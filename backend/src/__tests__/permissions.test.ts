import { describe, it, expect } from 'vitest';
import { hasPermission, assertPermission } from '../policies/permission.policy';
import { signToken, verifyToken } from '../utils/jwt';
describe('explicit capabilities and session version claims', () => {
  it('keeps platform and school permissions independent', async () => {
    expect(hasPermission('SUPER_ADMIN', 'PLATFORM_MANAGE')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'SCHOOL_MANAGE')).toBe(false);
    expect(hasPermission('ADMIN', 'PLATFORM_MANAGE')).toBe(false);
    expect(hasPermission('ADMIN', 'SCHOOL_MANAGE')).toBe(true);
    expect(hasPermission('ALUMNI', 'SCHOOL_MANAGE')).toBe(false);
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'ALUMNI'] as const) expect(hasPermission(role, 'ACCOUNT_MANAGE')).toBe(true);
    expect(hasPermission('STUDENT', 'ACCOUNT_MANAGE')).toBe(false);
    expect(() => assertPermission('SUPER_ADMIN', 'SCHOOL_MANAGE')).toThrow();
    const actor = { userId: 'cm9z2p7es0000l9m86e4w8v1a', role: 'SUPER_ADMIN' as const };
    const { adminService } = await import('../services/admin.service.js');
    const { postsService } = await import('../services/posts.service.js');
    const { eventsService } = await import('../services/events.service.js');
    await expect(adminService.dashboard(actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(postsService.createAnnouncement(actor, { title: 'Forbidden', content: 'Forbidden' })).rejects.toMatchObject({ statusCode: 403 });
    expect(() => eventsService.create(actor, { title: 'Forbidden', content: 'Forbidden', eventDate: new Date() })).toThrow();
  });
  it('signs and verifies the server-side session version', () => {
    expect(verifyToken(signToken({ userId: 'cm9z2p7es0000l9m86e4w8v1a', role: 'SUPER_ADMIN', sessionVersion: 3 })).sessionVersion).toBe(3);
    expect(verifyToken(signToken({ userId: 'cm9z2p7es0000l9m86e4w8v1a', role: 'ADMIN' })).sessionVersion).toBe(0);
  });
});
