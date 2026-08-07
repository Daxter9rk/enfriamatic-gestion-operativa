import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminAuth, db } from './admin.js';
import { assertAuthorized } from './authorization.js';
import { parseProfile, type Role, type UserStatus } from './contracts.js';
import {
  auditRecord,
  objectData,
  optionalText,
  requireActor,
  requireAdmin,
  requireRecentAuth,
  text,
} from './security.js';
import { canManageUserAction, type UserAction } from './user-policy.js';

const options = {
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 4,
  timeoutSeconds: 45,
  memory: '256MiB' as const,
};

function parseAction(value: unknown): UserAction {
  const action = text(value, 'action', 40);
  if (
    !['activate', 'suspend', 'deactivate', 'promote', 'demote', 'assignHierarchy'].includes(action)
  ) {
    throw new HttpsError('invalid-argument', 'Acción no soportada.');
  }
  return action as UserAction;
}

async function validateSupervisor(
  transaction: FirebaseFirestore.Transaction,
  supervisorId: string | null,
  teamId: string | null,
  targetUid: string,
): Promise<void> {
  if (!supervisorId) {
    // Un operador raíz puede encabezar un equipo sin tener supervisor propio.
    // Al recibir su primer subordinado se convierte en supervisor por capacidad.
    return;
  }
  if (supervisorId === targetUid) {
    throw new HttpsError('failed-precondition', 'Un usuario no puede supervisarse a sí mismo.');
  }
  const supervisorSnapshot = await transaction.get(db.collection('users').doc(supervisorId));
  if (!supervisorSnapshot.exists) throw new HttpsError('not-found', 'Supervisor no encontrado.');
  const supervisor = parseProfile(supervisorSnapshot.id, supervisorSnapshot.data());
  if (supervisor.role !== 'operator' || supervisor.status !== 'active') {
    throw new HttpsError('failed-precondition', 'El supervisor debe ser operador activo.');
  }
  if (!teamId || !supervisor.teamId || supervisor.teamId !== teamId) {
    throw new HttpsError('failed-precondition', 'Supervisor y subordinado deben compartir equipo.');
  }
}

function operationReference(kind: string, key: string) {
  return db.collection('idempotencyKeys').doc(`${kind}-${key}`);
}

export const createManagedUser = onCall(options, async (request) => {
  const actor = await requireActor(request);
  requireAdmin(actor);
  requireRecentAuth(request);
  const data = objectData(request.data);
  const idempotencyKey = text(data.idempotencyKey, 'idempotencyKey', 128);
  const email = text(data.email, 'email', 320).toLowerCase();
  const displayName = text(data.displayName, 'displayName', 100);
  const role: Role | null =
    data.role === 'admin' ? 'admin' : data.role === 'operator' ? 'operator' : null;
  if (!role) throw new HttpsError('invalid-argument', 'Rol no válido.');
  if (role === 'admin' && !actor.isPrimaryAdmin) {
    throw new HttpsError(
      'permission-denied',
      'Sólo el administrador principal puede crear admins.',
    );
  }
  const supervisorId =
    role === 'operator' ? optionalText(data.supervisorId, 'supervisorId', 128) : null;
  const teamId = role === 'operator' ? optionalText(data.teamId, 'teamId', 128) : null;
  const password = text(data.temporaryPassword, 'temporaryPassword', 128);
  if (password.length < 14) {
    throw new HttpsError(
      'invalid-argument',
      'La contraseña temporal requiere al menos 14 caracteres.',
    );
  }
  const operationRef = operationReference('user-create', idempotencyKey);
  const prior = await operationRef.get();
  if (prior.exists && typeof prior.get('resultUid') === 'string') {
    return { uid: String(prior.get('resultUid')), replayed: true };
  }

  let user: Awaited<ReturnType<typeof adminAuth.createUser>>;
  try {
    user = await adminAuth.createUser({ email, displayName, password, disabled: false });
  } catch (error) {
    const replay = await operationRef.get();
    if (replay.exists && typeof replay.get('resultUid') === 'string') {
      return { uid: String(replay.get('resultUid')), replayed: true };
    }
    throw error;
  }

  const profile = {
    uid: user.uid,
    email,
    displayName,
    role,
    status: 'active' satisfies UserStatus,
    supervisorId,
    teamId,
    isPrimaryAdmin: false,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
    schemaVersion: 1,
    active: true,
  };
  try {
    await db.runTransaction(async (transaction) => {
      const operation = await transaction.get(operationRef);
      if (operation.exists)
        throw new HttpsError('already-exists', 'La operación ya fue procesada.');
      await validateSupervisor(transaction, supervisorId, teamId, user.uid);
      transaction.create(db.collection('users').doc(user.uid), profile);
      transaction.create(operationRef, {
        operation: 'user.created',
        actorId: actor.uid,
        resultUid: user.uid,
        status: 'completed',
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(
        db.collection('auditLogs').doc(),
        auditRecord(actor, 'user.created', 'users', user.uid, null, {
          email,
          displayName,
          role,
          supervisorId,
          teamId,
        }),
      );
    });
  } catch (error) {
    try {
      await adminAuth.deleteUser(user.uid);
    } catch (compensationError) {
      await db.collection('consistencyJobs').add({
        operation: 'user.create.compensation',
        authUid: user.uid,
        status: 'required',
        error:
          compensationError instanceof Error ? compensationError.message.slice(0, 300) : 'unknown',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    throw error;
  }
  return { uid: user.uid, replayed: false };
});

export const updateManagedUser = onCall(options, async (request) => {
  const actor = await requireActor(request);
  requireAdmin(actor);
  requireRecentAuth(request);
  const data = objectData(request.data);
  const uid = text(data.uid, 'uid', 128);
  const action = parseAction(data.action);
  const idempotencyKey = text(data.idempotencyKey, 'idempotencyKey', 128);
  const supervisorId = optionalText(data.supervisorId, 'supervisorId', 128);
  const teamId = optionalText(data.teamId, 'teamId', 128);
  const operationRef = operationReference('user-update', idempotencyKey);
  const targetRef = db.collection('users').doc(uid);
  const prior = await operationRef.get();
  if (prior.exists) return { ok: true, replayed: true };

  const targetSnapshot = await targetRef.get();
  if (!targetSnapshot.exists) throw new HttpsError('not-found', 'Usuario no encontrado.');
  const target = parseProfile(targetSnapshot.id, targetSnapshot.data());
  assertAuthorized(
    canManageUserAction(actor, target, action),
    'No puedes ejecutar esta acción sobre el usuario seleccionado.',
  );

  const changesAuthState = ['activate', 'suspend', 'deactivate'].includes(action);
  const authBefore = changesAuthState ? await adminAuth.getUser(uid) : null;
  const desiredDisabled = action === 'suspend' || action === 'deactivate';
  if (authBefore && authBefore.disabled !== desiredDisabled) {
    await adminAuth.updateUser(uid, { disabled: desiredDisabled });
  }

  try {
    await db.runTransaction(async (transaction) => {
      const [currentSnapshot, operation] = await Promise.all([
        transaction.get(targetRef),
        transaction.get(operationRef),
      ]);
      if (operation.exists) return;
      if (!currentSnapshot.exists) throw new HttpsError('not-found', 'Usuario no encontrado.');
      const current = parseProfile(currentSnapshot.id, currentSnapshot.data());
      assertAuthorized(
        canManageUserAction(actor, current, action),
        'La autorización cambió; vuelve a intentarlo.',
      );
      const patch: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      };
      if (action === 'activate') {
        patch.status = 'active';
        patch.active = true;
      } else if (action === 'suspend' || action === 'deactivate') {
        const [subordinates, activeRequests] = await Promise.all([
          transaction.get(db.collection('users').where('supervisorId', '==', uid)),
          transaction.get(
            db
              .collection('requests')
              .where('assigneeId', '==', uid)
              .where('status', 'in', ['assigned', 'in_progress']),
          ),
        ]);
        if (!subordinates.empty || !activeRequests.empty) {
          throw new HttpsError(
            'failed-precondition',
            'Transfiere subordinados y solicitudes activas antes de cambiar el estado.',
          );
        }
        patch.status = action === 'suspend' ? 'suspended' : 'inactive';
        patch.active = false;
      } else if (action === 'promote') {
        if (current.role !== 'operator')
          throw new HttpsError('failed-precondition', 'Ya es admin.');
        const subordinates = await transaction.get(
          db.collection('users').where('supervisorId', '==', uid),
        );
        if (!subordinates.empty) {
          throw new HttpsError('failed-precondition', 'Transfiere subordinados antes de promover.');
        }
        patch.role = 'admin';
        patch.supervisorId = null;
        patch.teamId = null;
      } else if (action === 'demote') {
        if (current.role !== 'admin') throw new HttpsError('failed-precondition', 'No es admin.');
        const activeAdmins = await transaction.get(
          db.collection('users').where('role', '==', 'admin').where('status', '==', 'active'),
        );
        if (activeAdmins.size <= 1) {
          throw new HttpsError(
            'failed-precondition',
            'El sistema requiere un administrador activo.',
          );
        }
        await validateSupervisor(transaction, supervisorId, teamId, uid);
        patch.role = 'operator';
        patch.supervisorId = supervisorId;
        patch.teamId = teamId;
      } else {
        if (current.role !== 'operator') {
          throw new HttpsError('failed-precondition', 'Sólo operadores pertenecen a jerarquías.');
        }
        await validateSupervisor(transaction, supervisorId, teamId, uid);
        patch.supervisorId = supervisorId;
        patch.teamId = teamId;
      }
      transaction.update(targetRef, patch);
      transaction.create(operationRef, {
        operation: `user.${action}`,
        actorId: actor.uid,
        targetUid: uid,
        status: 'completed',
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(
        db.collection('auditLogs').doc(),
        auditRecord(actor, `user.${action}`, 'users', uid, currentSnapshot.data(), patch),
      );
    });
  } catch (error) {
    if (authBefore && authBefore.disabled !== desiredDisabled) {
      try {
        await adminAuth.updateUser(uid, { disabled: authBefore.disabled });
      } catch (compensationError) {
        await db.collection('consistencyJobs').add({
          operation: `user.${action}.compensation`,
          authUid: uid,
          desiredDisabled: authBefore.disabled,
          status: 'required',
          error:
            compensationError instanceof Error
              ? compensationError.message.slice(0, 300)
              : 'unknown',
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }
    throw error;
  }

  let reconciliationPending = false;
  if (changesAuthState) {
    try {
      await adminAuth.revokeRefreshTokens(uid);
    } catch (error) {
      reconciliationPending = true;
      await db.collection('consistencyJobs').add({
        operation: `user.${action}.revoke_tokens`,
        authUid: uid,
        status: 'required',
        error: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
  return { ok: true, replayed: false, reconciliationPending };
});
