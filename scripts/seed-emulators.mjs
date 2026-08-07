import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(resolve('functions', 'package.json'));
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { PDFDocument, StandardFonts } = require('pdf-lib');

const PROJECT_ID = 'enfriamatic-operativa-dev';
const BUCKET = `${PROJECT_ID}.firebasestorage.app`;
const credentialsDirectory = resolve('.credentials');
const credentialsPath = resolve(credentialsDirectory, 'emulator-users.local.json');

for (const name of [
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
]) {
  if (!process.env[name])
    throw new Error(`${name} es obligatorio; se rechazó cualquier conexión remota.`);
}
if ((process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT) !== PROJECT_ID) {
  throw new Error('El Emulator Suite no está usando el Project ID DEV autorizado.');
}

const app = initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
const auth = getAuth(app);
const db = getFirestore(app);
const bucket = getStorage(app).bucket(BUCKET);

const definitions = [
  [
    'primary',
    'admin.principal@emulator.enfriamatic.test',
    'Admin Principal EMU',
    'admin',
    'active',
    null,
    null,
    true,
  ],
  [
    'promoted',
    'admin.promovido@emulator.enfriamatic.test',
    'Admin Promovido EMU',
    'admin',
    'active',
    null,
    null,
    false,
  ],
  [
    'supervisorA',
    'supervisor.a@emulator.enfriamatic.test',
    'Supervisor A EMU',
    'operator',
    'active',
    null,
    'team-a',
    false,
  ],
  [
    'operatorA',
    'operador.a@emulator.enfriamatic.test',
    'Operador A EMU',
    'operator',
    'active',
    'supervisorA',
    'team-a',
    false,
  ],
  [
    'supervisorB',
    'supervisor.b@emulator.enfriamatic.test',
    'Supervisor B EMU',
    'operator',
    'active',
    null,
    'team-b',
    false,
  ],
  [
    'operatorB',
    'operador.b@emulator.enfriamatic.test',
    'Operador B EMU',
    'operator',
    'active',
    'supervisorB',
    'team-b',
    false,
  ],
  [
    'independent',
    'operador.independiente@emulator.enfriamatic.test',
    'Operador Independiente EMU',
    'operator',
    'active',
    null,
    null,
    false,
  ],
  [
    'inactive',
    'inactivo@emulator.enfriamatic.test',
    'Usuario Inactivo EMU',
    'operator',
    'inactive',
    null,
    null,
    false,
  ],
  [
    'suspended',
    'suspendido@emulator.enfriamatic.test',
    'Usuario Suspendido EMU',
    'operator',
    'suspended',
    null,
    null,
    false,
  ],
  [
    'invalidRole',
    'rol.invalido@emulator.enfriamatic.test',
    'Rol Inválido EMU',
    'owner',
    'active',
    null,
    null,
    false,
  ],
];

const password = `${randomBytes(24).toString('base64url')}Aa1!`;
const ids = {};
const credentials = {};
for (const [key, email, displayName] of definitions) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, displayName, disabled: false });
  } catch (error) {
    if (!error || typeof error !== 'object' || error.code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({ email, password, displayName, emailVerified: true });
  }
  ids[key] = user.uid;
  credentials[key] = { email, password };
}

const now = Timestamp.now();
const meta = (actorId) => ({
  active: true,
  createdAt: now,
  createdBy: actorId,
  updatedAt: now,
  updatedBy: actorId,
  schemaVersion: 1,
});
const primaryId = ids.primary;
const batch = db.batch();

for (const [
  key,
  email,
  displayName,
  role,
  status,
  supervisorKey,
  teamId,
  isPrimaryAdmin,
] of definitions) {
  batch.set(db.doc(`users/${ids[key]}`), {
    uid: ids[key],
    email,
    displayName,
    role,
    status,
    supervisorId: supervisorKey ? ids[supervisorKey] : null,
    teamId,
    isPrimaryAdmin,
    ...meta(primaryId),
    active: status === 'active',
  });
}

const resources = {
  'clients/client-a': {
    id: 'client-a',
    name: 'Cliente Ártico EMU',
    contactName: 'Contacto A',
    email: 'a@clientes.invalid',
    phone: '000-000-0001',
    taxId: 'XAXX010101000',
  },
  'clients/client-b': {
    id: 'client-b',
    name: 'Cliente Boreal EMU',
    contactName: 'Contacto B',
    email: 'b@clientes.invalid',
    phone: '000-000-0002',
    taxId: '',
  },
  'sites/site-a': {
    id: 'site-a',
    clientId: 'client-a',
    name: 'Instalación A EMU',
    type: 'Pruebas',
    address: 'Dirección ficticia A',
    contactName: 'Acceso A',
    accessNotes: '',
    mapUrl: '',
  },
  'sites/site-b': {
    id: 'site-b',
    clientId: 'client-b',
    name: 'Instalación B EMU',
    type: 'Pruebas',
    address: 'Dirección ficticia B',
    contactName: 'Acceso B',
    accessNotes: '',
    mapUrl: '',
  },
  'equipment/equipment-a': {
    id: 'equipment-a',
    clientId: 'client-a',
    siteId: 'site-a',
    name: 'Compresor A EMU',
    category: 'Compresor',
    brand: 'Marca EMU',
    model: 'A-1',
    serialNumber: 'EMU-A-1',
    capacity: '10 HP',
    refrigerant: 'R-404A',
    status: 'operating',
    specifications: {},
  },
  'equipment/equipment-b': {
    id: 'equipment-b',
    clientId: 'client-b',
    siteId: 'site-b',
    name: 'Compresor B EMU',
    category: 'Compresor',
    brand: 'Marca EMU',
    model: 'B-1',
    serialNumber: 'EMU-B-1',
    capacity: '8 HP',
    refrigerant: 'R-410A',
    status: 'operating',
    specifications: {},
  },
  'catalogItems/catalog-service': {
    id: 'catalog-service',
    code: 'EMU-SERV-1',
    name: 'Diagnóstico EMU',
    type: 'service',
    category: 'Servicios',
    unit: 'servicio',
    brand: '',
    model: '',
    basePrice: 1000,
    taxRate: 0.16,
    imageDocumentId: null,
  },
};
for (const [path, value] of Object.entries(resources))
  batch.set(db.doc(path), { ...value, ...meta(primaryId) });

batch.set(db.doc('settings/app'), {
  companyName: 'Enfriamatic EMU',
  taxRate: 0.16,
  quoteValidityDays: 15,
  maxDiscountPercent: 20,
  requestFolioPrefix: 'SOL-EMU',
  quoteFolioPrefix: 'COT-EMU',
  commercialConditions: ['Condición ficticia EMU.'],
  legalText: '',
  policyStatus: 'dev_provisional',
  ...meta(primaryId),
});
batch.set(db.doc('counters/requests-2026'), { value: 2 });
batch.set(db.doc('counters/quotes-2026'), { value: 0 });

const request = (id, team, assigneeId, supervisorId, createdBy) => ({
  id,
  folio: id === 'request-a' ? 'SOL-EMU-2026-00001' : 'SOL-EMU-2026-00002',
  clientId: `client-${team}`,
  siteId: `site-${team}`,
  equipmentId: `equipment-${team}`,
  scope: 'equipment',
  serviceType: 'diagnostic',
  priority: 'high',
  requestedDate: '2026-08-10',
  assigneeId,
  supervisorId,
  createdBy,
  description: `Solicitud ${team.toUpperCase()} EMU`,
  quoteRequirement: 'yes',
  status: 'assigned',
  operationalStage: 'reviewing',
  ...meta(createdBy),
});
batch.set(
  db.doc('requests/request-a'),
  request('request-a', 'a', ids.operatorA, ids.supervisorA, ids.supervisorA),
);
batch.set(
  db.doc('requests/request-b'),
  request('request-b', 'b', ids.operatorB, ids.supervisorB, ids.supervisorB),
);

batch.set(db.doc('quotes/quote-a'), {
  id: 'quote-a',
  folio: null,
  revision: 0,
  revisionNumber: 0,
  originalQuoteId: null,
  requestId: 'request-a',
  clientId: 'client-a',
  siteId: 'site-a',
  equipmentId: 'equipment-a',
  supervisorId: ids.supervisorA,
  clientName: 'Cliente Ártico EMU',
  status: 'draft',
  locked: false,
  discountDisplayMode: 'detailed',
  validityDays: 15,
  notes: 'Nota EMU',
  conditions: ['Condición ficticia EMU.'],
  totals: { gross: 0, discount: 0, subtotal: 0, tax: 0, total: 0 },
  documentStatus: 'not_generated',
  documentId: null,
  ...meta(ids.operatorA),
});
batch.set(db.doc('quotes/quote-a/items/item-1'), {
  id: 'item-1',
  catalogItemId: 'catalog-service',
  code: 'EMU-SERV-1',
  description: 'Diagnóstico EMU',
  unit: 'servicio',
  quantity: 2,
  originalUnitPrice: 1000,
  discountPercent: 10,
  taxRate: 0.16,
  discountDisplayMode: 'detailed',
  createdAt: now,
  createdBy: ids.operatorA,
  updatedAt: now,
  updatedBy: ids.operatorA,
});

await batch.commit();

async function manualPdf(title) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(title, { x: 50, y: 700, size: 18, font });
  return Buffer.from(await pdf.save());
}
for (const [id, title, accessScope] of [
  ['manual-general', 'Manual General EMU', 'all_active'],
  ['manual-operator', 'Manual Operador EMU', 'all_active'],
  ['manual-admin', 'Manual Administrador EMU', 'admin_only'],
]) {
  const bytes = await manualPdf(title);
  const storagePath = `manuals/${id}.pdf`;
  await bucket.file(storagePath).save(bytes, { resumable: false, contentType: 'application/pdf' });
  await db.doc(`documents/${id}`).set({
    id,
    kind: 'manual',
    accessScope,
    resourceId: id,
    storagePath,
    fileName: `${id}.pdf`,
    mimeType: 'application/pdf',
    size: bytes.length,
    status: 'ready',
    ...meta(primaryId),
  });
  await db.doc(`manuals/${id}`).set({
    id,
    title,
    description: 'Fixture EMU',
    accessScope,
    version: 'EMU-1',
    publishedAt: '2026-08-07',
    pages: 1,
    documentId: id,
    ...meta(primaryId),
  });
}

await mkdir(credentialsDirectory, { recursive: true });
await writeFile(
  credentialsPath,
  `${JSON.stringify({ projectId: PROJECT_ID, users: credentials }, null, 2)}\n`,
  {
    encoding: 'utf8',
    mode: 0o600,
  },
);
await db
  .collection('auditLogs')
  .doc('emulator-seed')
  .set({
    actorId: primaryId,
    actorRole: 'admin',
    actorSupervisorId: null,
    actorTeamId: null,
    action: 'emulator.seed.completed',
    resource: 'project',
    resourceId: PROJECT_ID,
    before: null,
    after: { fakeDataOnly: true },
    metadata: {},
    createdAt: FieldValue.serverTimestamp(),
    schemaVersion: 1,
  });

console.log(`Seed local idempotente completado en emuladores para ${PROJECT_ID}.`);
console.log(`Credenciales locales ignoradas por Git: ${credentialsPath}`);
