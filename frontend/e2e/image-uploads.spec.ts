import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { writeFileSync, rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const bcrypt = require('../../backend/node_modules/bcrypt');
const sharp = require('../../backend/node_modules/sharp');
const { v2: cloudinary } = require('../../backend/node_modules/cloudinary');
const live = process.env.GDA_LIVE_MEDIA_TEST === '1';
test.skip(!live, 'Opt in to temporary real Cloudinary uploads with GDA_LIVE_MEDIA_TEST=1');
const db = new PrismaClient({ datasourceUrl: process.env.PHASE1_TEST_DATABASE_URL });
const tag = `uploads-${Date.now()}`, password = 'PreviewUploadPassword123!';
const users: Record<string, string> = {}, assets = new Set<string>();
const manifest = `/tmp/gda-${tag}-assets.json`;
function remember(publicId: string) {
  assets.add(publicId);
  writeFileSync(manifest, JSON.stringify([...assets]), { mode: 0o600 });
}
// Only synthetic pixels leave the workspace; never upload school photos in tests.
const file = `/tmp/gda-${tag}-synthetic.png`;
let oldSettings: any;
const panels = [
  { path: '/admin/content/announcements', type: 'ANNOUNCEMENT', add: 'Create content', text: 'Content' },
  { path: '/admin/content/stories', type: 'STORY', add: 'Create content', text: 'Content' },
  { path: '/admin/content/events', type: 'EVENT', add: 'Create content', text: 'Description' },
  { path: '/admin/content/history', type: 'HISTORY', add: 'Add milestone', text: 'Description' },
  { path: '/admin/content/leadership/school', type: 'SCHOOL_LEADER', add: 'Add leader', text: 'Short biography' },
  { path: '/admin/content/leadership/alumni', type: 'ALUMNI_LEADER', add: 'Add leader', text: 'Short biography' },
] as const;
function capture(url: string) {
  const match = new URL(url).pathname.match(/\/image\/upload\/(?:v\d+\/)?(gda-aims\/(?:content-images\/c[a-z0-9]{24}|profile-pictures)\/[0-9a-f-]{36})\.[a-z]+$/);
  if (!match) throw new Error('The provider returned an unexpected managed image URL');
  remember(match[1]!);
}
async function login(page: Page, role: string) {
  await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(`${tag}-${role.toLowerCase()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}
async function contentPhoto(page: Page, saveLabel: string) {
  await expect(page.getByRole('button', { name: 'Upload image file', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Upload image file', exact: true }).click();
  await page.getByLabel('Content image file (JPEG, PNG or WebP, maximum 5 MB)', { exact: true }).setInputFiles(file);
  await expect(page.getByAltText('Content image preview')).toHaveAttribute('src', /^blob:/);
  const uploaded = page.waitForResponse(response => response.request().method() === 'POST' && /\/api\/.+\/image$/.test(response.url()), { timeout: 30000 });
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  const response = await uploaded; expect(response.status(), 'The real multipart upload must succeed').toBe(200);
  const record = (await response.json()).data; capture(record.image);
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0);
  return record;
}
async function profilePhoto(page: Page, role: string) {
  await page.getByLabel('Upload image (JPEG, PNG or WebP, maximum 5 MB)', { exact: true }).setInputFiles(file);
  const uploaded = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/account/profile-image'), { timeout: 30000 });
  await page.getByRole('button', { name: 'Upload selected image', exact: true }).click();
  expect((await uploaded).status()).toBe(200);
  const profile = role === 'ALUMNI' ? await db.alumniProfile.findUniqueOrThrow({ where: { userId: users[role] } }) : await db.staffProfile.findUniqueOrThrow({ where: { userId: users[role] } });
  capture(profile.profileImage);
  await expect(page.getByAltText('Profile picture preview')).toHaveAttribute('src', profile.profileImage);
  await expect(page.getByAltText('Profile picture preview')).toBeVisible();
  return profile;
}

test.beforeAll(async () => {
  await sharp({ create: { width: 32, height: 32, channels: 3, background: '#4169e1' } }).png().toFile(file);
  cloudinary.config({ cloud_name: process.env.GDA_TEST_CLOUDINARY_CLOUD_NAME, api_key: process.env.GDA_TEST_CLOUDINARY_API_KEY, api_secret: process.env.GDA_TEST_CLOUDINARY_API_SECRET, secure: true });
  oldSettings = await db.platformSettings.findUnique({ where: { id: 1 } });
  await db.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, mediaEnabled: true }, update: { mediaEnabled: true } });
  const hash = await bcrypt.hash(password, 12);
  for (const role of ['ADMIN', 'SUPER_ADMIN', 'ALUMNI']) {
    const email = `${tag}-${role.toLowerCase()}@example.test`;
    users[role] = (await db.user.create({ data: { email, password: hash, role,
      ...(role === 'ALUMNI' ? { alumniProfile: { create: { fullName: 'Upload Test Alumnus', graduationYear: 2005, phone: '123456789' } }, membershipApplication: { create: { reference: `${tag}-member`, email, trackingHash: 'isolated-test', fullName: 'Upload Test Alumnus', phone: '123456789', graduationYear: 2005, status: 'APPROVED', activatedAt: new Date() } } } : { staffProfile: { create: { fullName: `Upload Test ${role}` } } })
    } })).id;
  }
});
test.afterAll(async () => {
  const ids = Object.values(users);
  const removed: string[] = [], failed: string[] = [];
  try {
    for (const record of await db.post.findMany({ where: { createdBy: { in: ids } }, select: { image: true } })) if (record.image) capture(record.image);
    for (const profile of [...await db.staffProfile.findMany({ where: { userId: { in: ids } } }), ...await db.alumniProfile.findMany({ where: { userId: { in: ids } } })]) if (profile.profileImagePublicId) remember(profile.profileImagePublicId);
    for (const publicId of assets) {
      let deleted = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
          if (!['ok', 'not found'].includes(result.result)) throw new Error('Cleanup rejected');
          deleted = true; break;
        } catch { await delay(500 * (attempt + 1)); }
      }
      if (deleted) removed.push(publicId);
      else { failed.push(publicId); await db.mediaCleanup.upsert({ where: { publicId }, create: { publicId }, update: {} }); }
    }
    writeFileSync(manifest, JSON.stringify(failed), { mode: 0o600 });
    expect(failed, `Temporary assets requiring cleanup are recorded in ${manifest}`).toEqual([]);
  } finally {
    await db.post.deleteMany({ where: { createdBy: { in: ids } } }); await db.mediaCleanup.deleteMany({ where: { publicId: { in: removed } } });
    await db.membershipApplication.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } });
    if (oldSettings) await db.platformSettings.update({ where: { id: 1 }, data: oldSettings }); else await db.platformSettings.deleteMany({ where: { id: 1 } });
    await db.$disconnect();
    rmSync(file, { force: true });
  }
});

test('Admin uploads and persists real images in every school-content panel; availability errors can be retried', async ({ page }) => {
  test.setTimeout(360000); await login(page, 'ADMIN');
  let failAvailability = true;
  await page.route('**/api/account/me', route => failAvailability ? route.fulfill({ status: 503, json: { success: false, message: 'Temporary availability outage', data: null } }) : route.continue());
  for (const panel of panels) {
    await page.goto(panel.path); await page.getByRole('button', { name: panel.add, exact: true }).click();
    if (panel.type === 'ANNOUNCEMENT') {
      await expect(page.getByRole('alert')).toContainText('Could not check image uploads.');
      failAvailability = false; await page.getByRole('button', { name: 'Refresh upload availability', exact: true }).click();
    }
    const leader = panel.type.endsWith('LEADER'), title = `${tag} ${panel.type}`;
    await page.getByLabel(leader ? 'Full name' : 'Title', { exact: true }).fill(title);
    await page.getByLabel(panel.text, { exact: true }).fill('Temporary isolated browser test record.');
    if (panel.type === 'EVENT') await page.getByLabel('Event date and start time').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    if (panel.type === 'HISTORY') await page.getByLabel('Year or date', { exact: true }).fill('2005');
    if (leader) await page.getByLabel('Position', { exact: true }).fill('Test position');
    const record = await contentPhoto(page, ['HISTORY', 'SCHOOL_LEADER', 'ALUMNI_LEADER'].includes(panel.type) ? 'Save draft' : 'Save content');
    const saved = await db.post.findUniqueOrThrow({ where: { id: record.id } }); expect(saved.image).toBe(record.image); expect(saved.isPublished).toBe(false);
  }
});

test('Alumni upload story photos and profile photos from both profile screens without losing unsaved text', async ({ page }) => {
  test.setTimeout(180000); await login(page, 'ALUMNI');
  await page.goto('/stories/mine'); await page.getByRole('button', { name: 'Submit a story', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(`${tag} Alumni story`); await page.getByLabel('Content', { exact: true }).fill('An isolated upload test story.');
  await contentPhoto(page, 'Save content');
  await page.goto('/profile'); await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Upload Test Alumnus');
  await page.getByLabel('Biography', { exact: true }).fill('Unsaved biography survives the independent photo upload.');
  const first = await profilePhoto(page, 'ALUMNI'); expect(first.imageVersion).toBe(1);
  await expect(page.getByLabel('Biography', { exact: true })).toHaveValue('Unsaved biography survives the independent photo upload.');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Profile saved.' })).toBeVisible();
  expect((await db.alumniProfile.findUniqueOrThrow({ where: { userId: users.ALUMNI } })).profileImage).toBe(first.profileImage);
  await page.goto('/account/settings'); const second = await profilePhoto(page, 'ALUMNI'); expect(second.imageVersion).toBe(2);
});

test('Admin and SuperAdmin upload their own account pictures through the existing role permissions', async ({ page }) => {
  test.setTimeout(120000);
  for (const role of ['ADMIN', 'SUPER_ADMIN']) { await login(page, role); await page.goto('/account/settings'); const profile = await profilePhoto(page, role); expect(profile.imageVersion).toBe(1); }
});
