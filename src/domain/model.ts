export type UserRole = 'admin' | 'operator';
export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';
export type OperationalProfile = 'primary_admin' | 'promoted_admin' | 'supervisor' | 'operator';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  supervisorId: string | null;
  teamId: string | null;
  isPrimaryAdmin: boolean;
}

export type RequestStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export type OperationalStage =
  'reviewing' | 'diagnosing' | 'waiting_information' | 'executing' | 'quoting' | 'follow_up';

export type QuoteRequirement = 'yes' | 'no' | 'undetermined';
export type QuoteStatus =
  'draft' | 'issued' | 'sent' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
export type DiscountDisplayMode = 'detailed' | 'summary' | 'incorporated';
export type DocumentStatus = 'not_generated' | 'generating' | 'ready' | 'failed';

export interface EntityMeta {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  schemaVersion: number;
  active: boolean;
}

export interface Client extends EntityMeta {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  taxId?: string;
}

export interface Site extends EntityMeta {
  id: string;
  clientId: string;
  name: string;
  type: string;
  address: string;
  contactName: string;
  accessNotes: string;
  mapUrl: string;
}

export interface Equipment extends EntityMeta {
  id: string;
  clientId: string;
  siteId: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  capacity: string;
  refrigerant: string;
  status: 'operating' | 'maintenance' | 'inactive';
  specifications: Record<string, string>;
}

export interface ServiceRequest extends EntityMeta {
  id: string;
  folio: string;
  clientId: string;
  siteId: string;
  equipmentId: string | null;
  scope: 'general' | 'equipment';
  serviceType: 'diagnostic' | 'preventive' | 'corrective' | 'installation' | 'inspection' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  requestedDate: string;
  assigneeId: string | null;
  supervisorId: string | null;
  description: string;
  quoteRequirement: QuoteRequirement;
  status: RequestStatus;
  operationalStage: OperationalStage;
}

export interface CatalogItem extends EntityMeta {
  id: string;
  code: string;
  type: 'product' | 'service';
  category: string;
  name: string;
  unit: string;
  brand?: string;
  model?: string;
  basePrice: number;
  taxRate: number;
  imagePath?: string;
}

export interface QuoteLineInput {
  id: string;
  catalogItemId: string | null;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  originalUnitPrice: number;
  discountPercent: number;
  taxRate: number;
}

export interface QuoteLine extends QuoteLineInput {
  finalUnitPrice: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface QuoteTotals {
  gross: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface Quote extends EntityMeta {
  id: string;
  folio: string | null;
  revision: number;
  originalQuoteId: string | null;
  requestId: string;
  clientId: string;
  siteId: string;
  equipmentId: string | null;
  status: QuoteStatus;
  locked: boolean;
  discountDisplayMode: DiscountDisplayMode;
  validityDays: number;
  notes: string;
  conditions: string[];
  totals: QuoteTotals;
}

export interface Notification {
  id: string;
  userId: string;
  type:
    | 'assignment'
    | 'reassignment'
    | 'due_soon'
    | 'overdue'
    | 'quote_issued'
    | 'quote_rejected'
    | 'action_required';
  title: string;
  body: string;
  resourceType: string;
  resourceId: string;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  resource: string;
  resourceId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AppSettings {
  companyName: string;
  taxRate: number;
  quoteValidityDays: number;
  maxDiscountPercent: number;
  quoteFolioPrefix: string;
  requestFolioPrefix: string;
  commercialConditions: string[];
  legalText: string;
  policyStatus: 'dev_provisional' | 'approved';
}

export const collectionNames = [
  'users',
  'teams',
  'clients',
  'sites',
  'equipment',
  'requests',
  'quotes',
  'documents',
  'catalogItems',
  'notifications',
  'auditLogs',
  'settings',
  'manuals',
] as const;
