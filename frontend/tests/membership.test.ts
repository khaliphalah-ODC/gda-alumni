import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicationPayload, activationTokenFromFragment } from '../src/utils/membership.ts';
test('membership application payload normalizes inputs and excludes credentials and decisions', () => {
  const form = { fullName: ' Alumni Name ', email: ' Alumni@Example.COM ', phone: ' 123456789 ', graduationYear: 2004, location: '', previousName: '', studentIndexNumber: '', lastClassAttended: '', verificationInformation: '', password: 'must-not-submit', role: 'ADMIN', status: 'APPROVED' };
  const payload = applicationPayload(form);
  assert.equal(payload.email, 'alumni@example.com'); assert.equal(payload.fullName, 'Alumni Name'); assert.equal(payload.graduationYear, 2004);
  assert.equal('password' in payload, false); assert.equal('role' in payload, false); assert.equal('status' in payload, false);
});
test('activation consumes only correctly shaped fragment credentials', () => {
  const token = 'a'.repeat(64);
  assert.equal(activationTokenFromFragment(`#token=${token}`), token);
  for (const fragment of ['', '#token=invalid', `?token=${token}`, '#email=user@example.com']) assert.equal(activationTokenFromFragment(fragment), '');
});
