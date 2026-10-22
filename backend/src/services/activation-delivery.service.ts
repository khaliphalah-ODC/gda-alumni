import { platformRepository } from '../repositories/platform.repository';
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';
export function assertActivationDeliveryConfigured() {
  if (env.NODE_ENV === 'production' && env.ACTIVATION_DELIVERY !== 'smtp') throw new AppError(503, 'Invitation delivery is unavailable. Configure secure SMTP before approving or reissuing invitations');
}
export function smtpOptions() {
  return { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, requireTLS: !env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' as const },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000, disableFileAccess: true, disableUrlAccess: true,
  };
}
export type InvitationDelivery = { status: 'development' | 'sent' | 'failed'; message: string; developmentActivationLink?: string };
export class ActivationDeliveryService {
  async send(email: string, fullName: string, token: string): Promise<InvitationDelivery> {
    assertActivationDeliveryConfigured();
    const link = `${env.FRONTEND_ORIGIN}/activate#token=${token}`;
    if (env.ACTIVATION_DELIVERY === 'development') return { status: 'development', message: 'Development invitation is available privately below.', developmentActivationLink: link };
    try {
      const settings = await platformRepository.settings();
      if (!settings?.emailEnabled) return { status: 'failed', message: 'The decision was saved, but email delivery is disabled. Contact the platform administrator.' };
      const transport = nodemailer.createTransport(smtpOptions());
      const result = await transport.sendMail({
        from: { name: 'Gray D. Allison Alumni Portal', address: env.SMTP_FROM! }, to: email,
        subject: 'Activate your approved Gray D. Allison alumni membership',
        text: `Hello ${fullName},\n\nThe registrar has approved your alumni membership. Create your password using this private invitation:\n\n${link}\n\nThe invitation expires in 48 hours and works once. If you requested a replacement invitation, use the most recent one. Do not share this link. If you did not apply, contact the school registrar.\n\nGray D. Allison Alumni Portal`,
      });
      if (!result.accepted?.length || result.rejected?.length) throw new Error('Invitation not accepted');
      return { status: 'sent', message: 'Invitation accepted by the configured mail server for delivery. Ask the applicant to check their inbox and spam folder.' };
    } catch {
      // Never log SMTP errors: provider replies can contain addresses or secrets.
      return { status: 'failed', message: 'The decision was saved, but invitation delivery failed. Check mail configuration and reissue the invitation.' };
    }
  }
}
export const activationDeliveryService = new ActivationDeliveryService();
