import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = process.env.GDA_HOSTED_API_URL!.replace(/\/$/, '');
test('deployed database readiness, frontend API proxy and anonymous permissions', async ({ page, request }) => {
  for (const path of ['/api/ready', '/api/gallery?scope=public', '/api/achievements?scope=public', '/api/events?scope=public&category=Sports', '/api/posts/announcements?scope=public&category=Academic']) {
    const response = await request.get(api + path); expect(response.status(), path).toBe(200); expect(response.headers()['content-type']).toContain('application/json');
  }
  expect((await request.get(api + '/api/account/me')).status()).toBe(401);
  await page.goto('/announcements'); await expect(page.getByRole('heading', { name: 'Official Announcements' })).toBeVisible();
  const filtered = page.waitForResponse(response => response.url().includes('/api/posts/announcements') && response.url().includes('category=Academic'));
  await page.getByRole('button', { name: 'Academic', exact: true }).click(); expect((await filtered).status()).toBe(200);
  await page.goto('/events'); await expect(page.getByLabel('Event category', { exact: true })).toBeVisible();
  await page.goto('/forgot-password'); await expect(page.getByRole('button', { name: 'Send reset link', exact: true })).toBeVisible();
  await page.goto('/gallery'); await expect(page.getByRole('region', { name: 'School photo gallery' })).toBeVisible();
  await expect(page.getByText('Loading school photographs…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry gallery', exact: true })).toHaveCount(0);
  for (const image of await page.locator('section[aria-label="School photo gallery"] img').all()) {
    await image.scrollIntoViewIfNeeded(); await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  }
});

test('hosted multipart upload persists and is removed from an explicitly designated test account', async ({ page }) => {
  test.skip(process.env.GDA_HOSTED_TEST_ALLOW_WRITES !== '1', 'Requires an explicitly designated, empty staging test account');
  const email = process.env.GDA_HOSTED_TEST_EMAIL || '', password = process.env.GDA_HOSTED_TEST_PASSWORD || '';
  if (!/^e2e-[^@]+@/.test(email) || !password) throw new Error('Use GDA_HOSTED_TEST_EMAIL beginning e2e- and its password for a staging test account');
  await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click(); await expect(page).not.toHaveURL(/\/login(?:\?|$)/); await page.goto('/account/settings');
  // Refuse to overwrite an existing profile image; all requests use the browser's
  // same-origin cookie and frontend proxy so CORS/cookie deployment faults surface.
  const before = await page.request.get('/api/account/me'); expect(before.status()).toBe(200);
  const data = (await before.json()).data, profile = data.profile;
  if (!profile || profile.profileImage) throw new Error('The staging fixture must have an empty profile image');
  let uploaded = false;
  try {
    const bytes = await require('../../backend/node_modules/sharp')({ create: { width: 32, height: 32, channels: 3, background: '#4169e1' } }).png().toBuffer();
    const result = await page.request.post('/api/account/profile-image', { headers: { 'X-GDA-CSRF': '1' }, multipart: { version: String(profile.imageVersion), image: { name: 'synthetic.png', mimeType: 'image/png', buffer: bytes } } });
    expect(result.status()).toBe(200); uploaded = true;
    await page.reload(); const image = page.getByAltText('Profile picture preview'); await expect(image).toHaveAttribute('src', /^https:\/\//);
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  } finally {
    if (uploaded) {
      const current = (await (await page.request.get('/api/account/me')).json()).data.profile;
      const removed = await page.request.delete('/api/account/profile-image', { headers: { 'X-GDA-CSRF': '1' }, data: { version: current.imageVersion } }); expect(removed.status()).toBe(200);
    }
  }
});
