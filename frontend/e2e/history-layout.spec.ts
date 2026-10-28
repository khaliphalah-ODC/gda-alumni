import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('school history stays in two compact columns on phones and expands without clipping', async ({ page }) => {
  const content = 'Verified school history with the complete account available to readers. '.repeat(20);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const anonymous = path.endsWith('/auth/me');
    const records = path === '/api/history' ? Array.from({ length: 4 }, (_, index) => ({
      id: `history-${index}`, title: index === 0 ? 'A milestone in our school community' : `School milestone ${index}`,
      milestoneDate: String(1980 + index), content, image: '/images/home-documents.jpg',
    })) : path.includes('/chatbot/') ? { enabled: false } : [];
    await route.fulfill({ status: anonymous ? 401 : 200, json: { success: !anonymous, data: records, pagination: null } });
  });
  await page.goto('/about');
  const history = page.getByRole('region', { name: 'Our School History', exact: true });
  await expect(history.locator('li')).toHaveCount(4);
  await history.scrollIntoViewIfNeeded();
  await expect(history.locator('time')).toHaveText(['1980', '1981', '1982', '1983']);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const cards = history.locator('li');
    const first = (await cards.nth(0).boundingBox())!, second = (await cards.nth(1).boundingBox())!;
    expect(Math.abs(first.y - second.y), `${width}px: same row`).toBeLessThan(2);
    expect(second.x).toBeGreaterThan(first.x + first.width);
    const line = await history.locator('ol').evaluate(el => {
      const style = getComputedStyle(el, '::before');
      return { width: parseFloat(style.width), height: parseFloat(style.height), center: parseFloat(style.left) + el.getBoundingClientRect().x, background: style.backgroundColor };
    });
    expect(line.width).toBe(2);
    expect(line.height).toBeGreaterThan(first.height);
    expect(line.center).toBeGreaterThan(first.x + first.width);
    expect(line.center).toBeLessThan(second.x);
    expect(line.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(first.width).toBeLessThanOrEqual(440);
    expect(first.height).toBeLessThan(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const button = cards.first().getByRole('button');
    await button.focus(); await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const description = cards.first().locator('p');
    await expect(description).toHaveText(content.trim());
    expect(await description.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    if (width === 375) await history.screenshot({ path: '/tmp/gda-history-mobile.png' });
  }
  expect((await new AxeBuilder({ page }).include('[aria-labelledby="about-heading-history"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});
