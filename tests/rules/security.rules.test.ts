import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const projectId = 'enfriamatic-operativa-rules-test';
let env: Awaited<ReturnType<typeof initializeTestEnvironment>>;

const profile = (
  uid: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  uid,
  email: `${uid}@example.test`,
  displayName: `Usuario ${uid}`,
  role: 'operator',
  status: 'active',
  supervisorId: null,
  teamId: 'team-a',
  isPrimaryAdmin: false,
  active: true,
  ...overrides,
});

beforeAll(async () => {
  const [firestoreRules, storageRules] = await Promise.all([
    readFile('firestore.rules', 'utf8'),
    readFile('storage.rules', 'utf8'),
  ]);
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: firestoreRules, host: '127.0.0.1', port: 8080 },
    storage: { rules: storageRules, host: '127.0.0.1', port: 9199 },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users/admin'), profile('admin', { role: 'admin', isPrimaryAdmin: true })),
      setDoc(doc(db, 'users/supervisor'), profile('supervisor')),
      setDoc(doc(db, 'users/subordinate'), profile('subordinate', { supervisorId: 'supervisor' })),
      setDoc(doc(db, 'users/other'), profile('other', { teamId: 'team-b' })),
      setDoc(doc(db, 'users/inactive'), profile('inactive', { status: 'inactive' })),
      setDoc(doc(db, 'users/suspended'), profile('suspended', { status: 'suspended' })),
      setDoc(doc(db, 'users/invalid'), profile('invalid', { role: 'owner' })),
      setDoc(doc(db, 'clients/client-a'), { name: 'Cliente ficticio', active: true }),
      setDoc(doc(db, 'settings/app'), { taxRate: 0.16 }),
      setDoc(doc(db, 'manuals/general'), { accessScope: 'all_active', title: 'Guía DEV' }),
      setDoc(doc(db, 'manuals/admin'), { accessScope: 'admin_only', title: 'Admin DEV' }),
      setDoc(doc(db, 'requests/own'), {
        folio: 'SOL-DEV-1',
        createdBy: 'subordinate',
        assigneeId: 'subordinate',
        supervisorId: 'supervisor',
        status: 'assigned',
        operationalStage: 'reviewing',
      }),
      setDoc(doc(db, 'requests/other'), {
        folio: 'SOL-DEV-2',
        createdBy: 'other',
        assigneeId: 'other',
        supervisorId: null,
        status: 'assigned',
        operationalStage: 'reviewing',
      }),
      setDoc(doc(db, 'quotes/draft'), {
        createdBy: 'subordinate',
        supervisorId: 'supervisor',
        requestId: 'own',
        status: 'draft',
        locked: false,
        folio: null,
      }),
      setDoc(doc(db, 'quotes/locked'), {
        createdBy: 'subordinate',
        requestId: 'own',
        status: 'issued',
        locked: true,
        folio: 'COT-DEV-1',
      }),
      setDoc(doc(db, 'auditLogs/log-own'), {
        actorId: 'subordinate',
        actorSupervisorId: 'supervisor',
        action: 'request.updated',
      }),
    ]);
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('identidad y estado', () => {
  it('deniega anónimo, perfil ausente, inactivo, suspendido y rol inválido', async () => {
    const contexts = [
      env.unauthenticatedContext(),
      env.authenticatedContext('missing'),
      env.authenticatedContext('inactive'),
      env.authenticatedContext('suspended'),
      env.authenticatedContext('invalid'),
    ];
    for (const context of contexts) {
      await assertFails(getDoc(doc(context.firestore(), 'clients/client-a')));
    }
  });

  it('permite al usuario leer su perfil y bloquea perfiles ajenos', async () => {
    const db = env.authenticatedContext('subordinate').firestore();
    await assertSucceeds(getDoc(doc(db, 'users/subordinate')));
    await assertFails(getDoc(doc(db, 'users/other')));
  });

  it('permite al supervisor leer sólo subordinados directos', async () => {
    const db = env.authenticatedContext('supervisor').firestore();
    await assertSucceeds(getDoc(doc(db, 'users/subordinate')));
    await assertFails(getDoc(doc(db, 'users/other')));
  });
});

describe('recursos operativos', () => {
  it('permite lectura activa y reserva toda escritura de directorios al backend', async () => {
    const operatorDb = env.authenticatedContext('subordinate').firestore();
    const adminDb = env.authenticatedContext('admin').firestore();
    await assertSucceeds(getDoc(doc(operatorDb, 'clients/client-a')));
    await assertFails(setDoc(doc(operatorDb, 'clients/client-b'), { name: 'No permitido' }));
    await assertFails(
      setDoc(doc(adminDb, 'clients/client-b'), { name: 'Cliente DEV', active: true }),
    );
  });

  it('reserva al backend el trabajo, la asignación y los folios de solicitudes', async () => {
    const db = env.authenticatedContext('subordinate').firestore();
    await assertSucceeds(getDoc(doc(db, 'requests/own')));
    await assertFails(
      updateDoc(doc(db, 'requests/own'), {
        status: 'in_progress',
        operationalStage: 'diagnosing',
        updatedAt: 'now',
        updatedBy: 'subordinate',
      }),
    );
    await assertFails(updateDoc(doc(db, 'requests/own'), { assigneeId: 'other' }));
    await assertFails(updateDoc(doc(db, 'requests/own'), { folio: 'MANIPULADO' }));
    const adminDb = env.authenticatedContext('admin').firestore();
    await assertFails(updateDoc(doc(adminDb, 'requests/own'), { folio: 'MANIPULADO-ADMIN' }));
  });

  it('aplica alcance de supervisor y otro equipo', async () => {
    const supervisorDb = env.authenticatedContext('supervisor').firestore();
    await assertSucceeds(getDoc(doc(supervisorDb, 'requests/own')));
    await assertFails(getDoc(doc(supervisorDb, 'requests/other')));
  });
});

describe('cotizaciones y recursos sensibles', () => {
  it('permite partidas en borrador propio y bloquea cotización emitida', async () => {
    const db = env.authenticatedContext('subordinate').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'quotes/draft/items/line-a'), {
        description: 'Servicio ficticio',
        unit: 'servicio',
        quantity: 1,
        originalUnitPrice: 100,
        discountPercent: 0,
        taxRate: 0.16,
        createdBy: 'subordinate',
      }),
    );
    await assertFails(updateDoc(doc(db, 'quotes/locked'), { notes: 'Mutación' }));
    await assertFails(
      setDoc(doc(db, 'quotes/locked/items/line-b'), { description: 'No permitido' }),
    );
  });

  it('reserva settings y auditoría al backend/admin según operación', async () => {
    const operatorDb = env.authenticatedContext('subordinate').firestore();
    const adminDb = env.authenticatedContext('admin').firestore();
    await assertSucceeds(getDoc(doc(operatorDb, 'settings/app')));
    await assertFails(updateDoc(doc(operatorDb, 'settings/app'), { taxRate: 0 }));
    await assertFails(updateDoc(doc(adminDb, 'settings/app'), { taxRate: 0.16 }));
    await assertFails(
      setDoc(doc(operatorDb, 'auditLogs/fake'), { actorId: 'subordinate', action: 'fake' }),
    );
    await assertSucceeds(getDoc(doc(operatorDb, 'auditLogs/log-own')));
    await assertSucceeds(getDoc(doc(adminDb, 'auditLogs/log-own')));
  });

  it('bloquea manual de administrador para operador aunque conozca el ID', async () => {
    const operatorDb = env.authenticatedContext('subordinate').firestore();
    const adminDb = env.authenticatedContext('admin').firestore();
    await assertSucceeds(getDoc(doc(operatorDb, 'manuals/general')));
    await assertFails(getDoc(doc(operatorDb, 'manuals/admin')));
    await assertSucceeds(getDoc(doc(adminDb, 'manuals/admin')));
  });
});

describe('Storage privado backend-only', () => {
  it('deniega lectura y escritura para anónimo, operador y admin', async () => {
    for (const context of [
      env.unauthenticatedContext(),
      env.authenticatedContext('subordinate'),
      env.authenticatedContext('admin'),
    ]) {
      const target = ref(context.storage(), 'requests/own/evidence.jpg');
      await assertFails(getBytes(target));
      await assertFails(uploadBytes(target, new Uint8Array([0xff, 0xd8, 0xff])));
    }
  });
});
