import { createHash, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { bucket, db } from './admin.js';
import { assertAuthorized, canAccessRequest, canReadDocument } from './authorization.js';
import {
  parseDocument,
  parseQuote,
  parseRequest,
  type DocumentAccessScope,
  type DocumentKind,
} from './contracts.js';
import { auditRecord, objectData, optionalText, requireActor, text } from './security.js';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const signatures: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};
const uploadKinds = new Set<DocumentKind>([
  'catalog_image',
  'request_evidence',
  'site_document',
  'equipment_document',
]);

function matchesSignature(buffer: Buffer, mimeType: string): boolean {
  return (signatures[mimeType] ?? []).some((signature) =>
    signature.every((value, index) => buffer[index] === value),
  );
}

function parseKind(value: unknown): DocumentKind {
  const kind = text(value, 'kind', 40) as DocumentKind;
  if (!uploadKinds.has(kind))
    throw new HttpsError('invalid-argument', 'Tipo de archivo no permitido.');
  return kind;
}

function accessScopeFor(kind: DocumentKind): DocumentAccessScope {
  return kind === 'request_evidence' ? 'request_participants' : 'all_active';
}

function collectionFor(kind: DocumentKind): 'catalogItems' | 'requests' | 'sites' | 'equipment' {
  if (kind === 'catalog_image') return 'catalogItems';
  if (kind === 'request_evidence') return 'requests';
  if (kind === 'site_document') return 'sites';
  return 'equipment';
}

async function assertUploadAccess(
  actor: Awaited<ReturnType<typeof requireActor>>,
  kind: DocumentKind,
  resourceId: string,
): Promise<void> {
  const collection = collectionFor(kind);
  const snapshot = await db.collection(collection).doc(resourceId).get();
  if (!snapshot.exists || snapshot.get('active') === false) {
    throw new HttpsError('not-found', 'El recurso no existe o está inactivo.');
  }
  if (kind === 'request_evidence') {
    const serviceRequest = parseRequest(snapshot.id, snapshot.data());
    assertAuthorized(
      canAccessRequest(actor, serviceRequest),
      'No tienes acceso a la solicitud de esta evidencia.',
    );
    return;
  }
  assertAuthorized(actor.role === 'admin', 'Sólo un administrador puede modificar estos archivos.');
}

async function assertDocumentReadAccess(
  actor: Awaited<ReturnType<typeof requireActor>>,
  documentId: string,
) {
  const snapshot = await db.collection('documents').doc(documentId).get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'Documento no encontrado.');
  const document = parseDocument(snapshot.id, snapshot.data());
  if (!document.active || document.status !== 'ready') {
    throw new HttpsError('failed-precondition', 'El documento no está disponible.');
  }
  let relatedRequest = null;
  let relatedQuote = null;
  if (document.accessScope === 'request_participants') {
    const requestSnapshot = await db.collection('requests').doc(document.resourceId).get();
    if (!requestSnapshot.exists)
      throw new HttpsError('not-found', 'Solicitud relacionada inexistente.');
    relatedRequest = parseRequest(requestSnapshot.id, requestSnapshot.data());
  } else if (document.accessScope === 'quote_participants') {
    const quoteSnapshot = await db.collection('quotes').doc(document.resourceId).get();
    if (!quoteSnapshot.exists)
      throw new HttpsError('not-found', 'Cotización relacionada inexistente.');
    const quote = parseQuote(quoteSnapshot.id, quoteSnapshot.data());
    const requestSnapshot = await db.collection('requests').doc(quote.requestId).get();
    if (!requestSnapshot.exists)
      throw new HttpsError('not-found', 'Solicitud relacionada inexistente.');
    relatedQuote = { quote, request: parseRequest(requestSnapshot.id, requestSnapshot.data()) };
  }
  assertAuthorized(
    canReadDocument(actor, document.accessScope, relatedRequest, relatedQuote),
    'No tienes permiso para descargar este documento.',
  );
  return document;
}

export const uploadPrivateFile = onCall(
  {
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 4,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const kind = parseKind(data.kind);
    const resourceId = text(data.resourceId, 'resourceId', 128);
    const mimeType = text(data.mimeType, 'mimeType', 80);
    const fileName = optionalText(data.fileName, 'fileName', 160) ?? 'archivo';
    const base64 = text(data.base64, 'base64', 8_100_000);
    await assertUploadAccess(actor, kind, resourceId);
    if (!allowedTypes.has(mimeType)) throw new HttpsError('invalid-argument', 'MIME no permitido.');
    if (kind === 'catalog_image' && mimeType === 'application/pdf') {
      throw new HttpsError('invalid-argument', 'La imagen del catálogo debe ser JPEG o PNG.');
    }
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.byteLength === 0 || buffer.byteLength > 6_000_000) {
      throw new HttpsError('invalid-argument', 'El archivo debe pesar entre 1 byte y 6 MB.');
    }
    if (!matchesSignature(buffer, mimeType)) {
      throw new HttpsError('invalid-argument', 'La firma del archivo no coincide con su MIME.');
    }
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'pdf';
    const documentRef = db.collection('documents').doc();
    const path = `${kind}/${resourceId}/${randomUUID()}.${extension}`;
    const hash = createHash('sha256').update(buffer).digest('hex');
    await bucket.file(path).save(buffer, {
      resumable: false,
      contentType: mimeType,
      metadata: { metadata: { documentId: documentRef.id, kind, resourceId, sha256: hash } },
    });
    try {
      const replacedPath = await db.runTransaction<string | null>(async (transaction) => {
        const resourceRef = db.collection(collectionFor(kind)).doc(resourceId);
        const resourceSnapshot = await transaction.get(resourceRef);
        if (!resourceSnapshot.exists || resourceSnapshot.get('active') === false) {
          throw new HttpsError('not-found', 'El recurso dejó de estar disponible.');
        }
        const document = {
          kind,
          accessScope: accessScopeFor(kind),
          resourceId,
          storagePath: path,
          fileName,
          mimeType,
          size: buffer.byteLength,
          sha256: hash,
          status: 'ready',
          createdAt: FieldValue.serverTimestamp(),
          createdBy: actor.uid,
          schemaVersion: 1,
          active: true,
        };
        transaction.create(documentRef, document);
        let previousPath: string | null = null;
        if (kind === 'catalog_image') {
          const previousId: unknown = resourceSnapshot.get('imageDocumentId');
          if (typeof previousId === 'string') {
            const previousRef = db.collection('documents').doc(previousId);
            const previous = await transaction.get(previousRef);
            if (previous.exists) {
              const storedPath: unknown = previous.get('storagePath');
              previousPath = typeof storedPath === 'string' ? storedPath : null;
              transaction.update(previousRef, {
                active: false,
                replacedBy: documentRef.id,
                removedAt: FieldValue.serverTimestamp(),
                removedBy: actor.uid,
              });
            }
          }
          transaction.update(resourceRef, {
            imageDocumentId: documentRef.id,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: actor.uid,
          });
        }
        transaction.create(
          db.collection('auditLogs').doc(),
          auditRecord(actor, 'document.uploaded', 'documents', documentRef.id, null, {
            kind,
            resourceId,
            mimeType,
            size: buffer.byteLength,
            sha256: hash,
          }),
        );
        return previousPath;
      });
      if (replacedPath) {
        await bucket
          .file(replacedPath)
          .delete({ ignoreNotFound: true })
          .catch(async (error) => {
            await db.collection('consistencyJobs').add({
              operation: 'document.replace.cleanup',
              storagePath: replacedPath,
              status: 'required',
              error: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
              createdAt: FieldValue.serverTimestamp(),
            });
          });
      }
    } catch (error) {
      await bucket
        .file(path)
        .delete({ ignoreNotFound: true })
        .catch(() => undefined);
      throw error;
    }
    return { documentId: documentRef.id };
  },
);

export const removePrivateFile = onCall(
  { region: 'us-central1', minInstances: 0, maxInstances: 4, timeoutSeconds: 30 },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const documentId = text(data.documentId, 'documentId', 128);
    const documentRef = db.collection('documents').doc(documentId);
    const snapshot = await documentRef.get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'Documento no encontrado.');
    const document = parseDocument(snapshot.id, snapshot.data());
    if (document.kind === 'quote_pdf' || document.kind === 'manual') {
      throw new HttpsError('failed-precondition', 'Este documento es inmutable.');
    }
    await assertUploadAccess(actor, document.kind, document.resourceId);
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(documentRef);
      if (!current.exists || current.get('active') === false) return;
      transaction.update(documentRef, {
        active: false,
        removedAt: FieldValue.serverTimestamp(),
        removedBy: actor.uid,
      });
      if (document.kind === 'catalog_image') {
        const resourceRef = db.collection('catalogItems').doc(document.resourceId);
        const resource = await transaction.get(resourceRef);
        if (resource.get('imageDocumentId') === documentId) {
          transaction.update(resourceRef, {
            imageDocumentId: null,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: actor.uid,
          });
        }
      }
      transaction.create(
        db.collection('auditLogs').doc(),
        auditRecord(actor, 'document.removed', 'documents', documentId, current.data(), {
          active: false,
        }),
      );
    });
    await bucket.file(document.storagePath).delete({ ignoreNotFound: true });
    return { ok: true };
  },
);

export const downloadPrivateFile = onCall(
  {
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: '512MiB',
  },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const documentId = text(data.documentId, 'documentId', 128);
    const document = await assertDocumentReadAccess(actor, documentId);
    if (document.size > 6_000_000) {
      throw new HttpsError(
        'resource-exhausted',
        'El documento excede el límite de descarga directa.',
      );
    }
    const [buffer] = await bucket.file(document.storagePath).download();
    if (buffer.byteLength !== document.size) {
      throw new HttpsError('data-loss', 'El tamaño almacenado no coincide con la metadata.');
    }
    return {
      base64: buffer.toString('base64'),
      mimeType: document.mimeType,
      fileName: document.storagePath.split('/').at(-1) ?? 'documento',
    };
  },
);

export const listPrivateFiles = onCall(
  { region: 'us-central1', minInstances: 0, maxInstances: 10, timeoutSeconds: 20 },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const kind = text(data.kind, 'kind', 40) as DocumentKind;
    const resourceId = text(data.resourceId, 'resourceId', 128);
    if (![...uploadKinds, 'quote_pdf', 'manual'].includes(kind)) {
      throw new HttpsError('invalid-argument', 'Tipo de archivo no permitido.');
    }
    const snapshots = await db
      .collection('documents')
      .where('kind', '==', kind)
      .where('resourceId', '==', resourceId)
      .where('active', '==', true)
      .get();
    const files = [];
    for (const snapshot of snapshots.docs) {
      const document = await assertDocumentReadAccess(actor, snapshot.id);
      files.push({
        documentId: document.id,
        kind: document.kind,
        fileName:
          typeof snapshot.get('fileName') === 'string'
            ? String(snapshot.get('fileName'))
            : snapshot.id,
        mimeType: document.mimeType,
        size: document.size,
      });
    }
    return { files };
  },
);
