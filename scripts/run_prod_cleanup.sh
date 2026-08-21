#!/usr/bin/env bash
# One-time LIVE production cleanup runner — Trayambak Enterprise, Aug 2026.
#
# Prereqs (do these on the Emergent deployment console FIRST):
#   1. Deploy the current /app/backend/server.py (contains the guarded
#      /api/admin/prod-cleanup-2026-08 endpoint).
#   2. Set env var on the Deployment:  PROD_CLEANUP_TOKEN=<any-random-string>
#      (this is the confirmation token; unset it after cleanup).
#   3. Redeploy so the env var is picked up.
#
# Usage:
#   export TE_ADMIN_EMAIL='hi@trayambak.in'
#   export TE_ADMIN_PASSWORD='********'
#   export PROD_CLEANUP_TOKEN='<same-string-you-set-on-deployment>'
#   export TE_LIVE_URL='https://trayambak.in'   # or the emergent deploy URL
#   ./run_prod_cleanup.sh dry-run                # inspect BEFORE state
#   ./run_prod_cleanup.sh apply                  # actually apply cleanup
#
# The script never prints the token or password. Backup snapshots are
# written server-side into the `prod_cleanup_backups` collection.

set -euo pipefail

MODE="${1:-dry-run}"
: "${TE_LIVE_URL:?TE_LIVE_URL is required}"
: "${TE_ADMIN_EMAIL:?TE_ADMIN_EMAIL is required}"
: "${TE_ADMIN_PASSWORD:?TE_ADMIN_PASSWORD is required}"
: "${PROD_CLEANUP_TOKEN:?PROD_CLEANUP_TOKEN is required}"

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
  -d "{\"confirmation_token\":\"$PROD_CLEANUP_TOKEN\",\"dry_run\":$DRY_RUN}" \
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
