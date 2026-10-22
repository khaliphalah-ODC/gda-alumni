import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginCredentials, loginDestination } from '../src/utils/login.ts';

test('login submits only the strict API fields even if UI fields are added', () => {
  const form = { email: 'alumni@example.com', password: 'Password123', remember: true };
  assert.deepEqual(loginCredentials(form), { email: form.email, password: form.password });
});

test('login restores local routes and refuses external or login-loop destinations', () => {
  assert.equal(loginDestination('/requests/new?type=TRANSCRIPT#form', 'ALUMNI'), '/requests/new?type=TRANSCRIPT#form');
  for (const value of ['//attacker.example', '/\\attacker.example', 'https://attacker.example', '/login', '/register', undefined]) {
    assert.equal(loginDestination(value, 'ALUMNI'), '/dashboard');
  }
  assert.equal(loginDestination(undefined, 'ADMIN'), '/admin');
  assert.equal(loginDestination(undefined, 'SUPER_ADMIN'), '/super-admin');
});

test('API client supplies the CSRF header and signals session expiry', async () => {
  Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true });
  const { api } = await import('../src/api/client.ts');
  const { AxiosError } = await import('axios');
  let expired = 0;
  assert.equal(api.defaults.timeout, 30000);
  window.addEventListener('gda:session-expired', () => { expired++; });
  api.defaults.adapter = async (config) => {
    assert.equal(config.headers.get('X-GDA-CSRF'), '1');
    throw new AxiosError('Expired', 'ERR_BAD_REQUEST', config, null, { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config });
  };
  await assert.rejects(api.get('/requests/my'));
  assert.equal(expired, 1);
  await assert.rejects(api.post('/auth/login', {}));
  assert.equal(expired, 1);
});
