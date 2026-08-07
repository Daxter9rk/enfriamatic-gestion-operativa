import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PROJECT_ID = 'enfriamatic-operativa-dev';
const options = {
  apiKey: 'emulator-only',
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
  storageBucket: `${PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:emulator',
};

type Persona =
  | 'primary'
  | 'promoted'
  | 'supervisorA'
  | 'operatorA'
  | 'supervisorB'
  | 'operatorB'
  | 'independent'
  | 'inactive'
  | 'suspended'
  | 'invalidRole';
type CredentialMap = Record<Persona, { email: string; password: string }>;

const apps: FirebaseApp[] = [];
const sessions = new Map<Persona, ReturnType<typeof session>>();
let credentials: CredentialMap;

function session(label: string) {
  const app = initializeApp(options, `integration-${label}-${randomUUID()}`);
  apps.push(app);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(app, 'us-central1');
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  return { app, auth, firestore, functions };
}

async function signed(persona: Persona) {
  const existing = sessions.get(persona);
  if (existing) return existing;
  const value = session(persona);
  const credential = credentials[persona];
  await signInWithEmailAndPassword(value.auth, credential.email, credential.password);
  sessions.set(persona, value);
  return value;
}

async function call<T>(persona: Persona, name: string, data: unknown): Promise<T> {
  const value = await signed(persona);
  const result = await httpsCallable<unknown, T>(value.functions, name)(data);
  return result.data;
}

async function expectCode(operation: Promise<unknown>, code: string) {
  await expect(operation).rejects.toMatchObject({ code });
}

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('La integración se ejecuta exclusivamente dentro de Emulator Suite.');
  }
  const parsed = JSON.parse(
    await readFile(resolve('.credentials', 'emulator-users.local.json'), 'utf8'),
  ) as { projectId: string; users: CredentialMap };
  expect(parsed.projectId).toBe(PROJECT_ID);
  credentials = parsed.users;
});

afterAll(async () => {
  await Promise.all(apps.map((app) => deleteApp(app)));
});

describe('Functions integradas con Auth, Firestore y Storage Emulator', () => {
  it('rechaza anónimo, perfiles inactivos, suspendidos y roles inválidos', async () => {
    const anonymous = session('anonymous');
    await expectCode(
      httpsCallable(anonymous.functions, 'createServiceRequest')({}),
      'functions/unauthenticated',
    );
    for (const persona of ['inactive', 'suspended'] as const) {
      await expectCode(call(persona, 'createServiceRequest', {}), 'functions/permission-denied');
    }
    await expectCode(call('invalidRole', 'createServiceRequest', {}), 'functions/data-loss');
  });

  it('impide cruces de equipo y permite asignación propia o a subordinado directo', async () => {
    const assigned = await call<{ ok: boolean }>('supervisorA', 'assignServiceRequest', {
      requestId: 'request-a',
      assigneeId: (await signed('operatorA')).auth.currentUser?.uid,
      idempotencyKey: randomUUID(),
    });
    expect(assigned.ok).toBe(true);
    await expectCode(
      call('supervisorA', 'assignServiceRequest', {
        requestId: 'request-b',
        assigneeId: (await signed('operatorA')).auth.currentUser?.uid,
        idempotencyKey: randomUUID(),
      }),
      'functions/permission-denied',
    );
    await expectCode(
      call('supervisorA', 'assignServiceRequest', {
        requestId: 'request-a',
        assigneeId: (await signed('operatorB')).auth.currentUser?.uid,
        idempotencyKey: randomUUID(),
      }),
      'functions/permission-denied',
    );
  });

  it('valida relaciones y asigna folios únicos bajo concurrencia', async () => {
    await expectCode(
      call('operatorA', 'createServiceRequest', {
        clientId: 'client-a',
        siteId: 'site-b',
        equipmentId: null,
        scope: 'general',
        serviceType: 'diagnostic',
        priority: 'low',
        requestedDate: '2026-08-20',
        description: 'Relación inconsistente EMU',
        quoteRequirement: 'no',
        assigneeId: null,
        idempotencyKey: randomUUID(),
      }),
      'functions/failed-precondition',
    );
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        call<{ requestId: string; folio: string }>('operatorA', 'createServiceRequest', {
          clientId: 'client-a',
          siteId: 'site-a',
          equipmentId: 'equipment-a',
          scope: 'equipment',
          serviceType: 'diagnostic',
          priority: 'low',
          requestedDate: '2026-08-20',
          description: `Solicitud concurrente EMU ${index}`,
          quoteRequirement: 'no',
          assigneeId: null,
          idempotencyKey: randomUUID(),
        }),
      ),
    );
    expect(new Set(created.map((item) => item.folio)).size).toBe(created.length);
  });

  it('protege al principal y limita al administrador promovido', async () => {
    const primaryUid = (await signed('primary')).auth.currentUser?.uid;
    await expectCode(
      call('promoted', 'updateManagedUser', {
        uid: primaryUid,
        action: 'suspend',
        idempotencyKey: randomUUID(),
      }),
      'functions/permission-denied',
    );
    const email = `nuevo-${randomUUID()}@emulator.enfriamatic.test`;
    const created = await call<{ uid: string }>('primary', 'createManagedUser', {
      email,
      displayName: 'Nuevo Operador EMU',
      role: 'operator',
      supervisorId: null,
      teamId: 'team-new',
      temporaryPassword: `${randomBytes(20).toString('base64url')}Aa1!`,
      idempotencyKey: randomUUID(),
    });
    await call('primary', 'updateManagedUser', {
      uid: created.uid,
      action: 'promote',
      idempotencyKey: randomUUID(),
    });
    const primary = await signed('primary');
    expect((await getDoc(doc(primary.firestore, 'users', created.uid))).data()?.role).toBe('admin');
  });

  it('emite una sola vez, conserva el folio al reintentar y crea una revisión completa', async () => {
    await expectCode(
      call('operatorB', 'issueQuote', { quoteId: 'quote-a', idempotencyKey: randomUUID() }),
      'functions/permission-denied',
    );
    const idempotencyKey = randomUUID();
    const [first, second] = await Promise.all([
      call<{ folio: string; status: string; documentId?: string }>('operatorA', 'issueQuote', {
        quoteId: 'quote-a',
        idempotencyKey,
      }),
      call<{ folio: string; status: string; documentId?: string }>('operatorA', 'issueQuote', {
        quoteId: 'quote-a',
        idempotencyKey,
      }),
    ]);
    expect(first.folio).toBe(second.folio);
    const replay = await call<{ folio: string; status: string; documentId: string }>(
      'operatorA',
      'issueQuote',
      { quoteId: 'quote-a', idempotencyKey },
    );
    expect(replay.folio).toBe(first.folio);
    expect(replay.status).toBe('ready');
    const operator = await signed('operatorA');
    const source = await getDoc(doc(operator.firestore, 'quotes', 'quote-a'));
    expect(source.data()).toMatchObject({
      status: 'issued',
      locked: true,
      documentStatus: 'ready',
    });
    const revision = await call<{ quoteId: string; folio: string }>(
      'operatorA',
      'createQuoteRevision',
      {
        quoteId: 'quote-a',
        idempotencyKey: randomUUID(),
      },
    );
    expect(revision.folio).not.toBe(first.folio);
    const copiedItems = await getDocs(
      collection(operator.firestore, 'quotes', revision.quoteId, 'items'),
    );
    expect(copiedItems.size).toBe(1);
    expect(
      (await getDoc(doc(operator.firestore, 'quotes', revision.quoteId))).data(),
    ).toMatchObject({
      originalQuoteId: 'quote-a',
      revisionNumber: 1,
      status: 'draft',
      locked: false,
    });
  });

  it('protege archivos, manual administrador y registra auditoría backend', async () => {
    const general = await call<{ base64: string }>('operatorA', 'downloadPrivateFile', {
      documentId: 'manual-general',
    });
    expect(general.base64.length).toBeGreaterThan(50);
    await expectCode(
      call('operatorA', 'downloadPrivateFile', { documentId: 'manual-admin' }),
      'functions/permission-denied',
    );
    const onePixel =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const uploaded = await call<{ documentId: string }>('operatorA', 'uploadPrivateFile', {
      kind: 'request_evidence',
      resourceId: 'request-a',
      mimeType: 'image/png',
      fileName: 'evidencia-emu.png',
      base64: onePixel,
    });
    expect(uploaded.documentId).toBeTruthy();
    await expectCode(
      call('operatorA', 'uploadPrivateFile', {
        kind: 'request_evidence',
        resourceId: 'request-b',
        mimeType: 'image/png',
        fileName: 'prohibida.png',
        base64: onePixel,
      }),
      'functions/permission-denied',
    );
    const primary = await signed('primary');
    const issuedLogs = await getDocs(
      query(collection(primary.firestore, 'auditLogs'), where('action', '==', 'quote.issued')),
    );
    expect(issuedLogs.empty).toBe(false);
  });
});
