"""PRODUCTION DATABASE CLEANUP SCRIPT — TRAYAMBAK ENTERPRISE

⚠️  READ-ONLY UNTIL YOU FLIP `DRY_RUN = False` AT THE BOTTOM. ⚠️

Purpose:
  - Restore invoice TE/2026-27/0001 to its correct payload
  - Delete TE/2026-27/0002 and TE/2026-27/0003
  - Delete credit note TE/CN/2026-27/0001
  - Reset invoice counter for 2026-27 so next invoice becomes TE/2026-27/0002
  - Reset credit-note counter for 2026-27
  - Verify final state

Usage on the PRODUCTION host (Emergent Support / user with prod MongoDB access):
  1. Set env vars:
       export MONGO_URL="<production mongo connection string>"
       export DB_NAME="<production db name>"
  2. Take a backup FIRST — a mongodump against the same MONGO_URL:
       mongodump --uri "$MONGO_URL" --db "$DB_NAME" --out ./backup_$(date +%F)
  3. Dry run (default) to see what would change:
       python3 production_cleanup.py
  4. If the dry-run report looks right, set DRY_RUN=False and rerun:
       python3 production_cleanup.py

The script:
  - Prints BEFORE state
  - Backs up the three doomed records to /tmp/te_prod_backup_<timestamp>.json
  - Applies the changes only if DRY_RUN is False
  - Prints AFTER state
  - Never touches MX/SPF/DKIM/DMARC or any master data (customers, vendors, hsn_master,
    company_settings, users)
"""
import os
import json
import time
from pymongo import MongoClient

TARGET = "TE/2026-27/0001"
TO_DELETE_INVOICES = ["TE/2026-27/0002", "TE/2026-27/0003"]
TO_DELETE_CREDIT_NOTES = ["TE/CN/2026-27/0001"]

CORRECT_PAYLOAD = {
    "invoice_date": "2026-07-22",
    "taxable_amount": 37457.63,
    "cgst": 0.0,
    "sgst": 0.0,
    "igst": 6742.37,
    "total_tax": 6742.37,
    "grand_total": 44200.0,
    "subtotal": 44200.0,
    "total_discount": 0.0,
    "is_intra_state": False,
    "status": "pending",
    "amount_paid": 0.0,
    "balance": 44200.0,
    "credits_applied": 0.0,
    "payments": [],
    "place_of_supply_state": "Jharkhand",
    "place_of_supply_code": "20",
    "line_items": [
        {
            "description": "Waste Container (Dustbin) with a lid — GeM contract supply",
            "hsn": "3924",
            "quantity": 100,
            "unit": "Nos",
            "rate": 442.0,
            "discount": 0.0,
            "tax_rate": 18.0,
            "price_type": "exclusive",
        }
    ],
    "gem_contract_no": "GEMC-51168770315588",
    "cancelled": False,
}


def dump(db, tag):
    print(f"\n===== {tag} =====")
    print(f"Invoices     : {db.invoices.count_documents({})}")
    print(f"Credit notes : {db.credit_notes.count_documents({})}")
    for inv in db.invoices.find({}, {"_id": 0, "invoice_number": 1, "invoice_date": 1,
                                     "grand_total": 1, "taxable_amount": 1,
                                     "cgst": 1, "sgst": 1, "igst": 1,
                                     "amount_paid": 1, "balance": 1, "status": 1}):
        print(f"  {inv.get('invoice_number')} | date={inv.get('invoice_date')} | "
              f"total={inv.get('grand_total')} | taxable={inv.get('taxable_amount')} | "
              f"cgst={inv.get('cgst')} sgst={inv.get('sgst')} igst={inv.get('igst')} | "
              f"paid={inv.get('amount_paid')} bal={inv.get('balance')} status={inv.get('status')}")
    for cn in db.credit_notes.find({}, {"_id": 0, "credit_note_number": 1,
                                        "invoice_number": 1, "grand_total": 1}):
        print(f"  CN {cn.get('credit_note_number')} against {cn.get('invoice_number')} "
              f"total={cn.get('grand_total')}")
    for c in db.counters.find({}):
        print(f"  counter {c}")


def main(dry_run: bool):
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = MongoClient(mongo_url)
    db = client[db_name]

    dump(db, "BEFORE")

    # 1. Backup the doomed records
    backup = {
        "invoices_to_delete": list(db.invoices.find({"invoice_number": {"$in": TO_DELETE_INVOICES}})),
        "target_invoice_before": db.invoices.find_one({"invoice_number": TARGET}),
        "credit_notes_to_delete": list(db.credit_notes.find({"credit_note_number": {"$in": TO_DELETE_CREDIT_NOTES}})),
        "counters_before": list(db.counters.find({})),
        "captured_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    for k in ("invoices_to_delete", "credit_notes_to_delete"):
        for d in backup[k]:
            d["_id"] = str(d["_id"])
    if backup["target_invoice_before"]:
        backup["target_invoice_before"]["_id"] = str(backup["target_invoice_before"]["_id"])
    backup_path = f"/tmp/te_prod_backup_{int(time.time())}.json"
    with open(backup_path, "w") as f:
        json.dump(backup, f, indent=2, default=str)
    print(f"\nBackup saved to: {backup_path}")

    if dry_run:
        print("\n[DRY RUN] Not applying any changes. Set DRY_RUN=False to apply.")
        return

    # 2. Delete wrong invoices
    r1 = db.invoices.delete_many({"invoice_number": {"$in": TO_DELETE_INVOICES}})
    print(f"\nDeleted invoices     : {r1.deleted_count}")

    # 3. Delete credit notes
    r2 = db.credit_notes.delete_many({"credit_note_number": {"$in": TO_DELETE_CREDIT_NOTES}})
    print(f"Deleted credit notes : {r2.deleted_count}")

    # 4. Restore TE/2026-27/0001
    r3 = db.invoices.update_one({"invoice_number": TARGET}, {"$set": CORRECT_PAYLOAD})
    print(f"Restored {TARGET}   : matched={r3.matched_count} modified={r3.modified_count}")

    # 5. Reset counters so next invoice = TE/2026-27/0002 and next CN = TE/CN/2026-27/0001
    db.counters.update_one({"_id": "invoice_2026-27"}, {"$set": {"seq": 1}}, upsert=True)
    db.counters.update_one({"_id": "credit_note_2026-27"}, {"$set": {"seq": 0}}, upsert=True)
    print("Counters reset       : invoice_2026-27.seq=1, credit_note_2026-27.seq=0")

    dump(db, "AFTER")


if __name__ == "__main__":
    DRY_RUN = True   # ← flip to False after reviewing the dry-run report
    main(DRY_RUN)
