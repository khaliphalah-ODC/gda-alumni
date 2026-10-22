import { test } from 'node:test';
import assert from 'node:assert/strict';
// Shared pure generator; the build invocation writes the generated rules.
// @ts-expect-error standalone deployment script is JavaScript
import { netlifyRedirects } from '../../scripts/netlify-redirects.mjs';

test('Netlify forwards API uploads before the SPA fallback and preserves the /api prefix', () => {
  assert.equal(netlifyRedirects('https://preview-api.up.railway.app/'), '/api/*  https://preview-api.up.railway.app/api/:splat  200!\n/*  /index.html  200\n');
  for (const origin of [undefined, '', 'http://api.example.test', 'https://user:password@api.example.test', 'https://api.example.test/api', 'https://api.example.test/?key=value']) {
    assert.throws(() => netlifyRedirects(origin));
  }
  assert.throws(() => netlifyRedirects('https://api.example.test', 'https://api.example.test/api'));
});
