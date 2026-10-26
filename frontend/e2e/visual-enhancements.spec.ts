import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const db = new PrismaClient({ datasourceUrl: process.env.PHASE1_TEST_DATABASE_URL });
const tag = `visual-${Date.now()}`;
const artifactDirectory = '/tmp/gda-visual-validation';
let actorId: string, image: string;

test.beforeAll(async () => {
  mkdirSync(artifactDirectory, { recursive: true });
  const photo = readdirSync('dist/assets').find(name => /^image2-.*\.jpg$/.test(name));
  if (!photo) throw new Error('Build the authentic photo assets before testing');
  image = `http://127.0.0.1:55741/assets/${photo}`;
  actorId = (await db.user.create({ data: { email: `${tag}@example.test`, password: 'unusable-test-hash', role: 'ADMIN' } })).id;
  for (let index = 0; index < 6; index++) await db.post.create({ data: { title: `${tag} story ${index}`, content: 'Published alumni information from the isolated local test database.', type: 'STORY', createdBy: actorId, isPublished: true, publishedAt: new Date(Date.now() - index * 1000), image } });
  for (const days of [-20, -10, 10, 20, 30, 40, 50]) await db.post.create({ data: { title: `${tag} ${days < 0 ? 'past' : 'upcoming'} event ${days}`, content: 'A published event fixture with its actual recorded date.', type: 'EVENT', eventDate: new Date(Date.now() + days * 86400000), eventLocation: 'Test school', createdBy: actorId, isPublished: true, image } });
  for (const [milestoneDate, displayOrder] of [['2005', 0], ['1980', 5], ['1995-06-12', 9]] as const) await db.post.create({ data: { title: `${tag} milestone ${milestoneDate}`, content: `Verified description for ${milestoneDate}.`, type: 'HISTORY', milestoneDate, displayOrder, createdBy: actorId, isPublished: true, image } });
  await db.post.create({ data: { title: `${tag} unpublished`, content: 'Private event fixture.', type: 'EVENT', eventDate: new Date(0), createdBy: actorId } });
});
test.afterAll(async () => { if (actorId) { await db.post.deleteMany({ where: { createdBy: actorId } }); await db.user.delete({ where: { id: actorId } }); } await db.$disconnect(); });

test('hero supports arrows, pagination, keyboard, opt-in autoplay, focus pause and real mobile swipes', async ({ page, browser }) => {
  await page.goto('/');
  await expect(page.locator('.hero-carousel')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play slideshow', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Next school photograph', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show Flags on parade', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Previous school photograph', exact: true }).press('ArrowLeft');
  await expect(page.getByRole('button', { name: 'Show School community', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Show School community', exact: true }).click();
  await page.getByRole('button', { name: 'Play slideshow', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause slideshow', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Show Flags on parade', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 12000 });
  await page.getByRole('link', { name: 'JOIN ALUMNI NETWORK' }).focus();
  await expect(page.getByRole('button', { name: 'Play slideshow', exact: true })).toBeVisible();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await context.newPage();
  await mobile.goto('/');
  const session = await context.newCDPSession(mobile);
  const bounds = await mobile.locator('.hero-photographs').boundingBox();
  if (!bounds) throw new Error('Hero has no bounds');
  // Swipe the photograph, above the overlaid links and controls. Their positions
  // change when the app name wraps on mobile.
  const y = bounds.y + 40, startX = bounds.x + bounds.width - 40, endX = bounds.x + 40;
  expect(await mobile.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.hero-photographs'), { x: startX, y })).toBe(true);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
  for (const fraction of [0.2, 0.4, 0.6, 0.8, 1]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX + (endX - startX) * fraction, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(mobile.getByRole('button', { name: 'Show Flags on parade', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await context.close();
});

test('gallery filters, previews full images, traps focus, supports keyboard navigation and restores focus', async ({ page }) => {
  await page.goto('/gallery');
  const filter = page.getByRole('button', { name: 'Graduation', exact: true });
  await filter.click();
  await expect(page.getByRole('button', { name: /^Preview / })).toHaveCount(2);
  const trigger = page.getByRole('button', { name: 'Preview Graduates together', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'School photograph preview', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close photograph preview', exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('ArrowRight');
  await expect(dialog.locator('.swiper-slide-active figcaption')).toHaveText('A graduation gathering');
  expect(await dialog.locator('.swiper-slide-active img').evaluate(img => getComputedStyle(img).objectFit)).toBe('contain');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await page.getByRole('button', { name: 'Preview A graduation gathering', exact: true }).click();
  await expect(dialog.locator('.swiper-slide-active figcaption')).toHaveText('A graduation gathering');
  await page.getByRole('button', { name: 'Close photograph preview', exact: true }).click();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
});

test('published stories, milestones and past events use real API data and preserve managed image URLs', async ({ page }) => {
  await page.goto('/');
  const stories = page.getByRole('region', { name: 'alumni stories', exact: true });
  await expect(stories.locator('.swiper-slide')).toHaveCount(6);
  await stories.scrollIntoViewIfNeeded();
  const slidesBox = await stories.locator('.swiper-wrapper').boundingBox();
  const nextBox = await stories.getByRole('button', { name: 'Next alumni stories', exact: true }).boundingBox();
  expect(slidesBox && nextBox && nextBox.y >= slidesBox.y + slidesBox.height).toBe(true);
  await stories.getByRole('button', { name: 'Next alumni stories', exact: true }).click();
  await expect(stories.locator('.swiper-slide-active')).toContainText(`${tag} story 1`);
  const achievements = page.getByRole('region', { name: 'school milestones', exact: true });
  await expect(achievements.locator('.swiper-slide')).toHaveCount(3);
  const flip = achievements.locator('article').filter({ has: page.getByRole('heading', { name: `${tag} milestone 1980`, exact: true }) }).getByRole('button');
  await flip.click(); await expect(flip).toHaveAttribute('aria-expanded', 'true');
  await expect(achievements.getByText('Verified description for 1980.', { exact: true })).toBeVisible();
  await achievements.getByRole('link', { name: 'View school history', exact: true }).click();
  await expect(page).toHaveURL(/\/about#about-heading-history$/);
  const timeline = page.getByRole('region', { name: 'Our School History', exact: true });
  await expect(timeline.locator('time')).toHaveText(['1980', '1995-06-12', '2005']);
  await timeline.locator('li').first().scrollIntoViewIfNeeded();
  await expect.poll(() => timeline.locator('.motion-card').first().evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  await expect(timeline.locator('img').first()).toHaveAttribute('src', image);
  await page.goto('/events');
  await page.getByLabel('Event dates', { exact: true }).selectOption('past');
  await page.getByRole('button', { name: 'Carousel View', exact: true }).click();
  const events = page.getByRole('region', { name: 'past published events', exact: true });
  await expect(events.locator('.swiper-slide')).toHaveCount(2);
  await expect(events).toContainText(`${tag} past event`);
  await expect(page.locator('main')).not.toContainText(`${tag} unpublished`);
  await expect(events.locator('img').first()).toHaveAttribute('src', image);
  await page.getByLabel('Search events', { exact: true }).fill(`${tag} past event -10`);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(events.locator('.swiper-slide')).toHaveCount(1);
  await events.getByRole('link', { name: /View Details/ }).click();
  await expect(page.locator('h1')).toHaveText(`${tag} past event -10`);
});

test('reduced motion disables autoplay, carousel transitions, card movement and flips', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Slideshow paused for reduced motion', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Next school photograph', exact: true }).click();
  expect(await page.locator('.hero-photographs .swiper-wrapper').evaluate(el => el.style.transitionDuration)).toMatch(/^(0ms|)$/);
  const card = page.getByRole('region', { name: 'school milestones', exact: true }).locator('.motion-card').first();
  await card.scrollIntoViewIfNeeded();
  expect(await card.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  const flip = page.getByRole('region', { name: 'school milestones', exact: true }).locator('article').filter({ has: page.getByRole('heading', { name: `${tag} milestone 1980`, exact: true }) }).getByRole('button');
  await flip.click(); await expect(flip).toHaveAttribute('aria-expanded', 'true');
  expect(await page.locator('.achievement-faces').first().evaluate(el => getComputedStyle(el).transform)).toBe('none');
});

test('updated pages fit all six widths, load authentic assets and have no JavaScript errors', async ({ page }) => {
  test.setTimeout(480000);
  const errors: string[] = [], failedAssets: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('status of 401')) errors.push(`${message.text()} (${message.location().url})`); });
  page.on('response', response => { if (response.status() >= 400 && response.status() !== 401) failedAssets.push(`${response.status()} ${response.url()}`); });
  for (const width of [375, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/about', '/stories', '/events', '/gallery', '/services', '/login', '/register']) {
      await page.goto(route); await expect(page.locator('h1')).toBeVisible();
      expect(failedAssets, `Resources while opening ${route} at ${width}px`).toEqual([]);
      expect(errors, `Console while opening ${route} at ${width}px`).toEqual([]);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: `${route} fits ${width}px` }).toBe(true);
      expect(await page.locator('main img[src*="/images/"]').count(), `${route} has no old static illustrations`).toBe(0);
      if ((width === 390 || width === 1440) && ['/', '/about', '/gallery'].includes(route)) {
        // Reveal scroll entrances and load below-the-fold photos before inspection.
        await page.locator('main').evaluate(async () => {
          const delay = () => new Promise(resolve => setTimeout(resolve, 100));
          for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight * 0.8) { window.scrollTo(0, top); await delay(); }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(450);
        await page.screenshot({ path: `${artifactDirectory}/${route === '/' ? 'home' : route.slice(1)}-${width}.png`, fullPage: true });
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(result.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })), `${route} at ${width}`).toEqual([]);
      }
    }
  }
  expect(errors).toEqual([]); expect(failedAssets).toEqual([]);
});


test('hero and footer remain readable in light and dark system themes', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme }); await page.goto('/');
      await expect(page.locator('h1')).toBeVisible();
      const footer = page.locator('.site-footer'); await footer.scrollIntoViewIfNeeded();
      const result = await new AxeBuilder({ page }).include('.site-footer').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations.map(item => item.id), `Footer in ${colorScheme} at ${width}px`).toEqual([]);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${artifactDirectory}/home-overlay-${colorScheme}-${width}.png`, fullPage: true });
    }
  }
});
