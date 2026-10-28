export type EmailProvider = 'brevo' | 'smtp' | 'development';

export function resolveEmailProvider(config: { EMAIL_PROVIDER?: EmailProvider; ACTIVATION_DELIVERY: 'smtp' | 'development' }): EmailProvider {
  return config.EMAIL_PROVIDER ?? config.ACTIVATION_DELIVERY;
}
