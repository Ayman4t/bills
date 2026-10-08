/**
 * ZATCA Phase 1 simplified-invoice QR: TLV records, Base64 encoded.
 * Tags: 1 seller name, 2 VAT number, 3 ISO-8601 timestamp, 4 total incl. VAT, 5 VAT amount.
 * IMPORTANT: the length byte is the UTF-8 BYTE length (Arabic chars take 2 bytes), not the char count.
 */
export interface ZatcaQrInput {
  sellerName: string;
  vatNumber: string;
  timestamp: Date | string;
  totalWithVat: string; // e.g. "115.00"
  vatTotal: string; // e.g. "15.00"
}

const encoder = new TextEncoder();

export function isValidKsaVatNumber(v: string): boolean {
  return /^3\d{13}3$/.test(v);
}

export function formatZatcaAmount(minor: number, digits: number): string {
  return (minor / 10 ** digits).toFixed(digits);
}

function tlv(tag: number, value: string): Uint8Array {
  const bytes = encoder.encode(value);
  if (bytes.length > 255) throw new RangeError(`ZATCA tag ${tag} exceeds 255 bytes`);
  const out = new Uint8Array(bytes.length + 2);
  out[0] = tag;
  out[1] = bytes.length;
  out.set(bytes, 2);
  return out;
}

export function encodeZatcaTlv(input: ZatcaQrInput): string {
  const ts =
    typeof input.timestamp === 'string'
      ? input.timestamp
      : input.timestamp.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const parts = [
    tlv(1, input.sellerName),
    tlv(2, input.vatNumber),
    tlv(3, ts),
    tlv(4, input.totalWithVat),
    tlv(5, input.vatTotal),
  ];
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    all.set(p, offset);
    offset += p.length;
  }
  let bin = '';
  for (const b of all) bin += String.fromCharCode(b);
  return btoa(bin);
}
