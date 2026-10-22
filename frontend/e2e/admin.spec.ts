import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const bcrypt = require('../../backend/node_modules/bcrypt');

test('alumni management table opens a directory profile and confirms disable/enable with a password', async ({ page }) => {
  const db = new PrismaClient({ datasourceUrl: process.env.PHASE1_TEST_DATABASE_URL });
  const tag = `table-${Date.now()}`, password = 'TableBrowserPassword123';
  const adminEmail = `${tag}-admin@example.test`, alumniEmail = `${tag}-alumni@example.test`;
  const ids: string[] = [];
  try {
    const hash = await bcrypt.hash(password, 12);
    const admin = await db.user.create({ data: { email: adminEmail, password: hash, role: 'ADMIN', staffProfile: { create: { fullName: 'Table Test Administrator' } } } }); ids.push(admin.id);
    const member = await db.user.create({ data: { email: alumniEmail, password: hash, role: 'ALUMNI', alumniProfile: { create: { fullName: `${tag} Member`, graduationYear: 2005, bio: 'Directory lookup verified from the management table.' } }, membershipApplication: { create: { email: alumniEmail, fullName: `${tag} Member`, reference: tag, trackingHash: 'isolated-fixture', phone: '123456789', graduationYear: 2005, status: 'APPROVED', activatedAt: new Date() } } } }); ids.push(member.id);
    await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(adminEmail); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Log in', exact: true }).click(); await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/alumni'); await page.getByLabel('Search alumni name or email').fill(alumniEmail); await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('link', { name: 'View directory profile' }).click(); await page.getByRole('button', { name: 'View alumni profile' }).click(); await expect(page.getByText('Directory lookup verified from the management table.')).toBeVisible(); await expect(page.locator('main')).not.toContainText(alumniEmail);
    await page.goto('/admin/alumni'); await page.getByLabel('Search alumni name or email').fill(alumniEmail); await page.getByRole('button', { name: 'Search', exact: true }).click();
    for (const action of ['Disable', 'Enable']) {
      await page.getByRole('button', { name: `${action} account`, exact: true }).click(); await page.getByLabel('Your current password', { exact: true }).fill(password); await page.getByRole('button', { name: `Confirm ${action.toLowerCase()}`, exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Confirm account status change' })).toHaveCount(0);
      await expect(page.getByRole('row').filter({ hasText: alumniEmail })).toContainText(action === 'Disable' ? 'Disabled' : 'Active');
      const user = await db.user.findUniqueOrThrow({ where: { id: member.id }, include: { membershipApplication: true } }); expect(user.isActive).toBe(action === 'Enable'); expect(user.membershipApplication.status).toBe('APPROVED'); expect(user.membershipApplication.activatedAt).not.toBeNull();
    }
    await page.setViewportSize({ width: 375, height: 844 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await expect(page.getByRole('region', { name: 'Alumni accounts', exact: true })).toBeVisible();
  } finally {
    await db.auditRecord.deleteMany({ where: { actorId: { in: ids } } });
    const apps = await db.membershipApplication.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    await db.membershipReview.deleteMany({ where: { applicationId: { in: apps.map((app: { id: string }) => app.id) } } });
    await db.membershipApplication.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect();
  }
});
