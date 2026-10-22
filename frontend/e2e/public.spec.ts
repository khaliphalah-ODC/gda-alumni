import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: process.env.PHASE1_TEST_DATABASE_URL });
const tag = `public-${Date.now()}`;
let actorId: string;
test.beforeAll(async () => {
  actorId = (await prisma.user.create({ data: { email: `${tag}@example.test`, password: 'unusable-test-hash', role: 'ADMIN' } })).id;
  for (const type of ['ANNOUNCEMENT', 'STORY']) for (let index = 1; index <= 8; index++) {
    await prisma.post.create({ data: { title: `${tag} ${type === 'STORY' ? 'journey' : 'notice'} ${index}`, content: 'A published school-community update used only in an isolated local browser test. Read the full details to learn about this announcement or alumni journey.', type, createdBy: actorId, isPublished: true, publishedAt: new Date(Date.now() - index * 86400000), image: 'http://127.0.0.1:55741/images/home-documents.jpg' } });
  }
  await prisma.post.create({ data: { title: `${tag} private draft`, content: 'Must remain invisible to public visitors', type: 'STORY', createdBy: actorId } });
  for (const days of [-1, 1, 2, 40]) await prisma.post.create({ data: { title: `${tag} ${days < 0 ? 'past' : 'future'} event ${days}`, content: 'A dated event used only in the isolated test database.', type: 'EVENT', eventDate: new Date(Date.now() + days * 86400000), eventLocation: 'Test campus', eventTime: '10:00 AM', audience: 'Alumni', createdBy: actorId, isPublished: true, publishedAt: new Date() } });
});
test.afterAll(async () => { if (actorId) { await prisma.post.deleteMany({ where: { createdBy: actorId } }); await prisma.user.delete({ where: { id: actorId } }); } await prisma.$disconnect(); });

test('public lists search and paginate real publications, exclude drafts and open details', async ({ page }) => {
  await page.goto('/announcements'); await page.getByLabel('Search announcements', { exact: true }).fill(`${tag} notice`); await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('main article')).toHaveCount(3); await expect(page.getByRole('navigation', { name: 'Pagination', exact: true })).toContainText('8 results');
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await expect(page.locator('main article')).toHaveCount(3); await page.getByRole('link', { name: /Read More/ }).first().click(); await expect(page.locator('h1')).toContainText(tag);
  await page.goto('/stories'); await page.getByLabel('Search alumni stories', { exact: true }).fill(`${tag} journey 8`); await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('h1')).toContainText('journey 8'); await page.getByRole('link', { name: 'Read full story', exact: true }).click(); await expect(page.locator('h1')).toContainText('journey 8');
  await page.goto('/stories'); await page.getByLabel('Search alumni stories', { exact: true }).fill(`${tag} private draft`); await page.getByRole('button', { name: 'Search', exact: true }).click(); await expect(page.getByText('No published stories found.', { exact: true })).toBeVisible();
});
test('calendar toggles show actual upcoming events and retain working detail links', async ({ page }) => {
  await page.goto('/events'); await expect(page.locator('h3').filter({ hasText: tag })).toHaveCount(3); await expect(page.locator('main')).not.toContainText(`${tag} past event`);
  await page.getByRole('button', { name: 'Calendar View', exact: true }).click(); await expect(page.getByRole('button', { name: 'Calendar View', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: `${tag} future event 1`, exact: true }).click(); await expect(page.locator('h1')).toHaveText(`${tag} future event 1`);
});
test('failed public content requests show errors and can be retried', async ({ page }) => {
  let failed = true;
  await page.route('**/api/posts/announcements?*', route => failed ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Temporary test outage', data: null, pagination: null }) }) : route.continue());
  await page.goto('/announcements'); await expect(page.getByRole('alert')).toContainText('Temporary test outage'); failed = false;
  await page.getByRole('button', { name: 'Retry announcements' }).click(); await expect(page.locator('main article')).toHaveCount(3); await expect(page.getByRole('alert')).toHaveCount(0);
});
test('public pages fit six viewport widths and keep accessible controls', async ({ page }) => {
  test.setTimeout(360000);
  for (const width of [1440, 1280, 1024, 768, 390, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/about', '/announcements', '/stories', '/events', '/login', '/services', '/contact']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' }); await expect(page.locator('h1')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: `${route} fits ${width}px` }).toBe(true);
      if (width === 390 || width === 1440) {
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(results.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), `${route} at ${width}`).toEqual([]);
      }
    }
  }
});
