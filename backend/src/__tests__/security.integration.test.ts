import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Prisma, Role } from '@prisma/client';
import { env, authLifetimeSeconds } from '../config/env';
import { signToken, verifyToken } from '../utils/jwt';
import { authCookieMaxAge } from '../utils/auth-cookie';
import { AppError } from '../utils/app-error';
import { registerSchema, loginSchema } from '../validators/auth.validator';

const services = vi.hoisted(() => ({
  getSessionIdentity: vi.fn(), getCurrentUser: vi.fn(), register: vi.fn(), login: vi.fn(),
  listAnnouncements: vi.fn(),
}));
vi.mock('../services/membership.service', () => ({ membershipService: { apply: services.register } }));
vi.mock('../services/auth.service', () => ({ authService: services }));
vi.mock('../services/posts.service', () => ({ postsService: services }));
import { app } from '../app';
const id = 'cm9z2p7es0000l9m86e4w8v1a';
const cookie = (role: Role = Role.ALUMNI) => `gray_d_allison_token=${signToken({ userId: id, role })}`;
const mutation = () => request(app).post('/api/auth/logout').set('X-GDA-CSRF', '1');

describe('Phase 1 security regressions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    services.getSessionIdentity.mockResolvedValue({ userId: id, role: Role.ALUMNI });
    services.getCurrentUser.mockResolvedValue({ id, role: Role.ALUMNI });
    services.listAnnouncements.mockResolvedValue({ posts: [], pagination: null });
  });

  it('rejects browser mutations without the preflight header or from another origin', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(403);
    expect((await mutation().set('Origin', 'https://attacker.example')).status).toBe(403);
    expect((await mutation().set('Origin', new URL(env.FRONTEND_ORIGIN).origin)).status).toBe(200);
  });

  it('clears expired cookies on logout without requiring authentication', async () => {
    const expired = jwt.sign({ userId: id, role: Role.ALUMNI }, env.JWT_SECRET, { expiresIn: -1 });
    const response = await mutation().set('Cookie', `gray_d_allison_token=${expired}`);
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toContain('gray_d_allison_token=;');
  });

  it('clears expired cookies on protected routes and leaves public content available', async () => {
    const expired = `gray_d_allison_token=${jwt.sign({ userId: id, role: Role.ALUMNI }, env.JWT_SECRET, { expiresIn: -1 })}`;
    const response = await request(app).get('/api/auth/me').set('Cookie', expired);
    expect(response.status).toBe(401);
    expect(response.headers['set-cookie'][0]).toContain('gray_d_allison_token=;');
    expect((await request(app).get('/api/posts/announcements').set('Cookie', expired)).status).toBe(200);
  });

  it('uses current permissions instead of an old administrator JWT claim', async () => {
    const response = await request(app).get('/api/requests').set('Cookie', cookie(Role.ADMIN));
    expect(response.status).toBe(403);
    expect(services.getSessionIdentity).toHaveBeenCalledWith(id, 0);
  });

  it('clears cookies for removed or inactive accounts', async () => {
    services.getSessionIdentity.mockRejectedValue(new AppError(401, 'Authentication is no longer valid'));
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie());
    expect(response.status).toBe(401);
    expect(response.headers['set-cookie'][0]).toContain('gray_d_allison_token=;');
  });

  it('maps malformed and oversized JSON to client errors', async () => {
    const invalid = await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').set('Content-Type', 'application/json').send('{');
    expect(invalid.status).toBe(400);
    const oversized = await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ password: 'x'.repeat(110000) });
    expect(oversized.status).toBe(413);
  });

  it('maps duplicate database records to conflict without exposing internal fields', async () => {
    services.register.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('private details', { code: 'P2002', clientVersion: '6.19.0' }));
    const response = await request(app).post('/api/membership/applications').set('X-GDA-CSRF', '1').send({ email: 'test@example.com', fullName: 'Test Applicant', phone: '123456789', graduationYear: 2001 });
    expect(response.status).toBe(409);
    expect(JSON.stringify(response.body)).not.toContain('private details');
  });

  it('validates signed payloads, algorithm, and matching expiry durations', () => {
    expect(() => verifyToken(jwt.sign({ role: 'ADMIN' }, env.JWT_SECRET, { expiresIn: '1h' }))).toThrow();
    expect(() => verifyToken(jwt.sign({ userId: id, role: Role.ALUMNI }, env.JWT_SECRET, { algorithm: 'HS384', expiresIn: '1h' }))).toThrow();
    const payload = jwt.decode(signToken({ userId: id, role: Role.ALUMNI })) as jwt.JwtPayload;
    expect(payload.exp! - payload.iat!).toBe(authLifetimeSeconds);
    expect(authCookieMaxAge).toBe(authLifetimeSeconds * 1000);
  });

  it('reports missing database migrations as an actionable service error', async () => {
    services.register.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('private schema details', { code: 'P2022', clientVersion: '6.19.0' }));
    const response = await request(app).post('/api/membership/applications').set('X-GDA-CSRF', '1').send({ email: 'test@example.com', fullName: 'Test Applicant', phone: '123456789', graduationYear: 2001 });
    expect(response.status).toBe(503);
    expect(response.body.message).toContain('database needs an update');
    expect(JSON.stringify(response.body)).not.toContain('private schema');
  });

  it('limits passwords by UTF-8 bytes, including login input', () => {
    for (const schema of [registerSchema, loginSchema]) {
      expect(schema.safeParse({ email: 'test@example.com', password: 'a'.repeat(72) }).success).toBe(true);
      expect(schema.safeParse({ email: 'test@example.com', password: 'é'.repeat(37) }).success).toBe(false);
      expect(schema.safeParse({ email: 'test@example.com', password: 'a'.repeat(73) }).success).toBe(false);
    }
  });
});
