import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../types/auth.types';
import { accountRepository } from '../repositories/account.repository';
import { accountMailService } from './account-mail.service';
import { PASSWORD_SALT_ROUNDS } from '../constants/auth.constants';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const accountService = {
  async me(actor: AuthenticatedUser) {
    const user = await accountRepository.me(actor.userId);
    const { staffProfile, alumniProfile, ...account } = user;
    return { ...account, profile: user.role === 'ALUMNI' ? alumniProfile : staffProfile, emailChangeAvailable: await accountMailService.available() };
  },
  async confirm(actor: AuthenticatedUser, password: string) {
    const user = await accountRepository.credentials(actor.userId);
    if (!user.isActive || user.role !== actor.role || user.sessionVersion !== (actor.sessionVersion ?? 0) || !await bcrypt.compare(password, user.password)) throw new AppError(403, 'Current password is incorrect or the account has changed');
    return user;
  },
  profile(actor: AuthenticatedUser, data: { fullName: string; phone?: string | null; location?: string | null }) { return accountRepository.profile(actor.userId, actor.sessionVersion ?? 0, actor.role, data); },
  async password(actor: AuthenticatedUser, currentPassword: string, newPassword: string) {
    const user = await this.confirm(actor, currentPassword);
    if (await bcrypt.compare(newPassword, user.password)) throw new AppError(400, 'Choose a password different from your current password');
    await accountRepository.changePassword(user.id, user.password, await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS), user.sessionVersion);
  },
  async requestEmail(actor: AuthenticatedUser, email: string, password: string) {
    await accountMailService.requireDelivery(true);
    const user = await this.confirm(actor, password);
    if (email === user.email) throw new AppError(400, 'Choose an email different from your current address');
    const token = randomBytes(32).toString('hex');
    const id = await accountRepository.reserve(user.id, 'EMAIL_CHANGE', email, tokenHash(token), new Date(Date.now() + 30 * 60000), user.id, user.sessionVersion);
    try { await accountMailService.send(email, 'Verify your new email address', `Confirm your email change within 30 minutes: ${env.FRONTEND_ORIGIN}/verify-email#token=${token}\nIf you did not request this, ignore this message.`); }
    catch (error) { await accountRepository.delivery(id, false); throw error; }
    await accountRepository.delivery(id, true);
  },
  async verifyEmail(token: string) {
    await accountMailService.requireDelivery(true);
    const result = await accountRepository.consume(tokenHash(token), 'EMAIL_CHANGE');
    if (result.oldEmail) { try { await accountMailService.send(result.oldEmail, 'Your account email has changed', 'Your portal email address was changed after verification. If this was not you, contact the platform administrator.'); } catch { try { await accountRepository.notificationFailed(result.userId); } catch { /* The verified email change is already committed. */ } } }
  },
};
