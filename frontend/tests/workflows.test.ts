import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentEndpoint, localDateTime } from '../src/utils/content.ts';
import { canDeleteRequest, requestTransitions } from '../src/utils/requests.ts';
test('content endpoints and date editor preserve the selected event instant', () => {
  assert.equal(contentEndpoint('announcements'), '/posts/announcements'); assert.equal(contentEndpoint('stories'), '/stories'); assert.equal(contentEndpoint('events'), '/events');
  const instant = '2026-11-20T10:30:00.000Z'; assert.equal(new Date(localDateTime(instant)).toISOString(), instant); assert.equal(localDateTime(null), '');
});
test('request controls offer only supported transitions and permitted deletion', () => {
  assert.deepEqual(requestTransitions.SUBMITTED, ['IN_REVIEW']); assert.deepEqual(requestTransitions.IN_REVIEW, ['APPROVED', 'REJECTED']); assert.deepEqual(requestTransitions.REJECTED, ['IN_REVIEW']);
  assert.deepEqual(requestTransitions.APPROVED, ['READY_FOR_PICKUP']); assert.deepEqual(requestTransitions.READY_FOR_PICKUP, ['COMPLETED']); assert.deepEqual(requestTransitions.COMPLETED, []);
  assert.equal(canDeleteRequest('SUBMITTED', false), true); assert.equal(canDeleteRequest('REJECTED', false), true); assert.equal(canDeleteRequest('IN_REVIEW', false), false); assert.equal(canDeleteRequest('COMPLETED', false), false); assert.equal(canDeleteRequest('COMPLETED', true), true);
});
