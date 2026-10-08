import { describe, it, expect } from 'vitest';
import { encodeZatcaTlv, isValidKsaVatNumber, formatZatcaAmount } from './zatcaEncoder';

const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

describe('ZATCA TLV', () => {
  it('uses UTF-8 byte length for Arabic seller names', () => {
    const name = 'شركة النور'; // 10 chars, 19 bytes (9 letters x 2 + 1 space)
    const bytes = decode(
      encodeZatcaTlv({
        sellerName: name,
        vatNumber: '300000000000003',
        timestamp: new Date('2026-10-08T10:30:00.000Z'),
        totalWithVat: '115.00',
        vatTotal: '15.00',
      }),
    );
    expect(bytes[0]).toBe(1);
    expect(bytes[1]).toBe(new TextEncoder().encode(name).length);
    expect(bytes[1]).toBe(19);
  });
  it('encodes all five tags in order', () => {
    const bytes = decode(
      encodeZatcaTlv({ sellerName: 'A', vatNumber: '300000000000003', timestamp: '2026-10-08T10:30:00Z', totalWithVat: '1.00', vatTotal: '0.13' }),
    );
    const tags: number[] = [];
    for (let i = 0; i < bytes.length; i += 2 + bytes[i + 1]) tags.push(bytes[i]);
    expect(tags).toEqual([1, 2, 3, 4, 5]);
  });
  it('rejects fields over 255 bytes', () => {
    expect(() =>
      encodeZatcaTlv({ sellerName: 'ا'.repeat(200), vatNumber: '300000000000003', timestamp: '2026-10-08T10:30:00Z', totalWithVat: '1', vatTotal: '0' }),
    ).toThrow();
  });
  it('validates VAT numbers and formats amounts', () => {
    expect(isValidKsaVatNumber('300000000000003')).toBe(true);
    expect(isValidKsaVatNumber('123')).toBe(false);
    expect(formatZatcaAmount(11500, 2)).toBe('115.00');
  });
});
