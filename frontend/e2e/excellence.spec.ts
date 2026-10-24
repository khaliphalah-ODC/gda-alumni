import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const heading = 'Excellence in Discipline & Academics';
async function open(page: Page) {
  const requests = new Set<string>();
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    requests.add(path);
    const anonymous = path.endsWith('/auth/me');
    await route.fulfill({ status: anonymous ? 401 : 200, contentType: 'application/json', body: JSON.stringify({ success: !anonymous, message: 'Browser fixture', data: path.includes('/chatbot/') ? { enabled: false } : [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }) });
  });
  await page.goto('/');
  const section = page.getByRole('region', { name: heading, exact: true });
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator('.excellence-card').first()).toHaveCSS('opacity', '1');
  if ((page.viewportSize()?.width ?? 0) >= 1024) await expect(section.locator('.excellence-card').nth(1)).toHaveCSS('opacity', '1');
  return { section, requests };
}

test('cards flip independently, transfer keyboard focus and expose only the active face', async ({ page }) => {
  const { section, requests } = await open(page);
  const cards = section.locator('.excellence-card');
  await expect(cards).toHaveCount(2);
  for (const card of await cards.all()) {
    await expect(card.locator('img')).toHaveAttribute('loading', 'lazy');
    await expect.poll(() => card.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(card.locator('.excellence-card-back')).toHaveAttribute('inert', '');
    expect(await card.locator('.excellence-card-back a').evaluate(el => (el as HTMLElement).tabIndex)).toBe(0); // Native inert suppresses focus without rewriting link semantics.
    expect(await card.locator('.excellence-card-back a').evaluate(el => { (el as HTMLElement).focus(); return document.activeElement === el; })).toBe(false);
  }
  const front = cards.nth(0).getByRole('button', { name: /Explore achievement:/ });
  await front.focus(); await page.keyboard.press('Enter');
  const back = cards.nth(0).getByRole('button', { name: /Flip back:/ });
  await expect(back).toBeFocused();
  await expect(cards.nth(0).locator('.excellence-card-rotor')).toHaveClass(/is-flipped/);
  await expect(cards.nth(1).locator('.excellence-card-rotor')).not.toHaveClass(/is-flipped/);
  await expect(cards.nth(0)).toContainText('29 participating schools');
  await expect(cards.nth(0).getByRole('link')).toHaveAttribute('href', 'https://mod.gov.lr/liberia-celebrates-170th-national-flag-day/');
  await expect(cards.nth(0).getByRole('link')).toHaveAttribute('target', '_blank');
  await expect(cards.nth(0).getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
  await page.context().route('https://mod.gov.lr/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Source check</title>' }));
  const sourcePage = page.waitForEvent('popup');
  await cards.nth(0).getByRole('link').click();
  const popup = await sourcePage;
  await expect(popup).toHaveURL('https://mod.gov.lr/liberia-celebrates-170th-national-flag-day/');
  await popup.close();
  await back.focus();
  await expect(cards.nth(0).locator('.excellence-card-front')).toHaveAttribute('inert', '');
  await page.keyboard.press('Space'); await expect(front).toBeFocused();
  await cards.nth(1).getByRole('button', { name: /Explore achievement:/ }).click();
  // Pause one native transition mid-flip for visual inspection, then resume it
  // before continuing the interaction checks.
  const rotor = cards.nth(1).locator('.excellence-card-rotor');
  const paused = await rotor.evaluate(el => {
    const animation = el.getAnimations()[0];
    if (!animation) return false;
    animation.pause(); animation.currentTime = 200;
    return true;
  });
  if (paused) {
    await cards.nth(1).screenshot({ path: '/tmp/gda-excellence-mid-flip.png', animations: 'allow' });
    await rotor.evaluate(el => el.getAnimations().forEach(animation => animation.play()));
  }
  await expect(cards.nth(1).getByRole('button', { name: /Flip back:/ })).toBeFocused();
  await expect(cards.nth(1).getByRole('link')).toHaveAttribute('href', 'https://www.facebook.com/modliberia/posts/1492531776241236/');
  await expect(cards.nth(1).locator('time')).toHaveText('September 2026');
  await expect(cards.nth(1)).toContainText('reported a 100% WASSCE pass rate');
  await cards.nth(1).getByRole('button', { name: /Flip back:/ }).click();
  await expect(section.getByRole('link', { name: /Explore School History/ })).toHaveAttribute('href', '/about#about-heading-history');
  for (const path of ['/api/posts/announcements', '/api/stories', '/api/events', '/api/history']) expect(requests.has(path), path).toBe(true);
  const result = await new AxeBuilder({ page }).include('[aria-labelledby="excellence-heading"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
});

test('both faces fit at all requested widths without clipping or overflow', async ({ page }) => {
  for (const width of [375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const { section } = await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px page overflow`).toBe(true);
    const cards = section.locator('.excellence-card');
    const first = await cards.nth(0).boundingBox(), second = await cards.nth(1).boundingBox();
    expect(first && second).toBeTruthy();
    if (width >= 1024) expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
    else expect(second!.y).toBeGreaterThan(first!.y + first!.height);
    for (const card of await cards.all()) {
      const front = card.locator('.excellence-card-front'), back = card.locator('.excellence-card-back');
      expect(await front.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      await card.getByRole('button', { name: /Explore achievement:/ }).click();
      expect(await back.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      await card.getByRole('button', { name: /Flip back:/ }).click();
    }
    if (width === 1440 || width === 375) await section.screenshot({ path: `/tmp/gda-excellence-${width}.png` });
  }
});

test('reduced motion replaces rotation with an immediate accessible state change', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { section } = await open(page), card = section.locator('.excellence-card').first();
  await card.getByRole('button', { name: /Explore achievement:/ }).click();
  await expect(card.locator('.excellence-card-rotor')).toHaveCSS('transform', 'none');
  await expect(card.locator('.excellence-card-rotor')).toHaveCSS('transition-duration', '0s');
  await expect(card.locator('.excellence-card-front')).toHaveCSS('visibility', 'hidden');
  await expect(card.locator('.excellence-card-back')).toHaveCSS('visibility', 'visible');
  await expect(card.getByRole('button', { name: /Flip back:/ })).toBeFocused();
  await section.screenshot({ path: '/tmp/gda-excellence-reduced-back.png' });
});

test('touch controls work without swipe conflicts or automatic flipping', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    const { section } = await open(page), card = section.locator('.excellence-card').first();
    await card.getByRole('button', { name: /Explore achievement:/ }).tap();
    await expect(card.locator('.excellence-card-rotor')).toHaveClass(/is-flipped/);
    await page.waitForTimeout(900);
    await expect(card.locator('.excellence-card-rotor')).toHaveClass(/is-flipped/);
    await card.getByRole('button', { name: /Flip back:/ }).tap();
    await expect(card.locator('.excellence-card-rotor')).not.toHaveClass(/is-flipped/);
  } finally { await context.close(); }
});
