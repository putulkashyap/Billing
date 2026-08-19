# PRD — TRAYAMBAK ENTERPRISE · GST Billing & Account Reconciliation

## Original Problem Statement
Build a full-stack, production-ready GST Billing & Account Reconciliation web application for TRAYAMBAK ENTERPRISE (Proprietor: Ranjita Rai, GSTIN 24AMAPR1170Q1ZT, Vadodara, Gujarat). Stack: React + Tailwind + Lucide + Supabase/SQLite/mock. Modules: Auth (Admin/Staff), Order type toggle (GeM vs Regular B2B/B2C), GST calc engine (intra vs inter state, 0/5/12/18/28%), Account Reconciliation, PDF invoice generation with 3 selectable templates. No inventory. No delete/edit on finalized invoices. Bank: IDFC FIRST, A/C 69315494820, IFSC IDFB0042392.

## Architecture (implemented)
- **Backend**: FastAPI + MongoDB (chosen over Supabase since credentials not provided; user opted "best judgment"). Motor async driver, JWT auth via PyJWT + bcrypt. Admin seeded on startup with the specified credentials. Atomic MongoDB counter for `TE/{fiscal_year}/{NNNN}` invoice numbering.
- **Frontend**: React 19 + Tailwind + Shadcn UI, sonner toasts, lucide-react icons. Fonts: Outfit (headings) + IBM Plex Sans (body) + IBM Plex Mono (numbers).
- **PDF**: Client-side jsPDF + html2canvas, 3 selectable A4 templates.
- **Palette**: Deep Slate #0F172A, Azure Blue #2563EB, Sky #38BDF8.

## User Personas
- **Admin (Partner)** — Ranjita Rai — full control incl. staff, customers, invoices, reconciliation.
- **Staff** — restricted: create/view invoices only, no admin endpoints (403).

## Core Requirements (static)
- Company legal identity fields embedded (GSTIN, address, bank) in all invoice PDFs.
- Dynamic GST — Gujarat GSTIN (starts with `24`) → CGST+SGST split; else IGST. Tax brackets 0/5/12/18/28.
- Indian numbering format, 2 decimals, `en-IN` locale.
- Table alignment: text left, numbers right. No Due Date / Status inside printable PDF.
- Delete/Edit disabled on finalized invoices (list view has View-only action; payment status updates via Reconciliation).

## What's Been Implemented (2026-02-28)
- ✅ JWT auth with admin seed on startup (hi@trayambak.in / Ranjita@1985)
- ✅ Staff CRUD (admin-only)
- ✅ Customers CRUD (add/edit for all; delete admin-only)
- ✅ Invoice creation with GeM/Regular toggle & dynamic fields
- ✅ Line items (manual, on-the-fly) with HSN/qty/unit/rate/discount/tax bracket
- ✅ GST calc engine (server + live client preview)
- ✅ Invoice numbering `TE/YYYY-YY/NNNN` via atomic Mongo counter
- ✅ Reconciliation: log payment (amount, date, method, UTR/cheque ref), status transitions (pending → partially_paid → paid)
- ✅ Dashboard summary cards (Taxable Revenue, CGST/SGST/IGST, Paid, Outstanding)
- ✅ Invoice list with search + status filter
- ✅ Invoice preview modal with 3 templates (GeM / Modern Corporate / Compact Grid)
- ✅ Client-side PDF download via jsPDF + html2canvas
- ✅ Branded SVG logo embedded in app header and PDF letterheads
- ✅ RBAC (staff blocked from /api/users and customer delete — returns 403)

## 2026-02 · Data Maintenance
- ✅ DB cleanup verified: 1 invoice kept (`TE/2026-27/0001`, ₹44,200, IGST ₹6,742.37), 0 credit notes, counter `invoice_2026-27.seq=1` → next invoice `TE/2026-27/0002`. No code/UI/master data changes.

## 2026-02 · P2 — Customer/Vendor Fix + GST Foundation
- ✅ Extended `Customer` schema: trade_name, customer_type, PAN, gst_reg_type, state+state_code, billing/shipping, contact_person, mobile, payment_terms, active. Backward-compat aliases for `address`/`phone`.
- ✅ **New Vendor master** (`/api/vendors` + `/vendors` page) — CRUD + duplicate GSTIN protection.
- ✅ **HSN/SAC master** (`/api/hsn` + `/hsn` page) — code, description, gst/cgst/sgst/igst/cess rates, taxability, ITC, effective_from/to, active. Auto-splits half-rate for CGST/SGST.
- ✅ **Company Settings singleton** (`/api/company` + `/settings` page) — supplier legal identity, GSTIN, PoS origin state, bank details. Auto-seeded with TRAYAMBAK details.
- ✅ **GST engine refactor**: PoS-based determination via `resolve_intra_state(customer, place_of_supply_code, supplier_state_code)`. Legacy GSTIN-prefix rule kept only as fallback.
- ✅ **Place of Supply** on invoice (`place_of_supply_state`, `place_of_supply_code`), captured in UI with a state select. Existing invoice `TE/2026-27/0001` left untouched (PoS blank, still computes IGST correctly via GSTIN fallback).
- ✅ **GSTIN format validation** + normalization to uppercase.
- ✅ **Duplicate GSTIN protection** — 409 with a human-readable message for both customers and vendors.
- ✅ **HSN autofill in InvoiceForm**: typing an HSN pulls the configured rate; save is blocked if the line rate diverges from master.
- ✅ **GST Sales Register** (`/api/reports/gst-sales-register` + `/gst-register` page) — one row per line item, filters (FY, month, customer, state, GST rate, HSN), CSV export.
- ✅ **Expenses form**: added optional vendor picker that auto-fills name+GSTIN from Vendor master.
- ✅ Regression suite `/app/backend/tests/test_p2_masters_and_gst.py` (12 tests, all passing).

## 2026-02 · P3 — HSN effective dates, Purchase Register & ITC, GST Summary, GSTR-1 Working
- ✅ **HSN effective-date enforcement** in invoice create/update: rejects when invoice_date is outside HSN validity or when line rate mismatches configured master rate. HSN missing from master → user-driven rate allowed (backward compat for legacy invoices).
- ✅ **HSN CSV bulk import**: `POST /api/hsn/import/preview` (multipart) + `POST /api/hsn/import/commit` with `skip / update / version` strategies. UI: `HsnImportDialog.jsx` on `/hsn` page with template download.
- ✅ **Purchase Register expansion**: `Expense` + `ExpenseCreate` now carry `vendor_state`, `vendor_state_code`, `place_of_supply_state`, `place_of_supply_code`, `reverse_charge`, plus per-line `itc_eligibility` (eligible / ineligible / partial) with `itc_eligible_pct`. Purchase-side engine is `compute_expense_totals(vendor_gstin, items, pos_code, supplier_state_code, vendor_state_code)` — intra determined by *vendor_state* vs *pos* (not buyer state).
- ✅ **ITC classification** — every line records eligible / ineligible / partial; bill roll-up produces `itc_eligible_amount` and `itc_ineligible_amount`.
- ✅ **GST Purchase Register** page `/purchase-register` + `GET /api/reports/gst-purchase-register` (filters: FY, month, vendor, GSTIN, state, HSN, rate, ITC eligibility) + CSV export.
- ✅ **GST Summary** page `/gst-summary` + `GET /api/reports/gst-summary` — Output CGST/SGST/IGST/Cess, Input CGST/SGST/IGST/Cess, Eligible/Ineligible ITC, Indicative Net GST Position with disclaimer.
- ✅ **GSTR-1 Working Data Export** — `GET /api/reports/gstr1-working` (JSON + CSV) via `invoice_to_gstr1_row` mapping layer + `_gstr1_section` (B2B / B2CL / B2CS resolver). Response includes `missing_fields_for_portal_json` list clearly documenting what's still required before a portal-ready JSON can be emitted.
- ✅ Regression suite `/app/backend/tests/test_p3_hsn_purchase_itc.py` (10 tests) + P2 suite (12 tests) — 22/22 pass.

## 2026-02 · P4 — GSTR-1 Portal JSON generator
- ✅ **Schema researched (current 2025 offline utility)**: Table 12 rate-wise HSN with B2B/B2C tabs, Table 13 mandatory from May 2025 onwards, B2CS aggregated by (sply_ty, pos, rt), B2CL threshold ₹2.5L for inter-state unregistered, field names per gstr1_3b (`ctin`, `inum`, `idt`, `val`, `pos`, `rchrg`, `inv_typ`, `itms[]` with `itm_det{txval, rt, iamt, camt, samt, csamt}`, HSN `data[]` with `num/hsn_sc/uqc/qty/txval/iamt/camt/samt/csamt`).
- ✅ **Dedicated module** `/app/backend/gstr1.py` — isolated from invoice calc engine. `generate_gstr1_json()`, `validate_gstr1_data()`, section builders `_build_b2b/_b2cl/_b2cs/_exp/_hsn/_doc_issue`, `VALIDATIONS_IMPLEMENTED` (12) and `VALIDATIONS_NOT_IMPLEMENTED` (7) constants.
- ✅ **Invoice model P4 fields**: `rcm`, `export_type`, `shipping_bill_number/date`, `port_code`, `irn`, `irn_ack_no/date`, `eway_bill_number/date`, `cancelled`. UI: collapsible Compliance section in InvoiceForm.
- ✅ **Endpoint** `GET /api/reports/gstr1-portal-json?fp=MMYYYY&dryrun=true|false`. Dryrun returns PASS/BLOCKED + counts + validation lists. On failure returns 400 with an errors array pinpointing invoice + field + reason (e.g. *"B2B · TE/2026-27/0001 · [pos] Place of Supply missing."*).
- ✅ **UI page** `/gstr1-portal` (`Gstr1Portal.jsx`) — Validate button + Generate & Download. Displays both PASS/BLOCKED banner and both validations-we-run and validations-we-do-NOT-run lists side by side for full transparency.
- ✅ **Working Data Export kept intact** — CSV via `/reports/gstr1-working` and GST Summary page unchanged.
- ✅ Regression suite `/app/backend/tests/test_p4_gstr1_json.py` (17 tests) — total 39/39 pass across P2+P3+P4.

## Verified Tests
- Backend: 100% (9/9 pytest — auth, GJ CGST+SGST, MH IGST, partial/full payments, summary aggregates, staff create+login, RBAC 403)
- Frontend: 100% (login → dashboard → new invoice with live totals ₹11,800 → save → preview with 3 templates → reconciliation payment)

## Prioritized Backlog
- **P1**: Add DialogDescription / VisuallyHidden DialogTitle for a11y in preview & payment dialogs.
- **P1**: Multi-page PDF true pagination for long invoices (current impl slices via negative y-offset).
- **P2**: Charts/trends on Dashboard using recharts (monthly revenue, tax by state).
- **P2**: CSV/Excel export of invoices & GSTR-ready reports.
- **P2**: Bulk payment import.
- **P3**: Email invoice PDF to customer via Resend/SendGrid.
- **P3**: E-invoice/IRN integration for turnover > threshold.
- **P3**: Recurring invoices / subscription customers.
- **P3**: Dark mode toggle.
