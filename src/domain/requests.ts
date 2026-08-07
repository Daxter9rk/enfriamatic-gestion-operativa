import type { OperationalStage, RequestStatus } from './model';

const requestTransitions: Record<RequestStatus, readonly RequestStatus[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return requestTransitions[from].includes(to);
}

export function isOperationalStageValid(status: RequestStatus, stage: OperationalStage): boolean {
  if (status === 'pending') return stage === 'reviewing';
  if (status === 'assigned') {
    return ['reviewing', 'diagnosing', 'waiting_information'].includes(stage);
  }
  if (status === 'in_progress') {
    return ['diagnosing', 'waiting_information', 'executing', 'quoting', 'follow_up'].includes(
      stage,
    );
  }
  return true;
}

export function isOverdue(requestedDate: string, status: RequestStatus, now = new Date()): boolean {
  if (status === 'completed' || status === 'cancelled') return false;
  return new Date(`${requestedDate}T23:59:59`).getTime() < now.getTime();
}
