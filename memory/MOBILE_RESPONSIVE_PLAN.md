# Mobile Responsive UI — Deferred Scope (parked 2026-08-21)

**Status:** DEFERRED. Requested by user on 2026-08-21 but blocked by the user's own
"no code changes before LIVE cleanup" rule. Pick up only AFTER the LIVE production
cleanup is verified and the temporary `/api/admin/prod-cleanup-2026-08` endpoint has
been stripped and re-deployed.

## Scope confirmed by user (frontend only, no backend/API/business-logic changes)

1. Responsive sidebar → hamburger drawer on mobile; slide in/out; auto-close after nav.
2. Mobile header with logo, page title, hamburger, user chip.
3. Dashboard cards: 1-col small, 2-col md, no overflow.
4. Invoices list: table → mobile card list with invoice # / customer / date / total /
   balance / status / actions accessible.
5. Credit notes list: same treatment.
6. Reconciliation: mobile cards, show total / paid / balance / status / "Log Payment".
7. GST Sales Register: cards with important-first fields + expandable "View Details"
   for the long GST tail. Keep CSV export.
8. GST Summary: cards stack cleanly on mobile.
9. GSTR-1 Portal: responsive filing-period selector + validation-error visibility.
10. Customer / Vendor forms: single-column mobile, two-column ≥ md, large touch targets,
    modal fits screen + internal scroll.
11. New Invoice Form: mobile-usable but no calc / GST logic change.
12. Invoice PDF preview: browser preview responsive; PDF layout unchanged.
13. Touch targets: min 44×44 tap area on interactive elements.
14. No horizontal page scroll except controlled table-scroll where unavoidable.
15. Breakpoints: 320 / 375 / 390 / 414 / 768 / 1366+.
16. Desktop regression: keep the current desktop UI visually + functionally intact.
17. Test on Chrome Android / iPhone / tablet / desktop across the 14 existing routes.

## Post-cleanup pickup rules

- Do not open this work until the LIVE cleanup + endpoint-strip commit has been
  deployed and verified.
- Prepare on preview only; **do not auto-deploy to LIVE.** Wait for user to review
  the preview URL and click Deploy.
- Zero backend / DB / API / auth / GST engine / invoice-numbering / PDF-content changes.
- Run existing regression tests (`backend/tests/`) after frontend work; report pass/fail.
- After responsive work is deployed and stable, provide a written assessment of
  PWA/Android/iOS packaging options (no build unless separately authorized).
