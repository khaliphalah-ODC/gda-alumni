import { createServer, type Socket } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../repositories/platform.repository', () => ({ platformRepository: { settings: async () => ({ emailEnabled: true }) } }));
import { env } from '../config/env';
import { ActivationDeliveryService } from '../services/activation-delivery.service';
const previous = { ...env }, captures: string[] = [], recipients: string[] = [];
const sockets = new Set<Socket>();
const server = createServer(socket => {
  sockets.add(socket); socket.on('close', () => sockets.delete(socket));
  socket.setEncoding('utf8'); socket.write('220 gda.local ESMTP local test catcher\r\n');
  let buffer = '', body = '', readingData = false;
  socket.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\r\n')) {
      const end = buffer.indexOf('\r\n'), line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      if (readingData) {
        if (line === '.') { captures.push(body); body = ''; readingData = false; socket.write('250 queued locally\r\n'); }
        else body += line + '\r\n';
      } else if (/^EHLO/i.test(line)) socket.write('250-gda.local\r\n250 SIZE 1048576\r\n');
      else if (/^DATA/i.test(line)) { readingData = true; socket.write('354 End with dot\r\n'); }
      else if (/^QUIT/i.test(line)) { socket.end('221 Goodbye\r\n'); }
      else { if (/^RCPT TO:/i.test(line)) recipients.push(line); socket.write('250 OK\r\n'); }
    }
  });
});
beforeAll(async () => {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No local catcher');
  Object.assign(env, { NODE_ENV: 'test', EMAIL_PROVIDER: 'development', DEVELOPMENT_MAIL_CAPTURE: true, SMTP_HOST: '127.0.0.1', SMTP_PORT: address.port, SMTP_FROM: 'portal@example.test', FRONTEND_ORIGIN: 'http://localhost:3000' });
});
afterAll(async () => { Object.assign(env, previous); for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); });
describe('real loopback SMTP capture without external delivery', () => {
  it('captures an HTML/plain-text invitation over TCP and returns no activation token', async () => {
    const token = 'a'.repeat(64);
    const result = await new ActivationDeliveryService().send('capture@example.test', '<Applicant>', token);
    expect(result.status).toBe('development'); expect(result.message).toContain('No external inbox delivery');
    expect(JSON.stringify(result)).not.toContain(token); expect(captures).toHaveLength(1);
    expect(recipients).toEqual(['RCPT TO:<capture@example.test>']);
    expect(captures[0]).toContain('Content-Type: text/plain'); expect(captures[0]).toContain('Content-Type: text/html'); expect(captures[0]).toContain('&lt;Applicant&gt;');
  });
});
