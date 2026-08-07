import { FileCheck2, Plus, Trash2 } from 'lucide-react';
import { addDoc, collection, doc, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { CatalogItem, Quote, QuoteLine, QuoteLineInput } from '../../../domain/model';
import { calculateQuoteLine, calculateQuoteTotals } from '../../../domain/quotes';
import { useAuth, useOperationalProfile } from '../../auth/AuthProvider';
import { Card, Field, LoadingState, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { callBackend } from '../../../shared/services/callables';
import { getFirebaseServices } from '../../../shared/services/firebase';

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
  const operational = useOperationalProfile();
  const quoteScope = useMemo(
    () =>
      operational === 'primary_admin' || operational === 'promoted_admin'
        ? []
        : [where('createdBy', '==', profile?.uid ?? '')],
    [operational, profile?.uid],
  );
  const quotes = useCollectionData<Quote>('quotes', quoteScope);
  const catalog = useCollectionData<CatalogItem>('catalogItems');
  const items = useCollectionData<QuoteLineInput>(
    quoteId === 'nueva' ? 'quotes/__none__/items' : `quotes/${quoteId}/items`,
  );
  const [line, setLine] = useState(blankLine);
  const [feedback, setFeedback] = useState('');
  const [working, setWorking] = useState(false);
  const quote = quotes.data.find((item) => item.id === quoteId);
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

  async function createDraft() {
    if (!profile) return;
    setWorking(true);
    setFeedback('');
    try {
      const reference = doc(collection(getFirebaseServices().firestore, 'quotes'));
      await setDoc(reference, {
        id: reference.id,
        folio: null,
        revision: 0,
        originalQuoteId: null,
        requestId: params.get('requestId') ?? '',
        clientId: '',
        siteId: '',
        equipmentId: null,
        clientName: 'Cliente DEV por seleccionar',
        status: 'draft',
        locked: false,
        discountDisplayMode: 'detailed',
        validityDays: 15,
        notes: '',
        conditions: [],
        totals: { gross: 0, discount: 0, subtotal: 0, tax: 0, total: 0 },
        documentStatus: 'not_generated',
        createdAt: serverTimestamp(),
        createdBy: profile.uid,
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
        schemaVersion: 1,
        active: true,
      });
      await navigate(`/cotizaciones/${reference.id}`, { replace: true });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible crear.');
    } finally {
      setWorking(false);
    }
  }

  async function addLine(input: Omit<QuoteLineInput, 'id'>) {
    if (quote?.locked) return;
    setWorking(true);
    setFeedback('');
    try {
      await addDoc(collection(getFirebaseServices().firestore, 'quotes', quoteId, 'items'), input);
      setLine(blankLine);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible agregar.');
    } finally {
      setWorking(false);
    }
  }

  async function addCustom(event: FormEvent) {
    event.preventDefault();
    await addLine({
      catalogItemId: null,
      code: line.code || 'PERSONALIZADA',
      description: line.description,
      unit: line.unit,
      quantity: Number(line.quantity),
      originalUnitPrice: Number(line.originalUnitPrice),
      discountPercent: Number(line.discountPercent),
      taxRate: Number(line.taxRate),
    });
  }

  async function remove(item: QuoteLine) {
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
      >('issueQuote', { quoteId, idempotencyKey: crypto.randomUUID() });
      setFeedback(`Cotización ${response.folio} emitida y PDF generado.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible emitir.');
    } finally {
      setWorking(false);
    }
  }

  async function revise() {
    setWorking(true);
    try {
      const response = await callBackend<{ quoteId: string }, { quoteId: string }>(
        'createQuoteRevision',
        { quoteId },
      );
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
          {!quote.locked ? (
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
                          {!quote.locked ? (
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
          {!quote.locked ? (
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
            {quote.locked ? (
              <button
                className="button button-secondary button-full"
                disabled={working}
                onClick={() => void revise()}
              >
                Crear nueva revisión
              </button>
            ) : (
              <button
                className="button button-primary button-full"
                disabled={working || calculated.length === 0}
                onClick={() => void issue()}
              >
                Emitir y generar PDF
              </button>
            )}
            <p className="helper-text">Una vez emitida, la cotización es inmutable.</p>
          </Card>
        </aside>
      </section>
    </div>
  );
}
