#!/usr/bin/env bash
# LIVE production cleanup runner — Trayambak Enterprise, Aug 2026.
#
# Prereqs on Emergent Deployment:
#   1. Deploy the latest /app/backend/server.py (with the guarded endpoint).
#   2. Set env var:  PROD_CLEANUP_ENABLED=true   (boolean flag, NOT a secret)
#   3. Redeploy so the flag is picked up.
#
# Usage (from the pod OR the operator's machine):
#   export TE_LIVE_URL='https://trayambak.in'
#   export TE_ADMIN_EMAIL='hi@trayambak.in'
#   export TE_ADMIN_PASSWORD='********'
#   ./run_prod_cleanup.sh dry-run     # inspect BEFORE state, no mutation
#   ./run_prod_cleanup.sh apply       # actually apply the cleanup
#
# The endpoint auto-expires after 2026-08-31 (safety net).
# A BEFORE snapshot is written server-side into `prod_cleanup_backups`.

set -euo pipefail

MODE="${1:-dry-run}"
: "${TE_LIVE_URL:?TE_LIVE_URL is required}"
: "${TE_ADMIN_EMAIL:?TE_ADMIN_EMAIL is required}"
: "${TE_ADMIN_PASSWORD:?TE_ADMIN_PASSWORD is required}"

TOKEN=$(curl -s -X POST "$TE_LIVE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TE_ADMIN_EMAIL\",\"password\":\"$TE_ADMIN_PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: login failed."
  exit 1
fi

DRY_RUN="true"
[[ "$MODE" == "apply" ]] && DRY_RUN="false"

echo "=== Invoking cleanup (dry_run=$DRY_RUN) against $TE_LIVE_URL ==="
curl -s -X POST "$TE_LIVE_URL/api/admin/prod-cleanup-2026-08" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"dry_run\":$DRY_RUN}" \
  | python3 -m json.tool

echo
echo "=== Post-check: /api/invoices ==="
curl -s "$TE_LIVE_URL/api/invoices" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('count:', len(d))
for i in d:
    print(' ', i.get('invoice_number'),'|', i.get('grand_total'),'|', i.get('status'),
          '| PoS:', i.get('place_of_supply_code'),'| bal:', i.get('balance'))
"
echo "=== Post-check: /api/credit-notes ==="
curl -s "$TE_LIVE_URL/api/credit-notes" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; d = json.load(sys.stdin); print('count:', len(d) if isinstance(d, list) else d)"
