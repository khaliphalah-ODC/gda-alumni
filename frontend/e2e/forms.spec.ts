import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const bcrypt = require('../../backend/node_modules/bcrypt');
const db = new PrismaClient({ datasourceUrl: process.env.PHASE1_TEST_DATABASE_URL });
const tag = `forms-${Date.now()}`, password = 'FormsBrowserPassword123';
let memberId: string, requestId: string;
test.beforeAll(async () => {
 const member = await db.user.create({ data: { email: `${tag}@example.test`, password: await bcrypt.hash(password, 12), role: 'ALUMNI', alumniProfile: { create: { fullName: 'Reference Test Alumni', graduationYear: 2005, phone: '123456789', occupation: 'Engineer' } }, membershipApplication: { create: { email: `${tag}@example.test`, reference: tag, trackingHash: 'isolated-fixture', fullName: 'Reference Test Alumni', phone: '123456789', graduationYear: 2005, status: 'APPROVED', activatedAt: new Date() } } } });
 memberId = member.id;
 requestId = (await db.request.create({ data: { requestedBy: memberId, requestType: 'TRANSCRIPT', purpose: 'Reference tracking verification', fullNameAtGraduation: 'Reference Test Alumni', contactPhone: '123456789' } })).id;
 for (let i = 1; i <= 6; i++) await db.post.create({ data: { title: `${tag} achievement ${i}`, content: 'An alumni journey published only in the isolated test database. This is not a real school member or institutional claim.', type: 'STORY', createdBy: memberId, image: '/images/home-documents.jpg', isPublished: true, publishedAt: new Date(Date.now() - i * 1000) } });
 await db.post.create({ data: { title: `${tag} community event`, content: 'Future published event for real API verification.', type: 'EVENT', createdBy: memberId, isPublished: true, publishedAt: new Date(), eventDate: new Date(Date.now() + 86400000), eventLocation: 'Test campus' } });
});
test.afterAll(async () => {
 if (memberId) { await db.request.deleteMany({ where: { requestedBy: memberId } }); await db.post.deleteMany({ where: { createdBy: memberId } }); await db.membershipApplication.deleteMany({ where: { userId: memberId } }); await db.user.delete({ where: { id: memberId } }); }
 await db.$disconnect();
});
async function login(page: import('@playwright/test').Page) {
 await page.getByLabel('Email address', { exact: true }).fill(`${tag}@example.test`); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Log in', exact: true }).click();
}
test('services tracking restores the private request after login; document shortcuts preselect and submit real requests', async ({ page }) => {
 await page.goto('/services'); await expect(page.getByRole('link', { name: new RegExp(`${tag} community event`) })).toBeVisible();
 await page.getByLabel('Document tracking ID', { exact: true }).fill(requestId); await page.getByRole('button', { name: 'TRACK STATUS', exact: true }).click(); await expect(page).toHaveURL(/\/login\?redirect=/); await login(page);
 await expect(page).toHaveURL(new RegExp(`/requests\\?request=${requestId}$`)); await expect(page.getByText('Reference tracking verification', { exact: true })).toBeVisible();
 await page.goto('/services'); await page.getByRole('link', { name: 'Request WASSCE certificate', exact: true }).click(); await expect(page.getByLabel('Request Type', { exact: true })).toHaveValue('WASSCE_CERTIFICATE');
 await expect(page.getByLabel('Full Name at Graduation', { exact: true })).toHaveValue('Reference Test Alumni'); await expect(page.getByLabel('Contact Phone', { exact: true })).toHaveValue('123456789');
 await page.getByLabel('Purpose of Request', { exact: true }).fill('Forms reference document verification'); await page.getByRole('button', { name: 'Submit Document Request', exact: true }).click(); await page.getByRole('link', { name: 'View submitted request' }).click(); await expect(page.getByText('Forms reference document verification', { exact: true })).toBeVisible();
});

test('registration, login, services, stories and requests fit mobile and desktop with accessible controls', async ({ page }) => {
 test.setTimeout(360000);
 for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const path of ['/register', '/login', '/services', '/stories', '/requests/new']) {
   if (path === '/requests/new') { await page.goto('/login'); await login(page); await expect(page).toHaveURL(/\/dashboard$/); }
   await page.goto(path); await expect(page.locator('h1')).toBeVisible(); await expect(page.getByRole('status')).toHaveCount(0); await expect(page.getByRole('alert')).toHaveCount(0);
   if (path === '/requests/new') await expect(page.getByLabel('Full Name at Graduation', { exact: true })).toHaveValue('Reference Test Alumni');
   if (path === '/stories') await expect(page.locator('h1')).toContainText(tag);
   if (path === '/services') await expect(page.getByRole('link', { name: new RegExp(`${tag} community event`) })).toBeVisible();
   if (path === '/register') { await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0); await expect(page.getByRole('link', { name: 'Privacy Policy', exact: true }).first()).toBeVisible(); }
   await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
   const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
   expect(results.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.getByRole('button', { name: 'Log out', exact: true }).click();
 }
});
