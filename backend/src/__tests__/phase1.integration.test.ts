import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { AppError } from '../utils/app-error';

const service = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  getCurrentUser: vi.fn(),
  getSessionIdentity: vi.fn(),
}));

vi.mock('../services/auth.service', () => ({ authService: service }));

import app from '../app';

const alumni = {
  id: 'cm9z2p7es0000l9m86e4w8v1a',
  email: 'alumni@example.com',
  role: 'ALUMNI' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('Phase 1 authentication API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.register.mockResolvedValue(alumni);
    service.login.mockResolvedValue(alumni);
    service.getCurrentUser.mockResolvedValue(alumni);
    service.getSessionIdentity.mockResolvedValue({ userId: alumni.id, role: alumni.role });
  });

  it('reports health using the standard response format', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { status: 'ok' }, pagination: null });
  });

  it('rejects direct registration without creating an account or cookie', async () => {
    const response = await request(app).post('/api/auth/register').set('X-GDA-CSRF', '1').send({ email: alumni.email, password: 'SecurePass123!' });
    expect(response.status).toBe(403);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(service.register).not.toHaveBeenCalled();
  });

  it('rejects invalid registration input and client-supplied roles', async () => {
    const response = await request(app).post('/api/auth/register').set('X-GDA-CSRF', '1').send({ email: 'not-an-email', password: 'short', role: 'ADMIN' });
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(service.register).not.toHaveBeenCalled();
  });

  it('returns an invalid-credentials response for a wrong password', async () => {
    service.login.mockRejectedValueOnce(new AppError(401, 'Invalid email or password'));
    const response = await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: alumni.email, password: 'wrong-password' });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
  });

  it('requires authentication for /me and accepts a valid cookie', async () => {
    const anonymous = await request(app).get('/api/auth/me');
    expect(anonymous.status).toBe(401);

    const agent = request.agent(app);
    await agent.post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: alumni.email, password: 'SecurePass123!' });
    const authenticated = await agent.get('/api/auth/me');
    expect(authenticated.status).toBe(200);
    expect(authenticated.body.data.email).toBe(alumni.email);
  });

  it('rejects an invalid authentication token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'gray_d_allison_token=this-is-not-a-jwt');
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication token is invalid');
  });

  it('logs out an authenticated user by clearing the auth cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: alumni.email, password: 'SecurePass123!' });
    const response = await agent.post('/api/auth/logout').set('X-GDA-CSRF', '1');
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toContain('gray_d_allison_token=;');
  });

  it('limits repeated authentication attempts', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 11 }, () => request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: alumni.email, password: 'SecurePass123!' })),
    );
    expect(attempts.some((response: { status: number }) => response.status === 429)).toBe(true);
  });
});
