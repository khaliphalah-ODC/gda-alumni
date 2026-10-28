import { emailConfiguration, emailService, type EmailOptions } from './email.service';
import { platformRepository } from '../repositories/platform.repository';
import { AppError } from '../utils/app-error';
export const emailDisabledMessage = 'Email changes are temporarily unavailable because email verification is not enabled. Please contact the platform administrator for assistance.';
export const accountMailService = {
  async available() {
    const settings = await platformRepository.settings();
    return Boolean(settings?.emailEnabled && emailConfiguration().configured);
  },
  async requireDelivery(emailChange = false) {
    if (!await this.available()) throw new AppError(503, emailChange ? emailDisabledMessage : 'Admin invitations are unavailable until email delivery is configured and enabled');
  },
  async send(to: string, subject: string, text: string, options?: EmailOptions) {
    await this.requireDelivery();
    await emailService.send(to, subject, text, options);
  },
};
