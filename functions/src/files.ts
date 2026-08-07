import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { bucket, db } from './admin.js';
import { auditRecord, objectData, requireActor, text } from './security.js';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const signatures: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};

function matchesSignature(buffer: Buffer, mimeType: string): boolean {
  return (signatures[mimeType] ?? []).some((signature) =>
    signature.every((value, index) => buffer[index] === value),
  );
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
    const resourceType = text(data.resourceType, 'resourceType', 30);
    const resourceId = text(data.resourceId, 'resourceId', 128);
    const mimeType = text(data.mimeType, 'mimeType', 80);
    const base64 = text(data.base64, 'base64', 3_000_000);
    if (!['equipment', 'requests', 'catalogItems', 'sites'].includes(resourceType)) {
      throw new HttpsError('invalid-argument', 'Tipo de recurso no permitido.');
    }
    if (!allowedTypes.has(mimeType)) throw new HttpsError('invalid-argument', 'MIME no permitido.');
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.byteLength === 0 || buffer.byteLength > 2_000_000) {
      throw new HttpsError('invalid-argument', 'El archivo debe pesar entre 1 byte y 2 MB.');
    }
    if (!matchesSignature(buffer, mimeType)) {
      throw new HttpsError('invalid-argument', 'La firma del archivo no coincide con su MIME.');
    }
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'pdf';
    const documentRef = db.collection('documents').doc();
    const path = `${resourceType}/${resourceId}/${randomUUID()}.${extension}`;
    await bucket.file(path).save(buffer, { resumable: false, contentType: mimeType });
    await documentRef.set({
      resourceType,
      resourceId,
      storagePath: path,
      mimeType,
      size: buffer.byteLength,
      status: 'ready',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
      schemaVersion: 1,
      active: true,
    });
    await db.collection('auditLogs').add(
      auditRecord(actor, 'document.uploaded', 'documents', documentRef.id, null, {
        resourceType,
        resourceId,
        mimeType,
        size: buffer.byteLength,
      }),
    );
    return { documentId: documentRef.id };
  },
);

export const getPrivateDownloadUrl = onCall(
  { region: 'us-central1', minInstances: 0, maxInstances: 10, timeoutSeconds: 20 },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const documentId = text(data.documentId, 'documentId', 128);
    const snapshot = await db.collection('documents').doc(documentId).get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'Documento no encontrado.');
    const document = snapshot.data() as Record<string, unknown>;
    if (document.resourceType === 'manual_admin' && actor.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Manual restringido a administradores.');
    }
    const storagePath = text(document.storagePath, 'storagePath', 500);
    const expires = Date.now() + 5 * 60 * 1000;
    const [url] = await bucket.file(storagePath).getSignedUrl({ action: 'read', expires });
    return { url, expiresAt: new Date(expires).toISOString() };
  },
);
