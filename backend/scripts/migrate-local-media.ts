import 'dotenv/config';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { env } from '../src/config/env';
import { localAssetPath, localMediaRoot, localMediaOrigin } from '../src/services/local-media';
import { gallerySchema, achievementSchema } from '../src/validators/showcase.validator';

type Operation = { kind: 'post' | 'staff' | 'alumni' | 'seed'; id: string; source: string; oldUrl: string | null; oldPublicId?: string | null; version: number; publicId: string; url?: string; state: 'planned' | 'uploaded' | 'committed'; data?: Prisma.PostUncheckedCreateInput };
type Journal = { version: 1; createdAt: string; databaseHost: string; databaseName: string; operations: Operation[] };
const db = new PrismaClient({ log: [] });
const args = process.argv.slice(2), apply = args.includes('--apply');
function option(name: string) { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; }
const manifest = resolve(option('--manifest') ?? `backups/local-media-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
async function save(journal: Journal) { await mkdir(dirname(manifest), { recursive: true, mode: 0o700 }); await writeFile(manifest, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 }); }
function localAsset(url: string | null, id?: string | null) {
  if (id?.startsWith('local/') && localAssetPath(`${id.slice(6)}.webp`)) {
    if (!url || !url.includes('/api/media/images/')) return null;
    return id.slice(6);
  }
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.origin !== localMediaOrigin() && !['localhost', '127.0.0.1'].includes(parsed.hostname)) return null;
    const prefix = '/api/media/images/';
    const path = parsed.pathname.startsWith(prefix) ? parsed.pathname.slice(prefix.length) : '';
    return localAssetPath(path) ? path.slice(0, -5) : null;
  } catch { return null; }
}
async function fileBytes(path: string) {
  const actual = await realpath(path);
  const roots = [await realpath(localMediaRoot).catch(() => localMediaRoot), resolve('../images'), resolve('../frontend/src/assets/excellence')];
  if (!roots.some(root => actual.startsWith(`${root}${sep}`))) throw new Error('Source file is outside the allowed image directories');
  const bytes = await readFile(actual);
  const metadata = await sharp(bytes, { limitInputPixels: 40000000 }).metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '')) throw new Error('Unsupported source image');
  return bytes;
}
async function plan(): Promise<Journal> {
  const url = new URL(env.DATABASE_URL);
  const operations: Operation[] = [];
  const [posts, alumni, staff] = await Promise.all([
    db.post.findMany({ select: { id: true, image: true, version: true } }),
    db.alumniProfile.findMany({ select: { id: true, profileImage: true, profileImagePublicId: true, imageVersion: true } }),
    db.staffProfile.findMany({ select: { id: true, profileImage: true, profileImagePublicId: true, imageVersion: true } }),
  ]);
  for (const post of posts) {
    const asset = localAsset(post.image); if (!asset) continue;
    operations.push({ kind: 'post', id: post.id, oldUrl: post.image, version: post.version, source: resolve(localMediaRoot, `${asset}.webp`), publicId: `gda-aims/content-images/${post.id}/${randomUUID()}`, state: 'planned' });
  }
  for (const [kind, rows] of [['alumni', alumni], ['staff', staff]] as const) for (const row of rows) {
    const asset = localAsset(row.profileImage, row.profileImagePublicId); if (!asset) continue;
    operations.push({ kind, id: row.id, oldUrl: row.profileImage, oldPublicId: row.profileImagePublicId, version: row.imageVersion, source: resolve(localMediaRoot, `${asset}.webp`), publicId: `gda-aims/profile-pictures/${randomUUID()}`, state: 'planned' });
  }
  if (args.includes('--import-curated')) {
    const admins = await db.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    const adminId = option('--admin-id') ?? (admins.length === 1 ? admins[0].id : undefined);
    if (!adminId || !admins.some(admin => admin.id === adminId)) throw new Error('Choose an active school Admin with --admin-id when there is not exactly one');
    const settings = await db.platformSettings.findUnique({ where: { id: 1 } });
    const entries = JSON.parse(await readFile(resolve('data/curated-showcase.json'), 'utf8')) as { legacyKey: string; type: 'GALLERY' | 'ACHIEVEMENT'; file: string; data: Record<string, unknown> }[];
    for (const entry of entries) {
      if ((entry.type === 'GALLERY' && settings?.galleryManaged) || (entry.type === 'ACHIEVEMENT' && settings?.achievementsManaged)) continue;
      if (await db.post.findUnique({ where: { legacyKey: entry.legacyKey } })) continue;
      const data = (entry.type === 'GALLERY' ? gallerySchema : achievementSchema).parse(entry.data);
      const id = `c${randomBytes(12).toString('hex')}`;
      operations.push({ kind: 'seed', id, oldUrl: null, version: 0, source: resolve('..', entry.file), publicId: `gda-aims/content-images/${id}/${randomUUID()}`, state: 'planned', data: { ...data, id, type: entry.type, legacyKey: entry.legacyKey, createdBy: adminId, isPublished: true, publishedAt: new Date() } });
    }
  }
  return { version: 1, createdAt: new Date().toISOString(), databaseHost: url.hostname, databaseName: url.pathname, operations };
}
async function upload(operation: Operation) {
  const bytes = await fileBytes(operation.source);
  // A planned ID is persisted before upload. Resume can recover an upload that
  // succeeded just before the process stopped, without creating another asset.
  let resource: { public_id: string; secure_url: string } | undefined;
  try { resource = await cloudinary.api.resource(operation.publicId, { resource_type: 'image' }); }
  catch (error) { if ((error as { error?: { http_code?: number } }).error?.http_code !== 404 && (error as { http_code?: number }).http_code !== 404) throw error; }
  if (!resource) resource = await new Promise<{ public_id: string; secure_url: string }>((resolveUpload, reject) => {
    cloudinary.uploader.upload_stream({ public_id: operation.publicId, overwrite: false, resource_type: 'image', timeout: 30000 }, (error, result) => error || !result ? reject(new Error('Cloud upload failed')) : resolveUpload(result)).end(bytes);
  });
  if (!resource || resource.public_id !== operation.publicId || !resource.secure_url.startsWith('https://')) throw new Error('Provider asset verification failed');
  const response = await fetch(resource.secure_url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Hosted image could not be retrieved');
  await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  return resource.secure_url;
}
async function commit(operation: Operation) {
  await db.$transaction(async tx => {
    if (operation.kind === 'seed') {
      const existing = await tx.post.findUnique({ where: { id: operation.id } });
      if (existing) { if (existing.image !== operation.url || existing.legacyKey !== operation.data?.legacyKey) throw new Error('Imported entry changed; review the manifest'); return; }
      await tx.post.create({ data: { ...operation.data!, image: operation.url } });
    } else if (operation.kind === 'post') {
      const current = await tx.post.findUnique({ where: { id: operation.id } });
      if (current?.image === operation.url) return;
      const changed = await tx.post.updateMany({ where: { id: operation.id, image: operation.oldUrl, version: operation.version }, data: { image: operation.url, version: { increment: 1 } } });
      if (changed.count !== 1) throw new Error('Content changed; migration did not overwrite it');
    } else {
      const current = operation.kind === 'alumni' ? await tx.alumniProfile.findUnique({ where: { id: operation.id } }) : await tx.staffProfile.findUnique({ where: { id: operation.id } });
      if (current && current.profileImage === operation.url && current.profileImagePublicId === operation.publicId) return;
      const update = { where: { id: operation.id, profileImage: operation.oldUrl, profileImagePublicId: operation.oldPublicId, imageVersion: operation.version }, data: { profileImage: operation.url, profileImagePublicId: operation.publicId, imageVersion: { increment: 1 } } };
      const changed = operation.kind === 'alumni' ? await tx.alumniProfile.updateMany(update) : await tx.staffProfile.updateMany(update);
      if (changed.count !== 1) throw new Error('Profile changed; migration did not overwrite it');
    }
    await tx.auditRecord.create({ data: { action: 'LOCAL_IMAGE_MIGRATED', targetId: operation.id } });
  });
}
async function main() {
  let journal: Journal;
  try { journal = JSON.parse(await readFile(manifest, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; journal = await plan(); await save(journal); }
  const url = new URL(env.DATABASE_URL);
  if (journal.version !== 1 || journal.databaseHost !== url.hostname || journal.databaseName !== url.pathname) throw new Error('The manifest belongs to a different database');
  const pending = journal.operations.filter(operation => operation.state !== 'committed');
  for (const operation of pending) await fileBytes(operation.source);
  console.log(`Plan: ${journal.operations.length} images; ${pending.length} pending. Private manifest: ${manifest}`);
  if (!apply) { console.log('Dry run only. Original files and database records are unchanged. Re-run with --apply --manifest and this file path.'); return; }
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) throw new Error('Cloudinary credentials are required');
  cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true, timeout: 30000 });
  await cloudinary.api.ping();
  for (const operation of pending) {
    if (operation.state === 'planned') { operation.url = await upload(operation); operation.state = 'uploaded'; await save(journal); }
    await commit(operation); operation.state = 'committed'; await save(journal);
    console.log(`Verified and migrated ${journal.operations.filter(item => item.state === 'committed').length}/${journal.operations.length}.`);
  }
  const gallery = journal.operations.some(item => item.kind === 'seed' && item.data?.type === 'GALLERY');
  const achievements = journal.operations.some(item => item.kind === 'seed' && item.data?.type === 'ACHIEVEMENT');
  if (gallery || achievements) {
    const flags = { ...(gallery ? { galleryManaged: true } : {}), ...(achievements ? { achievementsManaged: true } : {}) };
    await db.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, ...flags }, update: flags });
  }
  console.log('Migration completed. Original image files were retained. Configure MEDIA_STORAGE=cloudinary before hosting.');
}
main().catch(() => { console.error('Migration stopped without overwriting changed records. Review the private manifest and source files, then resume with the same manifest. Provider errors and credentials were not logged.'); process.exitCode = 1; }).finally(() => db.$disconnect());
