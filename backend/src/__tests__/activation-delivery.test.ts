vi.mock('../repositories/platform.repository', () => ({ platformRepository: { settings: async () => ({ emailEnabled: true }) } }));
import { afterEach, describe, expect, it, vi } from 'vitest';
const mail = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: mail.createTransport } }));
import { env } from '../config/env';
import { ActivationDeliveryService, smtpOptions } from '../services/activation-delivery.service';
const previous = { ...env };
afterEach(() => { Object.assign(env, previous); vi.resetAllMocks(); });
describe('private activation delivery', () => {
  const service = new ActivationDeliveryService();
  it('sends production invitations through verified TLS without returning the token', async () => {
    Object.assign(env, { NODE_ENV: 'production', ACTIVATION_DELIVERY: 'smtp', FRONTEND_ORIGIN: 'https://school.example', SMTP_HOST: 'smtp.example', SMTP_FROM: 'registrar@school.example', SMTP_SECURE: true });
    mail.createTransport.mockReturnValue({ sendMail: mail.sendMail }); mail.sendMail.mockResolvedValue({ accepted: ['alumni@example.com'], rejected: [] });
    const result = await service.send('alumni@example.com', 'Approved Alumnus', 'a'.repeat(64));
    expect(result.status).toBe('sent'); expect(result).not.toHaveProperty('developmentActivationLink'); expect(JSON.stringify(result)).not.toContain('a'.repeat(64));
    const message = mail.sendMail.mock.calls[0]![0]; expect(message.to).toBe('alumni@example.com'); expect(message.text).toContain('https://school.example/activate#token=');
    expect(mail.createTransport.mock.calls[0]![0].tls.rejectUnauthorized).toBe(true);
  });
  it('requires STARTTLS when implicit TLS is disabled', () => {
    env.SMTP_SECURE = false;
    expect(smtpOptions().requireTLS).toBe(true); expect(smtpOptions().tls.minVersion).toBe('TLSv1.2');
  });
  it('reports a recoverable failure without leaking provider errors or tokens', async () => {
    env.ACTIVATION_DELIVERY = 'smtp'; mail.createTransport.mockReturnValue({ sendMail: mail.sendMail }); mail.sendMail.mockRejectedValue(new Error('private SMTP password recipient details'));
    const result = await service.send('alumni@example.com', 'Applicant', 'b'.repeat(64));
    expect(result.status).toBe('failed'); expect(JSON.stringify(result)).not.toContain('private SMTP'); expect(JSON.stringify(result)).not.toContain('b'.repeat(64));
  });
  it('never exposes development delivery in production', async () => {
    env.NODE_ENV = 'production'; env.ACTIVATION_DELIVERY = 'development';
    await expect(service.send('alumni@example.com', 'Applicant', 'c'.repeat(64))).rejects.toMatchObject({ statusCode: 503 });
  });
});
