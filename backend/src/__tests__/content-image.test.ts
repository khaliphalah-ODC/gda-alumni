import { describe, it, expect } from 'vitest';
import { contentImagePrefix, managedContentImageId } from '../utils/content-image';
const id = 'c123456789012345678901234', other = 'c987654321098765432109876';
const uuid = '12345678-1234-4234-8234-123456789abc';
describe('managed content image ownership', () => {
  it('recognizes only the expected cloud and owning content path', () => {
    const asset = `${contentImagePrefix(id)}${uuid}`;
    const image = `https://res.cloudinary.com/test/image/upload/v123/${asset}.webp`;
    expect(managedContentImageId(image, id, 'test')).toBe(asset);
    for (const bad of [image.replace('https:', 'http:'), image.replace('/test/', '/other/'), image.replace('/image/', '/video/'), image + '?test=1', image.replace('/v123/', '/w_100/'), image.replace('res.cloudinary.com', 'example.test')]) expect(managedContentImageId(bad, id, 'test')).toBeUndefined();
    expect(managedContentImageId(image, other, 'test')).toBeUndefined();
    expect(managedContentImageId(image, id, undefined)).toBeUndefined();
  });
});
