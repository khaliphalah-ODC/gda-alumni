import { waitUntil } from '@vercel/functions';
import { env } from '../config/env';

// Do not log provider errors, tokens, addresses or credentials.
export function background(task: Promise<unknown>) {
  const handled = task.catch(() => undefined);
  if (env.VERCEL === '1') waitUntil(handled);
  return handled;
}
