import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './admin.js';
import { assertAuthorized, canAssignRequest } from './authorization.js';
import { parseProfile, parseRequest } from './contracts.js';
import { auditRecord, objectData, requireActor, text } from './security.js';

export const assignServiceRequest = onCall(
  {
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 6,
    timeoutSeconds: 20,
    memory: '256MiB',
  },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const requestId = text(data.requestId, 'requestId', 128);
    const recipientId = text(data.recipientId, 'recipientId', 128);
    const idempotencyKey = text(data.idempotencyKey, 'idempotencyKey', 128);
    const recipientRef = db.collection('users').doc(recipientId);
    const serviceRequestRef = db.collection('requests').doc(requestId);
    const operationRef = db.collection('idempotencyKeys').doc(`request-assign-${idempotencyKey}`);

    const replayed = await db.runTransaction(async (transaction) => {
      const [recipientSnapshot, serviceSnapshot, operationSnapshot] = await Promise.all([
        transaction.get(recipientRef),
        transaction.get(serviceRequestRef),
        transaction.get(operationRef),
      ]);
      if (operationSnapshot.exists) return true;
      if (!recipientSnapshot.exists || !serviceSnapshot.exists) {
        throw new HttpsError('not-found', 'Usuario o solicitud no encontrado.');
      }
      const recipient = parseProfile(recipientSnapshot.id, recipientSnapshot.data());
      if (recipient.role !== 'operator' || recipient.status !== 'active') {
        throw new HttpsError('failed-precondition', 'El destinatario debe ser operador activo.');
      }
      const serviceRecord = parseRequest(serviceSnapshot.id, serviceSnapshot.data());
      assertAuthorized(
        canAssignRequest(actor, serviceRecord, recipient),
        'No tienes autorización sobre esta solicitud o el destinatario pertenece a otro equipo.',
      );
      const before = serviceSnapshot.data();
      if (!before) throw new HttpsError('data-loss', 'La solicitud no contiene datos.');
      if (before.status === 'completed' || before.status === 'cancelled') {
        throw new HttpsError('failed-precondition', 'La solicitud ya está cerrada.');
      }
      const patch = {
        assigneeId: recipientId,
        supervisorId: recipient.supervisorId ?? null,
        status: 'assigned',
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      };
      transaction.update(serviceRequestRef, patch);
      transaction.create(
        db.collection('auditLogs').doc(),
        auditRecord(actor, 'request.assigned', 'requests', requestId, before, patch),
      );
      transaction.create(operationRef, {
        operation: 'request.assigned',
        actorId: actor.uid,
        requestId,
        recipientId,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection('notifications').doc(), {
        userId: recipientId,
        type: 'assignment',
        title: 'Nueva solicitud asignada',
        body: `Se te asignó la solicitud ${serviceRecord.folio}.`,
        resourceType: 'requests',
        resourceId: requestId,
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
      });
      return false;
    });
    return { ok: true, replayed };
  },
);
