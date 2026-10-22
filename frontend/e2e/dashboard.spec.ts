import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const bcrypt = require('../../backend/node_modules/bcrypt');
const db = new PrismaClient({ datasourceUrl: process.env.PHASE1_TEST_DATABASE_URL });
const tag = `dashboard-${Date.now()}`, password = 'DashboardBrowserPassword123';
let adminId: string, alumniId: string;
test.beforeAll(async () => {
 const hash = await bcrypt.hash(password, 12);
 adminId = (await db.user.create({ data: { email: `${tag}-admin@example.test`, password: hash, role: 'ADMIN' } })).id;
 alumniId = (await db.user.create({ data: { email: `${tag}-alumni@example.test`, password: hash, role: 'ALUMNI', alumniProfile: { create: { fullName: 'Dashboard Test Member', graduationYear: 2005, occupation: 'Engineer', location: 'Monrovia' } }, membershipApplication: { create: { email: `${tag}-alumni@example.test`, reference: tag, trackingHash: 'isolated-fixture', fullName: 'Dashboard Test Member', phone: '123456789', graduationYear: 2005, status: 'APPROVED', activatedAt: new Date() } } } })).id;
 for (const status of ['IN_REVIEW', 'COMPLETED']) await db.request.create({ data: { requestedBy: alumniId, requestType: 'TRANSCRIPT', purpose: 'University', fullNameAtGraduation: 'Dashboard Test Member', contactPhone: '123456789', status, completedAt: status === 'COMPLETED' ? new Date() : null } });
 await db.post.create({ data: { title: 'Dashboard Community Event', content: 'An isolated upcoming community event.', type: 'EVENT', createdBy: adminId, isPublished: true, publishedAt: new Date(), eventDate: new Date(Date.now() + 86400000), eventLocation: 'Campus', eventTime: '10:00 AM' } });
});
test.afterAll(async () => {
 const ids = [adminId, alumniId].filter(Boolean);
 await db.request.deleteMany({ where: { requestedBy: { in: ids } } }); await db.post.deleteMany({ where: { createdBy: { in: ids } } });
 await db.membershipApplication.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect();
});
async function login(page: import('@playwright/test').Page, role: string) {
 await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(`${tag}-${role}@example.test`); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Log in', exact: true }).click(); await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/dashboard$/);
}
test('dashboard data, registry year filters and page export use the real API', async ({ page }) => {
 await login(page, 'admin'); await expect(page.getByRole('heading', { name: 'Request Fulfillment' })).toBeVisible(); await expect(page.getByRole('region', { name: 'Recent document requests', exact: true })).toContainText('Dashboard Test Member');
 await page.getByRole('link', { name: 'Review request for Dashboard Test Member', exact: true }).last().click(); await expect(page.getByText('Name at graduation', { exact: true })).toBeVisible(); await expect(page.getByLabel('Next status', { exact: true })).toBeVisible();
 await page.goto('/admin/alumni'); await page.getByLabel('Search alumni name or email').fill(`${tag}-alumni@example.test`); await page.getByLabel('Graduation Year').selectOption('2006'); await page.getByRole('button', { name: 'Search', exact: true }).click(); await expect(page.getByText('No matching alumni accounts.')).toBeVisible();
 await page.getByLabel('Graduation Year').selectOption('2005'); await page.getByRole('button', { name: 'Search', exact: true }).click(); await expect(page.getByRole('region', { name: 'Alumni accounts', exact: true })).toContainText('Engineer');
 const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export current page' }).click(); expect((await download).suggestedFilename()).toBe('gda-alumni-page-1.csv');
 await page.getByRole('button', { name: 'Log out', exact: true }).click(); await login(page, 'alumni');
 await expect(page.getByRole('heading', { name: 'Welcome back, Dashboard.' })).toBeVisible(); await expect(page.getByRole('region', { name: 'My recent requests', exact: true })).toContainText('COMPLETED');
 await expect(page.getByRole('link', { name: 'Dashboard Community Event' })).toBeVisible(); await expect(page.getByRole('link', { name: 'Manage Alumni', exact: true })).toHaveCount(0);
 await page.getByRole('link', { name: 'Apply for Documents', exact: true }).click(); await expect(page).toHaveURL(/\/requests\/new$/);
});

test('dashboards and alumni management fit desktop, tablet and mobile with accessible controls', async ({ page }) => {
 test.setTimeout(360000);
 for (const role of ['admin', 'alumni']) {
  await page.setViewportSize({ width: 1440, height: 1000 }); await login(page, role);
  for (const path of role === 'admin' ? ['/admin', '/admin/alumni'] : ['/dashboard']) {
   for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto(path);
    await expect(page.locator('h1')).toHaveCount(1); await expect(page.getByRole('status')).toHaveCount(0); await expect(page.getByRole('alert')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const mainLeft = await page.locator('main').evaluate(element => Math.round(element.getBoundingClientRect().left));
    expect(mainLeft).toBe(width >= 1024 ? 280 : 0);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
   }
  }
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.getByRole('button', { name: 'Log out', exact: true }).click();
 }
});
