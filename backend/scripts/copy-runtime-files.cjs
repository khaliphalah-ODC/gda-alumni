const { cpSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
const target = join(root, 'dist/src/services/ai-knowledge');
mkdirSync(target, { recursive: true });
cpSync(join(root, 'src/services/ai-knowledge/pdf.worker.cjs'), join(target, 'pdf.worker.cjs'));
