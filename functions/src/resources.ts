import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './admin.js';
import { assertAuthorized } from './authorization.js';
import { parseRequest } from './contracts.js';
import {
  auditRecord,
  objectData,
  optionalText,
  requireActor,
  requireAdmin,
  requireRecentAuth,
  text,
} from './security.js';

const options = {
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 6,
  timeoutSeconds: 30,
  memory: '256MiB' as const,
};

type ResourceCollection = 'clients' | 'sites' | 'equipment' | 'catalogItems';

function resourceCollection(value: unknown): ResourceCollection {
  const collection = text(value, 'collection', 30);
  if (!['clients', 'sites', 'equipment', 'catalogItems'].includes(collection)) {
    throw new HttpsError('invalid-argument', 'Recurso no permitido.');
  }
  return collection as ResourceCollection;
}

function numberValue(
  data: Record<string, unknown>,
  field: string,
  minimum: number,
  maximum: number,
) {
  const value = Number(data[field]);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new HttpsError('invalid-argument', `${field} no es válido.`);
  }
  return value;
}

function cleanResourcePayload(collection: ResourceCollection, value: unknown) {
  const data = objectData(value);
  if (collection === 'clients') {
    return {
      name: text(data.name, 'name', 160),
      contactName: text(data.contactName, 'contactName', 120),
      email: text(data.email, 'email', 320).toLowerCase(),
      phone: text(data.phone, 'phone', 40),
      taxId: optionalText(data.taxId, 'taxId', 40),
    };
  }
  if (collection === 'sites') {
    return {
      clientId: text(data.clientId, 'clientId', 128),
      name: text(data.name, 'name', 160),
      type: text(data.type, 'type', 80),
      address: text(data.address, 'address', 400),
      contactName: text(data.contactName, 'contactName', 120),
      accessNotes: optionalText(data.accessNotes, 'accessNotes', 1000) ?? '',
      mapUrl: optionalText(data.mapUrl, 'mapUrl', 500) ?? '',
    };
  }
  if (collection === 'equipment') {
    const status = text(data.status, 'status', 30);
    if (!['operating', 'maintenance', 'inactive'].includes(status)) {
      throw new HttpsError('invalid-argument', 'Estado de equipo no válido.');
    }
    return {
      clientId: text(data.clientId, 'clientId', 128),
      siteId: text(data.siteId, 'siteId', 128),
      name: text(data.name, 'name', 160),
      category: text(data.category, 'category', 100),
      brand: text(data.brand, 'brand', 100),
      model: text(data.model, 'model', 100),
      serialNumber: text(data.serialNumber, 'serialNumber', 120),
      capacity: optionalText(data.capacity, 'capacity', 100) ?? '',
      refrigerant: optionalText(data.refrigerant, 'refrigerant', 80) ?? '',
      status,
      specifications: {},
    };
  }
  const type = text(data.type, 'type', 20);
  if (!['product', 'service'].includes(type)) {
    throw new HttpsError('invalid-argument', 'Tipo de catálogo no válido.');
  }
  return {
    code: text(data.code, 'code', 50),
    name: text(data.name, 'name', 240),
    type,
    category: text(data.category, 'category', 100),
    unit: text(data.unit, 'unit', 40),
    brand: optionalText(data.brand, 'brand', 100),
    model: optionalText(data.model, 'model', 100),
    basePrice: numberValue(data, 'basePrice', 0, 100_000_000),
    taxRate: numberValue(data, 'taxRate', 0, 1),
  };
}

async function validateResourceRelations(
  transaction: FirebaseFirestore.Transaction,
  collection: ResourceCollection,
  payload: Record<string, unknown>,
) {
  if (collection === 'sites') {
    const client = await transaction.get(db.collection('clients').doc(String(payload.clientId)));
    if (!client.exists || client.get('active') === false) {
      throw new HttpsError('failed-precondition', 'El cliente no está disponible.');
    }
  }
  if (collection === 'equipment') {
    const [client, site] = await Promise.all([
      transaction.get(db.collection('clients').doc(String(payload.clientId))),
      transaction.get(db.collection('sites').doc(String(payload.siteId))),
    ]);
    if (
      !client.exists ||
      !site.exists ||
      client.get('active') === false ||
      site.get('active') === false
    ) {
      throw new HttpsError('failed-precondition', 'Cliente o instalación no disponibles.');
    }
    if (site.get('clientId') !== payload.clientId) {
      throw new HttpsError('failed-precondition', 'La instalación no pertenece al cliente.');
    }
  }
}

export const saveOperationalResource = onCall(options, async (request) => {
  const actor = await requireActor(request);
  requireAdmin(actor);
  const data = objectData(request.data);
  const collection = resourceCollection(data.collection);
  const resourceId = optionalText(data.resourceId, 'resourceId', 128);
  const payload = cleanResourcePayload(collection, data.payload);
  const resourceRef = resourceId
    ? db.collection(collection).doc(resourceId)
    : db.collection(collection).doc();
  await db.runTransaction(async (transaction) => {
    const beforeSnapshot = await transaction.get(resourceRef);
    await validateResourceRelations(transaction, collection, payload);
    const timestamps = beforeSnapshot.exists
      ? { updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid }
      : {
          createdAt: FieldValue.serverTimestamp(),
          createdBy: actor.uid,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.uid,
          schemaVersion: 1,
          active: true,
        };
    transaction.set(
      resourceRef,
      { id: resourceRef.id, ...payload, ...timestamps },
      { merge: true },
    );
    transaction.create(
      db.collection('auditLogs').doc(),
      auditRecord(
        actor,
        beforeSnapshot.exists ? `${collection}.updated` : `${collection}.created`,
        collection,
        resourceRef.id,
        beforeSnapshot.data(),
        payload,
      ),
    );
  });
  return { resourceId: resourceRef.id };
});

export const setOperationalResourceActive = onCall(options, async (request) => {
  const actor = await requireActor(request);
  requireAdmin(actor);
  const data = objectData(request.data);
  const collection = resourceCollection(data.collection);
  const resourceId = text(data.resourceId, 'resourceId', 128);
  if (typeof data.active !== 'boolean')
    throw new HttpsError('invalid-argument', 'active es requerido.');
  const resourceRef = db.collection(collection).doc(resourceId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(resourceRef);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Recurso no encontrado.');
    const patch = {
      active: data.active,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    };
    transaction.update(resourceRef, patch);
    transaction.create(
      db.collection('auditLogs').doc(),
      auditRecord(
        actor,
        `${collection}.${data.active ? 'reactivated' : 'deactivated'}`,
        collection,
        resourceId,
        snapshot.data(),
        patch,
      ),
    );
  });
  return { ok: true };
});

export const updateAppSettings = onCall(options, async (request) => {
  const actor = await requireActor(request);
  requireAdmin(actor);
  requireRecentAuth(request);
  const data = objectData(request.data);
  const conditions = Array.isArray(data.commercialConditions)
    ? data.commercialConditions
        .map((value) => text(value, 'commercialConditions', 500))
        .slice(0, 30)
    : [];
  const payload = {
    companyName: text(data.companyName, 'companyName', 180),
    taxRate: numberValue(data, 'taxRate', 0, 1),
    quoteValidityDays: numberValue(data, 'quoteValidityDays', 1, 365),
    maxDiscountPercent: numberValue(data, 'maxDiscountPercent', 0, 100),
    quoteFolioPrefix: text(data.quoteFolioPrefix, 'quoteFolioPrefix', 20),
    requestFolioPrefix: text(data.requestFolioPrefix, 'requestFolioPrefix', 20),
    commercialConditions: conditions,
    legalText: optionalText(data.legalText, 'legalText', 5000) ?? '',
    policyStatus: data.policyStatus === 'approved' ? 'approved' : 'dev_provisional',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
    schemaVersion: 1,
  };
  const settingsRef = db.collection('settings').doc('app');
  await db.runTransaction(async (transaction) => {
    const before = await transaction.get(settingsRef);
    transaction.set(settingsRef, payload, { merge: true });
    transaction.create(
      db.collection('auditLogs').doc(),
      auditRecord(actor, 'settings.updated', 'settings', 'app', before.data(), payload),
    );
  });
  return { ok: true };
});

const transitions: Record<string, readonly string[]> = {
  pending: ['cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const updateRequestProgress = onCall(options, async (request) => {
  const actor = await requireActor(request);
  const data = objectData(request.data);
  const requestId = text(data.requestId, 'requestId', 128);
  const status = text(data.status, 'status', 30);
  const operationalStage = text(data.operationalStage, 'operationalStage', 40);
  const validStages = [
    'reviewing',
    'diagnosing',
    'waiting_information',
    'executing',
    'quoting',
    'follow_up',
  ];
  if (!validStages.includes(operationalStage)) {
    throw new HttpsError('invalid-argument', 'Etapa operativa inválida.');
  }
  const resourceRef = db.collection('requests').doc(requestId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(resourceRef);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Solicitud no encontrada.');
    const serviceRequest = parseRequest(snapshot.id, snapshot.data());
    assertAuthorized(
      actor.role === 'admin' || serviceRequest.assigneeId === actor.uid,
      'Sólo el responsable puede actualizar el trabajo.',
    );
    const allowed =
      status === serviceRequest.status || transitions[serviceRequest.status]?.includes(status);
    if (!allowed) throw new HttpsError('failed-precondition', 'Transición de estado no permitida.');
    const patch = {
      status,
      operationalStage,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    };
    transaction.update(resourceRef, patch);
    transaction.create(
      db.collection('auditLogs').doc(),
      auditRecord(actor, 'request.progress_updated', 'requests', requestId, snapshot.data(), patch),
    );
  });
  return { ok: true };
});
