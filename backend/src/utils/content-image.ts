export const CONTENT_IMAGE_FOLDER = 'gda-aims/content-images/';
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export function contentImagePrefix(postId: string) {
  if (!/^c[a-z0-9]{24}$/.test(postId)) throw new Error('Invalid content identifier');
  return `${CONTENT_IMAGE_FOLDER}${postId}/`;
}
// Only our cloud's untransformed, server-generated asset for this exact post
// can be cleaned up. Pasting another post's URL never grants deletion rights.
export function managedContentImageId(image: string | null | undefined, postId: string, cloudName: string | undefined, localOrigin?: string): string | undefined {
  if (!image) return;
  try {
    const url = new URL(image);
    const localPrefix = `/api/media/images/${contentImagePrefix(postId)}`;
    if (localOrigin && url.origin === new URL(localOrigin).origin && !url.username && !url.password && !url.search && !url.hash && url.pathname.startsWith(localPrefix) && new RegExp(`^${uuid}\\.webp$`).test(url.pathname.slice(localPrefix.length))) {
      return `local/${url.pathname.slice('/api/media/images/'.length, -'.webp'.length)}`;
    }
    if (!cloudName) return;
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.search || url.hash) return;
    const path = url.pathname;
    const base = `/${cloudName}/image/upload/`;
    if (!path.startsWith(base)) return;
    const asset = path.slice(base.length).replace(/^v\d+\//, '');
    const prefix = contentImagePrefix(postId);
    if (!asset.startsWith(prefix) || !new RegExp(`^${uuid}\\.(webp|png|jpe?g)$`, 'i').test(asset.slice(prefix.length))) return;
    return asset.replace(/\.(webp|png|jpe?g)$/i, '');
  } catch { return; }
}
export function managedImagePrefix(prefix: string): boolean {
  return prefix === 'gda-aims/profile-pictures/' || /^gda-aims\/content-images\/c[a-z0-9]{24}\/$/.test(prefix);
}
