import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.pid) {
    if (process.platform === 'win32') child.kill('SIGTERM');
    else { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
  }
  process.exitCode = code;
}
for (const directory of ['backend', 'frontend']) {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], {
    cwd: `${root}${directory}`, stdio: 'inherit', detached: process.platform !== 'win32',
  });
  children.push(child);
  child.on('error', (error) => { console.error(`Could not start ${directory}: ${error.message}`); stop(1); });
  child.on('exit', (code) => { if (!stopping) stop(code || 1); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
