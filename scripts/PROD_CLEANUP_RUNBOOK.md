# LIVE Production Cleanup — Deployment Runbook

**Incident:** LIVE trayambak.in database contains 3 wrong invoices + 1 credit note; GSTIN validator was rejecting Tax Deductor GSTINs; Place-of-Supply not persisted on legacy invoices.

**Status of the code fix in this pod (preview):** ✅ Verified against a LIVE-mirrored dataset. Dry-run + Apply + Idempotency + Auth guards all pass.

---

## What ships in this deploy

1. **GSTIN validator (backend + frontend)** now accepts `Z` / `D` / `C` at position 14. Tax Deductor GSTINs like `20AAAGC0935R1DS` validate. `20AAPFC5310E2ZA` still valid too. Malformed GSTINs (e.g. `29ABCDE1234F1X5`) still rejected. Regression suite: `backend/tests/test_gstin_tds_tcs.py` (14 tests, all pass).
2. **GST registration types** now include `Tax Deductor (TDS)`, `Tax Collector (TCS)`, `SEZ`. Backend validation extended.
3. **One-time endpoint**: `POST /api/admin/prod-cleanup-2026-08` — admin-only, token-guarded, backup-first, idempotent, dry-run supported.
4. **Runner script**: `scripts/run_prod_cleanup.sh` for you to invoke against LIVE from your machine (never puts secrets in chat).

The endpoint is **DISABLED by default** (returns 403) unless `PROD_CLEANUP_TOKEN` env var is set on the deployment.

---

## Step-by-step

### 1. Deploy the code
Deploy the latest `/app/backend/server.py` + `/app/frontend/src/lib/india.js` to trayambak.in.

### 2. Enable the cleanup endpoint on LIVE (temporary)
On Emergent → Deployment → Environment Variables, add:
```
PROD_CLEANUP_TOKEN=<any-random-32-char-string-you-generate>
```
Redeploy so the env var is picked up.

### 3. Dry-run from your machine
```bash
export TE_LIVE_URL='https://trayambak.in'
export TE_ADMIN_EMAIL='hi@trayambak.in'
export TE_ADMIN_PASSWORD='<your admin password>'
export PROD_CLEANUP_TOKEN='<the same random string>'

/app/scripts/run_prod_cleanup.sh dry-run
```
Confirm the BEFORE report shows:
- 3 invoices (0001 wrong, 0002 correct-but-doomed, 0003 empty)
- 1 credit note
- counters `invoice_2026-27.seq >= 3`, `credit_note_2026-27.seq >= 1`

### 4. Apply
```bash
/app/scripts/run_prod_cleanup.sh apply
```
Expected AFTER report:
- `invoice_count: 1` — only `TE/2026-27/0001`
  - `taxable_amount: 37457.63`, `igst: 6742.37`, `grand_total: 44200.0`
  - `place_of_supply_code: "20"`, `place_of_supply_state: "Jharkhand"`
  - `status: pending`, `amount_paid: 0`, `credits_applied: 0`, `balance: 44200.0`
- `credit_note_count: 0`
- counter `invoice_2026-27.seq = 1` (next invoice will be `TE/2026-27/0002`)
- customer master GSTIN aligned to `20AAAGC0935R1DS`, `gst_reg_type=tax_deductor`
- backup written to `prod_cleanup_backups` collection (Mongo)

### 5. LIVE verification (via LIVE API only)
```bash
TOKEN=$(curl -s -X POST https://trayambak.in/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"'"$TE_ADMIN_EMAIL"'","password":"'"$TE_ADMIN_PASSWORD"'"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s "https://trayambak.in/api/invoices" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s "https://trayambak.in/api/credit-notes" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s "https://trayambak.in/api/reports/gst-sales-register?from=2026-07-01&to=2026-07-31" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s "https://trayambak.in/api/reports/gst-summary?from=2026-07-01&to=2026-07-31" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s "https://trayambak.in/api/reports/gstr1-portal-json?fp=072026&dryrun=true" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### 6. Disable + remove the endpoint
Once you (and I) confirm LIVE is clean:
1. **Remove** the `PROD_CLEANUP_TOKEN` env var from Emergent Deployment → Environment Variables.
2. Redeploy — this alone disables the endpoint (returns 403).
3. In the next code deploy, I'll strip the `/api/admin/prod-cleanup-2026-08` block out of `server.py` entirely.

### 7. Rollback (if anything goes wrong)
Every apply writes a full BEFORE snapshot into the `prod_cleanup_backups` MongoDB collection:
```javascript
// From a mongo shell attached to the LIVE database:
db.prod_cleanup_backups.find().sort({timestamp: -1}).limit(1)
```
The document contains `.before.invoices`, `.before.credit_notes`, `.before.customers`, `.before.counters` — enough to restore by hand or by a one-off restore script.

---

## Dress-rehearsal proof (against preview)

I mirrored the exact LIVE `/api/invoices` payload into preview, ran `dry-run` (returned "would-delete" list, no mutation), then `apply` (deleted 2 invoices + 1 CN, restored 0001 to canonical, aligned customer, reset counters), then invoked `apply` again which returned `already_clean` (idempotent). Bad-token/no-auth negative cases returned 403/401.

Full API-verified AFTER state on preview:
- `GET /api/invoices` → 1 record, correct values.
- `GET /api/credit-notes` → 0.
- `GET /api/reports/gst-sales-register` → 1 row, IGST ₹6,742.37, PoS 20/Jharkhand.
- `GET /api/reports/gst-summary` → output IGST ₹6,742.37, CGST 0, SGST 0.
- `GET /api/reports/gstr1-portal-json?fp=072026&dryrun=true` → `status: PASS`, no PoS-missing errors.
- `GET /api/reports/gstr1-portal-json?fp=072026` → correct B2B block with `ctin=20AAAGC0935R1DS`, `pos=20`, `iamt=6742.37`, `val=44200.0`.
