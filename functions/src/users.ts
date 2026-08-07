import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminAuth, db } from './admin.js';
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
  maxInstances: 4,
  timeoutSeconds: 30,
  memory: '256MiB' as const,
};

export const createManagedUser = onCall(options, async (request) => {
  const actor = await requireActor(request);
  requireAdmin(actor);
  requireRecentAuth(request);
  const data = objectData(request.data);
  const email = text(data.email, 'email', 320).toLowerCase();
  const displayName = text(data.displayName, 'displayName', 100);
  const role = data.role === 'admin' ? 'admin' : data.role === 'operator' ? 'operator' : null;
  if (!role) throw new HttpsError('invalid-argument', 'Rol no válido.');
  const supervisorId = optionalText(data.supervisorId, 'supervisorId', 128);
  const teamId = optionalText(data.teamId, 'teamId', 128);
  const password = text(data.temporaryPassword, 'temporaryPassword', 128);
  if (password.length < 14) {
    throw new HttpsError(
      'invalid-argument',
      'La contraseña temporal requiere al menos 14 caracteres.',
    );
  }

  const user = await adminAuth.createUser({ email, displayName, password, disabled: false });
  const profile = {
    uid: user.uid,
    email,
    displayName,
    role,
    status: 'active',
    supervisorId: role === 'operator' ? supervisorId : null,
    teamId: role === 'operator' ? teamId : null,
    isPrimaryAdmin: false,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
    schemaVersion: 1,
    active: true,
  };

  try {
    await db.runTransaction((transaction) => {
      transaction.create(db.collection('users').doc(user.uid), profile);
      const audit = db.collection('auditLogs').doc();
      transaction.create(
        audit,
        auditRecord(actor, 'user.created', 'users', user.uid, null, {
          email,
          displayName,
          role,
          supervisorId,
          teamId,
        }),
      );
      return Promise.resolve();
    });
  } catch (error) {
    await adminAuth.deleteUser(user.uid);
    throw error;
  }
  return { uid: user.uid };
});

export const updateManagedUser = onCall(options, async (request) => {
  const actor = await requireActor(request);
  requireAdmin(actor);
  requireRecentAuth(request);
  const data = objectData(request.data);
  const uid = text(data.uid, 'uid', 128);
  const action = text(data.action, 'action', 40);
  const targetRef = db.collection('users').doc(uid);

  await db.runTransaction(async (transaction) => {
    const targetSnapshot = await transaction.get(targetRef);
    if (!targetSnapshot.exists) throw new HttpsError('not-found', 'Usuario no encontrado.');
    const before = targetSnapshot.data() as Record<string, unknown>;
    if (before.isPrimaryAdmin === true) {
      throw new HttpsError('failed-precondition', 'El administrador principal está protegido.');
    }

    const patch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    };
    if (action === 'activate') {
      patch.status = 'active';
      patch.active = true;
    } else if (action === 'suspend') {
      patch.status = 'suspended';
      patch.active = false;
    } else if (action === 'deactivate') {
      const subordinateQuery = db.collection('users').where('supervisorId', '==', uid);
      const requestQuery = db
        .collection('requests')
        .where('assigneeId', '==', uid)
        .where('status', 'in', ['assigned', 'in_progress']);
      const [subordinates, activeRequests] = await Promise.all([
        transaction.get(subordinateQuery),
        transaction.get(requestQuery),
      ]);
      if (!subordinates.empty || !activeRequests.empty) {
        throw new HttpsError(
          'failed-precondition',
          'Transfiere subordinados y solicitudes activas antes de desactivar.',
        );
      }
      patch.status = 'inactive';
      patch.active = false;
    } else if (action === 'promote') {
      patch.role = 'admin';
      patch.supervisorId = null;
      patch.teamId = null;
    } else if (action === 'assignHierarchy') {
      patch.supervisorId = optionalText(data.supervisorId, 'supervisorId', 128);
      patch.teamId = optionalText(data.teamId, 'teamId', 128);
    } else {
      throw new HttpsError('invalid-argument', 'Acción no soportada.');
    }

    transaction.update(targetRef, patch);
    transaction.create(
      db.collection('auditLogs').doc(),
      auditRecord(actor, `user.${action}`, 'users', uid, before, patch),
    );
  });

  if (action === 'deactivate' || action === 'suspend') {
    await adminAuth.updateUser(uid, { disabled: true });
    await adminAuth.revokeRefreshTokens(uid);
  } else if (action === 'activate') {
    await adminAuth.updateUser(uid, { disabled: false });
  }
  return { ok: true };
});
