import { useMemo } from 'react';
import { calculateInvoice, formatMinor, type InvoiceTotals } from '../math/calculations';
import { useInvoiceStore } from '../stores/useInvoiceStore';

export function useInvoiceCalculator(): InvoiceTotals & { fmt: (minor: number) => string } {
  const doc = useInvoiceStore((s) => s.doc);
  return useMemo(() => {
    const totals = calculateInvoice(doc);
    const locale = doc.language === 'ar' ? 'ar' : 'en';
    return { ...totals, fmt: (m: number) => formatMinor(m, doc.currency, locale, true) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    doc.currency, doc.items, doc.taxRate, doc.taxType, doc.globalDiscount,
    doc.shippingFee, doc.withholdingRate, doc.roundTotalToUnit, doc.language,
  ]);
}
