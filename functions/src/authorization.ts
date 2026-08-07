import { HttpsError } from 'firebase-functions/v2/https';
import type {
  DocumentAccessScope,
  ProfileRecord,
  QuoteRecord,
  RequestRecord,
} from './contracts.js';

export function isDirectReport(actor: ProfileRecord, candidate: ProfileRecord): boolean {
  return (
    actor.role === 'operator' &&
    candidate.role === 'operator' &&
    candidate.status === 'active' &&
    candidate.supervisorId === actor.uid &&
    candidate.teamId !== null &&
    candidate.teamId === actor.teamId
  );
}

export function canAccessRequest(actor: ProfileRecord, serviceRequest: RequestRecord): boolean {
  if (actor.role === 'admin') return true;
  return (
    serviceRequest.createdBy === actor.uid ||
    serviceRequest.assigneeId === actor.uid ||
    serviceRequest.supervisorId === actor.uid
  );
}

export function canAssignRequest(
  actor: ProfileRecord,
  serviceRequest: RequestRecord,
  recipient: ProfileRecord,
): boolean {
  if (recipient.role !== 'operator' || recipient.status !== 'active') return false;
  if (actor.role === 'admin') return true;
  return (
    canAccessRequest(actor, serviceRequest) &&
    (recipient.uid === actor.uid || isDirectReport(actor, recipient))
  );
}

export function assertRequestRelations(
  serviceRequest: Pick<RequestRecord, 'clientId' | 'siteId' | 'equipmentId'>,
  siteClientId: string,
  equipment: { clientId: string; siteId: string } | null,
): void {
  if (siteClientId !== serviceRequest.clientId) {
    throw new HttpsError('failed-precondition', 'La instalación no pertenece al cliente.');
  }
  if (
    serviceRequest.equipmentId &&
    (!equipment ||
      equipment.clientId !== serviceRequest.clientId ||
      equipment.siteId !== serviceRequest.siteId)
  ) {
    throw new HttpsError(
      'failed-precondition',
      'El equipo no pertenece al cliente y la instalación seleccionados.',
    );
  }
}

export function assertQuoteRelations(quote: QuoteRecord, serviceRequest: RequestRecord): void {
  if (
    quote.requestId !== serviceRequest.id ||
    quote.clientId !== serviceRequest.clientId ||
    quote.siteId !== serviceRequest.siteId ||
    quote.equipmentId !== serviceRequest.equipmentId
  ) {
    throw new HttpsError(
      'failed-precondition',
      'La cotización contiene relaciones inconsistentes con su solicitud.',
    );
  }
}

export function canManageQuote(
  actor: ProfileRecord,
  quote: QuoteRecord,
  serviceRequest: RequestRecord,
): boolean {
  if (actor.role === 'admin') return true;
  return quote.createdBy === actor.uid && canAccessRequest(actor, serviceRequest);
}

export function canReadDocument(
  actor: ProfileRecord,
  accessScope: DocumentAccessScope,
  relatedRequest: RequestRecord | null,
  relatedQuote: { quote: QuoteRecord; request: RequestRecord } | null,
): boolean {
  if (accessScope === 'all_active') return true;
  if (accessScope === 'admin_only') return actor.role === 'admin';
  if (accessScope === 'request_participants') {
    return relatedRequest !== null && canAccessRequest(actor, relatedRequest);
  }
  return (
    relatedQuote !== null &&
    (actor.role === 'admin' ||
      relatedQuote.quote.createdBy === actor.uid ||
      canAccessRequest(actor, relatedQuote.request))
  );
}

export function assertAuthorized(condition: boolean, message: string): asserts condition {
  if (!condition) throw new HttpsError('permission-denied', message);
}
