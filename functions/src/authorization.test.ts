import { describe, expect, it } from 'vitest';
import {
  assertQuoteRelations,
  assertRequestRelations,
  canAccessRequest,
  canAssignRequest,
  canManageQuote,
  canReadDocument,
} from './authorization.js';
import type { ProfileRecord, QuoteRecord, RequestRecord } from './contracts.js';

const primary: ProfileRecord = {
  uid: 'primary',
  email: 'primary@example.test',
  displayName: 'Primary',
  role: 'admin',
  status: 'active',
  supervisorId: null,
  teamId: null,
  isPrimaryAdmin: true,
};
const supervisor: ProfileRecord = {
  uid: 'supervisor-a',
  email: 'supervisor@example.test',
  displayName: 'Supervisor',
  role: 'operator',
  status: 'active',
  supervisorId: null,
  teamId: 'team-a',
  isPrimaryAdmin: false,
};
const subordinate: ProfileRecord = {
  uid: 'operator-a',
  email: 'operator@example.test',
  displayName: 'Operator',
  role: 'operator',
  status: 'active',
  supervisorId: supervisor.uid,
  teamId: 'team-a',
  isPrimaryAdmin: false,
};
const otherTeam: ProfileRecord = {
  uid: 'operator-b',
  email: 'other@example.test',
  displayName: 'Other',
  role: 'operator',
  status: 'active',
  supervisorId: 'supervisor-b',
  teamId: 'team-b',
  isPrimaryAdmin: false,
};
const serviceRequest: RequestRecord = {
  id: 'request-a',
  clientId: 'client-a',
  siteId: 'site-a',
  equipmentId: 'equipment-a',
  createdBy: subordinate.uid,
  assigneeId: subordinate.uid,
  supervisorId: supervisor.uid,
  status: 'assigned',
  folio: 'SOL-DEV-2026-00001',
};
const quote: QuoteRecord = {
  id: 'quote-a',
  requestId: serviceRequest.id,
  clientId: serviceRequest.clientId,
  siteId: serviceRequest.siteId,
  equipmentId: serviceRequest.equipmentId,
  createdBy: subordinate.uid,
  status: 'draft',
  locked: false,
  folio: null,
  revisionNumber: 0,
  originalQuoteId: null,
};

describe('authorization boundaries', () => {
  it('allows only the owning team to access and assign a supervisor request', () => {
    expect(canAccessRequest(supervisor, serviceRequest)).toBe(true);
    expect(canAssignRequest(supervisor, serviceRequest, subordinate)).toBe(true);
    expect(canAssignRequest(supervisor, serviceRequest, supervisor)).toBe(true);
    expect(canAssignRequest(supervisor, serviceRequest, otherTeam)).toBe(false);
    expect(canAccessRequest(otherTeam, serviceRequest)).toBe(false);
    expect(canAssignRequest(primary, serviceRequest, otherTeam)).toBe(true);
  });

  it('requires quote ownership plus request access for operators', () => {
    expect(canManageQuote(subordinate, quote, serviceRequest)).toBe(true);
    expect(canManageQuote(supervisor, quote, serviceRequest)).toBe(false);
    expect(canManageQuote(otherTeam, quote, serviceRequest)).toBe(false);
    expect(canManageQuote(primary, quote, serviceRequest)).toBe(true);
  });

  it('rejects inconsistent client, site, equipment and quote relationships', () => {
    expect(() => assertRequestRelations(serviceRequest, 'other-client', null)).toThrow();
    expect(() =>
      assertRequestRelations(serviceRequest, 'client-a', {
        clientId: 'client-a',
        siteId: 'other-site',
      }),
    ).toThrow();
    expect(() =>
      assertQuoteRelations({ ...quote, clientId: 'other-client' }, serviceRequest),
    ).toThrow();
    expect(() => assertQuoteRelations(quote, serviceRequest)).not.toThrow();
  });

  it('uses one accessScope contract for all private documents and manuals', () => {
    expect(canReadDocument(subordinate, 'all_active', null, null)).toBe(true);
    expect(canReadDocument(subordinate, 'admin_only', null, null)).toBe(false);
    expect(canReadDocument(primary, 'admin_only', null, null)).toBe(true);
    expect(canReadDocument(supervisor, 'request_participants', serviceRequest, null)).toBe(true);
    expect(canReadDocument(otherTeam, 'request_participants', serviceRequest, null)).toBe(false);
    expect(
      canReadDocument(subordinate, 'quote_participants', null, { quote, request: serviceRequest }),
    ).toBe(true);
  });
});
