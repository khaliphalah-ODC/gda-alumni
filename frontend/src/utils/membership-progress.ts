export interface TrackedMembership {
  trackingCode: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; submittedAt: string;
  reviewedAt: string | null; rejectionReason: string | null; activated: boolean; activatedAt?: string | null;
  invitationStatus: string; invitationAttemptedAt: string | null;
}
export function membershipProgress(application: TrackedMembership) {
  const steps = [
    { label: 'Application submitted', complete: true, current: false },
    { label: 'Pending review', complete: Boolean(application.reviewedAt), current: application.status === 'PENDING' },
  ];
  if (application.status === 'PENDING') return steps;
  steps.push({ label: application.status === 'REJECTED' ? 'Application rejected' : 'Membership approved', complete: true, current: false });
  if (application.status === 'REJECTED') return steps;
  steps.push({ label: application.invitationStatus === 'DEVELOPMENT' ? 'Invitation captured locally (development)' : 'Invitation submitted to email provider', complete: ['SENT', 'DEVELOPMENT'].includes(application.invitationStatus), current: !application.activated && !['SENT', 'DEVELOPMENT'].includes(application.invitationStatus) });
  steps.push({ label: 'Account activated', complete: application.activated, current: !application.activated && application.invitationStatus === 'SENT' });
  return steps;
}
