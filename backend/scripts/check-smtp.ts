import nodemailer from 'nodemailer';
import { env } from '../src/config/env';
import { smtpOptions } from '../src/services/activation-delivery.service';
import { resolveEmailProvider } from '../src/config/email';
async function main() {
  if (resolveEmailProvider(env) !== 'smtp') throw new Error('Select EMAIL_PROVIDER=smtp and configure SMTP before checking delivery');
  await nodemailer.createTransport(smtpOptions()).verify();
  console.log('SMTP connection and authentication verified. No email was sent; inbox delivery still requires a verified sender/domain.');
}
main().catch(() => { console.error('SMTP verification failed. Check host, TLS, port, credentials and provider sender configuration. No credentials were logged.'); process.exitCode = 1; });
