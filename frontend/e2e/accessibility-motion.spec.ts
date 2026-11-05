import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function observeTextOpacity(page: Page) {
  await page.addInitScript(() => {
    const state = { lowOpacity: [] as { target: string; opacity: number }[] };
    Object.assign(window, { gdaTextOpacity: state });
    const sample = () => {
      for (const element of Array.from(document.querySelectorAll('#app > div, .motion-card, .excellence-card, main section.rounded.bg-white.p-5'))) {
        if (!element.textContent?.trim()) continue;
        const opacity = Number(getComputedStyle(element).opacity);
        if (opacity < 1 && state.lowOpacity.length < 20) state.lowOpacity.push({ target: element.className, opacity });
      }
    };
    new MutationObserver(sample).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  });
}

async function mockApi(page: Page, authenticated = false) {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    const user = { id: 'motion-fixture', email: 'motion@example.test', role: 'ADMIN' };
    const dashboard = {
      stats: { totalApprovedAlumni: 0, pendingApplications: 0, publishedAnnouncements: 0, upcomingEvents: 0, totalRequests: 0 },
      requestsByStatus: { SUBMITTED: 0, IN_REVIEW: 0, APPROVED: 0, REJECTED: 0, READY_FOR_PICKUP: 0, COMPLETED: 0 },
      recentRequests: [], recentApplications: [], membershipActivity: [], asOf: '2026-10-28T00:00:00Z',
    };
    const anonymous = path === '/api/auth/me' && !authenticated;
    const data = path === '/api/auth/me' ? user : path === '/api/admin/dashboard' ? dashboard
      : path.includes('/chatbot/') ? { enabled: false } : [];
    await route.fulfill({ status: anonymous ? 401 : 200, json: { success: !anonymous, data, pagination: null } });
  });
}

async function expectReadable(page: Page) {
  const observations = await page.evaluate(() => (window as typeof window & {
    gdaTextOpacity: { lowOpacity: { target: string; opacity: number }[] };
  }).gdaTextOpacity.lowOpacity);
  expect(observations, 'Text must keep full contrast throughout entrance animations').toEqual([]);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
}

test('public text keeps its contrast from the first frame with normal motion enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await observeTextOpacity(page); await mockApi(page);
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectReadable(page);
});

test('dashboard labels keep their contrast throughout card entrance animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await observeTextOpacity(page); await mockApi(page, true);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Total Alumni', exact: true })).toBeVisible();
  await expectReadable(page);
});

test('achievement text remains opaque when scrolled into view', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await observeTextOpacity(page); await mockApi(page);
  await page.goto('/');
  const achievements = page.getByRole('region', { name: 'Excellence in Discipline & Academics', exact: true });
  await achievements.scrollIntoViewIfNeeded();
  await expect(achievements.getByRole('button', { name: /Explore achievement:/ }).first()).toBeVisible();
  await expectReadable(page);
});
