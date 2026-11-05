import { createHash, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { resolveEmailProvider } from '../config/email';
import { AppError } from '../utils/app-error';

const senderName = 'Gray D. Allison Alumni Portal';
export interface EmailOptions { html?: string; deliveryKey?: string }
export class EmailDeliveryError extends AppError {
  constructor(public readonly diagnostic: string, public readonly retrySafe = false) {
    super(503, 'Email delivery failed. Please try again later');
  }
}

export function emailConfiguration() {
  const provider = resolveEmailProvider(env);
  const configured = provider === 'brevo'
    ? Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL && env.BREVO_SENDER_NAME)
    : provider === 'smtp' ? Boolean(env.SMTP_HOST && env.SMTP_FROM)
      : env.NODE_ENV !== 'production' && env.DEVELOPMENT_MAIL_CAPTURE && ['localhost', '127.0.0.1', '::1'].includes(env.SMTP_HOST ?? '') && Boolean(env.SMTP_FROM);
  return {
    provider, configured, sender: provider === 'brevo' ? env.BREVO_SENDER_EMAIL ?? null : env.SMTP_FROM ?? null,
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
      if (!configuration.configured) throw new EmailDeliveryError('EMAIL_NOT_CONFIGURED', true);
      const html = options.html ?? htmlFromText(text);
      if (configuration.provider === 'smtp' || configuration.provider === 'development') {
        // Plain SMTP is allowed only for an explicitly selected loopback catcher.
        const transport = configuration.provider === 'development'
          ? { ...smtpOptions(), secure: false, requireTLS: false, ignoreTLS: true, auth: undefined } : smtpOptions();
        const result = await nodemailer.createTransport(transport).sendMail({
          from: { name: senderName, address: env.SMTP_FROM! }, to, subject, text, html,
          ...(options.deliveryKey ? { messageId: `<${createHash('sha256').update(options.deliveryKey).digest('hex')}@${env.SMTP_FROM!.split('@').at(-1)}>` } : {}),
        });
        if (!result.accepted?.length || result.rejected?.length) throw new EmailDeliveryError('RECIPIENT_REJECTED', true);
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
      if (!response.ok && response.status !== 400) throw new EmailDeliveryError(response.status === 401 || response.status === 403 ? 'PROVIDER_AUTHORIZATION' : response.status === 429 ? 'PROVIDER_RATE_LIMIT' : response.status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_REJECTED', response.status < 500);
      const result: unknown = await response.json();
      // Brevo rejects replayed idempotency keys after accepting the first send.
      if (response.status === 400 && result && typeof result === 'object' && 'code' in result && result.code === 'duplicate_parameter') return;
      if (!response.ok || !result || typeof result !== 'object' || !('messageId' in result)
        || typeof result.messageId !== 'string' || !result.messageId.trim()) throw new EmailDeliveryError('PROVIDER_REJECTED', response.status >= 400 && response.status < 500);
    } catch (error) {
      // Never log/return provider response bodies, request headers or credentials.
      // No automatic retries or fallback: a timeout can follow an accepted send.
      if (error instanceof EmailDeliveryError) throw error;
      const smtp = error as { code?: string; command?: string; responseCode?: number };
      if (smtp.code === 'EAUTH') throw new EmailDeliveryError('SMTP_AUTHENTICATION', true);
      if (smtp.responseCode && smtp.responseCode >= 400) throw new EmailDeliveryError('SMTP_REJECTED', true);
      if (smtp.code === 'EDNS' || (smtp.code === 'ECONNECTION' && smtp.command === 'CONN')) throw new EmailDeliveryError('SMTP_CONNECTION', true);
      // An interrupted connection/timeout can follow acceptance. Require an
      // explicit resend rather than risk an automatic duplicate SMTP message.
      throw new EmailDeliveryError('ACCEPTANCE_UNKNOWN');
    }
  },
};
