import type { ApplicationForm } from '../types/api';
export function applicationPayload(form: ApplicationForm) {
  return {
    fullName: form.fullName.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(),
    graduationYear: Number(form.graduationYear), location: form.location.trim(), previousName: form.previousName.trim(),
    studentIndexNumber: form.studentIndexNumber.trim(), lastClassAttended: form.lastClassAttended.trim(),
    verificationInformation: form.verificationInformation.trim(),
  };
}
export function activationTokenFromFragment(fragment: string): string {
  if (!fragment.startsWith('#')) return '';
  const token = new URLSearchParams(fragment.replace(/^#/, '')).get('token');
  return token && /^[a-f0-9]{64}$/.test(token) ? token : '';
}
