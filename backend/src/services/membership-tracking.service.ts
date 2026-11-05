import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { accountMailService } from './account-mail.service';
import { background } from '../utils/background';
import { lockEmail } from '../repositories/account.repository';
import { AppError } from '../utils/app-error';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const otpHash = (id: string, code: string) => createHmac('sha256', env.JWT_SECRET).update(`membership-tracking:${id}:${code}`).digest('hex');
export const trackingMessage = 'If the details match an application, a verification code will be sent to its registered email. Check your inbox and spam folder.';
export const membershipTrackingService = {
  async request(email: string, trackingCode?: string) {
    const delay = new Promise(resolve => setTimeout(resolve, 500));
    const id = randomUUID(), code = String(randomInt(100000, 1000000));
    try {
      if (!await accountMailService.available()) return { challengeId: id, message: trackingMessage };
      const application = await prisma.$transaction(async tx => {
        await lockEmail(tx, email);
        const application = await tx.membershipApplication.findFirst({ where: { email, ...(trackingCode ? { trackingCode } : {}) }, orderBy: { createdAt: 'desc' } });
        if (!application || await tx.membershipTrackingChallenge.findFirst({ where: { applicationId: application.id, createdAt: { gt: new Date(Date.now() - 60000) } } })) return null;
        await tx.membershipTrackingChallenge.create({ data: { id, applicationId: application.id, codeHash: otpHash(id, code), expiresAt: new Date(Date.now() + 10 * 60000) } });
        return application;
      });
      if (application) background((async () => {
        try {
          await accountMailService.send(application.email, 'Verify your membership application tracking', `Your membership tracking verification code is ${code}.\n\nIt expires in 10 minutes and works once. Enter it only on the tracking page you opened. It cannot activate an account. If you did not request this, ignore this email.`, { deliveryKey: id });
          await prisma.membershipTrackingChallenge.updateMany({ where: { id, consumedAt: null }, data: { deliveredAt: new Date() } });
        } catch { /* Generic public response; no token or provider details logged. */ }
      })());
      return { challengeId: id, message: trackingMessage };
    } finally { await delay; }
  },
  async verify(challengeId: string, code: string) {
    const verificationToken = randomBytes(32).toString('hex'), now = new Date();
    const application = await prisma.$transaction(async tx => {
      // Count every guess, including concurrent guesses; throwing inside the
      // transaction would roll back the counter and permit unlimited attempts.
      const claim = await tx.membershipTrackingChallenge.updateMany({ where: { id: challengeId, consumedAt: null, deliveredAt: { not: null }, expiresAt: { gt: now }, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
      if (!claim.count) return null;
      const challenge = await tx.membershipTrackingChallenge.findUniqueOrThrow({ where: { id: challengeId } });
      if (!timingSafeEqual(Buffer.from(challenge.codeHash, 'hex'), Buffer.from(otpHash(challengeId, code), 'hex'))) return null;
      await tx.membershipTrackingChallenge.update({ where: { id: challengeId }, data: { consumedAt: now, proofHash: hash(verificationToken), proofExpiresAt: new Date(Date.now() + 30 * 60000) } });
      return tx.membershipApplication.findUniqueOrThrow({ where: { id: challenge.applicationId }, select: { trackingCode: true } });
    });
    if (!application) throw new AppError(400, 'Verification code is invalid, expired or already used. Request another code.');
    return { trackingCode: application.trackingCode, verificationToken };
  },
  async find(trackingCode: string, verificationToken: string) {
    const challenge = await prisma.membershipTrackingChallenge.findUnique({ where: { proofHash: hash(verificationToken) }, include: { application: true } });
    if (!challenge?.proofExpiresAt || challenge.proofExpiresAt <= new Date() || challenge.application.trackingCode !== trackingCode) return null;
    return challenge.application;
  },
};
