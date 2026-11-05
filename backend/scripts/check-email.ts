import { z } from 'zod';
import nodemailer from 'nodemailer';
import { env } from '../src/config/env';
import { emailConfiguration, EmailDeliveryError, smtpOptions } from '../src/services/email.service';
import { accountMailService } from '../src/services/account-mail.service';
import { prisma } from '../src/config/prisma';

class EmailCheckError extends Error {}

export async function checkEmail(args = process.argv.slice(2)) {
  const configuration = emailConfiguration();
  if (!configuration.configured) throw new EmailCheckError('Configure EMAIL_PROVIDER=brevo or smtp and its required server variables, or an explicit loopback development catcher.');
  console.log(`Email provider: ${configuration.provider}. Required configuration is present; provider access and inbox delivery are not verified.`);
  if (args.includes('--verify-provider')) {
    const available = await accountMailService.available();
    console.log(`Platform email delivery: ${available ? 'enabled' : 'disabled'}.`);
    if (configuration.provider === 'brevo') {
      for (const path of ['/account', '/senders']) {
        const response = await fetch(`https://api.brevo.com/v3${path}`, { redirect: 'error', headers: { 'api-key': env.BREVO_API_KEY!, accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new EmailCheckError(`Brevo ${path} rejected the read-only check (HTTP ${response.status}). Check API-key validity, account permissions and provider restrictions.`);
        const result = await response.json() as { relay?: { enabled?: boolean }; senders?: { email: string; active: boolean }[] };
        if (path === '/account') console.log(`Brevo relay enabled: ${result.relay?.enabled === true}.`);
        if (path === '/senders') console.log(`Configured sender is active: ${result.senders?.some(sender => sender.email.toLowerCase() === env.BREVO_SENDER_EMAIL?.toLowerCase() && sender.active) === true}.`);
      }
    } else if (configuration.provider === 'smtp') {
      await nodemailer.createTransport(smtpOptions()).verify();
      console.log('SMTP connection and authentication verified. Sender verification and inbox delivery remain unverified.');
    } else console.log('Local capture selected; no external inbox delivery is expected.');
  }
  if (!args.includes('--send-test')) {
    console.log('No email was sent. A real test requires EMAIL_TEST_RECIPIENT plus --send-test --confirm-send after user confirmation. Provider checks make read-only network requests only with --verify-provider.');
    return;
  }
  if (!args.includes('--confirm-send')) throw new EmailCheckError('Sending requires explicit confirmation with --send-test --confirm-send.');
  const recipient = z.string().trim().email().safeParse(process.env.EMAIL_TEST_RECIPIENT);
  if (!recipient.success) throw new EmailCheckError('Configure one valid EMAIL_TEST_RECIPIENT before sending a test.');
  if (!await accountMailService.available()) throw new EmailCheckError('Platform email delivery is disabled. A SuperAdmin must enable it in platform settings after provider configuration is verified. No email was sent.');
  await accountMailService.send(recipient.data, 'GDA-AIMS email delivery test',
    'This is the single email delivery test you explicitly requested. No account, activation link or password reset was created.',
    { deliveryKey: 'gda-email-delivery-diagnostic' });
  console.log(configuration.provider === 'development' ? 'One message was captured locally. No external email was sent.' : 'One test message was accepted by the selected provider. Confirm receipt separately in the recipient inbox and spam folder.');
}

if (require.main === module) {
  checkEmail().catch((error: unknown) => {
    console.error(error instanceof EmailCheckError ? error.message : error instanceof EmailDeliveryError ? `Email check failed: ${error.diagnostic}.` : 'Email check failed. Verify credentials, platform settings and provider connectivity. No credentials were logged.');
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
}
