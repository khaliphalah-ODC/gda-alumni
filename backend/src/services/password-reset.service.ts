import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { passwordResetRepository } from '../repositories/password-reset.repository';
import { accountRepository } from '../repositories/account.repository';
import { accountMailService } from './account-mail.service';
import { tokenHash } from './account.service';
import { background } from '../utils/background';
import { AppError } from '../utils/app-error';
import { env } from '../config/env';
import { PASSWORD_SALT_ROUNDS } from '../constants/auth.constants';

export const recoveryMessage = 'If an eligible account uses that email, a password reset link will be sent. Check your inbox and spam folder.';
export const passwordResetService = {
  async request(email: string) {
    // No address-dependent provider wait in the public response. The minimum delay
    // masks normal lookup/write differences; both paths return the same message.
    const delay = new Promise(resolve => setTimeout(resolve, 500));
    try {
      if (!await accountMailService.available()) throw new AppError(503, 'Password recovery is temporarily unavailable. Please contact the school administrator.');
      const token = randomBytes(32).toString('hex');
      const reset = await passwordResetRepository.issue(email, tokenHash(token));
      if (reset) background((async () => {
        try {
          await accountMailService.send(reset.email, 'Reset your Gray D. Allison portal password',
            `Reset your password within 30 minutes:\n${env.FRONTEND_ORIGIN}/reset-password#token=${token}\n\nThis link works once. If you did not request this, ignore this email; your password has not changed. Never share the link.`, { deliveryKey: reset.id });
          await accountRepository.delivery(reset.id, true);
        } catch { await accountRepository.delivery(reset.id, false); }
      })());
    } finally { await delay; }
  },
  async reset(token: string, newPassword: string) {
    const email = await passwordResetRepository.redeem(tokenHash(token), await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS));
    background(accountMailService.send(email, 'Your portal password was reset', 'Your Gray D. Allison portal password has been reset and all previous sessions have ended. If this was not you, contact the school administrator immediately.', { deliveryKey: tokenHash(token) }));
  },
};
