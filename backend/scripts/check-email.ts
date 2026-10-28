import { z } from 'zod';
import { emailConfiguration } from '../src/services/email.service';
import { accountMailService } from '../src/services/account-mail.service';
import { prisma } from '../src/config/prisma';

class EmailCheckError extends Error {}

export async function checkEmail(args = process.argv.slice(2)) {
  const configuration = emailConfiguration();
  if (!configuration.configured) throw new EmailCheckError('Configure EMAIL_PROVIDER=brevo or smtp and its required server variables.');
  console.log(`Email provider: ${configuration.provider}. Required local configuration is present; provider access and inbox delivery are not verified.`);
  if (!args.includes('--send-test')) {
    console.log('No network request or email was sent. A real test requires EMAIL_TEST_RECIPIENT plus --send-test --confirm-send after user confirmation.');
    return;
  }
  if (!args.includes('--confirm-send')) throw new EmailCheckError('Sending requires explicit confirmation with --send-test --confirm-send.');
  const recipient = z.string().trim().email().safeParse(process.env.EMAIL_TEST_RECIPIENT);
  if (!recipient.success) throw new EmailCheckError('Configure one valid EMAIL_TEST_RECIPIENT before sending a test.');
  await accountMailService.send(recipient.data, 'GDA-AIMS email delivery test',
    'This is the single email delivery test you explicitly requested. No account, activation link or password reset was created.',
    { deliveryKey: 'gda-email-delivery-diagnostic' });
  console.log('One test message was accepted by the selected provider. Check the configured recipient inbox and spam folder.');
}

if (require.main === module) {
  checkEmail().catch((error: unknown) => {
    console.error(error instanceof EmailCheckError ? error.message : 'Email check failed. Verify provider credentials and platform settings. No credentials were logged.');
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
}
