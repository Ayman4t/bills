# BillZero — Technical Specification (v2, revised)

Zero-login, 100% client-side invoice & quotation studio. No paywall, no watermark, no server-side storage.
Targets freelancers and small businesses (EN/AR, RTL-first). Output: A4 invoice or quote as PDF/print in under 60 seconds.

## 1. Stack
- Next.js 14+ App Router, `output: 'export'` (static hosting), TypeScript strict.
- Tailwind, Radix/shadcn primitives, lucide-react, framer-motion.
- State: `zustand` + `persist` for the **current draft only** (`skipHydration: true`, rehydrate in a client effect).
- Archive, client profiles, logo and signature **Blobs**: `dexie` (IndexedDB). Never store base64 images in localStorage (5 MB cap).
- Tests: `vitest`.
- QR: `qrcode.react`.
- Fonts: self-hosted Geist Sans/Mono (EN), Cairo/Tajawal (AR).

## 2. Money rules (implemented in `src/lib/math/calculations.ts`)
1. All arithmetic in **integer minor units**; digits come from `Intl` (USD 2, KWD 3, JPY 0). Inputs are major units.
2. Rounding: half away from zero; `toMinor` is decimal-safe (1.005 → 1.01).
3. Order: line gross → line discount → global discount (allocated to lines by largest remainder) → tax per line → shipping (untaxed) → withholding → optional round-to-unit.
4. Tax: `LineItem.taxRate` **overrides** `InvoiceDocument.taxRate` when defined (including 0). `inclusive` extracts tax from the entered price.
5. Withholding tax is a % of the **net (pre-VAT)** amount and is deducted from the payable total.
6. Every discount is `{ type: 'percentage' | 'fixed', value }`; discounts are clamped to the amount they apply to.
7. Disclaimer: the tool produces invoice/quote templates. It does not submit to ETA (Egypt) or ZATCA Phase 2. Do not label output "tax invoice" without a visible notice about local e-invoicing obligations.

## 3. Documents
- Toggle Invoice ↔ Quote. Quotes add `quoteValidUntil`, approval signature line, optional terms.
- Quote → Invoice: new id, `QT-` → `INV-`, `convertedFromId` keeps the link.
- Schema: `src/types/invoice.ts` (already written).

## 4. Payments & QR
- **KSA / ZATCA Phase 1**: TLV tags 1–5, Base64, **UTF-8 byte lengths**, 15-digit VAT number starting and ending with 3 (`zatcaEncoder.ts`).
- **PayPal**: `https://paypal.me/{handle}/{amount}`.
- **Bank**: IBAN + account name as text/QR.
- **InstaPay (Egypt)**: render the payment address (IPA) as text/QR. Do **not** assume a public deep-link scheme; verify against InstaPay before building one.
- Signature: canvas pad or PNG stamp upload, stored as a Dexie Blob.

## 5. Export & sharing
- **Primary**: `window.print()` with `@media print` (true vector, correct Arabic shaping). Disable zoom `transform` and hide chrome in print CSS.
- **Secondary**: "Download PDF". Test Arabic early. `html2pdf.js` rasterizes (not vector); `@react-pdf/renderer` needs an explicit RTL and Arabic-font check.
- **WhatsApp**: `https://wa.me/{digits}?text={encodeURIComponent(msg)}`. The number is international digits without `+`; the message follows `doc.language`.
- History drawer: last 50 docs in Dexie; search, duplicate, quote→invoice.

## 6. UI
- Left controls (themes, currency, tax, payment QR) + centered A4 sheet (`aspect-[1/1.4142]`, `shadow-2xl`, zoom).
- Inline editing directly on the paper.
- Themes: Minimal Swiss, Modern Slate, Executive Emerald, Warm Artisan.
- Switching to `ar` mirrors layout (`dir="rtl"`), and uses Latin digits (`-u-nu-latn`) by default with an option for Arabic-Indic.

## 7. SEO routes (static)
- EN: `/free-invoice-generator`, `/quote-generator-freelancers`, `/receipt-maker-no-sign-in`.
- AR: separate `app/ar/[slug]/page.tsx` with `generateStaticParams`, for `/ar/فاتورة-مبيعات-مجانية`, `/ar/صانع-عروض-الأسعار`, `/ar/فاتورة-ضريبية-الكترونية`.
- JSON-LD `SoftwareApplication` on each, plus `hreflang` between EN/AR.

## 8. Directory tree
```
public/fonts, public/manifest.json
src/app/{layout.tsx, page.tsx, history/page.tsx, [slug]/page.tsx, ar/[slug]/page.tsx}
src/components/canvas/{A4Sheet,LineItemRow,PaymentQRBlock,SignatureBox}.tsx
src/components/controls/{Toolbar,ThemePicker,TaxSettingsModal,CurrencySelector}.tsx
src/components/templates/{Minimal,Modern,Executive,Artisan}Template.tsx
src/lib/db/indexdb.ts
src/lib/math/calculations.ts            ✅ done + tested
src/lib/export/{pdfGenerator,zatcaEncoder}.ts   zatcaEncoder ✅
src/lib/stores/useInvoiceStore.ts       ✅
src/lib/hooks/useInvoiceCalculator.ts   ✅
src/types/invoice.ts                    ✅
```

## 9. Roadmap
- **Phase 1** Scaffold: see README steps.
- **Phase 2** Store + calculation engine + tests. ✅ delivered
- **Phase 3** `A4Sheet` with inline editing and live totals (use `useInvoiceCalculator`).
- **Phase 4** RTL/LTR engine, currency selector, payment QR block.
- **Phase 5** Print CSS, PDF download, Dexie history, logo/signature Blobs.
- **Phase 6** SEO pages.
