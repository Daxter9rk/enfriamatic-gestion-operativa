import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './admin.js';
import { assertAuthorized, assertRequestRelations } from './authorization.js';
import { parseProfile } from './contracts.js';
import { auditRecord, objectData, optionalText, requireActor, text } from './security.js';

const serviceTypes = new Set([
  'diagnostic',
  'preventive',
  'corrective',
  'installation',
  'inspection',
  'other',
]);
const priorities = new Set(['low', 'medium', 'high', 'critical']);
const quoteRequirements = new Set(['yes', 'no', 'undetermined']);

export const createServiceRequest = onCall(
  { region: 'us-central1', minInstances: 0, maxInstances: 6, timeoutSeconds: 30 },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const clientId = text(data.clientId, 'clientId', 128);
    const siteId = text(data.siteId, 'siteId', 128);
    const equipmentId = optionalText(data.equipmentId, 'equipmentId', 128);
    const serviceType = text(data.serviceType, 'serviceType', 40);
    const priority = text(data.priority, 'priority', 20);
    const quoteRequirement = text(data.quoteRequirement, 'quoteRequirement', 20);
    const requestedDate = text(data.requestedDate, 'requestedDate', 10);
    const description = text(data.description, 'description', 2000);
    const requestedAssigneeId = optionalText(data.assigneeId, 'assigneeId', 128);
    const assigneeId =
      actor.role === 'operator' ? (requestedAssigneeId ?? actor.uid) : requestedAssigneeId;
    if (
      !serviceTypes.has(serviceType) ||
      !priorities.has(priority) ||
      !quoteRequirements.has(quoteRequirement)
    ) {
      throw new HttpsError('invalid-argument', 'Servicio, prioridad o cotización no válidos.');
    }

    const requestRef = db.collection('requests').doc();
    const year = new Date().getUTCFullYear();
    await db.runTransaction(async (transaction) => {
      const [settingsSnapshot, clientSnapshot, siteSnapshot, equipmentSnapshot] = await Promise.all(
        [
          transaction.get(db.collection('settings').doc('app')),
          transaction.get(db.collection('clients').doc(clientId)),
          transaction.get(db.collection('sites').doc(siteId)),
          equipmentId
            ? transaction.get(db.collection('equipment').doc(equipmentId))
            : Promise.resolve(null),
        ],
      );
      if (!clientSnapshot.exists || !siteSnapshot.exists) {
        throw new HttpsError('failed-precondition', 'Cliente o instalación no disponible.');
      }
      if (clientSnapshot.get('active') === false || siteSnapshot.get('active') === false) {
        throw new HttpsError('failed-precondition', 'Cliente o instalación inactivos.');
      }
      const siteClientId: unknown = siteSnapshot.get('clientId');
      if (typeof siteClientId !== 'string') {
        throw new HttpsError('data-loss', 'La instalación no tiene un cliente válido.');
      }
      let equipmentRelation: { clientId: string; siteId: string } | null = null;
      if (equipmentId) {
        if (!equipmentSnapshot?.exists || equipmentSnapshot.get('active') === false) {
          throw new HttpsError('failed-precondition', 'El equipo no está disponible.');
        }
        const equipmentClientId: unknown = equipmentSnapshot.get('clientId');
        const equipmentSiteId: unknown = equipmentSnapshot.get('siteId');
        if (typeof equipmentClientId !== 'string' || typeof equipmentSiteId !== 'string') {
          throw new HttpsError('data-loss', 'El equipo tiene relaciones inválidas.');
        }
        equipmentRelation = { clientId: equipmentClientId, siteId: equipmentSiteId };
      }
      assertRequestRelations({ clientId, siteId, equipmentId }, siteClientId, equipmentRelation);

      let assignee: ReturnType<typeof parseProfile> | null = null;
      if (assigneeId) {
        const assigneeSnapshot = await transaction.get(db.collection('users').doc(assigneeId));
        if (!assigneeSnapshot.exists) {
          throw new HttpsError('failed-precondition', 'El responsable no existe.');
        }
        assignee = parseProfile(assigneeSnapshot.id, assigneeSnapshot.data());
        if (assignee.role !== 'operator' || assignee.status !== 'active') {
          throw new HttpsError('failed-precondition', 'El responsable debe ser operador activo.');
        }
        assertAuthorized(
          actor.role === 'admin' ||
            actor.uid === assigneeId ||
            (assignee.supervisorId === actor.uid && assignee.teamId === actor.teamId),
          'No puedes asignar fuera de tu equipo.',
        );
      }
      const counterRef = db.collection('counters').doc(`requests-${year}`);
      const counter = await transaction.get(counterRef);
      const next = Number(counter.data()?.value ?? 0) + 1;
      const settings = settingsSnapshot.data();
      const prefix =
        typeof settings?.requestFolioPrefix === 'string' ? settings.requestFolioPrefix : 'SOL-DEV';
      const folio = `${prefix}-${year}-${String(next).padStart(5, '0')}`;
      const payload = {
        id: requestRef.id,
        folio,
        clientId,
        siteId,
        equipmentId,
        scope: equipmentId ? 'equipment' : 'general',
        serviceType,
        priority,
        requestedDate,
        assigneeId,
        supervisorId: assignee?.supervisorId ?? null,
        description,
        quoteRequirement,
        status: assigneeId ? 'assigned' : 'pending',
        operationalStage: 'reviewing',
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
        schemaVersion: 1,
        active: true,
      };
      transaction.set(counterRef, { value: next, updatedAt: FieldValue.serverTimestamp() });
      transaction.create(requestRef, payload);
      transaction.create(
        db.collection('auditLogs').doc(),
        auditRecord(actor, 'request.created', 'requests', requestRef.id, null, {
          ...payload,
          folio,
        }),
      );
      if (assigneeId) {
        transaction.create(db.collection('notifications').doc(), {
          userId: assigneeId,
          type: 'assignment',
          title: 'Nueva solicitud asignada',
          body: `Se te asignó la solicitud ${folio}.`,
          resourceType: 'requests',
          resourceId: requestRef.id,
          readAt: null,
          createdAt: FieldValue.serverTimestamp(),
          schemaVersion: 1,
        });
      }
    });
    return { requestId: requestRef.id };
  },
);
