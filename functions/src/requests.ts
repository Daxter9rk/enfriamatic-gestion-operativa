import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './admin.js';
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
    const recipientRef = db.collection('users').doc(recipientId);
    const serviceRequestRef = db.collection('requests').doc(requestId);

    await db.runTransaction(async (transaction) => {
      const [recipientSnapshot, serviceSnapshot] = await Promise.all([
        transaction.get(recipientRef),
        transaction.get(serviceRequestRef),
      ]);
      if (!recipientSnapshot.exists || !serviceSnapshot.exists) {
        throw new HttpsError('not-found', 'Usuario o solicitud no encontrado.');
      }
      const recipient = recipientSnapshot.data() as Record<string, unknown>;
      if (recipient.role !== 'operator' || recipient.status !== 'active') {
        throw new HttpsError('failed-precondition', 'El destinatario debe ser operador activo.');
      }
      if (
        actor.role !== 'admin' &&
        (recipient.supervisorId !== actor.uid || recipient.teamId !== actor.teamId)
      ) {
        throw new HttpsError(
          'permission-denied',
          'Sólo puedes asignar dentro de tu equipo directo.',
        );
      }
      const before = serviceSnapshot.data() as Record<string, unknown>;
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
      transaction.create(db.collection('notifications').doc(), {
        userId: recipientId,
        type: 'assignment',
        title: 'Nueva solicitud asignada',
        body: `Se te asignó la solicitud ${
          typeof before.folio === 'string' ? before.folio : requestId
        }.`,
        resourceType: 'requests',
        resourceId: requestId,
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
      });
    });
    return { ok: true };
  },
);
