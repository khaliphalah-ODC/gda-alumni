import { test } from 'node:test';
import assert from 'node:assert/strict';
import { membershipProgress, type TrackedMembership } from '../src/utils/membership-progress';
const base: TrackedMembership = { trackingCode: '123456789012', status: 'PENDING', submittedAt: '2026-11-04', reviewedAt: null, rejectionReason: null, activated: false, invitationStatus: 'NONE', invitationAttemptedAt: null };
test('pending and rejected applications never show completed invitation or activation steps', () => {
  assert.equal(membershipProgress(base).length, 2);
  const rejected = membershipProgress({ ...base, status: 'REJECTED', reviewedAt: '2026-11-04' });
  assert.deepEqual(rejected.map(step => step.label), ['Application submitted', 'Pending review', 'Application rejected']);
});
test('provider acceptance, local capture and activation remain distinct events', () => {
  const approved = { ...base, status: 'APPROVED' as const, reviewedAt: '2026-11-04' };
  assert.equal(membershipProgress({ ...approved, invitationStatus: 'FAILED' })[3]?.complete, false);
  assert.equal(membershipProgress({ ...approved, invitationStatus: 'SENT' })[3]?.complete, true);
  assert.equal(membershipProgress({ ...approved, invitationStatus: 'SENT' })[4]?.complete, false);
  assert.match(membershipProgress({ ...approved, invitationStatus: 'DEVELOPMENT' })[3]!.label, /captured locally/);
  assert.equal(membershipProgress({ ...approved, activated: true, invitationStatus: 'NONE' })[3]?.complete, false);
});
