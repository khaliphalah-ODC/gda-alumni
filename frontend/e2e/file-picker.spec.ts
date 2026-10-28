import { test, expect, type Page } from '@playwright/test';

const photo = {
  name: 'selected-photo.png', mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'),
};

async function mockAccount(page: Page, role = 'ADMIN', enabled = true) {
  const user = { id: 'picker-fixture', email: 'picker@example.test', role, profileImage: null };
  const profile = { fullName: 'Photo picker fixture', graduationYear: 2005, imageVersion: 0, profileImage: null };
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    // File selection must not submit a form or contact real storage.
    expect(route.request().method()).toBe('GET');
    const data = path === '/api/auth/me' ? user
      : path === '/api/account/me' ? { ...user, profile, media: { enabled, maxBytes: 5242880, unavailableReason: enabled ? null : 'Uploads are disabled for this fixture.' } }
      : path === '/api/alumni/profile' ? profile
      : ['/api/gallery', '/api/achievements'].includes(path) ? { items: [], managed: false } : [];
    await route.fulfill({ json: { success: true, data, pagination: { page: 1, total: 0, totalPages: 0, limit: 12 } } });
  });
}

const panels = [
  ['announcements', 'Create content'], ['stories', 'Create content'], ['events', 'Create content'],
  ['history', 'Add milestone'], ['leadership/school', 'Add leader'], ['leadership/alumni', 'Add leader'],
  ['gallery', 'Add photograph'], ['achievements', 'Add achievement'],
] as const;

for (const [panel, create] of panels) test(`${panel}: Upload image file directly opens the system chooser`, async ({ page }) => {
  await mockAccount(page);
  await page.goto(`/admin/content/${panel}`);
  await page.getByRole('button', { name: create, exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload image file', exact: true }).click();
  await (await chooser).setFiles(photo);
  await expect(page.getByAltText('Content image preview')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('#content-image-file')).toHaveValue(/selected-photo\.png$/);
  // Opening again and cancelling keeps the selected photo and preview.
  const nextChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload image file', exact: true }).click();
  await nextChooser;
  await expect(page.locator('#content-image-file')).toHaveValue(/selected-photo\.png$/);
  await expect(page.getByAltText('Content image preview')).toHaveAttribute('src', /^blob:/);
});

for (const role of ['ADMIN', 'SUPER_ADMIN', 'ALUMNI']) test(`${role}: Choose photo opens the account file chooser`, async ({ page }) => {
  await mockAccount(page, role);
  await page.goto('/account/settings');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo', exact: true }).click();
  await (await chooser).setFiles(photo);
  await expect(page.getByAltText('Profile picture preview')).toHaveAttribute('src', /^blob:/);
  await expect(page.getByRole('button', { name: 'Upload selected image', exact: true })).toBeEnabled();
});

test('alumni profile chooser works by keyboard while uploads are disabled', async ({ page }) => {
  await mockAccount(page, 'ALUMNI', false);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Choose photo', exact: true }).focus();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooser).setFiles(photo);
  await expect(page.getByAltText('Profile picture preview')).toHaveAttribute('src', /^blob:/);
  await expect(page.getByRole('button', { name: 'Upload selected image', exact: true })).toBeDisabled();
});

test('alumni story chooser opens on touch even when uploads are disabled', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await mockAccount(page, 'ALUMNI', false);
    await page.goto('http://127.0.0.1:55748/stories/mine');
    await page.getByRole('button', { name: 'Submit a story', exact: true }).tap();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload image file', exact: true }).tap();
    await (await chooser).setFiles(photo);
    await expect(page.getByAltText('Content image preview')).toHaveAttribute('src', /^blob:/);
  } finally { await context.close(); }
});
