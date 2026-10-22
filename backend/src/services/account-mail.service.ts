import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { smtpOptions } from './activation-delivery.service';
import { platformRepository } from '../repositories/platform.repository';
import { AppError } from '../utils/app-error';
export const emailDisabledMessage = 'Email changes are temporarily unavailable because email verification is not enabled. Please contact the platform administrator for assistance.';
export const accountMailService = {
  async available() {
    const settings = await platformRepository.settings();
    return Boolean(settings?.emailEnabled && env.ACTIVATION_DELIVERY === 'smtp' && env.SMTP_HOST && env.SMTP_FROM);
  },
  async requireDelivery(emailChange = false) {
    if (!await this.available()) throw new AppError(503, emailChange ? emailDisabledMessage : 'Admin invitations are unavailable until email delivery is configured and enabled');
  },
  async send(to: string, subject: string, text: string) {
    try {
      const result = await nodemailer.createTransport(smtpOptions()).sendMail({ from: { name: 'Gray D. Allison Alumni Portal', address: env.SMTP_FROM! }, to, subject, text });
      if (!result.accepted?.length || result.rejected?.length) throw new Error('Rejected');
    } catch { throw new AppError(503, 'Email delivery failed. Please try again later'); }
  },
};
