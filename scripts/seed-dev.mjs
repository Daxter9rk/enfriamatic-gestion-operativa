import { createRequire } from 'node:module';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'enfriamatic-operativa-dev';
const BUCKET = `${PROJECT_ID}.firebasestorage.app`;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const credentialsPath = resolve(repositoryRoot, '.credentials', `${PROJECT_ID}-users.local.json`);
const temporaryAdcPath = resolve(repositoryRoot, '.credentials', '.firebase-cli-adc.tmp.json');
const rootRequire = createRequire(import.meta.url);
const functionsRequire = createRequire(resolve(repositoryRoot, 'functions', 'package.json'));
const { applicationDefault, initializeApp } = functionsRequire('firebase-admin/app');
const { getAuth } = functionsRequire('firebase-admin/auth');
const { FieldValue, getFirestore, Timestamp } = functionsRequire('firebase-admin/firestore');
const { getStorage } = functionsRequire('firebase-admin/storage');
const { PDFDocument, StandardFonts, rgb } = functionsRequire('pdf-lib');

const projectFlag = process.argv.findIndex((argument) => argument === '--project');
const requestedProject = projectFlag >= 0 ? process.argv[projectFlag + 1] : PROJECT_ID;
if (requestedProject !== PROJECT_ID) {
  throw new Error(`Project ID no autorizado para seed DEV: ${requestedProject ?? '(ausente)'}`);
}

for (const name of [
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
  'FUNCTIONS_EMULATOR',
]) {
  if (process.env[name]) {
    throw new Error(`${name} está definido; seed-dev sólo admite el proyecto Firebase DEV remoto.`);
  }
}

if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT_ID) {
  throw new Error(`Proyecto efectivo no autorizado: ${process.env.GCLOUD_PROJECT}`);
}

const cliAuth = rootRequire('firebase-tools/lib/auth');
const { requireAuth } = rootRequire('firebase-tools/lib/requireAuth');
const cliOAuth = rootRequire('firebase-tools/lib/api');

const account = cliAuth.getGlobalDefaultAccount();
if (!account?.user?.email || !account.tokens) {
  throw new Error('Ejecuta firebase login antes del seed DEV.');
}

const cliOptions = {
  project: PROJECT_ID,
  projectId: PROJECT_ID,
  user: account.user,
  tokens: account.tokens,
};
await requireAuth(cliOptions);

const refreshToken = account.tokens.refresh_token;
if (!refreshToken)
  throw new Error('La sesión de Firebase CLI no contiene refresh token reutilizable.');
await mkdir(dirname(temporaryAdcPath), { recursive: true });
await writeFile(
  temporaryAdcPath,
  JSON.stringify({
    type: 'authorized_user',
    client_id: cliOAuth.clientId,
    client_secret: cliOAuth.clientSecret,
    refresh_token: refreshToken,
  }),
  { encoding: 'utf8', mode: 0o600 },
);
const previousGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
process.env.GOOGLE_APPLICATION_CREDENTIALS = temporaryAdcPath;

let auth;
let db;
let bucket;

const userDefinitions = [
  {
    key: 'primaryAdmin',
    email: 'admin.principal@dev.enfriamatic.example',
    displayName: 'Alicia Polar DEV',
    role: 'admin',
    supervisorKey: null,
    teamId: null,
    isPrimaryAdmin: true,
  },
  {
    key: 'promotedAdmin',
    email: 'admin.operativo@dev.enfriamatic.example',
    displayName: 'Bruno Ártico DEV',
    role: 'admin',
    supervisorKey: null,
    teamId: null,
    isPrimaryAdmin: false,
  },
  {
    key: 'supervisor',
    email: 'supervisor.norte@dev.enfriamatic.example',
    displayName: 'Celia Boreal DEV',
    role: 'operator',
    supervisorKey: null,
    teamId: 'team-norte-dev',
    isPrimaryAdmin: false,
  },
  {
    key: 'subordinateOne',
    email: 'operador.glaciar@dev.enfriamatic.example',
    displayName: 'Diego Glaciar DEV',
    role: 'operator',
    supervisorKey: 'supervisor',
    teamId: 'team-norte-dev',
    isPrimaryAdmin: false,
  },
  {
    key: 'subordinateTwo',
    email: 'operadora.aurora@dev.enfriamatic.example',
    displayName: 'Elena Aurora DEV',
    role: 'operator',
    supervisorKey: 'supervisor',
    teamId: 'team-norte-dev',
    isPrimaryAdmin: false,
  },
  {
    key: 'independentOperator',
    email: 'operador.independiente@dev.enfriamatic.example',
    displayName: 'Fabio Nival DEV',
    role: 'operator',
    supervisorKey: null,
    teamId: 'team-independiente-dev',
    isPrimaryAdmin: false,
  },
];

function randomPassword() {
  return `${randomBytes(24).toString('base64url')}Aa1!`;
}

async function readCredentials() {
  try {
    const parsed = JSON.parse(await readFile(credentialsPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || parsed.projectId !== PROJECT_ID) {
      throw new Error('El archivo local de credenciales pertenece a otro proyecto o es inválido.');
    }
    if (!parsed.users || typeof parsed.users !== 'object' || Array.isArray(parsed.users)) {
      throw new Error('El archivo local de credenciales no contiene un mapa de usuarios válido.');
    }
    return parsed.users;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  }
}

async function upsertUsers() {
  const stored = await readCredentials();
  const identities = {};
  for (const definition of userDefinitions) {
    const password = stored[definition.email] ?? randomPassword();
    let record;
    try {
      record = await auth.getUserByEmail(definition.email);
      record = await auth.updateUser(record.uid, {
        displayName: definition.displayName,
        disabled: false,
        password,
      });
    } catch (error) {
      if (!error || typeof error !== 'object' || error.code !== 'auth/user-not-found') throw error;
      record = await auth.createUser({
        email: definition.email,
        emailVerified: true,
        displayName: definition.displayName,
        disabled: false,
        password,
      });
    }
    identities[definition.key] = record.uid;
    stored[definition.email] = password;
  }
  await mkdir(dirname(credentialsPath), { recursive: true });
  await writeFile(
    credentialsPath,
    `${JSON.stringify({ projectId: PROJECT_ID, users: stored }, null, 2)}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  return identities;
}

function common(actorId) {
  const now = Timestamp.now();
  return {
    active: true,
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
    schemaVersion: 1,
  };
}

async function createFixturePdf(title, accessScope) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText('ENFRIAMATIC GESTIÓN OPERATIVA', {
    x: 54,
    y: 710,
    size: 18,
    font: bold,
    color: rgb(0.02, 0.16, 0.34),
  });
  page.drawText(title, { x: 54, y: 650, size: 24, font: bold });
  page.drawText('DOCUMENTO DE PRUEBA DEV — NO ES MANUAL FINAL', {
    x: 54,
    y: 600,
    size: 13,
    font: bold,
    color: rgb(0.75, 0.12, 0.12),
  });
  page.drawText(`Alcance técnico: ${accessScope}`, { x: 54, y: 560, size: 11, font });
  page.drawText('Contenido ficticio para validar autorización, preview y descarga privada.', {
    x: 54,
    y: 535,
    size: 11,
    font,
  });
  return Buffer.from(await pdf.save());
}

async function uploadFixtures(actorId) {
  const manuals = [
    ['manual-general-dev', 'Guía general DEV', 'all_active'],
    ['manual-operador-dev', 'Manual del operador DEV', 'all_active'],
    ['manual-admin-dev', 'Manual del administrador DEV', 'admin_only'],
  ];
  const results = [];
  for (const [documentId, title, accessScope] of manuals) {
    const storagePath = `manuals/${documentId}.pdf`;
    const bytes = await createFixturePdf(title, accessScope);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await bucket.file(storagePath).save(bytes, {
      resumable: false,
      contentType: 'application/pdf',
      metadata: {
        cacheControl: 'private, max-age=0, no-store',
        metadata: { documentId, accessScope, fixture: 'true', sha256 },
      },
    });
    results.push({ documentId, title, accessScope, storagePath, size: bytes.length, sha256 });
  }

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const catalogPath = 'catalog/dev-catalog-image.png';
  await bucket.file(catalogPath).save(png, {
    resumable: false,
    contentType: 'image/png',
    metadata: { cacheControl: 'private, max-age=0, no-store', metadata: { fixture: 'true' } },
  });
  await db.doc('documents/catalog-image-dev').set({
    id: 'catalog-image-dev',
    kind: 'catalog_image',
    accessScope: 'all_active',
    resourceId: 'catalog-compresor-dev',
    storagePath: catalogPath,
    fileName: 'catalogo-fixture-dev.png',
    mimeType: 'image/png',
    size: png.length,
    sha256: createHash('sha256').update(png).digest('hex'),
    status: 'ready',
    ...common(actorId),
  });
  return results;
}

async function seedFirestore(ids, manualFiles) {
  const actorId = ids.primaryAdmin;
  const foreignPrimary = await db.collection('users').where('isPrimaryAdmin', '==', true).get();
  if (foreignPrimary.docs.some((item) => item.id !== actorId)) {
    throw new Error('Existe otro administrador principal; el seed se detuvo sin reemplazarlo.');
  }

  const batch = db.batch();
  for (const definition of userDefinitions) {
    const uid = ids[definition.key];
    batch.set(db.doc(`users/${uid}`), {
      uid,
      email: definition.email,
      displayName: definition.displayName,
      role: definition.role,
      status: 'active',
      supervisorId: definition.supervisorKey ? ids[definition.supervisorKey] : null,
      teamId: definition.teamId,
      isPrimaryAdmin: definition.isPrimaryAdmin,
      ...common(actorId),
    });
  }

  const records = {
    'teams/team-norte-dev': {
      id: 'team-norte-dev',
      name: 'Equipo Boreal DEV',
      supervisorId: ids.supervisor,
      memberIds: [ids.supervisor, ids.subordinateOne, ids.subordinateTwo],
    },
    'teams/team-independiente-dev': {
      id: 'team-independiente-dev',
      name: 'Operación Independiente DEV',
      supervisorId: null,
      memberIds: [ids.independentOperator],
    },
    'clients/client-laboratorio-dev': {
      id: 'client-laboratorio-dev',
      name: 'Laboratorio Boreal DEV',
      contactName: 'Contacto Ficticio Uno',
      email: 'contacto.uno@clientes.example',
      phone: '+52 555 010 1001',
      taxId: 'XAXX010101000',
    },
    'clients/client-centro-dev': {
      id: 'client-centro-dev',
      name: 'Centro de Pruebas Glaciar DEV',
      contactName: 'Contacto Ficticio Dos',
      email: 'contacto.dos@clientes.example',
      phone: '+52 555 010 1002',
      taxId: '',
    },
    'sites/site-camara-dev': {
      id: 'site-camara-dev',
      clientId: 'client-laboratorio-dev',
      name: 'Cámara Experimental Norte DEV',
      type: 'Laboratorio ficticio',
      address: 'Avenida Ficticia 100, Ciudad DEV',
      contactName: 'Acceso DEV Uno',
      accessNotes: 'Presentarse en recepción de pruebas.',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=Avenida+Ficticia+100',
    },
    'sites/site-taller-dev': {
      id: 'site-taller-dev',
      clientId: 'client-centro-dev',
      name: 'Taller Criogénico DEV',
      type: 'Taller ficticio',
      address: 'Calle Simulada 42, Ciudad DEV',
      contactName: 'Acceso DEV Dos',
      accessNotes: 'Usar equipo de protección de prueba.',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=Calle+Simulada+42',
    },
    'equipment/equipment-compresor-dev': {
      id: 'equipment-compresor-dev',
      name: 'Compresor de ensayo DEV',
      clientId: 'client-laboratorio-dev',
      siteId: 'site-camara-dev',
      category: 'Compresor semihermético',
      brand: 'Marca Ficticia Boreal',
      model: 'DEV-CMP-100',
      serialNumber: 'DEV-SN-000100',
      capacity: '10 HP',
      refrigerant: 'R-404A',
      status: 'operating',
      specifications: { voltage: '220 V', phases: '3' },
    },
    'equipment/equipment-evaporador-dev': {
      id: 'equipment-evaporador-dev',
      name: 'Evaporador de ensayo DEV',
      clientId: 'client-centro-dev',
      siteId: 'site-taller-dev',
      category: 'Evaporador',
      brand: 'Marca Ficticia Aurora',
      model: 'DEV-EVP-200',
      serialNumber: 'DEV-SN-000200',
      capacity: '5 TR',
      refrigerant: 'R-410A',
      status: 'maintenance',
      specifications: { airflow: 'Dato DEV' },
    },
    'catalogItems/catalog-compresor-dev': {
      id: 'catalog-compresor-dev',
      code: 'DEV-PROD-001',
      name: 'Componente de compresor DEV',
      type: 'product',
      category: 'Componentes',
      unit: 'pieza',
      brand: 'Marca Ficticia Boreal',
      model: 'DEV-CMP-P',
      basePrice: 1250,
      taxRate: 0.16,
      imageDocumentId: 'catalog-image-dev',
    },
    'catalogItems/catalog-diagnostico-dev': {
      id: 'catalog-diagnostico-dev',
      code: 'DEV-SERV-001',
      name: 'Diagnóstico técnico DEV',
      type: 'service',
      category: 'Servicios',
      unit: 'servicio',
      brand: '',
      model: '',
      basePrice: 1800,
      taxRate: 0.16,
      imageDocumentId: null,
    },
    'settings/app': {
      companyName: 'Enfriamatic · datos DEV',
      taxRate: 0.16,
      quoteValidityDays: 15,
      maxDiscountPercent: 20,
      requestFolioPrefix: 'SOL-DEV',
      quoteFolioPrefix: 'COT-DEV',
      legalText: '',
      commercialConditions: [
        'Condiciones ficticias de prueba DEV; no constituyen política comercial.',
      ],
      policyStatus: 'dev_provisional',
    },
    'counters/requests-2026': { value: 3 },
    'counters/quotes-2026': { value: 2 },
  };

  for (const [path, data] of Object.entries(records)) {
    batch.set(db.doc(path), { ...data, ...common(actorId) }, { merge: true });
  }

  const requestBase = {
    clientId: 'client-laboratorio-dev',
    siteId: 'site-camara-dev',
    equipmentId: 'equipment-compresor-dev',
    scope: 'equipment',
    serviceType: 'diagnostic',
    quoteRequirement: 'yes',
    requestedDate: '2026-08-15',
    description: 'Diagnóstico ficticio para validar el flujo DEV.',
    createdBy: ids.supervisor,
    schemaVersion: 1,
    active: true,
  };
  batch.set(db.doc('requests/request-assigned-dev'), {
    id: 'request-assigned-dev',
    folio: 'SOL-DEV-2026-00001',
    ...requestBase,
    priority: 'high',
    assigneeId: ids.subordinateOne,
    supervisorId: ids.supervisor,
    status: 'in_progress',
    operationalStage: 'diagnosing',
    createdAt: Timestamp.fromDate(new Date('2026-08-05T14:00:00Z')),
    updatedAt: Timestamp.now(),
    updatedBy: ids.subordinateOne,
  });
  batch.set(db.doc('requests/request-unassigned-dev'), {
    id: 'request-unassigned-dev',
    folio: 'SOL-DEV-2026-00002',
    ...requestBase,
    equipmentId: null,
    scope: 'general',
    priority: 'medium',
    quoteRequirement: 'undetermined',
    assigneeId: null,
    supervisorId: ids.supervisor,
    status: 'pending',
    operationalStage: 'reviewing',
    createdAt: Timestamp.fromDate(new Date('2026-08-06T14:00:00Z')),
    updatedAt: Timestamp.now(),
    updatedBy: ids.supervisor,
  });
  batch.set(db.doc('requests/request-independent-dev'), {
    id: 'request-independent-dev',
    folio: 'SOL-DEV-2026-00003',
    ...requestBase,
    clientId: 'client-centro-dev',
    siteId: 'site-taller-dev',
    equipmentId: 'equipment-evaporador-dev',
    priority: 'low',
    quoteRequirement: 'no',
    createdBy: ids.independentOperator,
    assigneeId: ids.independentOperator,
    supervisorId: null,
    status: 'completed',
    operationalStage: 'follow_up',
    createdAt: Timestamp.fromDate(new Date('2026-08-01T14:00:00Z')),
    updatedAt: Timestamp.now(),
    updatedBy: ids.independentOperator,
  });

  batch.set(db.doc('quotes/quote-draft-dev'), {
    id: 'quote-draft-dev',
    folio: null,
    revision: 0,
    revisionNumber: 0,
    originalQuoteId: null,
    requestId: 'request-assigned-dev',
    clientId: 'client-laboratorio-dev',
    siteId: 'site-camara-dev',
    equipmentId: 'equipment-compresor-dev',
    supervisorId: ids.supervisor,
    clientName: 'Laboratorio Boreal DEV',
    status: 'draft',
    locked: false,
    discountDisplayMode: 'detailed',
    validityDays: 15,
    notes: 'Nota ficticia DEV.',
    conditions: [],
    totals: { gross: 1800, discount: 180, subtotal: 1620, tax: 259.2, total: 1879.2 },
    documentStatus: 'not_generated',
    documentId: null,
    ...common(ids.subordinateOne),
  });
  batch.set(db.doc('quotes/quote-draft-dev/items/item-1'), {
    id: 'item-1',
    catalogItemId: 'catalog-diagnostico-dev',
    code: 'DEV-SERV-001',
    description: 'Diagnóstico técnico DEV',
    unit: 'servicio',
    quantity: 1,
    originalUnitPrice: 1800,
    finalUnitPrice: 1620,
    discountPercent: 10,
    discountAmount: 180,
    taxRate: 0.16,
    subtotalAmount: 1620,
    taxAmount: 259.2,
    totalAmount: 1879.2,
    discountDisplayMode: 'detailed',
    createdBy: ids.subordinateOne,
    createdAt: Timestamp.now(),
  });

  for (const manual of manualFiles) {
    batch.set(db.doc(`documents/${manual.documentId}`), {
      id: manual.documentId,
      kind: 'manual',
      accessScope: manual.accessScope,
      resourceId: manual.documentId,
      storagePath: manual.storagePath,
      fileName: `${manual.documentId}.pdf`,
      mimeType: 'application/pdf',
      size: manual.size,
      sha256: manual.sha256,
      status: 'ready',
      fixture: true,
      ...common(actorId),
    });
    batch.set(db.doc(`manuals/${manual.documentId}`), {
      id: manual.documentId,
      title: manual.title,
      description: 'Fixture privado para validación DEV.',
      accessScope: manual.accessScope,
      version: 'DEV-1',
      publishedAt: '2026-08-07',
      pages: 1,
      documentId: manual.documentId,
      ...common(actorId),
    });
  }

  batch.set(db.doc('notifications/notification-assignment-dev'), {
    id: 'notification-assignment-dev',
    userId: ids.subordinateOne,
    type: 'assignment',
    title: 'Solicitud DEV asignada',
    body: 'Tienes una solicitud ficticia asignada.',
    resourceType: 'request',
    resourceId: 'request-assigned-dev',
    readAt: null,
    createdAt: Timestamp.now(),
  });
  batch.set(db.doc('auditLogs/seed-dev'), {
    id: 'seed-dev',
    actorId,
    actorRole: 'admin',
    actorSupervisorId: null,
    action: 'dev.seed.completed',
    resource: 'project',
    resourceId: PROJECT_ID,
    before: null,
    after: { fixtureVersion: 1 },
    metadata: { fakeDataOnly: true },
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

try {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
    storageBucket: BUCKET,
  });
  if (app.options.projectId !== PROJECT_ID) {
    throw new Error(
      `SDK Admin inicializado contra proyecto no autorizado: ${app.options.projectId}`,
    );
  }
  auth = getAuth();
  db = getFirestore();
  bucket = getStorage().bucket(BUCKET);

  console.log(`[preflight] Proyecto autorizado para Auth: ${PROJECT_ID}`);
  const identities = await upsertUsers();
  console.log(`[preflight] Proyecto autorizado para Storage: ${PROJECT_ID}`);
  const manualFiles = await uploadFixtures(identities.primaryAdmin);
  console.log(`[preflight] Proyecto autorizado para Firestore: ${PROJECT_ID}`);
  await seedFirestore(identities, manualFiles);

  console.log(`Seed idempotente completado en ${PROJECT_ID}.`);
  console.log(`Credenciales locales: ${credentialsPath}`);
  console.log('Usuarios DEV:');
  for (const user of userDefinitions) console.log(`- ${user.email} (${user.key})`);
} finally {
  if (previousGoogleCredentials === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousGoogleCredentials;
  await unlink(temporaryAdcPath).catch(() => undefined);
}
