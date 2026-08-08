import { Download, Eye, FileCheck2, Plus, Save, Trash2 } from 'lucide-react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { CatalogItem, QuoteLine, QuoteLineInput } from '../../../domain/model';
import { decodeCatalogItem, decodeQuoteLine } from '../../../domain/firestore-validation';
import { calculateQuoteLine, calculateQuoteTotals } from '../../../domain/quotes';
import { useAuth } from '../../auth/AuthContext';
import { Card, Field, LoadingState, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { useAuthorizedQuotes } from '../../../shared/hooks/useAuthorizedQuotes';
import { callBackend } from '../../../shared/services/callables';
import { getFirebaseServices } from '../../../shared/services/firebase';
import { openPrivateDocument } from '../../../shared/services/private-files';

const blankLine = {
  code: '',
  description: '',
  unit: 'servicio',
  quantity: '1',
  originalUnitPrice: '0',
  discountPercent: '0',
  taxRate: '0.16',
};

export function QuoteBuilderPage() {
  const { quoteId = 'nueva' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const quotes = useAuthorizedQuotes();
  const catalog = useCollectionData<CatalogItem>('catalogItems', decodeCatalogItem);
  const items = useCollectionData<QuoteLineInput>(
    quoteId === 'nueva' ? 'quotes/__none__/items' : `quotes/${quoteId}/items`,
    decodeQuoteLine,
  );
  const [line, setLine] = useState(blankLine);
  const [feedback, setFeedback] = useState('');
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState(false);
  const [details, setDetails] = useState({ notes: '', conditions: '', validityDays: 15 });
  const issueKey = useRef(crypto.randomUUID());
  const quote = quotes.data.find((item) => item.id === quoteId);
  const editable = quote?.status === 'draft' && !quote.locked;
  const calculated = useMemo(
    () =>
      items.data.flatMap((item) => {
        try {
          return [calculateQuoteLine(item)];
        } catch {
          return [];
        }
      }),
    [items.data],
  );
  const summary = calculateQuoteTotals(calculated);

  useEffect(() => {
    if (quote) {
      setDetails({
        notes: quote.notes,
        conditions: quote.conditions.join('\n'),
        validityDays: quote.validityDays,
      });
    }
  }, [quote]);

  async function createDraft() {
    if (!profile) return;
    const requestId = params.get('requestId');
    if (!requestId) {
      setFeedback('Selecciona una solicitud antes de crear la cotización.');
      return;
    }
    setWorking(true);
    setFeedback('');
    try {
      const response = await callBackend<
        { requestId: string; idempotencyKey: string },
        { quoteId: string }
      >('createQuoteDraft', { requestId, idempotencyKey: crypto.randomUUID() });
      await navigate(`/cotizaciones/${response.quoteId}`, { replace: true });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible crear.');
    } finally {
      setWorking(false);
    }
  }

  async function addLine(input: Omit<QuoteLineInput, 'id'>, resetCustomForm = false) {
    if (!editable || !profile) return;
    setWorking(true);
    setFeedback('');
    try {
      await addDoc(collection(getFirebaseServices().firestore, 'quotes', quoteId, 'items'), {
        ...input,
        discountDisplayMode: quote?.discountDisplayMode ?? 'detailed',
        createdAt: serverTimestamp(),
        createdBy: profile.uid,
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
      });
      if (resetCustomForm) setLine(blankLine);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible agregar.');
    } finally {
      setWorking(false);
    }
  }

  async function addCustom(event: FormEvent) {
    event.preventDefault();
    await addLine(
      {
        catalogItemId: null,
        code: line.code || 'PERSONALIZADA',
        description: line.description,
        unit: line.unit,
        quantity: Number(line.quantity),
        originalUnitPrice: Number(line.originalUnitPrice),
        discountPercent: Number(line.discountPercent),
        taxRate: Number(line.taxRate),
      },
      true,
    );
  }

  async function remove(item: QuoteLine) {
    if (!editable) return;
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(getFirebaseServices().firestore, 'quotes', quoteId, 'items', item.id));
  }

  async function issue() {
    setWorking(true);
    setFeedback('');
    try {
      const response = await callBackend<
        { quoteId: string; idempotencyKey: string },
        { folio: string; status: string }
      >('issueQuote', { quoteId, idempotencyKey: issueKey.current });
      setFeedback(
        response.status === 'generating'
          ? `La emisión ${response.folio} ya está en proceso.`
          : `Cotización ${response.folio} emitida y PDF generado.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible emitir.');
    } finally {
      setWorking(false);
    }
  }

  async function saveDetails() {
    if (!editable || !profile) return;
    setWorking(true);
    try {
      await updateDoc(doc(getFirebaseServices().firestore, 'quotes', quoteId), {
        notes: details.notes.trim(),
        conditions: details.conditions
          .split('\n')
          .map((value) => value.trim())
          .filter(Boolean),
        validityDays: details.validityDays,
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
      });
      setFeedback('Condiciones del borrador guardadas.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible guardar.');
    } finally {
      setWorking(false);
    }
  }

  async function changeStatus(status: string) {
    setWorking(true);
    try {
      await callBackend('updateQuoteStatus', {
        quoteId,
        status,
        idempotencyKey: crypto.randomUUID(),
      });
      setFeedback('Seguimiento de cotización actualizado.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible actualizar.');
    } finally {
      setWorking(false);
    }
  }

  async function revise() {
    setWorking(true);
    try {
      const response = await callBackend<
        { quoteId: string; idempotencyKey: string },
        { quoteId: string }
      >('createQuoteRevision', { quoteId, idempotencyKey: crypto.randomUUID() });
      await navigate(`/cotizaciones/${response.quoteId}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible crear revisión.');
    } finally {
      setWorking(false);
    }
  }

  if (quoteId === 'nueva')
    return (
      <div className="page-stack">
        <PageHeader
          title="Nueva cotización"
          description="Crea un borrador; el folio se asignará exclusivamente al emitir."
        />
        <Card>
          <div className="empty-state">
            <FileCheck2 />
            <h2>Borrador seguro</h2>
            <p>La cotización permanecerá editable hasta su emisión.</p>
            <button
              className="button button-primary"
              disabled={working}
              onClick={() => void createDraft()}
            >
              Crear borrador
            </button>
            {feedback ? <div className="notice notice-error">{feedback}</div> : null}
          </div>
        </Card>
      </div>
    );
  if (quotes.loading || items.loading) return <LoadingState />;
  if (!quote)
    return (
      <div className="state-card">
        <h2>Cotización no encontrada</h2>
      </div>
    );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={quote.folio ?? 'Sin folio hasta emitir'}
        title={quote.locked ? 'Cotización emitida' : 'Cotización en borrador'}
        description="Los cálculos se muestran aquí y se revalidan en backend al emitir."
        actions={
          <StatusBadge tone={quote.locked ? 'green' : 'neutral'}>{quote.status}</StatusBadge>
        }
      />
      <section className="quote-layout">
        <div className="page-stack">
          {editable ? (
            <Card title="Insertar del catálogo">
              <div className="catalog-strip">
                {catalog.data
                  .filter((item) => item.active)
                  .slice(0, 6)
                  .map((item) => (
                    <button
                      key={item.id}
                      onClick={() =>
                        void addLine({
                          catalogItemId: item.id,
                          code: item.code,
                          description: item.name,
                          unit: item.unit,
                          quantity: 1,
                          originalUnitPrice: item.basePrice,
                          discountPercent: 0,
                          taxRate: item.taxRate,
                        })
                      }
                    >
                      <Plus size={16} />
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.basePrice.toLocaleString('es-MX', {
                            style: 'currency',
                            currency: 'MXN',
                          })}
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
            </Card>
          ) : null}
          {editable ? (
            <Card title="Vigencia, notas y condiciones">
              <div className="form-grid">
                <Field label="Vigencia (días)">
                  <input
                    min="1"
                    max="365"
                    type="number"
                    value={details.validityDays}
                    onChange={(event) =>
                      setDetails({ ...details, validityDays: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Notas">
                  <textarea
                    rows={3}
                    value={details.notes}
                    onChange={(event) => setDetails({ ...details, notes: event.target.value })}
                  />
                </Field>
                <Field label="Condiciones" hint="Una condición por línea.">
                  <textarea
                    rows={5}
                    value={details.conditions}
                    onChange={(event) => setDetails({ ...details, conditions: event.target.value })}
                  />
                </Field>
                <button className="button button-secondary" onClick={() => void saveDetails()}>
                  <Save size={17} /> Guardar condiciones
                </button>
              </div>
            </Card>
          ) : null}
          {preview ? (
            <Card title="Vista previa económica">
              <p>
                <strong>{quote.clientId}</strong> · {quote.folio ?? 'Borrador sin folio'}
              </p>
              <p>
                {calculated.length} partidas · Total {summary.total.toFixed(2)} MXN
              </p>
              <p>{details.notes || 'Sin notas.'}</p>
            </Card>
          ) : null}
          <Card title="Partidas de la cotización">
            {calculated.length === 0 ? (
              <div className="empty-inline">
                <FileCheck2 />
                <span>Agrega partidas del catálogo o personalizadas.</span>
              </div>
            ) : (
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Cantidad</th>
                      <th>Precio original</th>
                      <th>Descuento</th>
                      <th>Importe</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {calculated.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.description}</strong>
                          <small>
                            {item.code} · {item.unit}
                          </small>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{item.originalUnitPrice.toFixed(2)}</td>
                        <td>{item.discountPercent}%</td>
                        <td>{item.totalAmount.toFixed(2)}</td>
                        <td>
                          {editable ? (
                            <button
                              className="icon-button danger"
                              aria-label="Eliminar partida"
                              onClick={() => void remove(item)}
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {editable ? (
            <Card title="Partida personalizada">
              <form className="form-grid" onSubmit={(event) => void addCustom(event)}>
                <Field label="Código">
                  <input
                    value={line.code}
                    onChange={(event) => setLine({ ...line, code: event.target.value })}
                  />
                </Field>
                <Field label="Concepto">
                  <input
                    required
                    value={line.description}
                    onChange={(event) => setLine({ ...line, description: event.target.value })}
                  />
                </Field>
                <Field label="Unidad">
                  <input
                    required
                    value={line.unit}
                    onChange={(event) => setLine({ ...line, unit: event.target.value })}
                  />
                </Field>
                <Field label="Cantidad">
                  <input
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={line.quantity}
                    onChange={(event) => setLine({ ...line, quantity: event.target.value })}
                  />
                </Field>
                <Field label="Precio unitario">
                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={line.originalUnitPrice}
                    onChange={(event) =>
                      setLine({ ...line, originalUnitPrice: event.target.value })
                    }
                  />
                </Field>
                <Field label="Descuento %">
                  <input
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    type="number"
                    value={line.discountPercent}
                    onChange={(event) => setLine({ ...line, discountPercent: event.target.value })}
                  />
                </Field>
                <button className="button button-secondary" disabled={working} type="submit">
                  Agregar partida
                </button>
              </form>
            </Card>
          ) : null}
        </div>
        <aside>
          <Card title="Resumen de totales">
            <dl className="totals">
              <div>
                <dt>Importe original</dt>
                <dd>{summary.gross.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Descuentos</dt>
                <dd>-{summary.discount.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Subtotal</dt>
                <dd>{summary.subtotal.toFixed(2)}</dd>
              </div>
              <div>
                <dt>IVA</dt>
                <dd>{summary.tax.toFixed(2)}</dd>
              </div>
              <div className="total">
                <dt>Total MXN</dt>
                <dd>{summary.total.toFixed(2)}</dd>
              </div>
            </dl>
            {feedback ? <div className="notice">{feedback}</div> : null}
            {editable ? (
              <>
                <button
                  className="button button-secondary button-full"
                  onClick={() => setPreview((value) => !value)}
                >
                  <Eye size={17} /> {preview ? 'Cerrar vista previa' : 'Vista previa'}
                </button>
                <button
                  className="button button-primary button-full"
                  disabled={working || calculated.length === 0}
                  onClick={() => void issue()}
                >
                  Emitir y generar PDF
                </button>
              </>
            ) : quote.locked ? (
              <>
                {quote.documentId ? (
                  <button
                    className="button button-primary button-full"
                    onClick={() => void openPrivateDocument(quote.documentId!)}
                  >
                    <Download size={17} /> Abrir PDF privado
                  </button>
                ) : null}
                {quote.status === 'issued' ? (
                  <button
                    className="button button-secondary button-full"
                    onClick={() => void changeStatus('sent')}
                  >
                    Marcar enviada
                  </button>
                ) : null}
                {quote.status === 'sent' ? (
                  <select
                    aria-label="Seguimiento de cotización"
                    defaultValue=""
                    onChange={(event) =>
                      event.target.value && void changeStatus(event.target.value)
                    }
                  >
                    <option value="">Actualizar seguimiento</option>
                    <option value="accepted">Aceptada</option>
                    <option value="rejected">Rechazada</option>
                    <option value="expired">Vencida</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                ) : null}
                <button
                  className="button button-secondary button-full"
                  disabled={working}
                  onClick={() => void revise()}
                >
                  Crear nueva revisión
                </button>
              </>
            ) : (
              <div className="notice">Emisión en proceso. Esta cotización no admite edición.</div>
            )}
            <p className="helper-text">Una vez emitida, la cotización es inmutable.</p>
          </Card>
        </aside>
      </section>
    </div>
  );
}
