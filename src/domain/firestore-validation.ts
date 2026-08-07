import { Timestamp } from 'firebase/firestore';
import type {
  AppSettings,
  AuditLog,
  CatalogItem,
  Client,
  Equipment,
  Notification,
  Quote,
  QuoteLineInput,
  ServiceRequest,
  Site,
  UserProfile,
} from './model';

type Data = Record<string, unknown>;
export type DocumentDecoder<T> = (id: string, value: unknown) => T;

export interface DirectoryRecord {
  id: string;
  name: string;
  active: boolean;
  [key: string]: unknown;
}

export interface ManualRecord {
  id: string;
  title: string;
  description: string;
  accessScope: 'all_active' | 'admin_only';
  version: string;
  publishedAt: string;
  pages: number;
  documentId: string;
  active: boolean;
}

function data(value: unknown, collection: string): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${collection}: documento inválido.`);
  }
  return value as Data;
}

function string(source: Data, field: string, collection: string, allowEmpty = false): string {
  const value = source[field];
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new Error(`${collection}.${field}: cadena inválida.`);
  }
  return value;
}

function optionalString(source: Data, field: string, collection: string): string | null {
  const value = source[field];
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${collection}.${field}: cadena inválida.`);
  return value;
}

function number(source: Data, field: string, collection: string): number {
  const value = source[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${collection}.${field}: número inválido.`);
  }
  return value;
}

function boolean(source: Data, field: string, collection: string): boolean {
  const value = source[field];
  if (typeof value !== 'boolean') throw new Error(`${collection}.${field}: booleano inválido.`);
  return value;
}

function timestamp(source: Data, field: string, collection: string): Timestamp {
  const value = source[field];
  if (!(value instanceof Timestamp)) throw new Error(`${collection}.${field}: timestamp inválido.`);
  return value;
}

function nullableTimestamp(source: Data, field: string, collection: string): Timestamp | null {
  const value = source[field];
  if (value === null || value === undefined) return null;
  if (!(value instanceof Timestamp)) throw new Error(`${collection}.${field}: timestamp inválido.`);
  return value;
}

function oneOf<T extends string>(
  source: Data,
  field: string,
  values: readonly T[],
  collection: string,
): T {
  const value = string(source, field, collection);
  if (!values.includes(value as T)) throw new Error(`${collection}.${field}: valor inválido.`);
  return value as T;
}

function meta(source: Data, collection: string) {
  return {
    createdAt: timestamp(source, 'createdAt', collection),
    createdBy: string(source, 'createdBy', collection),
    updatedAt: timestamp(source, 'updatedAt', collection),
    updatedBy: string(source, 'updatedBy', collection),
    schemaVersion: number(source, 'schemaVersion', collection),
    active: boolean(source, 'active', collection),
  };
}

export const decodeUserProfile: DocumentDecoder<UserProfile> = (id, value) => {
  const source = data(value, 'users');
  return {
    uid: id,
    email: string(source, 'email', 'users'),
    displayName: string(source, 'displayName', 'users'),
    role: oneOf(source, 'role', ['admin', 'operator'] as const, 'users'),
    status: oneOf(
      source,
      'status',
      ['active', 'inactive', 'pending', 'suspended'] as const,
      'users',
    ),
    supervisorId: optionalString(source, 'supervisorId', 'users'),
    teamId: optionalString(source, 'teamId', 'users'),
    isPrimaryAdmin: source.isPrimaryAdmin === true,
  };
};

export const decodeClient: DocumentDecoder<Client> = (id, value) => {
  const source = data(value, 'clients');
  const taxId = optionalString(source, 'taxId', 'clients');
  return {
    id,
    name: string(source, 'name', 'clients'),
    contactName: string(source, 'contactName', 'clients'),
    email: string(source, 'email', 'clients'),
    phone: string(source, 'phone', 'clients'),
    ...(taxId ? { taxId } : {}),
    ...meta(source, 'clients'),
  };
};

export const decodeSite: DocumentDecoder<Site> = (id, value) => {
  const source = data(value, 'sites');
  return {
    id,
    clientId: string(source, 'clientId', 'sites'),
    name: string(source, 'name', 'sites'),
    type: string(source, 'type', 'sites'),
    address: string(source, 'address', 'sites'),
    contactName: string(source, 'contactName', 'sites'),
    accessNotes: string(source, 'accessNotes', 'sites', true),
    mapUrl: string(source, 'mapUrl', 'sites', true),
    ...meta(source, 'sites'),
  };
};

export const decodeEquipment: DocumentDecoder<Equipment> = (id, value) => {
  const source = data(value, 'equipment');
  const specifications = data(source.specifications ?? {}, 'equipment.specifications');
  const safeSpecifications: Record<string, string> = {};
  for (const [key, item] of Object.entries(specifications)) {
    if (typeof item !== 'string') throw new Error('equipment.specifications: valor inválido.');
    safeSpecifications[key] = item;
  }
  return {
    id,
    clientId: string(source, 'clientId', 'equipment'),
    siteId: string(source, 'siteId', 'equipment'),
    category: string(source, 'category', 'equipment'),
    brand: string(source, 'brand', 'equipment'),
    model: string(source, 'model', 'equipment'),
    serialNumber: string(source, 'serialNumber', 'equipment'),
    capacity: string(source, 'capacity', 'equipment', true),
    refrigerant: string(source, 'refrigerant', 'equipment', true),
    status: oneOf(source, 'status', ['operating', 'maintenance', 'inactive'] as const, 'equipment'),
    specifications: safeSpecifications,
    ...meta(source, 'equipment'),
  };
};

export const decodeServiceRequest: DocumentDecoder<ServiceRequest> = (id, value) => {
  const source = data(value, 'requests');
  return {
    id,
    folio: string(source, 'folio', 'requests'),
    clientId: string(source, 'clientId', 'requests'),
    siteId: string(source, 'siteId', 'requests'),
    equipmentId: optionalString(source, 'equipmentId', 'requests'),
    scope: oneOf(source, 'scope', ['general', 'equipment'] as const, 'requests'),
    serviceType: oneOf(
      source,
      'serviceType',
      ['diagnostic', 'preventive', 'corrective', 'installation', 'inspection', 'other'] as const,
      'requests',
    ),
    priority: oneOf(source, 'priority', ['low', 'medium', 'high', 'critical'] as const, 'requests'),
    requestedDate: string(source, 'requestedDate', 'requests'),
    assigneeId: optionalString(source, 'assigneeId', 'requests'),
    supervisorId: optionalString(source, 'supervisorId', 'requests'),
    description: string(source, 'description', 'requests'),
    quoteRequirement: oneOf(
      source,
      'quoteRequirement',
      ['yes', 'no', 'undetermined'] as const,
      'requests',
    ),
    status: oneOf(
      source,
      'status',
      ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'] as const,
      'requests',
    ),
    operationalStage: oneOf(
      source,
      'operationalStage',
      [
        'reviewing',
        'diagnosing',
        'waiting_information',
        'executing',
        'quoting',
        'follow_up',
      ] as const,
      'requests',
    ),
    ...meta(source, 'requests'),
  };
};

export const decodeCatalogItem: DocumentDecoder<CatalogItem> = (id, value) => {
  const source = data(value, 'catalogItems');
  const brand = optionalString(source, 'brand', 'catalogItems');
  const model = optionalString(source, 'model', 'catalogItems');
  const imagePath = optionalString(source, 'imagePath', 'catalogItems');
  return {
    id,
    code: string(source, 'code', 'catalogItems'),
    type: oneOf(source, 'type', ['product', 'service'] as const, 'catalogItems'),
    category: string(source, 'category', 'catalogItems'),
    name: string(source, 'name', 'catalogItems'),
    unit: string(source, 'unit', 'catalogItems'),
    ...(brand ? { brand } : {}),
    ...(model ? { model } : {}),
    basePrice: number(source, 'basePrice', 'catalogItems'),
    taxRate: number(source, 'taxRate', 'catalogItems'),
    ...(imagePath ? { imagePath } : {}),
    ...meta(source, 'catalogItems'),
  };
};

function decodeTotals(value: unknown) {
  const source = data(value, 'quotes.totals');
  return {
    gross: number(source, 'gross', 'quotes.totals'),
    discount: number(source, 'discount', 'quotes.totals'),
    subtotal: number(source, 'subtotal', 'quotes.totals'),
    tax: number(source, 'tax', 'quotes.totals'),
    total: number(source, 'total', 'quotes.totals'),
  };
}

export const decodeQuote: DocumentDecoder<Quote> = (id, value) => {
  const source = data(value, 'quotes');
  const conditions = source.conditions;
  if (!Array.isArray(conditions) || conditions.some((item) => typeof item !== 'string')) {
    throw new Error('quotes.conditions: lista inválida.');
  }
  return {
    id,
    folio: optionalString(source, 'folio', 'quotes'),
    revision: number(source, 'revision', 'quotes'),
    revisionNumber: number(source, 'revisionNumber', 'quotes'),
    originalQuoteId: optionalString(source, 'originalQuoteId', 'quotes'),
    requestId: string(source, 'requestId', 'quotes'),
    clientId: string(source, 'clientId', 'quotes'),
    siteId: string(source, 'siteId', 'quotes'),
    equipmentId: optionalString(source, 'equipmentId', 'quotes'),
    supervisorId: optionalString(source, 'supervisorId', 'quotes'),
    status: oneOf(
      source,
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
    locked: boolean(source, 'locked', 'quotes'),
    discountDisplayMode: oneOf(
      source,
      'discountDisplayMode',
      ['detailed', 'summary', 'incorporated'] as const,
      'quotes',
    ),
    validityDays: number(source, 'validityDays', 'quotes'),
    notes: string(source, 'notes', 'quotes', true),
    conditions: conditions.map(String),
    totals: decodeTotals(source.totals),
    documentId: optionalString(source, 'documentId', 'quotes'),
    documentStatus: oneOf(
      source,
      'documentStatus',
      ['not_generated', 'generating', 'ready', 'failed'] as const,
      'quotes',
    ),
    ...meta(source, 'quotes'),
  };
};

export const decodeQuoteLine: DocumentDecoder<QuoteLineInput> = (id, value) => {
  const source = data(value, 'quoteItems');
  return {
    id,
    catalogItemId: optionalString(source, 'catalogItemId', 'quoteItems'),
    code: string(source, 'code', 'quoteItems'),
    description: string(source, 'description', 'quoteItems'),
    unit: string(source, 'unit', 'quoteItems'),
    quantity: number(source, 'quantity', 'quoteItems'),
    originalUnitPrice: number(source, 'originalUnitPrice', 'quoteItems'),
    discountPercent: number(source, 'discountPercent', 'quoteItems'),
    taxRate: number(source, 'taxRate', 'quoteItems'),
  };
};

export const decodeNotification: DocumentDecoder<Notification> = (id, value) => {
  const source = data(value, 'notifications');
  return {
    id,
    userId: string(source, 'userId', 'notifications'),
    type: oneOf(
      source,
      'type',
      [
        'assignment',
        'reassignment',
        'due_soon',
        'overdue',
        'quote_issued',
        'quote_rejected',
        'action_required',
      ] as const,
      'notifications',
    ),
    title: string(source, 'title', 'notifications'),
    body: string(source, 'body', 'notifications'),
    resourceType: string(source, 'resourceType', 'notifications'),
    resourceId: string(source, 'resourceId', 'notifications'),
    readAt: nullableTimestamp(source, 'readAt', 'notifications'),
    createdAt: timestamp(source, 'createdAt', 'notifications'),
  };
};

export const decodeAuditLog: DocumentDecoder<AuditLog> = (id, value) => {
  const source = data(value, 'auditLogs');
  return {
    id,
    actorId: string(source, 'actorId', 'auditLogs'),
    actorRole: oneOf(source, 'actorRole', ['admin', 'operator'] as const, 'auditLogs'),
    action: string(source, 'action', 'auditLogs'),
    resource: string(source, 'resource', 'auditLogs'),
    resourceId: string(source, 'resourceId', 'auditLogs'),
    before: source.before === null ? null : data(source.before, 'auditLogs.before'),
    after: source.after === null ? null : data(source.after, 'auditLogs.after'),
    metadata: data(source.metadata ?? {}, 'auditLogs.metadata'),
    createdAt: timestamp(source, 'createdAt', 'auditLogs'),
  };
};

export const decodeSettings: DocumentDecoder<AppSettings & { id: string }> = (id, value) => {
  const source = data(value, 'settings');
  if (
    !Array.isArray(source.commercialConditions) ||
    source.commercialConditions.some((item) => typeof item !== 'string')
  ) {
    throw new Error('settings.commercialConditions: lista inválida.');
  }
  return {
    id,
    companyName: string(source, 'companyName', 'settings'),
    taxRate: number(source, 'taxRate', 'settings'),
    quoteValidityDays: number(source, 'quoteValidityDays', 'settings'),
    maxDiscountPercent: number(source, 'maxDiscountPercent', 'settings'),
    quoteFolioPrefix: string(source, 'quoteFolioPrefix', 'settings'),
    requestFolioPrefix: string(source, 'requestFolioPrefix', 'settings'),
    commercialConditions: source.commercialConditions.map(String),
    legalText: string(source, 'legalText', 'settings', true),
    policyStatus: oneOf(
      source,
      'policyStatus',
      ['dev_provisional', 'approved'] as const,
      'settings',
    ),
  };
};

export const decodeManual: DocumentDecoder<ManualRecord> = (id, value) => {
  const source = data(value, 'manuals');
  return {
    id,
    title: string(source, 'title', 'manuals'),
    description: string(source, 'description', 'manuals'),
    accessScope: oneOf(source, 'accessScope', ['all_active', 'admin_only'] as const, 'manuals'),
    version: string(source, 'version', 'manuals'),
    publishedAt: string(source, 'publishedAt', 'manuals'),
    pages: number(source, 'pages', 'manuals'),
    documentId: string(source, 'documentId', 'manuals'),
    active: boolean(source, 'active', 'manuals'),
  };
};

export const decodeDirectoryRecord: DocumentDecoder<DirectoryRecord> = (id, value) => {
  const source = data(value, 'directory');
  return {
    ...source,
    id,
    name: string(source, 'name', 'directory'),
    active: boolean(source, 'active', 'directory'),
  };
};

export function formatTimestamp(value: Timestamp | null | undefined): string {
  return value ? value.toDate().toLocaleString('es-MX') : '—';
}
