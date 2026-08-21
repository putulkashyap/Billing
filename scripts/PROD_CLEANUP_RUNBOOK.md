# LIVE Production Cleanup — Deployment Runbook (v2, boolean-flag gate)

**Incident:** LIVE `trayambak.in` DB out of sync — 3 wrong invoices + 1 wrong credit note + mismatched customer master + missing PoS on legacy records + GSTIN validator rejecting Tax Deductor GSTINs.

**Pod status:** Code fixes complete + dress-rehearsal on preview passed against a byte-for-byte LIVE mirror. No LIVE mutation yet.

---

## What ships in this deploy

1. **GSTIN validator** (backend + frontend) — pos-14 accepts `Z` / `D` (TDS) / `C` (TCS). `20AAAGC0935R1DS` validates. 14 regression tests pass.
2. **GST_REG_TYPES** — added Tax Deductor / Tax Collector / SEZ.
3. **One-time cleanup endpoint** `POST /api/admin/prod-cleanup-2026-08` — admin JWT + boolean env-var flag `PROD_CLEANUP_ENABLED=true` + hard date-expiry after 2026-08-31 + backup-first + idempotent + dry-run.
4. **Runner** `scripts/run_prod_cleanup.sh` (no secrets, admin creds only).

Endpoint returns **403** unless `PROD_CLEANUP_ENABLED=true` on the deployment.

---

## User steps (Emergent Deployment UI — cannot be done from pod)

### 1. Deploy Code
Push `/app/backend/server.py` + `/app/frontend/src/lib/india.js` → Emergent → Deploy.

### 2. Enable the flag
Deployment → Environment Variables → add:
```
PROD_CLEANUP_ENABLED=true
```
Redeploy.

### 3. Ping the pod
Reply in chat: **"deployed, flag enabled"**. The agent will do dry-run + show it before applying.

---

## After LIVE cleanup succeeds

### 9. Disable the endpoint
Deployment → Environment Variables → remove `PROD_CLEANUP_ENABLED` (or set to `false`).
Redeploy. Endpoint returns 403.

### 12. Strip endpoint code
Agent will delete the `/api/admin/prod-cleanup-2026-08` block from `server.py` in the follow-up commit; you deploy that final commit.

Safety net: the endpoint auto-expires after **2026-08-31** even if the flag is left on.

---

## Rollback
Every mutation writes a full BEFORE snapshot into the `prod_cleanup_backups` MongoDB collection. Look up the most recent doc; `before.invoices`, `before.credit_notes`, `before.customers`, `before.counters` contain the pre-mutation state.

---

## Dress-rehearsal proof (preview, LIVE-mirrored dataset)

- Dry-run → correct BEFORE list, no mutation.
- Apply → 1 canonical invoice, 0 CN, counters reset (`invoice_2026-27.seq=1`), customer master aligned to `20AAAGC0935R1DS` / `tax_deductor`.
- 2nd apply → `already_clean` (idempotent).
- No admin JWT → 401. Wrong role (n/a in this pod) or flag off → 403.
- Downstream reports verified via API:
  - `/api/reports/gst-sales-register` → 1 row, IGST ₹6,742.37, PoS 20.
  - `/api/reports/gst-summary` → output IGST ₹6,742.37.
  - `/api/reports/gstr1-portal-json?fp=072026&dryrun=true` → `status: PASS`.
  - Live JSON: correct B2B block with `ctin=20AAAGC0935R1DS`, `pos=20`, `iamt=6742.37`, `val=44200.0`.
