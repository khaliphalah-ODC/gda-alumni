import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { env } from '../config/env';
import { platformRepository } from '../repositories/platform.repository';
import { accountRepository } from '../repositories/account.repository';
import { accountService, tokenHash } from './account.service';
import { accountMailService } from './account-mail.service';
import { assertPermission } from '../policies/permission.policy';
import type { AuthenticatedUser } from '../types/auth.types';
import { PASSWORD_SALT_ROUNDS } from '../constants/auth.constants';
import { AppError } from '../utils/app-error';
import { mediaConfiguration } from './media.service';
export const platformService = {
  async settings() {
    const settings = await platformRepository.settings();
    return { platformName: settings?.platformName ?? 'Gray D. Allison Alumni Portal', emailEnabled: settings?.emailEnabled ?? false, mediaEnabled: settings?.mediaEnabled ?? false,
      email: { configured: Boolean(env.ACTIVATION_DELIVERY === 'smtp' && env.SMTP_HOST && env.SMTP_FROM), sender: env.SMTP_FROM ?? null, status: 'Not transport-verified; configuration does not prove inbox delivery' },
      media: mediaConfiguration(),
      cloudinary: { configured: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET), cloudName: env.CLOUDINARY_CLOUD_NAME ?? null, maxBytes: env.IMAGE_MAX_BYTES, formats: ['JPEG', 'PNG', 'WebP'], status: 'Not externally verified' } };
  },
  admins(page: number, search: string, active?: boolean) { return platformRepository.admins(page, search, active); },
  async detail(id: string) { const user = await platformRepository.detail(id); if (!user) throw new AppError(404, 'Admin account not found'); return user; },
  async dashboard() { return { ...await platformRepository.dashboard(), settings: await this.settings() }; },
  async updateSettings(actor: AuthenticatedUser, password: string, data: { platformName?: string; emailEnabled?: boolean; mediaEnabled?: boolean }) {
    assertPermission(actor.role, 'PLATFORM_MANAGE'); await accountService.confirm(actor, password);
    const status = await this.settings();
    if (data.emailEnabled && !status.email.configured) throw new AppError(400, 'Configure SMTP on the server before enabling email');
    if (data.mediaEnabled && !status.media.configured) throw new AppError(400, 'Configure image storage on the server before enabling uploads');
    await platformRepository.updateSettings(actor.userId, data); return this.settings();
  },
  async invite(actor: AuthenticatedUser, name: string, email: string, password: string) {
    assertPermission(actor.role, 'PLATFORM_MANAGE'); await accountService.confirm(actor, password); await accountMailService.requireDelivery();
    const token = randomBytes(32).toString('hex');
    const id = await accountRepository.reserve(null, 'ADMIN_INVITE', email, tokenHash(token), new Date(Date.now() + 48 * 3600000), actor.userId, actor.sessionVersion ?? 0, name);
    try { await accountMailService.send(email, 'Activate your administrator account', `Create your administrator password within 48 hours: ${env.FRONTEND_ORIGIN}/admin-activate#token=${token}\nDo not share this private invitation.`); }
    catch (error) { await accountRepository.delivery(id, false); throw error; }
    await accountRepository.delivery(id, true);
  },
  async activate(token: string, password: string) { await accountMailService.requireDelivery(); await accountRepository.consume(tokenHash(token), 'ADMIN_INVITE', await bcrypt.hash(password, PASSWORD_SALT_ROUNDS)); },
  async updateAdmin(actor: AuthenticatedUser, id: string, password: string, data: { fullName?: string; isActive?: boolean }) {
    assertPermission(actor.role, 'PLATFORM_MANAGE'); await accountService.confirm(actor, password); await platformRepository.updateAdmin(actor.userId, id, data);
  },
};
