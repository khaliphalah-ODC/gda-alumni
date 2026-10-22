import nodemailer from 'nodemailer';
import { env } from '../src/config/env';
import { smtpOptions } from '../src/services/activation-delivery.service';
async function main() {
  if (env.ACTIVATION_DELIVERY !== 'smtp') throw new Error('Set ACTIVATION_DELIVERY=smtp and configure SMTP before checking delivery');
  await nodemailer.createTransport(smtpOptions()).verify();
  console.log('SMTP connection and authentication verified. No email was sent; inbox delivery still requires a verified sender/domain.');
}
main().catch(() => { console.error('SMTP verification failed. Check host, TLS, port, credentials and provider sender configuration. No credentials were logged.'); process.exitCode = 1; });
