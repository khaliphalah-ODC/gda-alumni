import { platformRepository } from '../repositories/platform.repository';
import { createHash } from 'node:crypto';
import { env } from '../config/env';
import { emailConfiguration, emailService, EmailDeliveryError } from './email.service';
export { smtpOptions } from './email.service';
export type InvitationDelivery = { status: 'development' | 'sent' | 'failed' | 'unknown'; message: string; diagnostic?: string; retrySafe?: boolean };
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
export class ActivationDeliveryService {
  async send(email: string, fullName: string, token: string, expiresAt = new Date(Date.now() + 48 * 3600000)): Promise<InvitationDelivery> {
    const configuration = emailConfiguration();
    if (!configuration.configured || (env.NODE_ENV === 'production' && configuration.provider === 'development')) return { status: 'failed', diagnostic: 'EMAIL_NOT_CONFIGURED', retrySafe: true, message: 'Invitation could not be sent. Configure email delivery and retry.' };
    try {
      const settings = await platformRepository.settings();
      if (!settings?.emailEnabled) return { status: 'failed', diagnostic: 'EMAIL_DISABLED', retrySafe: true, message: 'Membership approved. Email delivery is disabled in platform settings; enable it and retry.' };
      const link = `${env.FRONTEND_ORIGIN}/activate#token=${token}`;
      const expiry = expiresAt.toUTCString();
      const text = `Dear ${fullName},\n\nCongratulations!\n\nYour application to join the Gray D. Allison Alumni Community has been reviewed and approved.\n\nActivate your alumni account and create your password:\n${link}\n\nThis personal invitation works once and expires at ${expiry}. If you requested a replacement, use the newest invitation. Never share it.\n\nAfter activation, sign in to your alumni dashboard and complete your profile.\n\nIf you did not submit this application, contact the school through its verified official channels.\n\nGray D. Allison Alumni Management System`;
      const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#1e293b"><main style="max-width:600px;margin:24px auto;background:white;padding:32px"><p style="background:#031935;color:white;padding:20px;font-size:20px;font-weight:bold">Gray D. Allison Alumni Community</p><h1 style="font-size:24px">Your membership has been approved</h1><p>Dear ${escape(fullName)},</p><p>Congratulations! Your application has been reviewed and approved. You are invited to activate your alumni account.</p><p style="margin:32px 0"><a href="${escape(link)}" style="display:inline-block;padding:16px 24px;background:#031935;color:white;text-decoration:none;font-weight:bold">ACTIVATE MY ACCOUNT</a></p><p>This personal invitation can only be used once and expires at <strong>${escape(expiry)}</strong>. Use your newest invitation and never share it.</p><p>After activation, sign in to your alumni dashboard and complete your profile.</p><p>If you did not apply, contact the school through its verified official channels.</p><hr><p>Gray D. Allison Alumni Management System</p></main></body></html>`;
      await emailService.send(email, 'Your Gray D. Allison Alumni Membership Has Been Approved', text,
        { html, deliveryKey: createHash('sha256').update(token).digest('hex') });
      return configuration.provider === 'development'
        ? { status: 'development', message: 'Invitation captured in the local mail catcher. No external inbox delivery occurred.' }
        : { status: 'sent', message: 'Invitation submitted to email provider. Inbox delivery is not confirmed.' };
    } catch (error) {
      const diagnostic = error instanceof EmailDeliveryError ? error.diagnostic : 'DELIVERY_INTERNAL_ERROR';
      const retrySafe = error instanceof EmailDeliveryError && error.retrySafe;
      return { status: retrySafe ? 'failed' : 'unknown', diagnostic, retrySafe, message: retrySafe ? 'Invitation could not be sent. Review the delivery error and retry.' : 'Provider acceptance could not be confirmed. Check provider logs before resending.' };
    }
  }
}
export const activationDeliveryService = new ActivationDeliveryService();
