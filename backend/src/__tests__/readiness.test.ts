import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
const health = vi.hoisted(() => ({ checkDatabase: vi.fn() }));
vi.mock('../repositories/health.repository', () => ({ healthRepository: health }));
import { app } from '../app';
import { env } from '../config/env';
const previous = { ...env };
afterEach(() => { Object.assign(env, previous); vi.resetAllMocks(); });
describe('release readiness', () => {
  it('reports database connectivity without exposing configuration', async () => {
    health.checkDatabase.mockResolvedValue(undefined);
    const response = await request(app).get('/api/ready'); expect(response.status).toBe(200); expect(response.body.data).toEqual({ database: 'connected' });
  });
  it('returns 503 on a database failure without raw error details', async () => {
    health.checkDatabase.mockRejectedValue(new Error('private connection string'));
    const response = await request(app).get('/api/ready'); expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('private connection');
  });
  it('keeps production unready until secure invitation delivery is selected', async () => {
    health.checkDatabase.mockResolvedValue(undefined); env.NODE_ENV = 'production'; env.ACTIVATION_DELIVERY = 'development';
    expect((await request(app).get('/api/ready')).status).toBe(503);
  });
});
