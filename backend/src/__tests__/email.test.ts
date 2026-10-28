import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn(), settings: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }));
vi.mock('../repositories/platform.repository', () => ({ platformRepository: { settings: mocks.settings } }));
import { env } from '../config/env';
import { resolveEmailProvider } from '../config/email';
import { emailConfiguration, emailService } from '../services/email.service';
import { accountMailService } from '../services/account-mail.service';
import { ActivationDeliveryService } from '../services/activation-delivery.service';
import { checkEmail } from '../../scripts/check-email';

const previous = { ...env, EMAIL_PROVIDER: env.EMAIL_PROVIDER, BREVO_API_KEY: env.BREVO_API_KEY, BREVO_SENDER_EMAIL: env.BREVO_SENDER_EMAIL, BREVO_SENDER_NAME: env.BREVO_SENDER_NAME };
const fetchMock = vi.fn<typeof fetch>();
const recipient = 'recipient@example.test';
const payload = () => JSON.parse(fetchMock.mock.calls.at(-1)![1]!.body as string);
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(env, { NODE_ENV: 'test', EMAIL_PROVIDER: 'brevo', ACTIVATION_DELIVERY: 'development',
    BREVO_API_KEY: 'never-log-this-key', BREVO_SENDER_EMAIL: 'registrar@example.test', BREVO_SENDER_NAME: 'School Registrar' });
  mocks.settings.mockResolvedValue({ emailEnabled: true });
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({ accepted: [recipient], rejected: [] });
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ messageId: '<test@brevo>' }), { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { Object.assign(env, previous); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('email provider selection and HTTPS transport', () => {
  it.each([
    [undefined, 'development', 'development'], [undefined, 'smtp', 'smtp'],
    ['brevo', 'smtp', 'brevo'], ['smtp', 'development', 'smtp'], ['development', 'smtp', 'development'],
  ] as const)('resolves explicit %s and legacy %s to %s', (provider, legacy, selected) => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: provider, ACTIVATION_DELIVERY: legacy })).toBe(selected);
  });
  it('sends HTML and plain text through the fixed Brevo HTTPS endpoint', async () => {
    await accountMailService.send(recipient, 'Existing subject', 'Existing plain text', { html: '<p>Existing HTML</p>', deliveryKey: 'event-one' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.brevo.com/v3/smtp/email');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST', redirect: 'error', headers: { 'api-key': 'never-log-this-key', 'Content-Type': 'application/json' } });
    expect(fetchMock.mock.calls[0]![1]!.signal).toBeInstanceOf(AbortSignal);
    expect(payload()).toMatchObject({ sender: { email: 'registrar@example.test', name: 'School Registrar' }, to: [{ email: recipient }], subject: 'Existing subject', textContent: 'Existing plain text', htmlContent: '<p>Existing HTML</p>' });
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });
  it('keeps text templates intact and escapes names in generated HTML', async () => {
    const text = 'Hello <script>alert("x")</script>\nhttps://school.example/activate#token=private-token';
    await emailService.send(recipient, 'Activation', text);
    expect(payload().textContent).toBe(text);
    expect(payload().htmlContent).toContain('&lt;script&gt;');
    expect(payload().htmlContent).not.toContain('<script>');
    expect(payload().htmlContent).toContain('<a href="https://school.example/activate#token=private-token">');
  });
  it('reuses an opaque UUID for the same event and changes it for a new event', async () => {
    await emailService.send(recipient, 'Subject', 'Private token', { deliveryKey: 'same-event' });
    const first = payload().headers.idempotencyKey;
    expect(first).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    await emailService.send(recipient, 'Subject', 'Private token', { deliveryKey: 'same-event' });
    expect(payload().headers.idempotencyKey).toBe(first);
    await emailService.send(recipient, 'Subject', 'Private token', { deliveryKey: 'new-event' });
    expect(payload().headers.idempotencyKey).not.toBe(first);
  });
  it('treats Brevo idempotency replays as already accepted without resending', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'duplicate_parameter' }), { status: 400 }));
    await expect(emailService.send(recipient, 'Subject', 'Body', { deliveryKey: 'event-one' })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([400, 401, 403, 429, 500, 503])('sanitizes HTTP %s without a retry or SMTP fallback', async status => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'never-log-this-key private-token password' }), { status }));
    await expect(emailService.send(recipient, 'Private', 'private-token')).rejects.toMatchObject({ statusCode: 503, message: 'Email delivery failed. Please try again later' });
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(mocks.createTransport).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
  });
  it.each(['network', 'timeout', 'invalid JSON', 'missing messageId'])('safely handles %s', async failure => {
    if (failure === 'network') fetchMock.mockRejectedValue(new Error('private network credentials'));
    if (failure === 'timeout') fetchMock.mockRejectedValue(new DOMException('private timeout details', 'TimeoutError'));
    if (failure === 'invalid JSON') fetchMock.mockResolvedValue(new Response('private HTML error', { status: 502 }));
    if (failure === 'missing messageId') fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));
    await expect(emailService.send(recipient, 'Subject', 'Body')).rejects.toMatchObject({ statusCode: 503, message: 'Email delivery failed. Please try again later' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('uses the existing TLS SMTP transport when explicitly selected', async () => {
    Object.assign(env, { EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.gmail.com', SMTP_FROM: 'sender@example.test', SMTP_USER: 'sender@example.test', SMTP_PASSWORD: 'test-app-password', SMTP_SECURE: true });
    await accountMailService.send(recipient, 'Subject', 'Body', { html: '<p>Body</p>' });
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp.gmail.com', tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' } }));
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ text: 'Body', html: '<p>Body</p>' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sanitizes SMTP rejection as before', async () => {
    Object.assign(env, { EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.gmail.com', SMTP_FROM: 'sender@example.test' });
    mocks.sendMail.mockResolvedValue({ accepted: [], rejected: [recipient] });
    await expect(accountMailService.send(recipient, 'Subject', 'Body')).rejects.toMatchObject({ statusCode: 503 });
  });
  it('blocks sends when platform email delivery is disabled', async () => {
    mocks.settings.mockResolvedValue({ emailEnabled: false });
    expect(await accountMailService.available()).toBe(false);
    await expect(accountMailService.send(recipient, 'Subject', 'Body')).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('publishes only safe configuration metadata', () => {
    expect(emailConfiguration()).toMatchObject({ provider: 'brevo', configured: true, sender: 'registrar@example.test' });
    expect(JSON.stringify(emailConfiguration())).not.toContain('never-log-this-key');
  });
  it('does not call a provider when Brevo configuration is missing', async () => {
    env.BREVO_API_KEY = undefined;
    await expect(emailService.send(recipient, 'Subject', 'Body')).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('activation compatibility and safe diagnostics', () => {
  const service = new ActivationDeliveryService();
  it('keeps the private development link without sending email', async () => {
    Object.assign(env, { EMAIL_PROVIDER: 'development', ACTIVATION_DELIVERY: 'smtp' });
    expect(await service.send(recipient, 'Member', 'a'.repeat(64))).toMatchObject({ status: 'development', developmentActivationLink: expect.stringContaining('#token=') });
    expect(fetchMock).not.toHaveBeenCalled(); expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(await accountMailService.available()).toBe(false);
  });
  it('uses Brevo for production activation without exposing the token', async () => {
    env.NODE_ENV = 'production';
    const token = 'b'.repeat(64);
    const result = await service.send(recipient, 'Member', token);
    expect(result.status).toBe('sent'); expect(JSON.stringify(result)).not.toContain(token);
    expect(payload().textContent).toContain(`/activate#token=${token}`);
  });
  it('returns a recoverable failed delivery when Brevo rejects the invitation', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"private token"}', { status: 401 }));
    const result = await service.send(recipient, 'Member', 'c'.repeat(64));
    expect(result.status).toBe('failed'); expect(JSON.stringify(result)).not.toContain('private token');
  });
  it('never exposes development activation links in production', async () => {
    Object.assign(env, { NODE_ENV: 'production', EMAIL_PROVIDER: 'development', ACTIVATION_DELIVERY: 'smtp' });
    await expect(service.send(recipient, 'Member', 'd'.repeat(64))).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('checks configuration without making any network requests by default', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await checkEmail([]);
    expect(fetchMock).not.toHaveBeenCalled(); expect(mocks.settings).not.toHaveBeenCalled();
  });
  it('requires both explicit send flags and a configured recipient', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await expect(checkEmail(['--send-test'])).rejects.toThrow('explicit confirmation');
    vi.stubEnv('EMAIL_TEST_RECIPIENT', 'not-an-email');
    await expect(checkEmail(['--send-test', '--confirm-send'])).rejects.toThrow('one valid EMAIL_TEST_RECIPIENT');
    expect(fetchMock).not.toHaveBeenCalled(); vi.unstubAllEnvs();
  });
  it('sends exactly one mocked diagnostic to the explicitly configured test recipient', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubEnv('EMAIL_TEST_RECIPIENT', recipient);
    await checkEmail(['--send-test', '--confirm-send']);
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(payload().to).toEqual([{ email: recipient }]);
    expect(payload().textContent).not.toContain('#token='); vi.unstubAllEnvs();
  });
});
