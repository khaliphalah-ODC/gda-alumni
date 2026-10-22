import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function netlifyRedirects(origin, apiBase = '/api') {
  if (apiBase !== '/api') throw new Error('Set VITE_API_URL=/api for the Netlify API proxy.');
  let target;
  try { target = new URL(origin); } catch { throw new Error('Set API_PROXY_ORIGIN to the public HTTPS origin of the Railway API.'); }
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash || target.pathname !== '/') {
    throw new Error('API_PROXY_ORIGIN must be an HTTPS origin without a path, query or credentials.');
  }
  // The API rule must precede the Vue Router fallback, including POST uploads.
  return `/api/*  ${target.origin}/api/:splat  200!\n/*  /index.html  200\n`;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const output = new URL('../frontend/dist/_redirects', import.meta.url);
    await writeFile(output, netlifyRedirects(process.env.API_PROXY_ORIGIN, process.env.VITE_API_URL || '/api'));
    console.log('Netlify API proxy and Vue route fallback written.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
