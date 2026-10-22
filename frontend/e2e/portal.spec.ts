import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const bcrypt = require('../../backend/node_modules/bcrypt');
const suffix = `@browser-${Date.now()}.example`;
const superEmail = `super${suffix}`, settingsMemberEmail = `settings-member${suffix}`;
const adminEmail = `admin${suffix}`, alumniEmail = `alumnus${suffix}`, password = 'BrowserTestPassword123';
let prisma: InstanceType<typeof PrismaClient>;
async function login(page: Page, email: string, passwordValue = password) {
  await page.goto('/login'); await page.getByLabel('Email address', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(passwordValue); await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(email === superEmail ? /\/super-admin$/ : email === adminEmail ? /\/admin$/ : /\/dashboard$/);
}
async function accessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map((item) => ({ id: item.id, impact: item.impact, targets: item.nodes.map((node) => node.target) }))).toEqual([]);
}
async function fits(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true); }
test.beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: process.env.PHASE1_TEST_DATABASE_URL });
  await prisma.user.create({ data: { email: adminEmail, password: await bcrypt.hash(password, 12), role: 'ADMIN', staffProfile: { create: { fullName: 'Browser Administrator' } } } });
  await prisma.user.create({ data: { email: superEmail, password: await bcrypt.hash(password, 12), role: 'SUPER_ADMIN', staffProfile: { create: { fullName: 'Browser Platform Operator' } } } });
  await prisma.user.create({ data: { email: settingsMemberEmail, password: await bcrypt.hash(password, 12), role: 'ALUMNI', alumniProfile: { create: { fullName: 'Settings Member' } }, membershipApplication: { create: { email: settingsMemberEmail, fullName: 'Settings Member', reference: `settings${suffix}`, trackingHash: 'test-fixture', phone: '123456789', graduationYear: 2005, status: 'APPROVED', activatedAt: new Date() } } } });

});
test.afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } }); const ids = users.map((user: { id: string }) => user.id);
  const applications = await prisma.membershipApplication.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } });
  await prisma.auditRecord.deleteMany({ where: { actorId: { in: ids } } }); await prisma.accountToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.request.deleteMany({ where: { requestedBy: { in: ids } } }); await prisma.post.deleteMany({ where: { createdBy: { in: ids } } });
  await prisma.membershipReview.deleteMany({ where: { applicationId: { in: applications.map((app: { id: string }) => app.id) } } });
  await prisma.membershipApplication.deleteMany({ where: { email: { endsWith: suffix } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect();
});
test('public pages render while the session service is still waiting', async ({ page }) => {
  let sessionRequested = false;
  await page.route('**/api/auth/me', async (route) => {
    sessionRequested = true;
    // Keep the request pending until after the page's content has rendered.
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Authentication is required' }) });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 2500 });
  expect(sessionRequested).toBe(true);
  await expect(page.getByRole('link', { name: 'Join alumni network' })).toBeVisible();
});
test('public pages work on mobile, with keyboard navigation and accessible forms', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/', '/about', '/services', '/announcements', '/stories', '/events', '/privacy', '/terms', '/help', '/register', '/membership/status', '/login', '/activate', '/admin-activate', '/verify-email', '/missing-page']) {
    await page.goto(route); await expect(page.locator('h1')).toBeVisible(); await fits(page); await accessible(page);
    expect(await page.locator('a[href="#"], button:not([type]):empty').count()).toBe(0);
  }
  await page.goto('/'); await page.getByRole('button', { name: 'Menu', exact: true }).focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Membership', exact: true }).click(); await expect(page).toHaveURL(/\/register$/);
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
});
test('visitor application → review → activation → member profile, stories, events and document completion', async ({ browser }) => {
  const visitor = await browser.newContext(), administrator = await browser.newContext();
  const member = await visitor.newPage(), admin = await administrator.newPage();
  const errors: string[] = []; member.on('pageerror', (error) => errors.push(error.message)); admin.on('pageerror', (error) => errors.push(error.message));
  try {
    await member.goto('/register'); await member.getByLabel('Full name', { exact: true }).fill('Browser Alumni'); await member.getByLabel('Email address', { exact: true }).fill(alumniEmail); await member.getByLabel('Phone number', { exact: true }).fill('123456789'); await member.getByLabel('Graduation year', { exact: true }).selectOption('2005');
    await member.getByLabel(/I have read the/).check(); await member.getByRole('button', { name: 'Submit application', exact: true }).click(); await expect(member.getByRole('heading', { name: 'Application submitted' })).toBeVisible();
    const receipt = await member.getByLabel('Private tracking credentials').inputValue(); const reference = /Reference: (GDA-[A-F0-9]{24})/.exec(receipt)![1]!, secret = /Tracking secret: ([a-f0-9]{64})/.exec(receipt)![1]!;
    expect(await prisma.user.findUnique({ where: { email: alumniEmail } })).toBeNull();
    await member.goto('/membership/status'); await member.getByLabel('Application reference', { exact: true }).fill(reference); await member.getByLabel('Private tracking secret', { exact: true }).fill(secret); await member.getByRole('button', { name: 'Check status', exact: true }).click(); await expect(member.getByRole('heading', { name: 'PENDING', exact: true })).toBeVisible();
    await login(admin, adminEmail); await expect(admin.getByRole('heading', { name: 'Administrator dashboard' })).toBeVisible(); await accessible(admin);
    await admin.goto('/admin/membership'); await admin.getByLabel('Search name, email or reference').fill(alumniEmail); await admin.getByRole('button', { name: 'Search', exact: true }).click(); await admin.getByRole('button', { name: 'Review details', exact: true }).click(); await admin.getByLabel('Private verification notes').fill('School records verified in browser test'); await admin.getByRole('button', { name: 'Approve membership', exact: true }).click();
    await expect(admin.getByLabel('Private invitation link')).toBeVisible(); const invitation = await admin.getByLabel('Private invitation link').inputValue();
    await member.goto(invitation); await expect(member).toHaveURL(/\/activate$/); await member.getByLabel('Create password', { exact: true }).fill(password); await member.getByLabel('Confirm password', { exact: true }).fill(password); await member.getByRole('button', { name: 'Activate account', exact: true }).click(); await expect(member.getByText('Your approved account is activated and your profile is ready to complete.')).toBeVisible();
    await login(member, alumniEmail); await member.getByText('Membership, profile and alumni updates', { exact: true }).click(); await expect(member.getByText('APPROVED · Activated')).toBeVisible(); await accessible(member);
    await member.goto('/profile'); await expect(member.getByLabel('Full name', { exact: true })).toHaveValue('Browser Alumni'); await member.getByLabel('Occupation', { exact: true }).fill('Engineer'); await member.getByLabel('Current location', { exact: true }).fill('Monrovia'); await member.getByLabel('Biography', { exact: true }).fill('Browser-verified member biography.'); await member.getByRole('button', { name: 'Save profile', exact: true }).click(); await expect(member.getByRole('status').filter({ hasText: 'Profile saved' })).toBeVisible();
    await member.goto('/alumni'); await member.getByLabel('Search by name', { exact: true }).fill('Browser Alumni'); await member.getByRole('button', { name: 'Search directory', exact: true }).click(); await member.getByRole('button', { name: 'View alumni profile' }).click(); await expect(member.getByText('Browser-verified member biography.')).toBeVisible(); expect(await member.locator('main').getByText(alumniEmail, { exact: true }).count()).toBe(0);
    await member.goto('/stories/mine'); await member.getByRole('button', { name: 'Submit a story', exact: true }).click(); await member.getByLabel('Title', { exact: true }).fill('Browser story'); await member.getByLabel('Content', { exact: true }).fill('My real end-to-end story workflow.'); await member.getByRole('button', { name: 'Save content', exact: true }).click(); await expect(member.getByRole('status').filter({ hasText: 'Story saved' })).toBeVisible();
    await admin.goto('/admin/content/stories'); await admin.getByLabel('Search title or content').fill('Browser story'); await admin.getByRole('button', { name: 'Search', exact: true }).click(); await admin.locator('article').filter({ has: admin.getByRole('heading', { name: 'Browser story', exact: true }) }).getByRole('button', { name: 'Publish', exact: true }).click(); await expect(admin.getByRole('status').filter({ hasText: 'Content published' })).toBeVisible();
    await member.goto('/stories'); await member.getByLabel('Search alumni stories').fill('Browser story'); await member.getByRole('button', { name: 'Search', exact: true }).click(); await member.getByRole('link', { name: 'Read full story', exact: true }).click(); await expect(member.getByRole('heading', { name: 'Browser story' })).toBeVisible();
    await admin.goto('/admin/content/events'); await admin.getByRole('button', { name: 'Create content', exact: true }).click(); await admin.getByLabel('Title', { exact: true }).fill('Browser future event'); await admin.getByLabel('Description', { exact: true }).fill('A future event verified in a browser.'); const future = new Date(Date.now() + 86400000); await admin.getByLabel('Event date and start time').fill(future.toISOString().slice(0, 16)); await admin.getByLabel('Location', { exact: true }).fill('School campus'); await admin.getByRole('button', { name: 'Save content', exact: true }).click(); await expect(admin.getByRole('status').filter({ hasText: 'Content saved' })).toBeVisible(); await admin.locator('article').filter({ has: admin.getByRole('heading', { name: 'Browser future event', exact: true }) }).getByRole('button', { name: 'Publish', exact: true }).click(); await expect(admin.getByRole('status').filter({ hasText: 'Content published' })).toBeVisible();
    await member.goto('/events'); await expect(member.getByRole('heading', { name: 'Browser future event' })).toBeVisible();
    await member.goto('/requests/new'); await member.getByLabel('Request Type', { exact: true }).selectOption('TRANSCRIPT'); await member.getByLabel('Full Name at Graduation', { exact: true }).fill('Browser Alumni'); await member.getByLabel('Graduation Year', { exact: true }).fill('2005'); await member.getByLabel('Contact Phone', { exact: true }).fill('123456789'); await member.getByLabel('Purpose of Request', { exact: true }).fill('University application'); await member.getByRole('button', { name: 'Submit Document Request', exact: true }).click(); await expect(member.getByRole('status').filter({ hasText: 'Your reference' })).toBeVisible();
    await admin.goto('/admin/requests'); await admin.getByLabel('Search name, reference, index number or email').fill(alumniEmail); await admin.getByRole('button', { name: 'Search', exact: true }).click(); await admin.getByRole('button', { name: 'Open request', exact: true }).click();
    for (const status of ['IN_REVIEW', 'APPROVED', 'READY_FOR_PICKUP', 'COMPLETED']) { await admin.getByLabel('Registrar note (visible to the requester)').fill(`Browser review: ${status}`); await admin.getByLabel('Next status', { exact: true }).selectOption(status); await admin.getByRole('button', { name: 'Update request status', exact: true }).click(); await expect(admin.getByRole('status').filter({ hasText: 'Request status updated' })).toBeVisible(); await expect(admin.getByText(`Browser review: ${status}`, { exact: true })).toBeVisible(); }
    await member.setViewportSize({ width: 390, height: 844 }); await member.goto('/requests'); await member.getByRole('button', { name: 'Open request', exact: true }).click(); await expect(member.getByText('Browser review: COMPLETED', { exact: true })).toBeVisible(); await fits(member); await accessible(member);
    await member.getByRole('button', { name: 'Menu', exact: true }).click(); await member.getByRole('link', { name: 'My Profile', exact: true }).first().click(); await expect(member).toHaveURL(/\/profile$/); await fits(member); await accessible(member);
    await member.goto('/admin'); await expect(member).toHaveURL(/\/dashboard$/); expect(errors).toEqual([]);
  } finally { await visitor.close(); await administrator.close(); }
});


test('separate staff roles, shared mobile settings and accessible password controls', async ({ browser }) => {
  for (const email of [superEmail, adminEmail, settingsMemberEmail]) {
    const context = await browser.newContext(); const page = await context.newPage();
    try {
      await page.goto('/login'); const input = page.getByLabel('Password', { exact: true });
      await input.fill(password); await expect(input).toHaveAttribute('type', 'password');
      const toggle = page.getByRole('button', { name: 'Show password', exact: true });
      await toggle.focus(); await page.keyboard.press('Enter'); await expect(input).toHaveAttribute('type', 'text'); await expect(input).toHaveValue(password);
      await expect(page.getByRole('button', { name: 'Hide password', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Enter'); await expect(input).toHaveAttribute('type', 'password');
      await login(page, email);
      if (email === superEmail) {
        await expect(page.getByRole('link', { name: 'Membership Applications', exact: true })).toHaveCount(0);
        await page.goto('/admin/membership'); await expect(page).toHaveURL(/\/super-admin$/);
        await page.goto('/super-admin/settings'); await expect(page.getByRole('heading', { name: 'Platform settings', exact: true })).toBeVisible(); await accessible(page);
      } else { await page.goto('/super-admin'); await expect(page).toHaveURL(email === adminEmail ? /\/admin$/ : /\/dashboard$/); }
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/account/settings');
      await expect(page.getByLabel('Current email', { exact: true })).toHaveValue(email);
      await expect(page.getByLabel('Upload image (JPEG, PNG or WebP, maximum 5 MB)', { exact: true })).toBeDisabled();
      await expect(page.getByRole('link', { name: 'Open platform upload settings', exact: true })).toHaveCount(email === superEmail ? 1 : 0);
      await expect(page.getByText('Email changes are temporarily unavailable because email verification is not enabled. Please contact the platform administrator for assistance.')).toBeVisible();
      await page.getByLabel('Full name', { exact: true }).fill(email === settingsMemberEmail ? 'Browser Alumni' : 'Browser Staff Profile');
      await page.getByRole('button', { name: 'Save personal profile', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Personal profile saved.' })).toBeVisible();
      const newPasswordField = page.getByLabel('New password', { exact: true }), confirmation = page.getByLabel('Confirm new password', { exact: true });
      await expect(newPasswordField).toHaveAttribute('type', 'password'); await expect(confirmation).toHaveAttribute('type', 'password');
      await page.locator('button[aria-controls="new-password"]').click(); await expect(newPasswordField).toHaveAttribute('type', 'text'); await expect(confirmation).toHaveAttribute('type', 'password');
      await fits(page); await accessible(page);
      if (email === superEmail) {
        const replacement = 'ChangedBrowserPassword456!';
        await page.getByLabel('Current password', { exact: true }).fill(password); await newPasswordField.fill(replacement); await confirmation.fill(replacement);
        await page.getByRole('button', { name: 'Update password', exact: true }).click(); await expect(page).toHaveURL(/\/login\?changed=password$/);
        await login(page, email, replacement);
      }
    } finally { await context.close(); }
  }
});


test('profile picture preview switches between a selected file and an HTTPS URL', async ({ page }) => {
  await login(page, settingsMemberEmail);
  // Simulate upload availability for this UI preview check; no upload is sent.
  // Authentication and the owner account still come from the real API.
  await page.route('**/api/account/me', async (route) => {
    const response = await route.fetch(); expect(response.status()).toBe(200);
    const body = await response.json(); body.data.media.enabled = true;
    await route.fulfill({ response, json: body });
  });
  const bytes = await require('../../backend/node_modules/sharp')({ create: { width: 1, height: 1, channels: 3, background: 'blue' } }).png().toBuffer();
  const imageUrl = 'https://images.example/profile.png';
  await page.route(imageUrl, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: bytes }));
  await page.goto('/account/settings');
  const file = page.getByLabel('Upload image (JPEG, PNG or WebP, maximum 5 MB)', { exact: true });
  await expect(file).toBeEnabled(); await file.setInputFiles({ name: 'preview.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.getByAltText('Profile picture preview')).toHaveAttribute('src', /^blob:/);
  await page.getByLabel('HTTPS image URL', { exact: true }).fill(imageUrl);
  await page.getByRole('button', { name: 'Preview image URL', exact: true }).click();
  await expect(page.getByAltText('Profile picture preview')).toHaveAttribute('src', imageUrl);
  await expect.poll(() => page.getByAltText('Profile picture preview').evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBe(1);
  await file.setInputFiles({ name: 'preview-again.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.getByAltText('Profile picture preview')).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: 'Save image URL', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Profile picture saved.' })).toBeVisible();
  await expect(file).toHaveValue('');
  await page.reload(); await expect(page.getByAltText('Profile picture preview')).toHaveAttribute('src', imageUrl);
  await page.getByRole('button', { name: 'Restore default picture', exact: true }).click();
  await expect(page.getByText('Default profile picture', { exact: true })).toBeVisible();
});
