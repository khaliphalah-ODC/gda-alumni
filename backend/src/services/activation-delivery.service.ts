import { platformRepository } from '../repositories/platform.repository';
import { createHash } from 'node:crypto';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';
import { emailConfiguration, emailService } from './email.service';
export { smtpOptions } from './email.service';
export function assertActivationDeliveryConfigured() {
  if (env.NODE_ENV === 'production' && !emailConfiguration().configured) throw new AppError(503, 'Invitation delivery is unavailable. Configure Brevo or secure SMTP before approving or reissuing invitations');
}
export type InvitationDelivery = { status: 'development' | 'sent' | 'failed'; message: string; developmentActivationLink?: string };
export class ActivationDeliveryService {
  async send(email: string, fullName: string, token: string): Promise<InvitationDelivery> {
    assertActivationDeliveryConfigured();
    const link = `${env.FRONTEND_ORIGIN}/activate#token=${token}`;
    if (emailConfiguration().provider === 'development') return { status: 'development', message: 'Development invitation is available privately below.', developmentActivationLink: link };
    try {
      const settings = await platformRepository.settings();
      if (!settings?.emailEnabled) return { status: 'failed', message: 'The decision was saved, but email delivery is disabled. Contact the platform administrator.' };
      await emailService.send(email, 'Activate your approved Gray D. Allison alumni membership',
        `Hello ${fullName},\n\nThe registrar has approved your alumni membership. Create your password using this private invitation:\n\n${link}\n\nThe invitation expires in 48 hours and works once. If you requested a replacement invitation, use the most recent one. Do not share this link. If you did not apply, contact the school registrar.\n\nGray D. Allison Alumni Portal`,
        { deliveryKey: createHash('sha256').update(token).digest('hex') });
      return { status: 'sent', message: 'Invitation accepted by the configured email provider for delivery. Ask the applicant to check their inbox and spam folder.' };
    } catch {
      // Never log provider errors: replies can contain addresses or secrets.
      return { status: 'failed', message: 'The decision was saved, but invitation delivery failed. Check mail configuration and reissue the invitation.' };
    }
  }
}
export const activationDeliveryService = new ActivationDeliveryService();
