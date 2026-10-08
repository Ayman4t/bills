import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { InvoiceDocument, LineItem } from '../../types/invoice';

const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);

export const createEmptyItem = (): LineItem => ({
  id: uid(),
  description: '',
  quantity: 1,
  unitPrice: 0,
  discount: { type: 'percentage', value: 0 },
});

export function createEmptyInvoice(type: InvoiceDocument['type'] = 'invoice'): InvoiceDocument {
  const now = Date.now();
  return {
    id: uid(),
    type,
    number: type === 'invoice' ? 'INV-0001' : 'QT-0001',
    issueDate: today(),
    language: 'en',
    currency: 'USD',
    sender: { name: '', email: '', phone: '', address: '' },
    client: { name: '' },
    items: [createEmptyItem()],
    taxRate: 0,
    taxType: 'exclusive',
    globalDiscount: { type: 'fixed', value: 0 },
    shippingFee: 0,
    withholdingRate: 0,
    roundTotalToUnit: false,
    paymentDetails: { method: 'bank' },
    theme: 'modern',
    createdAt: now,
    updatedAt: now,
  };
}

interface InvoiceState {
  doc: InvoiceDocument;
  updateDoc: (patch: Partial<InvoiceDocument>) => void;
  updateSender: (patch: Partial<InvoiceDocument['sender']>) => void;
  updateClient: (patch: Partial<InvoiceDocument['client']>) => void;
  addItem: () => void;
  updateItem: (id: string, patch: Partial<LineItem>) => void;
  removeItem: (id: string) => void;
  setType: (type: InvoiceDocument['type']) => void;
  /** Quote -> new invoice (fresh id, INV- prefix, link back to the quote). */
  convertQuoteToInvoice: () => void;
  loadDocument: (doc: InvoiceDocument) => void;
  duplicate: () => void;
  reset: () => void;
}

const touch = (d: InvoiceDocument): InvoiceDocument => ({ ...d, updatedAt: Date.now() });

/**
 * Only the CURRENT DRAFT is persisted here. Logos/signatures live in Dexie as Blobs
 * and the archive of past invoices lives in Dexie too (Phase 5), so we never hit the
 * ~5 MB localStorage ceiling.
 *
 * `skipHydration` avoids SSR/static-export hydration mismatches: call
 * `useInvoiceStore.persist.rehydrate()` once in a client `useEffect` (e.g. in layout).
 */
export const useInvoiceStore = create<InvoiceState>()(
  persist(
    (set) => ({
      doc: createEmptyInvoice(),
      updateDoc: (patch) => set((s) => ({ doc: touch({ ...s.doc, ...patch }) })),
      updateSender: (patch) => set((s) => ({ doc: touch({ ...s.doc, sender: { ...s.doc.sender, ...patch } }) })),
      updateClient: (patch) => set((s) => ({ doc: touch({ ...s.doc, client: { ...s.doc.client, ...patch } }) })),
      addItem: () => set((s) => ({ doc: touch({ ...s.doc, items: [...s.doc.items, createEmptyItem()] }) })),
      updateItem: (id, patch) =>
        set((s) => ({
          doc: touch({ ...s.doc, items: s.doc.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }),
        })),
      removeItem: (id) =>
        set((s) => ({
          doc: touch({
            ...s.doc,
            items: s.doc.items.length > 1 ? s.doc.items.filter((i) => i.id !== id) : s.doc.items,
          }),
        })),
      setType: (type) =>
        set((s) => ({
          doc: touch({
            ...s.doc,
            type,
            number: s.doc.number.replace(/^(INV|QT)-/, type === 'invoice' ? 'INV-' : 'QT-'),
          }),
        })),
      convertQuoteToInvoice: () =>
        set((s) => {
          if (s.doc.type !== 'quote') return s;
          const { quoteValidUntil: _drop, ...rest } = s.doc;
          return {
            doc: {
              ...rest,
              id: uid(),
              type: 'invoice',
              number: s.doc.number.replace(/^QT-/, 'INV-'),
              convertedFromId: s.doc.id,
              issueDate: today(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          };
        }),
      loadDocument: (doc) => set({ doc }),
      duplicate: () =>
        set((s) => ({
          doc: { ...s.doc, id: uid(), issueDate: today(), createdAt: Date.now(), updatedAt: Date.now() },
        })),
      reset: () => set({ doc: createEmptyInvoice() }),
    }),
    {
      name: 'billzero-draft-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ doc: s.doc }),
    },
  ),
);
