# Deferred — Code Quality Report (parked 2026-08-21)

**Status:** DEFERRED. Do not act on this without an explicit new instruction from the user.
Reason: user issued a FREEZE mandate on 2026-08-21 and requires that the LIVE production
incident cleanup complete before any refactor/enhancement work resumes.

---

## Critical (deferred)

### Missing hook dependencies (24 occurrences)
- `src/pages/InvoiceForm.jsx` lines 45, 51, 90, 98
- `src/pages/Expenses.jsx` line 46
- `src/pages/Dashboard.jsx` line 12
- Recommendation: add missing deps or wrap dep-functions in `useCallback`.

### Possibly undefined variables (6 occurrences, Python)
- Locations to be re-scanned by the CI tool at the time of pickup (line numbers may
  shift). Defensive checks or default values as appropriate.

---

## Important (deferred)

### localStorage for sensitive data (4 occurrences)
- `src/lib/api.js:9`, `src/context/AuthContext.jsx:13,23`, `src/components/HsnImportDialog.jsx:29`
- **⚠️ Not a like-for-like patch** — replacing localStorage with httpOnly cookies means
  changing the FastAPI auth to Set-Cookie + samesite + secure, updating every fetch
  call to `credentials:'include'`, and a full re-test of the auth flow. Requires the
  integration_playbook_expert_v2 auth playbook and full regression before merge.

### High-complexity Python functions
- `gstr1.py:324 validate_gstr1_data()` — complexity 25
- `server.py update_invoice()` — complexity 28, 52 lines
- `server.py _validate_hsn_effective()` — complexity 18
- Recommendation: extract helper functions.

### High-complexity / long React components
- `src/pages/InvoiceForm.jsx` — 507 lines
- `src/components/PartyForm.jsx` — complexity 29, 162 lines
- `src/components/HsnImportDialog.jsx` — complexity 25, 157 lines
- `src/pages/Expenses.jsx` — 377 lines

### Array index as React key (10 occurrences)
- `src/pages/InvoiceForm.jsx:371`, `src/pages/Expenses.jsx:316`,
  `src/pages/PurchaseRegister.jsx:187`, `src/pages/GstRegister.jsx:194`,
  `src/components/HsnImportDialog.jsx:117,134`

### Long Python functions
- `server.py compute_expense_totals()` — 54 lines, 16 locals
- `server.py update_invoice()` — 52 lines

### Expensive computations in JSX
- `src/pages/Reports.jsx:74`
- `src/pages/PurchaseRegister.jsx:139`
- `src/pages/GstRegister.jsx:154`

---

## Pickup rules (when the user lifts the freeze)

1. Do NOT batch all of the above into one commit. Split into two review-able tranches:
   - Tranche A (surgical bug-fixes): hook deps, undefined-var checks, array-index keys
     replaced with `item.id`/`uuid` on rows that already have a stable id.
   - Tranche B (structural refactors): component splits, complexity reductions, localStorage
     auth change. Each Tranche-B item requires its own re-test cycle.
2. localStorage → httpOnly cookies is NOT a code-quality patch; it is an auth-integration
   change and MUST go through `integration_playbook_expert_v2` first.
3. Do not co-mingle Code-Quality tranches with the parallel-track Mobile Responsive work
   (see `MOBILE_RESPONSIVE_PLAN.md` when that opens).
