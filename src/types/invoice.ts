export type DiscountType = 'percentage' | 'fixed';

/** `fixed` values are in MAJOR currency units (e.g. 10.5 EGP). */
export interface Discount {
  type: DiscountType;
  value: number;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  /** Major currency units. For taxType 'inclusive' this price already contains tax. */
  unitPrice: number;
  discount: Discount;
  /** Percent. If defined it OVERRIDES the document-level taxRate for this line. */
  taxRate?: number;
}

export type PaymentMethod = 'bank' | 'instapay' | 'paypal' | 'zatca' | 'custom';

export interface InvoiceDocument {
  id: string;
  type: 'invoice' | 'quote';
  number: string;
  issueDate: string; // YYYY-MM-DD
  dueDate?: string; // invoices
  quoteValidUntil?: string; // quotes
  language: 'en' | 'ar';
  currency: string; // ISO 4217
  convertedFromId?: string; // set when a quote is converted to an invoice

  sender: {
    name: string;
    email: string;
    phone: string;
    address: string;
    taxNumber?: string;
    /** Key of a Blob stored in Dexie (never base64 in localStorage). */
    logoId?: string;
  };

  client: {
    name: string;
    email?: string;
    /** Digits with country code, e.g. 201001234567 (used for wa.me). */
    phone?: string;
    address?: string;
    taxNumber?: string;
  };

  items: LineItem[];

  taxRate: number; // percent, default for lines without their own taxRate
  taxType: 'exclusive' | 'inclusive';
  globalDiscount: Discount; // applied after line discounts, before tax
  shippingFee: number; // major units, not taxed, added after tax
  withholdingRate: number; // percent of the net (pre-VAT) amount, deducted from total
  roundTotalToUnit: boolean; // round grand total to nearest whole currency unit

  paymentDetails: {
    method: PaymentMethod;
    accountName?: string;
    accountNumber?: string; // IBAN, InstaPay address (IPA) or PayPal handle
    routingCode?: string;
    qrPayload?: string;
  };

  notes?: string;
  terms?: string;
  signatureId?: string; // Dexie Blob key
  theme: 'minimal' | 'modern' | 'executive' | 'artisan';
  createdAt: number;
  updatedAt: number;
}
