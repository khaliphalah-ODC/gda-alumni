import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const bcrypt = require('../../backend/node_modules/bcrypt');
test('all content forms preview files, preserve drafts after upload failure and save image URLs without duplicates', async ({ page }) => {
  const db = new PrismaClient({ datasourceUrl: process.env.PHASE1_TEST_DATABASE_URL });
  const email = `content-images-${Date.now()}@example.test`, password = 'ContentImageBrowser123'; let actorId: string | undefined;
  try {
    actorId = (await db.user.create({ data: { email, password: await bcrypt.hash(password, 12), role: 'ADMIN' } })).id;
    await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Log in', exact: true }).click(); await expect(page).toHaveURL(/\/admin$/);
    // Expose the selector for the browser test only. The real upload API remains
    // disabled, so it must return its real 503 and never contact Cloudinary.
    await page.route('**/api/account/me', async route => { const response = await route.fetch(); const body = await response.json(); body.data.media.enabled = true; await route.fulfill({ response, json: body }); });
    const bytes = await require('../../backend/node_modules/sharp')({ create: { width: 5, height: 5, channels: 3, background: 'blue' } }).png().toBuffer();
    const imageUrl = 'https://images.example/content.png'; await page.route(imageUrl, route => route.fulfill({ status: 200, contentType: 'image/png', body: bytes }));
    for (const kind of ['announcements', 'stories', 'events']) {
      const title = `Browser uploaded ${kind} ${Date.now()}`;
      await page.goto(`/admin/content/${kind}`); await page.getByRole('button', { name: 'Create content', exact: true }).click();
      await page.getByLabel('Title', { exact: true }).fill(title); await page.getByLabel(kind === 'events' ? 'Description' : 'Content', { exact: true }).fill('Image workflow verified with a real saved draft.');
      if (kind === 'events') await page.getByLabel('Event date and start time').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
      await page.getByRole('button', { name: 'Upload image file', exact: true }).click(); await page.getByLabel('Content image file (JPEG, PNG or WebP, maximum 5 MB)', { exact: true }).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: bytes });
      await expect(page.getByAltText('Content image preview')).toHaveAttribute('src', /^blob:/);
      await expect(page.getByLabel('Content image file (JPEG, PNG or WebP, maximum 5 MB)', { exact: true })).toHaveValue(/photo\.png$/);
      await page.getByRole('button', { name: 'Save content', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Image upload failed.');
      await expect(page.getByRole('status').filter({ hasText: 'Your content was saved.' })).toBeVisible();
      expect(await db.post.count({ where: { createdBy: actorId, title } })).toBe(1);
      await page.getByRole('button', { name: 'Image URL', exact: true }).click(); await page.getByLabel('Image URL (optional)', { exact: true }).fill(imageUrl);
      await page.getByRole('button', { name: 'Save content', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Content saved.' })).toBeVisible();
      const records = await db.post.findMany({ where: { createdBy: actorId, title } }); expect(records).toHaveLength(1); expect(records[0].image).toBe(imageUrl);
    }
  } finally { if (actorId) { await db.post.deleteMany({ where: { createdBy: actorId } }); await db.user.delete({ where: { id: actorId } }); } await db.$disconnect(); }
});
