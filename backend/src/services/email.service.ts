import { createHash, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { resolveEmailProvider } from '../config/email';
import { AppError } from '../utils/app-error';

const senderName = 'Gray D. Allison Alumni Portal';
const deliveryFailed = () => new AppError(503, 'Email delivery failed. Please try again later');
export interface EmailOptions { html?: string; deliveryKey?: string }

export function emailConfiguration() {
  const provider = resolveEmailProvider(env);
  const configured = provider === 'brevo'
    ? Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL && env.BREVO_SENDER_NAME)
    : provider === 'smtp' && Boolean(env.SMTP_HOST && env.SMTP_FROM);
  return {
    provider, configured, sender: provider === 'brevo' ? env.BREVO_SENDER_EMAIL ?? null : provider === 'smtp' ? env.SMTP_FROM ?? null : null,
    status: 'Not transport-verified; configuration does not prove inbox delivery',
  };
}

export function smtpOptions() {
  return { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, requireTLS: !env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' as const },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000, disableFileAccess: true, disableUrlAccess: true,
  };
}

function htmlFromText(text: string) {
  const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
  // Preserve existing text templates and make their private HTTPS links clickable.
  return `<div>${text.split(/(https:\/\/[^\s]+)/g).map((part, index) => index % 2 ? `<a href="${escape(part)}">${escape(part)}</a>` : escape(part)).join('').replace(/\n/g, '<br>')}</div>`;
}

function idempotencyKey(event: string | undefined, sender: string, to: string, subject: string, text: string, html: string) {
  if (!event) return randomUUID();
  // A standard UUIDv5: the same event and payload reuse a key without exposing
  // tokens or recipient details in Brevo's idempotency header.
  const namespace = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
  const bytes = createHash('sha1').update(namespace).update(JSON.stringify([event, sender, to, subject, text, html])).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const emailService = {
  async send(to: string, subject: string, text: string, options: EmailOptions = {}): Promise<void> {
    try {
      const configuration = emailConfiguration();
      if (!configuration.configured) throw deliveryFailed();
      const html = options.html ?? htmlFromText(text);
      if (configuration.provider === 'smtp') {
        const result = await nodemailer.createTransport(smtpOptions()).sendMail({
          from: { name: senderName, address: env.SMTP_FROM! }, to, subject, text, html,
        });
        if (!result.accepted?.length || result.rejected?.length) throw deliveryFailed();
        return;
      }
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { 'api-key': env.BREVO_API_KEY!, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { email: env.BREVO_SENDER_EMAIL!, name: env.BREVO_SENDER_NAME! },
          to: [{ email: to }], subject, textContent: text, htmlContent: html,
          headers: { idempotencyKey: idempotencyKey(options.deliveryKey, configuration.sender!, to, subject, text, html) },
        }),
      });
      const result: unknown = await response.json();
      // Brevo rejects replayed idempotency keys after accepting the first send.
      if (response.status === 400 && result && typeof result === 'object' && 'code' in result && result.code === 'duplicate_parameter') return;
      if (!response.ok || !result || typeof result !== 'object' || !('messageId' in result)
        || typeof result.messageId !== 'string' || !result.messageId.trim()) throw deliveryFailed();
    } catch {
      // Never log/return provider response bodies, request headers or credentials.
      // No automatic retries or fallback: a timeout can follow an accepted send.
      throw deliveryFailed();
    }
  },
};
