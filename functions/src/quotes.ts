import { createHash, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { bucket, db } from './admin.js';
import {
  assertAuthorized,
  assertQuoteRelations,
  assertRequestRelations,
  canManageQuote,
  canAccessRequest,
} from './authorization.js';
import { parseQuote, parseRequest } from './contracts.js';
import {
  calculateLine,
  totals,
  type CalculatedLine,
  type LineInput,
} from '../../src/domain/quote-calculations.js';
import { auditRecord, objectData, requireActor, text } from './security.js';
import { decideIssueStart, IssueDecisionError } from './quote-issuance-policy.js';

export interface QuoteGeneration {
  quoteId: string;
  folio: string;
  token: string;
  idempotencyKey: string;
  lines: CalculatedLine[];
  summary: ReturnType<typeof totals>;
  clientName: string;
  notes: string;
  conditions: string[];
  configurationSnapshot: Record<string, unknown>;
}

type StartResult =
  | { outcome: 'ready'; folio: string; documentId: string }
  | { outcome: 'generating'; folio: string }
  | { outcome: 'generate'; generation: QuoteGeneration };

const money = (value: number) =>
  value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

function drawHeader(page: PDFPage, regular: PDFFont, bold: PDFFont, folio: string): number {
  page.drawRectangle({ x: 0, y: 700, width: 612, height: 92, color: rgb(0.02, 0.13, 0.27) });
  page.drawText('ENFRIAMATIC', { x: 42, y: 748, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText('Gestión Operativa · Cotización', {
    x: 42,
    y: 724,
    size: 11,
    font: regular,
    color: rgb(0.4, 0.86, 1),
  });
  page.drawText(folio, { x: 420, y: 744, size: 12, font: bold, color: rgb(1, 1, 1) });
  return 675;
}

function drawTableHeader(page: PDFPage, bold: PDFFont, y: number): number {
  page.drawRectangle({ x: 38, y: y - 5, width: 536, height: 22, color: rgb(0.92, 0.95, 0.99) });
  page.drawText('Concepto', { x: 44, y: y + 2, size: 8, font: bold });
  page.drawText('Cantidad', { x: 350, y: y + 2, size: 8, font: bold });
  page.drawText('Precio', { x: 425, y: y + 2, size: 8, font: bold });
  page.drawText('Importe', { x: 510, y: y + 2, size: 8, font: bold });
  return y - 22;
}

function drawWrappedText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  y: number,
  width: number,
  size = 9,
): number {
  const words = value.replace(/\s+/g, ' ').trim().split(' ');
  let line = '';
  let cursor = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > width && line) {
      page.drawText(line, { x, y: cursor, size, font });
      cursor -= size + 3;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursor, size, font });
    cursor -= size + 3;
  }
  return cursor;
}

export async function buildQuotePdf(generation: QuoteGeneration): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = drawHeader(page, regular, bold, generation.folio);
  page.drawText(`Cliente: ${generation.clientName}`, { x: 42, y, size: 11, font: bold });
  y = drawTableHeader(page, bold, y - 34);

  for (const line of generation.lines) {
    if (y < 105) {
      page = pdf.addPage([612, 792]);
      y = drawTableHeader(page, bold, drawHeader(page, regular, bold, generation.folio) - 20);
    }
    const description =
      line.description.length > 76 ? `${line.description.slice(0, 73)}…` : line.description;
    page.drawText(description, { x: 44, y, size: 8, font: regular });
    page.drawText(`${line.quantity} ${line.unit}`, { x: 350, y, size: 8, font: regular });
    page.drawText(money(line.finalUnitPrice), { x: 425, y, size: 8, font: regular });
    page.drawText(money(line.totalAmount), { x: 510, y, size: 8, font: regular });
    y -= 22;
  }

  if (y < 285) {
    page = pdf.addPage([612, 792]);
    y = drawHeader(page, regular, bold, generation.folio) - 25;
  }
  page.drawLine({ start: { x: 340, y }, end: { x: 574, y }, thickness: 1 });
  y -= 23;
  for (const [label, value] of [
    ['Importe bruto', generation.summary.gross],
    ['Descuento', generation.summary.discount],
    ['Subtotal', generation.summary.subtotal],
    ['IVA', generation.summary.tax],
  ] as const) {
    page.drawText(label, { x: 390, y, size: 9, font: regular });
    page.drawText(money(value), { x: 505, y, size: 9, font: regular });
    y -= 18;
  }
  page.drawText('Total MXN', { x: 390, y, size: 11, font: bold });
  page.drawText(money(generation.summary.total), { x: 500, y, size: 11, font: bold });
  y -= 35;

  if (generation.notes) {
    page.drawText('Notas', { x: 42, y, size: 10, font: bold });
    y = drawWrappedText(page, regular, generation.notes, 42, y - 16, 520);
    y -= 8;
  }
  if (generation.conditions.length > 0) {
    page.drawText('Condiciones comerciales', { x: 42, y, size: 10, font: bold });
    y -= 16;
    for (const condition of generation.conditions) {
      if (y < 75) {
        page = pdf.addPage([612, 792]);
        y = drawHeader(page, regular, bold, generation.folio) - 20;
      }
      y = drawWrappedText(page, regular, `• ${condition}`, 48, y, 510);
    }
  }

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawText('Documento DEV con datos ficticios · No es CFDI.', {
      x: 42,
      y: 35,
      size: 8,
      font: regular,
      color: rgb(0.35, 0.4, 0.5),
    });
    current.drawText(`Página ${index + 1} de ${pages.length}`, {
      x: 500,
      y: 35,
      size: 8,
      font: regular,
      color: rgb(0.35, 0.4, 0.5),
    });
  });
  return pdf.save();
}

export const createQuoteDraft = onCall(
  { region: 'us-central1', minInstances: 0, maxInstances: 6, timeoutSeconds: 30 },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const requestId = text(data.requestId, 'requestId', 128);
    const idempotencyKey = text(data.idempotencyKey, 'idempotencyKey', 128);
    const operationRef = db.collection('idempotencyKeys').doc(`quote-draft-${idempotencyKey}`);
    const quoteRef = db.collection('quotes').doc();
    return db.runTransaction(async (transaction) => {
      const prior = await transaction.get(operationRef);
      if (prior.exists) {
        const priorQuoteId: unknown = prior.get('resultQuoteId');
        if (typeof priorQuoteId !== 'string')
          throw new HttpsError('data-loss', 'Operación incompleta.');
        return { quoteId: priorQuoteId, replayed: true };
      }
      const requestSnapshot = await transaction.get(db.collection('requests').doc(requestId));
      if (!requestSnapshot.exists) throw new HttpsError('not-found', 'Solicitud no encontrada.');
      const serviceRequest = parseRequest(requestSnapshot.id, requestSnapshot.data());
      assertAuthorized(
        canAccessRequest(actor, serviceRequest),
        'No tienes acceso a la solicitud seleccionada.',
      );
      if (requestSnapshot.get('quoteRequirement') === 'no') {
        throw new HttpsError(
          'failed-precondition',
          'La solicitud indica que no requiere cotización.',
        );
      }
      const [clientSnapshot, settingsSnapshot] = await Promise.all([
        transaction.get(db.collection('clients').doc(serviceRequest.clientId)),
        transaction.get(db.collection('settings').doc('app')),
      ]);
      if (!clientSnapshot.exists)
        throw new HttpsError('failed-precondition', 'Cliente inexistente.');
      const settings = settingsSnapshot.data() ?? {};
      const quote = {
        id: quoteRef.id,
        folio: null,
        revisionNumber: 0,
        revision: 0,
        originalQuoteId: null,
        previousRevisionId: null,
        requestId,
        clientId: serviceRequest.clientId,
        siteId: serviceRequest.siteId,
        equipmentId: serviceRequest.equipmentId,
        supervisorId: serviceRequest.supervisorId,
        clientName:
          typeof clientSnapshot.get('name') === 'string'
            ? String(clientSnapshot.get('name'))
            : 'Cliente DEV',
        status: 'draft',
        locked: false,
        discountDisplayMode: 'detailed',
        validityDays: Number(settings.quoteValidityDays ?? 15),
        notes: '',
        conditions: Array.isArray(settings.commercialConditions)
          ? settings.commercialConditions.map(String)
          : [],
        totals: { gross: 0, discount: 0, subtotal: 0, tax: 0, total: 0 },
        documentStatus: 'not_generated',
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
        schemaVersion: 1,
        active: true,
      };
      transaction.create(quoteRef, quote);
      transaction.create(operationRef, {
        operation: 'quote.draft_created',
        actorId: actor.uid,
        resultQuoteId: quoteRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(
        db.collection('auditLogs').doc(),
        auditRecord(actor, 'quote.draft_created', 'quotes', quoteRef.id, null, quote),
      );
      return { quoteId: quoteRef.id, replayed: false };
    });
  },
);

async function loadAuthorizedQuote(
  transaction: FirebaseFirestore.Transaction,
  actor: Awaited<ReturnType<typeof requireActor>>,
  quoteId: string,
) {
  const quoteRef = db.collection('quotes').doc(quoteId);
  const quoteSnapshot = await transaction.get(quoteRef);
  if (!quoteSnapshot.exists) throw new HttpsError('not-found', 'Cotización no encontrada.');
  const quote = parseQuote(quoteSnapshot.id, quoteSnapshot.data());
  const requestRef = db.collection('requests').doc(quote.requestId);
  const [requestSnapshot, clientSnapshot, siteSnapshot, equipmentSnapshot] = await Promise.all([
    transaction.get(requestRef),
    transaction.get(db.collection('clients').doc(quote.clientId)),
    transaction.get(db.collection('sites').doc(quote.siteId)),
    quote.equipmentId
      ? transaction.get(db.collection('equipment').doc(quote.equipmentId))
      : Promise.resolve(null),
  ]);
  if (!requestSnapshot.exists || !clientSnapshot.exists || !siteSnapshot.exists) {
    throw new HttpsError('failed-precondition', 'La cotización tiene relaciones inexistentes.');
  }
  const serviceRequest = parseRequest(requestSnapshot.id, requestSnapshot.data());
  assertQuoteRelations(quote, serviceRequest);
  const siteClientId: unknown = siteSnapshot.get('clientId');
  if (typeof siteClientId !== 'string') throw new HttpsError('data-loss', 'Instalación inválida.');
  let equipmentRelation: { clientId: string; siteId: string } | null = null;
  if (quote.equipmentId) {
    if (!equipmentSnapshot?.exists)
      throw new HttpsError('failed-precondition', 'Equipo inexistente.');
    const clientId: unknown = equipmentSnapshot.get('clientId');
    const siteId: unknown = equipmentSnapshot.get('siteId');
    if (typeof clientId !== 'string' || typeof siteId !== 'string') {
      throw new HttpsError('data-loss', 'Equipo inválido.');
    }
    equipmentRelation = { clientId, siteId };
  }
  assertRequestRelations(serviceRequest, siteClientId, equipmentRelation);
  assertAuthorized(
    canManageQuote(actor, quote, serviceRequest),
    'No tienes autorización para operar esta cotización.',
  );
  return { quoteRef, quoteSnapshot, quote, serviceRequest, clientSnapshot };
}

export const issueQuote = onCall(
  {
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 4,
    timeoutSeconds: 90,
    memory: '512MiB',
  },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const quoteId = text(data.quoteId, 'quoteId', 128);
    const idempotencyKey = text(data.idempotencyKey, 'idempotencyKey', 128);
    const quoteRef = db.collection('quotes').doc(quoteId);

    const start = await db.runTransaction<StartResult>(async (transaction) => {
      const { quoteSnapshot, quote, clientSnapshot } = await loadAuthorizedQuote(
        transaction,
        actor,
        quoteId,
      );
      const rawQuote = quoteSnapshot.data();
      if (!rawQuote) throw new HttpsError('data-loss', 'Cotización sin datos.');
      let decision;
      try {
        decision = decideIssueStart(
          {
            status: quote.status,
            locked: quote.locked,
            folio: quote.folio,
            idempotencyKey: rawQuote.idempotencyKey,
            documentId: rawQuote.documentId,
          },
          idempotencyKey,
        );
      } catch (error) {
        if (error instanceof IssueDecisionError) {
          throw new HttpsError(
            error.kind === 'other_in_progress' ? 'aborted' : 'failed-precondition',
            error.message,
          );
        }
        throw error;
      }
      if (decision.outcome === 'ready') return decision;
      if (decision.outcome === 'generating') return decision;

      const [settingsSnapshot, itemSnapshots] = await Promise.all([
        transaction.get(db.collection('settings').doc('app')),
        transaction.get(quoteRef.collection('items')),
      ]);
      const settings = settingsSnapshot.data() ?? {};
      const maxDiscount = Number(settings.maxDiscountPercent ?? 20);
      const lines = itemSnapshots.docs.map((snapshot) => {
        const item = snapshot.data();
        const input: LineInput = {
          id: snapshot.id,
          description: text(item.description, 'description', 500),
          unit: text(item.unit, 'unit', 40),
          quantity: Number(item.quantity),
          originalUnitPrice: Number(item.originalUnitPrice),
          discountPercent: Number(item.discountPercent),
          taxRate: Number(item.taxRate),
        };
        return calculateLine(input);
      });
      if (lines.length === 0)
        throw new HttpsError('failed-precondition', 'Agrega al menos una partida.');
      if (lines.length > 400)
        throw new HttpsError('resource-exhausted', 'La cotización excede 400 partidas.');
      if (lines.some((line) => line.discountPercent > maxDiscount)) {
        throw new HttpsError('failed-precondition', 'Una partida excede la política de descuento.');
      }
      const summary = totals(lines);
      const year = new Date().getUTCFullYear();
      const counterRef = db.collection('counters').doc(`quotes-${year}`);
      const counterSnapshot = await transaction.get(counterRef);
      const existingFolio = decision.reuseFolio;
      let folio = existingFolio;
      if (!folio) {
        const next = Number(counterSnapshot.data()?.value ?? 0) + 1;
        const prefix =
          typeof settings.quoteFolioPrefix === 'string' ? settings.quoteFolioPrefix : 'COT-DEV';
        folio = `${prefix}-${year}-${String(next).padStart(5, '0')}`;
        transaction.set(counterRef, { value: next, updatedAt: FieldValue.serverTimestamp() });
      }
      const token = randomUUID();
      const configurationSnapshot = {
        taxRate: Number(settings.taxRate ?? 0.16),
        maxDiscountPercent: maxDiscount,
        quoteValidityDays: Number(settings.quoteValidityDays ?? 15),
        commercialConditions: Array.isArray(settings.commercialConditions)
          ? settings.commercialConditions.map(String)
          : [],
        legalText: typeof settings.legalText === 'string' ? settings.legalText : '',
        policyStatus: settings.policyStatus === 'approved' ? 'approved' : 'dev_provisional',
      };
      transaction.update(quoteRef, {
        folio,
        status: 'issuing',
        locked: false,
        idempotencyKey,
        totals: summary,
        economicSnapshot: { lines, totals: summary },
        configurationSnapshot,
        documentStatus: 'generating',
        generationToken: token,
        generationAttempt: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      });
      return {
        outcome: 'generate',
        generation: {
          quoteId,
          folio,
          token,
          idempotencyKey,
          lines,
          summary,
          clientName:
            typeof clientSnapshot.get('name') === 'string'
              ? String(clientSnapshot.get('name'))
              : 'Cliente DEV',
          notes: typeof rawQuote.notes === 'string' ? rawQuote.notes : '',
          conditions: Array.isArray(rawQuote.conditions) ? rawQuote.conditions.map(String) : [],
          configurationSnapshot,
        },
      };
    });

    if (start.outcome === 'ready') return { ...start, status: 'ready' };
    if (start.outcome === 'generating') return { ...start, status: 'generating' };
    const generation = start.generation;
    const path = `quotes/${quoteId}/${generation.folio}.pdf`;
    let objectSaved = false;
    try {
      const bytes = await buildQuotePdf(generation);
      const buffer = Buffer.from(bytes);
      const hash = createHash('sha256').update(buffer).digest('hex');
      await bucket.file(path).save(buffer, {
        resumable: false,
        contentType: 'application/pdf',
        metadata: { metadata: { quoteId, folio: generation.folio, sha256: hash } },
      });
      objectSaved = true;
      const documentRef = db.collection('documents').doc(`quote-${quoteId}`);
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(quoteRef);
        const current = snapshot.data();
        if (
          !snapshot.exists ||
          current?.generationToken !== generation.token ||
          current.idempotencyKey !== generation.idempotencyKey ||
          current.status !== 'issuing'
        ) {
          throw new HttpsError('aborted', 'La generación fue reemplazada o cancelada.');
        }
        transaction.set(documentRef, {
          kind: 'quote_pdf',
          accessScope: 'quote_participants',
          resourceId: quoteId,
          storagePath: path,
          mimeType: 'application/pdf',
          size: buffer.byteLength,
          sha256: hash,
          status: 'ready',
          createdBy: actor.uid,
          createdAt: FieldValue.serverTimestamp(),
          schemaVersion: 1,
          active: true,
        });
        transaction.update(quoteRef, {
          status: 'issued',
          locked: true,
          documentId: documentRef.id,
          documentStatus: 'ready',
          generationToken: FieldValue.delete(),
          generationError: FieldValue.delete(),
          issuedAt: FieldValue.serverTimestamp(),
          issuedBy: actor.uid,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.uid,
        });
        transaction.create(
          db.collection('auditLogs').doc(),
          auditRecord(actor, 'quote.issued', 'quotes', quoteId, snapshot.data(), {
            folio: generation.folio,
            totals: generation.summary,
            documentId: documentRef.id,
          }),
        );
        if (typeof current.createdBy === 'string') {
          transaction.create(db.collection('notifications').doc(), {
            userId: current.createdBy,
            type: 'quote_issued',
            title: 'Cotización emitida',
            body: `La cotización ${generation.folio} fue emitida y su PDF está disponible.`,
            resourceType: 'quotes',
            resourceId: quoteId,
            readAt: null,
            createdAt: FieldValue.serverTimestamp(),
            schemaVersion: 1,
          });
        }
      });
      return { folio: generation.folio, documentId: documentRef.id, status: 'ready' };
    } catch (error) {
      if (objectSaved) {
        await bucket
          .file(path)
          .delete({ ignoreNotFound: true })
          .catch(() => undefined);
      }
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(quoteRef);
        const current = snapshot.data();
        if (current?.generationToken !== generation.token || current.status !== 'issuing') return;
        const failure = {
          status: 'draft',
          locked: false,
          documentStatus: 'failed',
          generationToken: FieldValue.delete(),
          generationError:
            error instanceof Error ? error.message.slice(0, 300) : 'Error desconocido',
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.uid,
        };
        transaction.update(quoteRef, failure);
        transaction.create(
          db.collection('auditLogs').doc(),
          auditRecord(actor, 'quote.issue_failed', 'quotes', quoteId, current, failure),
        );
      });
      throw error;
    }
  },
);

export const createQuoteRevision = onCall(
  { region: 'us-central1', minInstances: 0, maxInstances: 4, timeoutSeconds: 45 },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const quoteId = text(data.quoteId, 'quoteId', 128);
    const idempotencyKey = text(data.idempotencyKey, 'idempotencyKey', 128);
    const operationRef = db.collection('idempotencyKeys').doc(`quote-revision-${idempotencyKey}`);
    const revisionRef = db.collection('quotes').doc();

    const result = await db.runTransaction(async (transaction) => {
      const prior = await transaction.get(operationRef);
      if (prior.exists) {
        const priorQuoteId: unknown = prior.get('resultQuoteId');
        if (typeof priorQuoteId !== 'string')
          throw new HttpsError('data-loss', 'Operación incompleta.');
        return { quoteId: priorQuoteId, replayed: true };
      }
      const { quoteSnapshot: sourceSnapshot, quote: source } = await loadAuthorizedQuote(
        transaction,
        actor,
        quoteId,
      );
      if (source.status === 'draft' || source.status === 'issuing') {
        throw new HttpsError('failed-precondition', 'La cotización todavía no admite revisión.');
      }
      const [itemsSnapshot, settingsSnapshot] = await Promise.all([
        transaction.get(db.collection('quotes').doc(quoteId).collection('items')),
        transaction.get(db.collection('settings').doc('app')),
      ]);
      if (itemsSnapshot.size > 400) {
        throw new HttpsError('resource-exhausted', 'La cotización excede 400 partidas.');
      }
      const year = new Date().getUTCFullYear();
      const counterRef = db.collection('counters').doc(`quotes-${year}`);
      const counterSnapshot = await transaction.get(counterRef);
      const next = Number(counterSnapshot.data()?.value ?? 0) + 1;
      const settings = settingsSnapshot.data() ?? {};
      const prefix =
        typeof settings.quoteFolioPrefix === 'string' ? settings.quoteFolioPrefix : 'COT-DEV';
      const folio = `${prefix}-${year}-${String(next).padStart(5, '0')}`;
      const rawSource = sourceSnapshot.data();
      if (!rawSource) throw new HttpsError('data-loss', 'Cotización sin datos.');
      const revisionNumber = source.revisionNumber + 1;
      const cleanSource = { ...rawSource };
      for (const transientField of [
        'idempotencyKey',
        'generationToken',
        'generationError',
        'issuedAt',
        'issuedBy',
      ]) {
        Reflect.deleteProperty(cleanSource, transientField);
      }
      const revision = {
        ...cleanSource,
        id: revisionRef.id,
        folio,
        status: 'draft',
        locked: false,
        originalQuoteId: source.originalQuoteId ?? quoteId,
        previousRevisionId: quoteId,
        revisionNumber,
        revision: revisionNumber,
        documentId: null,
        documentStatus: 'not_generated',
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      };
      transaction.set(counterRef, { value: next, updatedAt: FieldValue.serverTimestamp() });
      transaction.create(revisionRef, revision);
      for (const item of itemsSnapshot.docs) {
        transaction.create(revisionRef.collection('items').doc(item.id), {
          ...item.data(),
          copiedFromQuoteId: quoteId,
          copiedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.create(operationRef, {
        operation: 'quote.revision_created',
        actorId: actor.uid,
        sourceQuoteId: quoteId,
        resultQuoteId: revisionRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(
        db.collection('auditLogs').doc(),
        auditRecord(actor, 'quote.revision_created', 'quotes', revisionRef.id, null, {
          originalQuoteId: quoteId,
          folio,
          revisionNumber,
          itemCount: itemsSnapshot.size,
        }),
      );
      return { quoteId: revisionRef.id, folio, replayed: false };
    });
    return result;
  },
);

const quoteTransitions: Record<string, readonly string[]> = {
  issued: ['sent', 'cancelled'],
  sent: ['accepted', 'rejected', 'expired', 'cancelled'],
  accepted: [],
  rejected: [],
  cancelled: [],
  expired: [],
};

export const updateQuoteStatus = onCall(
  { region: 'us-central1', minInstances: 0, maxInstances: 6, timeoutSeconds: 30 },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const quoteId = text(data.quoteId, 'quoteId', 128);
    const nextStatus = text(data.status, 'status', 30);
    const idempotencyKey = text(data.idempotencyKey, 'idempotencyKey', 128);
    const operationRef = db.collection('idempotencyKeys').doc(`quote-status-${idempotencyKey}`);
    const quoteRef = db.collection('quotes').doc(quoteId);
    const replayed = await db.runTransaction(async (transaction) => {
      const operation = await transaction.get(operationRef);
      if (operation.exists) return true;
      const { quoteSnapshot, quote } = await loadAuthorizedQuote(transaction, actor, quoteId);
      if (!quoteTransitions[quote.status]?.includes(nextStatus)) {
        throw new HttpsError('failed-precondition', 'Transición de cotización no permitida.');
      }
      const patch = {
        status: nextStatus,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      };
      transaction.update(quoteRef, patch);
      transaction.create(operationRef, {
        operation: 'quote.status_updated',
        actorId: actor.uid,
        quoteId,
        nextStatus,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(
        db.collection('auditLogs').doc(),
        auditRecord(actor, 'quote.status_updated', 'quotes', quoteId, quoteSnapshot.data(), patch),
      );
      if (nextStatus === 'rejected') {
        transaction.create(db.collection('notifications').doc(), {
          userId: quote.createdBy,
          type: 'quote_rejected',
          title: 'Cotización rechazada',
          body: `La cotización ${quote.folio ?? quoteId} fue rechazada.`,
          resourceType: 'quotes',
          resourceId: quoteId,
          readAt: null,
          createdAt: FieldValue.serverTimestamp(),
          schemaVersion: 1,
        });
      }
      return false;
    });
    return { ok: true, replayed };
  },
);
