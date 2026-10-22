import { test } from 'node:test';
import assert from 'node:assert/strict';

test('image uploads preserve the file and version as multipart data despite the JSON client default', async () => {
  Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true });
  const { api } = await import('../src/api/client.ts');
  const { uploadImage } = await import('../src/api/image-upload.ts');
  const file = new File(['image bytes'], 'school.png', { type: 'image/png' });
  api.defaults.adapter = async config => {
    assert.equal(config.headers.get('X-GDA-CSRF'), '1');
    assert.match(String(config.headers.getContentType()), /^multipart\/form-data/);
    assert.ok(config.data instanceof FormData);
    assert.equal(config.data.get('version'), '4');
    assert.equal((config.data.get('image') as File).name, file.name);
    assert.equal(await (config.data.get('image') as File).text(), 'image bytes');
    return { data: { success: true, data: null }, status: 200, statusText: 'OK', headers: {}, config };
  };
  await uploadImage('/account/profile-image', file, 4);
  await uploadImage('/history/c123456789012345678901234/image', file, 4);
});
