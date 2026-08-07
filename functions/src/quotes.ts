import { createHash, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { bucket, db } from './admin.js';
import { calculateLine, totals, type LineInput } from './quote-calculations.js';
import { auditRecord, objectData, requireActor, text } from './security.js';

interface QuoteGeneration {
  quoteId: string;
  folio: string;
  token: string;
  lines: ReturnType<typeof calculateLine>[];
  summary: ReturnType<typeof totals>;
  clientName: string;
  notes: string;
  conditions: string[];
}

async function buildPdf(generation: QuoteGeneration): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: 700, width: 612, height: 92, color: rgb(0.02, 0.13, 0.27) });
  page.drawText('ENFRIAMATIC', { x: 42, y: 748, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText('Gestión Operativa · Cotización', {
    x: 42,
    y: 724,
    size: 11,
    font: regular,
    color: rgb(0.4, 0.86, 1),
  });
  page.drawText(generation.folio, { x: 420, y: 744, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`Cliente: ${generation.clientName}`, { x: 42, y: 670, size: 12, font: bold });
  let y = 635;
  for (const line of generation.lines.slice(0, 14)) {
    page.drawText(line.description.slice(0, 52), { x: 42, y, size: 9, font: regular });
    page.drawText(`${line.quantity} ${line.unit}`, { x: 380, y, size: 9, font: regular });
    page.drawText(
      line.totalAmount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
      { x: 470, y, size: 9, font: regular },
    );
    y -= 25;
  }
  y -= 12;
  page.drawLine({ start: { x: 360, y }, end: { x: 570, y }, thickness: 1 });
  y -= 25;
  page.drawText('Subtotal', { x: 410, y, size: 10, font: regular });
  page.drawText(generation.summary.subtotal.toFixed(2), { x: 520, y, size: 10, font: regular });
  y -= 20;
  page.drawText('IVA', { x: 410, y, size: 10, font: regular });
  page.drawText(generation.summary.tax.toFixed(2), { x: 520, y, size: 10, font: regular });
  y -= 24;
  page.drawText('Total MXN', { x: 410, y, size: 12, font: bold });
  page.drawText(generation.summary.total.toFixed(2), { x: 515, y, size: 12, font: bold });
  page.drawText('Documento generado en entorno DEV con datos ficticios.', {
    x: 42,
    y: 45,
    size: 8,
    font: regular,
    color: rgb(0.35, 0.4, 0.5),
  });
  return pdf.save();
}

export const issueQuote = onCall(
  {
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 4,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const quoteId = text(data.quoteId, 'quoteId', 128);
    const idempotencyKey = text(data.idempotencyKey, 'idempotencyKey', 128);
    const quoteRef = db.collection('quotes').doc(quoteId);
    const generation = await db.runTransaction<QuoteGeneration>(async (transaction) => {
      const [quoteSnapshot, settingsSnapshot, itemSnapshots] = await Promise.all([
        transaction.get(quoteRef),
        transaction.get(db.collection('settings').doc('app')),
        transaction.get(quoteRef.collection('items')),
      ]);
      if (!quoteSnapshot.exists) throw new HttpsError('not-found', 'Cotización no encontrada.');
      const quote = quoteSnapshot.data() as Record<string, unknown>;
      if (quote.status === 'issued' && quote.idempotencyKey === idempotencyKey) {
        throw new HttpsError('already-exists', 'La cotización ya fue emitida.');
      }
      if (quote.status !== 'draft' || quote.locked === true) {
        throw new HttpsError('failed-precondition', 'La cotización no es editable.');
      }
      const settings = settingsSnapshot.data();
      const maxDiscount = Number(settings?.maxDiscountPercent ?? 20);
      const lineInputs = itemSnapshots.docs.map((snapshot) => {
        const item = snapshot.data() as LineInput;
        return calculateLine({ ...item, id: snapshot.id });
      });
      if (lineInputs.length === 0) {
        throw new HttpsError('failed-precondition', 'Agrega al menos una partida.');
      }
      if (lineInputs.some((line) => line.discountPercent > maxDiscount)) {
        throw new HttpsError('failed-precondition', 'Una partida excede la política de descuento.');
      }
      const summary = totals(lineInputs);
      const year = new Date().getUTCFullYear();
      const counterRef = db.collection('counters').doc(`quotes-${year}`);
      const counterSnapshot = await transaction.get(counterRef);
      const next = Number(counterSnapshot.data()?.value ?? 0) + 1;
      const prefix =
        typeof settings?.quoteFolioPrefix === 'string' ? settings.quoteFolioPrefix : 'COT-DEV';
      const folio = `${prefix}-${year}-${String(next).padStart(5, '0')}`;
      const token = randomUUID();
      transaction.set(counterRef, { value: next, updatedAt: FieldValue.serverTimestamp() });
      transaction.update(quoteRef, {
        folio,
        status: 'issued',
        locked: true,
        idempotencyKey,
        totals: summary,
        documentStatus: 'generating',
        generationToken: token,
        issuedAt: FieldValue.serverTimestamp(),
        issuedBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      });
      return {
        quoteId,
        folio,
        token,
        lines: lineInputs,
        summary,
        clientName: typeof quote.clientName === 'string' ? quote.clientName : 'Cliente DEV',
        notes: typeof quote.notes === 'string' ? quote.notes : '',
        conditions: Array.isArray(quote.conditions) ? quote.conditions.map(String) : [],
      };
    });

    try {
      const bytes = await buildPdf(generation);
      const buffer = Buffer.from(bytes);
      const hash = createHash('sha256').update(buffer).digest('hex');
      const path = `quotes/${quoteId}/${generation.folio}.pdf`;
      await bucket.file(path).save(buffer, {
        resumable: false,
        contentType: 'application/pdf',
        metadata: { metadata: { quoteId, folio: generation.folio, sha256: hash } },
      });
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(quoteRef);
        if (snapshot.data()?.generationToken !== generation.token) {
          throw new HttpsError('aborted', 'La generación fue reemplazada.');
        }
        const documentRef = db.collection('documents').doc();
        transaction.create(documentRef, {
          resourceType: 'quote',
          resourceId: quoteId,
          quoteId,
          folio: generation.folio,
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
          documentId: documentRef.id,
          documentStatus: 'ready',
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(
          db.collection('auditLogs').doc(),
          auditRecord(actor, 'quote.issued', 'quotes', quoteId, null, {
            folio: generation.folio,
            totals: generation.summary,
            documentId: documentRef.id,
          }),
        );
      });
      return { folio: generation.folio, status: 'ready' };
    } catch (error) {
      await quoteRef.update({
        documentStatus: 'failed',
        generationError: error instanceof Error ? error.message.slice(0, 300) : 'Error desconocido',
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw error;
    }
  },
);

export const createQuoteRevision = onCall(
  { region: 'us-central1', minInstances: 0, maxInstances: 4, timeoutSeconds: 30 },
  async (request) => {
    const actor = await requireActor(request);
    const data = objectData(request.data);
    const quoteId = text(data.quoteId, 'quoteId', 128);
    const sourceRef = db.collection('quotes').doc(quoteId);
    const revisionRef = db.collection('quotes').doc();
    await db.runTransaction(async (transaction) => {
      const sourceSnapshot = await transaction.get(sourceRef);
      if (!sourceSnapshot.exists) throw new HttpsError('not-found', 'Cotización no encontrada.');
      const source = sourceSnapshot.data() as Record<string, unknown>;
      if (source.status === 'draft') {
        throw new HttpsError('failed-precondition', 'El borrador todavía puede editarse.');
      }
      transaction.create(revisionRef, {
        ...source,
        id: revisionRef.id,
        folio: null,
        status: 'draft',
        locked: false,
        originalQuoteId: quoteId,
        revision: Number(source.revision ?? 0) + 1,
        documentId: null,
        documentStatus: 'not_generated',
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      });
      transaction.create(
        db.collection('auditLogs').doc(),
        auditRecord(actor, 'quote.revision_created', 'quotes', revisionRef.id, null, {
          originalQuoteId: quoteId,
        }),
      );
    });
    return { quoteId: revisionRef.id };
  },
);
