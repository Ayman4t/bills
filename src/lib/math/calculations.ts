import type { Discount, InvoiceDocument } from '../../types/invoice';

export type CalcInput = Pick<
  InvoiceDocument,
  | 'currency'
  | 'items'
  | 'taxRate'
  | 'taxType'
  | 'globalDiscount'
  | 'shippingFee'
  | 'withholdingRate'
  | 'roundTotalToUnit'
>;

/** All *Minor fields are integers in the currency's smallest unit (cents, fils...). */
export interface LineTotals {
  grossMinor: number; // qty * unit price
  discountMinor: number; // line discount
  globalDiscountShareMinor: number; // this line's share of the global discount
  netMinor: number; // tax-exclusive amount after all discounts
  taxMinor: number;
  totalMinor: number; // net + tax
}

export interface InvoiceTotals {
  digits: number;
  lines: LineTotals[];
  /** Sum of lines after line discounts, before global discount (tax-inclusive if taxType is inclusive). */
  subtotalMinor: number;
  discountMinor: number; // global discount
  netMinor: number; // taxable base (tax-exclusive)
  taxMinor: number;
  shippingMinor: number;
  withholdingMinor: number;
  roundingMinor: number;
  totalMinor: number; // grand total payable
}

const finite = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/** Round half away from zero (accounting convention). */
export function roundHalfUp(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

export function currencyDigits(currency: string): number {
  try {
    const d = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits;
    return d ?? 2;
  } catch {
    return 2;
  }
}

/** Decimal-safe: 1.005 -> 101 (not 100) for 2 digits. */
export function toMinor(major: number, digits: number): number {
  const n = finite(major);
  const s = String(n);
  if (s.includes('e')) return roundHalfUp(n * 10 ** digits);
  return roundHalfUp(Number(`${s}e${digits}`));
}

export function fromMinor(minor: number, digits: number): number {
  return minor / 10 ** digits;
}

const mulRate = (amountMinor: number, ratePercent: number) =>
  roundHalfUp((amountMinor * finite(ratePercent)) / 100);

function discountToMinor(d: Discount | undefined, base: number, digits: number): number {
  if (!d) return 0;
  const raw =
    d.type === 'percentage'
      ? mulRate(base, Math.min(Math.max(finite(d.value), 0), 100))
      : toMinor(Math.max(finite(d.value), 0), digits);
  return Math.min(Math.max(raw, 0), Math.max(base, 0));
}

/** Largest-remainder split so the parts always sum exactly to `total`. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map(Math.floor);
  let remainder = total - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) parts[order[k].i]++;
  return parts;
}

export function calculateInvoice(input: CalcInput): InvoiceTotals {
  const digits = currencyDigits(input.currency);

  // 1. Per-line gross and line discount
  const base = input.items.map((item) => {
    const gross = roundHalfUp(finite(item.quantity) * toMinor(item.unitPrice, digits));
    const discount = gross > 0 ? discountToMinor(item.discount, gross, digits) : 0;
    return { item, gross, discount, afterDiscount: gross - discount };
  });

  const subtotalMinor = base.reduce((s, l) => s + l.afterDiscount, 0);

  // 2. Global discount, split across lines proportionally (keeps per-line tax exact)
  const discountMinor = subtotalMinor > 0 ? discountToMinor(input.globalDiscount, subtotalMinor, digits) : 0;
  const shares = allocate(discountMinor, base.map((l) => Math.max(l.afterDiscount, 0)));

  // 3. Tax per line (line rate overrides global rate)
  const lines: LineTotals[] = base.map((l, i) => {
    const amount = l.afterDiscount - shares[i];
    const rate = finite(l.item.taxRate ?? input.taxRate);
    let net: number;
    let tax: number;
    if (input.taxType === 'inclusive') {
      net = roundHalfUp((amount * 100) / (100 + rate));
      tax = amount - net;
    } else {
      net = amount;
      tax = mulRate(amount, rate);
    }
    return {
      grossMinor: l.gross,
      discountMinor: l.discount,
      globalDiscountShareMinor: shares[i],
      netMinor: net,
      taxMinor: tax,
      totalMinor: net + tax,
    };
  });

  const netMinor = lines.reduce((s, l) => s + l.netMinor, 0);
  const taxMinor = lines.reduce((s, l) => s + l.taxMinor, 0);
  const shippingMinor = toMinor(Math.max(finite(input.shippingFee), 0), digits);
  const withholdingMinor = mulRate(netMinor, input.withholdingRate);

  const preRound = netMinor + taxMinor + shippingMinor - withholdingMinor;
  let roundingMinor = 0;
  if (input.roundTotalToUnit) {
    const unit = 10 ** digits;
    roundingMinor = roundHalfUp(preRound / unit) * unit - preRound;
  }

  return {
    digits,
    lines,
    subtotalMinor,
    discountMinor,
    netMinor,
    taxMinor,
    shippingMinor,
    withholdingMinor,
    roundingMinor,
    totalMinor: preRound + roundingMinor,
  };
}

/** Display helper. Pass `latnDigits` to keep 0-9 digits inside Arabic documents. */
export function formatMinor(
  minor: number,
  currency: string,
  locale = 'en',
  latnDigits = false,
): string {
  const digits = currencyDigits(currency);
  const loc = latnDigits && !locale.includes('-u-') ? `${locale}-u-nu-latn` : locale;
  return new Intl.NumberFormat(loc, { style: 'currency', currency }).format(fromMinor(minor, digits));
}
