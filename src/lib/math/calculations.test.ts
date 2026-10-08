import { describe, it, expect } from 'vitest';
import { calculateInvoice, currencyDigits, toMinor, allocate, type CalcInput } from './calculations';

const item = (unitPrice: number, quantity = 1, extra: Partial<CalcInput['items'][number]> = {}) => ({
  id: crypto.randomUUID(),
  description: 'x',
  quantity,
  unitPrice,
  discount: { type: 'percentage' as const, value: 0 },
  ...extra,
});

const base = (over: Partial<CalcInput> = {}): CalcInput => ({
  currency: 'USD',
  items: [],
  taxRate: 0,
  taxType: 'exclusive',
  globalDiscount: { type: 'fixed', value: 0 },
  shippingFee: 0,
  withholdingRate: 0,
  roundTotalToUnit: false,
  ...over,
});

describe('currency handling', () => {
  it('knows minor-unit digits', () => {
    expect(currencyDigits('USD')).toBe(2);
    expect(currencyDigits('KWD')).toBe(3);
    expect(currencyDigits('JPY')).toBe(0);
  });
  it('rounds decimals without float drift', () => {
    expect(toMinor(1.005, 2)).toBe(101);
    expect(toMinor(0.1 + 0.2, 2)).toBe(30);
    expect(toMinor(1.005, 3)).toBe(1005);
  });
});

describe('tax', () => {
  it('exclusive 14% (Egypt VAT)', () => {
    const t = calculateInvoice(base({ currency: 'EGP', taxRate: 14, items: [item(100, 2)] }));
    expect([t.netMinor, t.taxMinor, t.totalMinor]).toEqual([20000, 2800, 22800]);
  });
  it('inclusive 15% (KSA VAT) extracts tax from the price', () => {
    const t = calculateInvoice(base({ currency: 'SAR', taxRate: 15, taxType: 'inclusive', items: [item(115)] }));
    expect([t.netMinor, t.taxMinor, t.totalMinor]).toEqual([10000, 1500, 11500]);
  });
  it('line taxRate overrides the global rate (including 0%)', () => {
    const t = calculateInvoice(base({ taxRate: 14, items: [item(100), item(100, 1, { taxRate: 0 })] }));
    expect(t.taxMinor).toBe(1400);
  });
});

describe('discounts', () => {
  it('line percentage discount', () => {
    const t = calculateInvoice(base({ items: [item(200, 1, { discount: { type: 'percentage', value: 10 } })] }));
    expect(t.totalMinor).toBe(18000);
  });
  it('global fixed discount is allocated exactly across lines', () => {
    const t = calculateInvoice(
      base({ taxRate: 14, globalDiscount: { type: 'fixed', value: 1 }, items: [item(10), item(10), item(10)] }),
    );
    const shares = t.lines.map((l) => l.globalDiscountShareMinor);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(t.netMinor).toBe(2900);
    expect(t.lines.reduce((s, l) => s + l.taxMinor, 0)).toBe(t.taxMinor);
  });
  it('discount larger than the subtotal clamps to zero total', () => {
    const t = calculateInvoice(base({ globalDiscount: { type: 'fixed', value: 999 }, items: [item(50)] }));
    expect(t.totalMinor).toBe(0);
  });
  it('allocate always sums to the total', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(5, [0, 0])).toEqual([0, 0]);
  });
});

describe('extras', () => {
  it('withholding tax is taken on the net, before VAT', () => {
    const t = calculateInvoice(base({ currency: 'EGP', taxRate: 14, withholdingRate: 5, items: [item(1000)] }));
    expect([t.taxMinor, t.withholdingMinor, t.totalMinor]).toEqual([14000, 5000, 109000]);
  });
  it('shipping is untaxed and added after tax', () => {
    const t = calculateInvoice(base({ taxRate: 10, shippingFee: 5, items: [item(100)] }));
    expect(t.totalMinor).toBe(11500);
  });
  it('rounds the grand total to a whole unit and reports the adjustment', () => {
    const t = calculateInvoice(base({ roundTotalToUnit: true, items: [item(10.4)] }));
    expect([t.totalMinor, t.roundingMinor]).toEqual([1000, -40]);
  });
  it('KWD uses 3 decimals', () => {
    const t = calculateInvoice(base({ currency: 'KWD', items: [item(1.5, 3)] }));
    expect(t.totalMinor).toBe(4500);
  });
  it('ignores NaN / empty input safely', () => {
    const t = calculateInvoice(base({ items: [item(NaN, 2)] }));
    expect(t.totalMinor).toBe(0);
  });
});
