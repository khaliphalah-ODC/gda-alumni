// Test-only SMTP fixture. It is never loaded by the production entry point.
const { appendFileSync } = require('node:fs');
const database = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
const outbox = process.env.GDA_TEST_OUTBOX;
if (process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/gda_phase1_test' || !/^\/tmp\/gda-[a-z0-9-]+\.jsonl$/.test(outbox || '')) throw new Error('Mail fixture requires the isolated local test database and private outbox');
require('nodemailer').createTransport = () => ({
  verify: async () => true,
  sendMail: async message => { appendFileSync(outbox, JSON.stringify({ to: message.to, subject: message.subject, text: message.text }) + '\n', { mode: 0o600 }); return { accepted: [message.to], rejected: [] }; },
});
