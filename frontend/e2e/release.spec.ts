import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync, rmSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const bcrypt = require('../../backend/node_modules/bcrypt');
const sharp = require('../../backend/node_modules/sharp');
const url = new URL(process.env.PHASE1_TEST_DATABASE_URL || 'postgresql://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use the isolated local test database');
const db = new PrismaClient({ datasourceUrl: url.href });
const tag = `release-browser-${Date.now()}`, email = `${tag}@example.test`, password = 'ReleaseBrowser123!', replacement = 'RecoveredBrowser456!';
let actorId: string, previous: any, pixels: Buffer;
async function login(page: Page, value = password) {
  await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(value); await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
test.beforeAll(async () => {
  previous = await db.platformSettings.findUnique({ where: { id: 1 } });
  await db.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, emailEnabled: true, mediaEnabled: true }, update: { emailEnabled: true, mediaEnabled: true, galleryManaged: false, achievementsManaged: false } });
  actorId = (await db.user.create({ data: { email, role: 'ADMIN', password: await bcrypt.hash(password, 4) } })).id;
  pixels = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#4169e1' } }).png().toBuffer();
});
test.afterAll(async () => {
  if (actorId) {
    await db.accountToken.deleteMany({ where: { userId: actorId } }); await db.post.deleteMany({ where: { createdBy: actorId } });
    await db.auditRecord.deleteMany({ where: { actorId } }); await db.user.delete({ where: { id: actorId } });
  }
  if (previous) await db.platformSettings.update({ where: { id: 1 }, data: previous }); else await db.platformSettings.deleteMany();
  await db.$disconnect();
  for (const path of [process.env.GDA_TEST_OUTBOX, process.env.GDA_TEST_UPLOAD_DIR]) if (path?.startsWith('/tmp/gda-release-')) rmSync(path, { recursive: true, force: true });
});

test('forgotten-password email link works once and ends existing browser sessions', async ({ page, browser }) => {
  await login(page);
  const context = await browser.newContext(), recovery = await context.newPage();
  try {
    await recovery.goto('http://127.0.0.1:55751/forgot-password');
    await recovery.getByLabel('Email address', { exact: true }).fill(email); await recovery.getByRole('button', { name: 'Send reset link', exact: true }).click();
    await expect(recovery.getByRole('status').filter({ hasText: 'If an eligible account' })).toBeVisible();
    let token = '';
    await expect.poll(() => {
      try { token = readFileSync(process.env.GDA_TEST_OUTBOX!, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)).find(message => message.to === email && message.text.includes('/reset-password#'))?.text.match(/token=([a-f0-9]{64})/)?.[1] || ''; } catch { /* delivery still pending */ }
      return token.length;
    }).toBe(64);
    await recovery.goto(`http://127.0.0.1:55751/reset-password#token=${token}`);
    await expect(recovery).toHaveURL('http://127.0.0.1:55751/reset-password');
    await recovery.getByLabel('New password', { exact: true }).fill(replacement); await recovery.getByLabel('Confirm new password', { exact: true }).fill(replacement);
    await recovery.getByRole('button', { name: 'Reset password', exact: true }).click();
    await expect(recovery.getByRole('status').filter({ hasText: 'Password reset.' })).toBeVisible();
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);
    await login(page, replacement);
    await recovery.goto(`http://127.0.0.1:55751/reset-password#token=${token}`);
    await recovery.getByLabel('New password', { exact: true }).fill(password); await recovery.getByLabel('Confirm new password', { exact: true }).fill(password);
    await recovery.getByRole('button', { name: 'Reset password', exact: true }).click(); await expect(recovery.getByRole('alert')).toBeVisible();
  } finally { await context.close(); }
});

test('announcement and event category controls filter real published database records', async ({ page }) => {
  for (const [type, categories] of [['ANNOUNCEMENT', ['Academic', 'Alumni']], ['EVENT', ['Sports', 'Ceremony']]] as const) {
    for (const category of categories) await db.post.create({ data: { type, title: `${tag} ${category}`, content: 'Published category fixture', category, createdBy: actorId, isPublished: true, publishedAt: new Date(), ...(type === 'EVENT' ? { eventDate: new Date('2099-06-01') } : {}) } });
  }
  await page.goto('/announcements'); await page.getByRole('button', { name: 'Academic', exact: true }).click();
  await expect(page.getByRole('heading', { name: `${tag} Academic`, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: `${tag} Alumni`, exact: true })).toHaveCount(0);
  await page.goto('/events'); await page.getByLabel('Event category', { exact: true }).selectOption('Sports');
  await expect(page.getByRole('heading', { name: `${tag} Sports`, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: `${tag} Ceremony`, exact: true })).toHaveCount(0);
});

for (const kind of ['gallery', 'achievements'] as const) test(`Admin uploads, publishes and edits ${kind}; public pages read the saved collection`, async ({ page, browser }) => {
  await login(page, replacement); await page.goto(`/admin/content/${kind}`);
  await page.getByRole('button', { name: kind === 'gallery' ? 'Add photograph' : 'Add achievement', exact: true }).click();
  const title = `${tag} ${kind}`;
  await page.getByLabel(kind === 'gallery' ? 'Photograph title' : 'Card title', { exact: true }).fill(title);
  await page.getByLabel('Image alternative text', { exact: true }).fill(`Synthetic ${kind} test image`);
  await page.getByLabel('Photo caption (optional)', { exact: true }).fill(title);
  if (kind === 'achievements') {
    for (const [label, value] of [['Front description', 'Verified browser achievement'], ['Achievement heading', 'Browser fixture award'], ['Achievement details', 'Database-backed achievement details'], ['Achievement date (YYYY, YYYY-MM or YYYY-MM-DD)', '2026-09-01'], ['Source URL (HTTPS)', 'https://example.test/source'], ['Source label', 'Browser fixture source']]) await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByRole('button', { name: 'Upload image file', exact: true }).click();
  await page.getByLabel('Content image file (JPEG, PNG or WebP, maximum 5 MB)', { exact: true }).setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: pixels });
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();
  const article = page.locator('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await article.getByRole('button', { name: 'Publish', exact: true }).click(); await expect(article).toContainText('Published');
  const context = await browser.newContext(), publicPage = await context.newPage();
  try {
    await publicPage.goto(`http://127.0.0.1:55751/${kind === 'gallery' ? 'gallery' : ''}`);
    if (kind === 'gallery') {
      await publicPage.getByRole('button', { name: `Preview ${title}`, exact: true }).click(); await expect(publicPage.getByRole('dialog', { name: 'School photograph preview' })).toBeVisible();
    } else await expect(publicPage.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const image = publicPage.getByAltText(`Synthetic ${kind} test image`).first(); await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    await article.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel(kind === 'gallery' ? 'Photograph title' : 'Card title', { exact: true }).fill(title + ' edited');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();
    await publicPage.reload(); await expect(publicPage.getByText(kind === 'gallery' ? 'No gallery photographs are published.' : 'No featured achievements are published.', { exact: true })).toBeVisible();
  } finally { await context.close(); }
});
