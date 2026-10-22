import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const bcrypt = require('../../backend/node_modules/bcrypt');
const db = new PrismaClient({ datasourceUrl: process.env.PHASE1_TEST_DATABASE_URL });
const tag = `about-${Date.now()}`, password = 'AboutContentBrowser123';
let adminId: string, superId: string;
const groups = [
  { path: '/admin/content/history', kind: 'history', title: 'Verified milestone', heading: 'Our School History', extra: '1980', type: 'HISTORY', endpoint: '/api/history' },
  { path: '/admin/content/leadership/school', kind: 'school', title: 'School Leader', heading: 'School Leadership', extra: 'Principal', type: 'SCHOOL_LEADER', endpoint: '/api/leadership/school' },
  { path: '/admin/content/leadership/alumni', kind: 'alumni', title: 'Alumni Leader', heading: 'Alumni Leadership', extra: 'Association President', type: 'ALUMNI_LEADER', endpoint: '/api/leadership/alumni' },
] as const;

test.beforeAll(async () => {
  const hash = await bcrypt.hash(password, 12);
  adminId = (await db.user.create({ data: { email: `${tag}@example.test`, password: hash, role: 'ADMIN' } })).id;
  superId = (await db.user.create({ data: { email: `${tag}-super@example.test`, password: hash, role: 'SUPER_ADMIN' } })).id;
});
test.afterAll(async () => {
  if (adminId) await db.post.deleteMany({ where: { createdBy: adminId } });
  await db.user.deleteMany({ where: { id: { in: [adminId, superId].filter(Boolean) } } });
  await db.$disconnect();
});

test('Admin manages history and both leadership groups through draft, publication, review, unpublish and delete', async ({ page }) => {
  test.setTimeout(360000);
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(`${tag}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Manage History', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/history$/);
  for (const group of groups) {
    const title = `${tag} ${group.title}`;
    if (group.kind === 'school') await page.getByRole('link', { name: 'Manage Leadership', exact: true }).click();
    if (group.kind === 'alumni') await page.getByRole('navigation', { name: 'Leadership groups' }).getByRole('link', { name: 'Alumni leadership', exact: true }).click();
    await expect(page).toHaveURL(group.path);
    await page.getByRole('button', { name: group.kind === 'history' ? 'Add milestone' : 'Add leader', exact: true }).click();
    await page.getByLabel(group.kind === 'history' ? 'Title' : 'Full name', { exact: true }).fill(title);
    await page.getByLabel(group.kind === 'history' ? 'Year or date' : 'Position', { exact: true }).fill(group.extra);
    await page.getByLabel(group.kind === 'history' ? 'Description' : 'Short biography', { exact: true }).fill('Verified information for this section.');
    await page.getByLabel('Display order', { exact: true }).fill('7');
    if (group.kind !== 'history') {
      const width = group.kind === 'school' ? 1440 : 390;
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => item.id)).toEqual([]);
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();
    await page.goto('/about'); await expect(page.getByRole('heading', { name: 'Our School History', exact: true })).toBeVisible(); await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: group.heading, exact: true })).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await page.goto(group.path);
    let record = page.locator('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await record.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(record.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
    await page.goto('/about'); await expect(page.getByRole('heading', { name: 'Our School History', exact: true })).toBeVisible(); await expect(page.getByRole('status')).toHaveCount(0);
    const section = page.getByRole('region', { name: group.heading, exact: true });
    await expect(section.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(section).toContainText(group.extra);
    for (const other of groups.filter(item => item.kind !== group.kind)) await expect(page.getByRole('region', { name: other.heading, exact: true })).not.toContainText(title);
    await page.goto(group.path);
    record = page.locator('article').filter({ hasText: title });
    await record.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel(group.kind === 'history' ? 'Description' : 'Short biography', { exact: true }).fill('Changed information awaiting review.');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(record.getByText('Draft', { exact: true })).toBeVisible();
    await page.goto('/about'); await expect(page.getByRole('heading', { name: 'Our School History', exact: true })).toBeVisible(); await expect(page.getByRole('status')).toHaveCount(0); await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await page.goto(group.path);
    await record.getByRole('button', { name: 'Publish', exact: true }).click();
    await record.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await expect(record.getByText('Draft', { exact: true })).toBeVisible();
    await page.goto('/about'); await expect(page.getByRole('heading', { name: 'Our School History', exact: true })).toBeVisible(); await expect(page.getByRole('status')).toHaveCount(0); await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await page.goto(group.path);
    await record.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Record deleted.' })).toBeVisible();
    expect(await db.post.count({ where: { title, createdBy: adminId } })).toBe(0);
    if (group.kind === 'history') await page.getByRole('link', { name: 'Manage Leadership', exact: true }).click();
  }
});

test('a failed photo upload preserves one saved draft and can be retried using a URL', async ({ page }) => {
  await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(`${tag}@example.test`); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Log in', exact: true }).click(); await expect(page).toHaveURL(/\/admin$/);
  await page.route('**/api/account/me', async route => { const response = await route.fetch(); const body = await response.json(); body.data.media.enabled = true; await route.fulfill({ response, json: body }); });
  await page.goto('/admin/content/leadership/alumni'); await page.getByRole('button', { name: 'Add leader', exact: true }).click();
  const title = `${tag} Photo retry`;
  await page.getByLabel('Full name', { exact: true }).fill(title); await page.getByLabel('Position', { exact: true }).fill('Secretary'); await page.getByLabel('Short biography', { exact: true }).fill('Biography for a photo upload test.');
  const bytes = await require('../../backend/node_modules/sharp')({ create: { width: 5, height: 5, channels: 3, background: 'blue' } }).png().toBuffer();
  await page.getByRole('button', { name: 'Upload image file', exact: true }).click();
  await page.getByLabel('Content image file (JPEG, PNG or WebP, maximum 5 MB)', { exact: true }).setInputFiles({ name: 'leader.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.getByAltText('Content image preview')).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Image upload failed.');
  expect(await db.post.count({ where: { createdBy: adminId, title } })).toBe(1);
  await page.getByRole('button', { name: 'Image URL', exact: true }).click();
  const image = 'http://127.0.0.1:55741/images/home-documents.jpg';
  await page.getByLabel('Image URL (optional)', { exact: true }).fill(image);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();
  const saved = await db.post.findMany({ where: { createdBy: adminId, title } }); expect(saved).toHaveLength(1); expect(saved[0].image).toBe(image); expect(saved[0].isPublished).toBe(false);
});

test('About sections preserve ordering, paginate publications, fit mobile screens and expose accessible content', async ({ page }) => {
  const ids: string[] = [];
  try {
    for (let index = 12; index >= 0; index--) ids.push((await db.post.create({ data: { title: `${tag} Milestone ${index}`, content: 'School-verified milestone information.', type: 'HISTORY', milestoneDate: String(1980 + index), displayOrder: index, isPublished: true, createdBy: adminId } })).id);
    for (const group of groups.filter(item => item.kind !== 'history')) ids.push((await db.post.create({ data: { title: `${tag} ${group.title} Published`, content: 'A short biography approved for public display.', position: group.extra, type: group.type, displayOrder: 0, isPublished: true, image: 'http://127.0.0.1:55741/images/home-documents.jpg', createdBy: adminId } })).id);
    await page.goto('/about'); await expect(page.getByRole('heading', { name: 'Our School History', exact: true })).toBeVisible(); await expect(page.getByRole('status')).toHaveCount(0);
    const history = page.getByRole('region', { name: 'Our School History', exact: true });
    await expect(history.locator('li')).toHaveCount(12);
    await expect(history.locator('li h3').first()).toHaveText(`${tag} Milestone 0`);
    await history.getByRole('button', { name: 'Next', exact: true }).click(); await expect(history.locator('li')).toHaveCount(1); await expect(history).toContainText(`${tag} Milestone 12`);
    await history.getByRole('button', { name: 'Previous', exact: true }).click(); await expect(history.locator('li')).toHaveCount(12);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => item.id)).toEqual([]);
    }
  } finally { await db.post.deleteMany({ where: { id: { in: ids } } }); }
});

test('each public section reports an outage independently and supports retry', async ({ page }) => {
  let failing = true;
  await page.route('**/api/leadership/school?*', route => failing ? route.fulfill({ status: 503, json: { success: false, message: 'Temporary school leadership outage', data: null, pagination: null } }) : route.continue());
  await page.goto('/about'); await expect(page.getByRole('heading', { name: 'Our School History', exact: true })).toBeVisible(); await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Temporary school leadership outage');
  await expect(page.getByRole('region', { name: 'Alumni Leadership', exact: true }).getByText('Verified alumni leadership information', { exact: false })).toBeVisible();
  failing = false; await page.getByRole('button', { name: 'Retry school leadership', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('SuperAdmin retains platform access and cannot manage history or either leadership group', async ({ page }) => {
  await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(`${tag}-super@example.test`); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Log in', exact: true }).click(); await expect(page).toHaveURL(/\/super-admin$/);
  await expect(page.getByRole('link', { name: 'Manage History', exact: true })).toHaveCount(0); await expect(page.getByRole('link', { name: 'Manage Leadership', exact: true })).toHaveCount(0);
  for (const group of groups) {
    await page.goto(group.path); await expect(page).toHaveURL(/\/super-admin$/);
    const response = await page.request.post(group.endpoint, { headers: { 'X-GDA-CSRF': '1' }, data: {} }); expect(response.status()).toBe(403);
  }
});
