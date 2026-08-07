import { HttpsError } from 'firebase-functions/v2/https';

export type Role = 'admin' | 'operator';
export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export interface ProfileRecord {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  supervisorId: string | null;
  teamId: string | null;
  isPrimaryAdmin: boolean;
}

export interface RequestRecord {
  id: string;
  clientId: string;
  siteId: string;
  equipmentId: string | null;
  createdBy: string;
  assigneeId: string | null;
  supervisorId: string | null;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  folio: string;
}

export interface QuoteRecord {
  id: string;
  requestId: string;
  clientId: string;
  siteId: string;
  equipmentId: string | null;
  createdBy: string;
  status:
    'draft' | 'issuing' | 'issued' | 'sent' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
  locked: boolean;
  folio: string | null;
  revisionNumber: number;
  originalQuoteId: string | null;
}

export type DocumentKind =
  | 'catalog_image'
  | 'request_evidence'
  | 'site_document'
  | 'equipment_document'
  | 'quote_pdf'
  | 'manual';

export type DocumentAccessScope =
  'all_active' | 'admin_only' | 'request_participants' | 'quote_participants';

export interface DocumentRecord {
  id: string;
  kind: DocumentKind;
  accessScope: DocumentAccessScope;
  resourceId: string;
  storagePath: string;
  mimeType: string;
  size: number;
  status: 'ready' | 'failed';
  active: boolean;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('data-loss', `${label} tiene un formato inválido.`);
  }
  return value as UnknownRecord;
}

function requiredString(source: UnknownRecord, field: string, label: string): string {
  const value = source[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpsError('data-loss', `${label}.${field} es inválido.`);
  }
  return value;
}

function nullableString(source: UnknownRecord, field: string, label: string): string | null {
  const value = source[field];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpsError('data-loss', `${label}.${field} es inválido.`);
  }
  return value;
}

function oneOf<T extends string>(
  source: UnknownRecord,
  field: string,
  values: readonly T[],
  label: string,
): T {
  const value = source[field];
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new HttpsError('data-loss', `${label}.${field} es inválido.`);
  }
  return value as T;
}

export function parseProfile(id: string, value: unknown): ProfileRecord {
  const data = record(value, 'users');
  return {
    uid: id,
    email: requiredString(data, 'email', 'users'),
    displayName: requiredString(data, 'displayName', 'users'),
    role: oneOf(data, 'role', ['admin', 'operator'] as const, 'users'),
    status: oneOf(data, 'status', ['active', 'inactive', 'pending', 'suspended'] as const, 'users'),
    supervisorId: nullableString(data, 'supervisorId', 'users'),
    teamId: nullableString(data, 'teamId', 'users'),
    isPrimaryAdmin: data.isPrimaryAdmin === true,
  };
}

export function parseRequest(id: string, value: unknown): RequestRecord {
  const data = record(value, 'requests');
  return {
    id,
    clientId: requiredString(data, 'clientId', 'requests'),
    siteId: requiredString(data, 'siteId', 'requests'),
    equipmentId: nullableString(data, 'equipmentId', 'requests'),
    createdBy: requiredString(data, 'createdBy', 'requests'),
    assigneeId: nullableString(data, 'assigneeId', 'requests'),
    supervisorId: nullableString(data, 'supervisorId', 'requests'),
    status: oneOf(
      data,
      'status',
      ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'] as const,
      'requests',
    ),
    folio: requiredString(data, 'folio', 'requests'),
  };
}

export function parseQuote(id: string, value: unknown): QuoteRecord {
  const data = record(value, 'quotes');
  const revisionNumber = data.revisionNumber ?? data.revision;
  if (!Number.isSafeInteger(revisionNumber) || Number(revisionNumber) < 0) {
    throw new HttpsError('data-loss', 'quotes.revisionNumber es inválido.');
  }
  return {
    id,
    requestId: requiredString(data, 'requestId', 'quotes'),
    clientId: requiredString(data, 'clientId', 'quotes'),
    siteId: requiredString(data, 'siteId', 'quotes'),
    equipmentId: nullableString(data, 'equipmentId', 'quotes'),
    createdBy: requiredString(data, 'createdBy', 'quotes'),
    status: oneOf(
      data,
      'status',
      [
        'draft',
        'issuing',
        'issued',
        'sent',
        'accepted',
        'rejected',
        'cancelled',
        'expired',
      ] as const,
      'quotes',
    ),
    locked: data.locked === true,
    folio: nullableString(data, 'folio', 'quotes'),
    revisionNumber: Number(revisionNumber),
    originalQuoteId: nullableString(data, 'originalQuoteId', 'quotes'),
  };
}

export function parseDocument(id: string, value: unknown): DocumentRecord {
  const data = record(value, 'documents');
  const size = data.size;
  if (!Number.isSafeInteger(size) || Number(size) < 0) {
    throw new HttpsError('data-loss', 'documents.size es inválido.');
  }
  return {
    id,
    kind: oneOf(
      data,
      'kind',
      [
        'catalog_image',
        'request_evidence',
        'site_document',
        'equipment_document',
        'quote_pdf',
        'manual',
      ] as const,
      'documents',
    ),
    accessScope: oneOf(
      data,
      'accessScope',
      ['all_active', 'admin_only', 'request_participants', 'quote_participants'] as const,
      'documents',
    ),
    resourceId: requiredString(data, 'resourceId', 'documents'),
    storagePath: requiredString(data, 'storagePath', 'documents'),
    mimeType: requiredString(data, 'mimeType', 'documents'),
    size: Number(size),
    status: oneOf(data, 'status', ['ready', 'failed'] as const, 'documents'),
    active: data.active === true,
  };
}

export function parseRelationId(value: unknown, field: string): string {
  const data = record(value, field);
  const id = data[field];
  if (typeof id !== 'string' || !id) {
    throw new HttpsError('failed-precondition', `La relación ${field} es inválida.`);
  }
  return id;
}
