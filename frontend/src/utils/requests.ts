import type { RequestStatus } from '../types/api';
export const requestStatuses: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'READY_FOR_PICKUP', 'COMPLETED'];
export const requestTransitions: Record<RequestStatus, RequestStatus[]> = {
  SUBMITTED: ['IN_REVIEW'], IN_REVIEW: ['APPROVED', 'REJECTED'], APPROVED: ['READY_FOR_PICKUP'],
  REJECTED: ['IN_REVIEW'], READY_FOR_PICKUP: ['COMPLETED'], COMPLETED: [],
};
export const requestLabel = (value: string) => value.replace(/_/g, ' ');
export const canDeleteRequest = (status: RequestStatus, admin: boolean) => admin || status === 'SUBMITTED' || status === 'REJECTED';
