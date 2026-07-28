"""Regression tests for invoice edit (PUT should update, not create)."""
import os
import copy
import subprocess
import pytest
import requests


def _mongo_cleanup(invoice_ids=None, reset_counter=True):
    """Delete disposable invoices from MongoDB and reset invoice counter."""
    ids_js = "[]" if not invoice_ids else "[" + ",".join(f'"{i}"' for i in invoice_ids) + "]"
    script = f"""
    var ids = {ids_js};
    if (ids.length) db.invoices.deleteMany({{id: {{$in: ids}}}});
    """
    if reset_counter:
        script += 'db.counters.updateOne({_id:"invoice_2026-27"}, {$set:{seq:1}});'
    subprocess.run(["mongosh", "test_database", "--quiet", "--eval", script],
                   check=False, capture_output=True)

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or ""
if not BASE_URL:
    # fallback: read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "hi@trayambak.in"
ADMIN_PASSWORD = "Ranjita@1985"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def original_invoice(H):
    """Fetch TE/2026-27/0001 original snapshot."""
    r = requests.get(f"{BASE_URL}/api/invoices", headers=H)
    assert r.status_code == 200
    invs = r.json()
    target = [i for i in invs if i["invoice_number"] == "TE/2026-27/0001"]
    assert len(target) == 1, f"Expected 1 invoice TE/2026-27/0001, found {len(target)}. Invoices: {[i['invoice_number'] for i in invs]}"
    return copy.deepcopy(target[0])


def _build_update_payload(inv, overrides=None):
    """Build a PUT payload matching what the frontend sends."""
    payload = {
        "order_type": inv.get("order_type", "gem"),
        "invoice_date": inv.get("invoice_date"),
        "customer": inv.get("customer"),
        "line_items": [
            {
                "description": li.get("description"),
                "hsn_sac": li.get("hsn_sac"),
                "quantity": li.get("quantity"),
                "unit": li.get("unit"),
                "rate": li.get("rate"),
                "discount": li.get("discount", 0),
                "tax_rate": li.get("tax_rate"),
                "price_type": li.get("price_type", "exclusive"),
            }
            for li in inv.get("line_items", [])
        ],
        "notes": inv.get("notes", ""),
    }
    if inv.get("order_type") == "gem":
        payload["gem_contract_no"] = inv.get("gem_contract_no")
        payload["buyer_department"] = inv.get("buyer_department")
        payload["consignee_details"] = inv.get("consignee_details")
    else:
        for k in ("po_number", "po_date"):
            if k in inv:
                payload[k] = inv[k]
    if overrides:
        payload.update(overrides)
    return payload


def test_put_updates_same_invoice_no_duplicate(H, original_invoice):
    """PUT should return same id/invoice_number, not create a new one."""
    inv_id = original_invoice["id"]
    original_num = original_invoice["invoice_number"]

    # Modify: change gem_contract_no + line item qty
    modified = copy.deepcopy(original_invoice)
    modified["gem_contract_no"] = "GEMC-EDITED-TEST"
    modified["line_items"][0]["quantity"] = float(original_invoice["line_items"][0]["quantity"]) + 2

    payload = _build_update_payload(modified)

    r = requests.put(f"{BASE_URL}/api/invoices/{inv_id}", json=payload, headers=H)
    assert r.status_code == 200, f"PUT failed: {r.status_code} {r.text}"
    updated = r.json()

    # Same id + invoice number (no duplicate)
    assert updated["id"] == inv_id, "Invoice id changed after update!"
    assert updated["invoice_number"] == original_num, f"Invoice number changed! got {updated['invoice_number']}"
    assert updated["gem_contract_no"] == "GEMC-EDITED-TEST"
    assert float(updated["line_items"][0]["quantity"]) == float(original_invoice["line_items"][0]["quantity"]) + 2

    # Verify collection still has exactly 1 invoice
    r2 = requests.get(f"{BASE_URL}/api/invoices", headers=H)
    assert r2.status_code == 200
    all_invs = r2.json()
    matching = [i for i in all_invs if i["invoice_number"].startswith("TE/2026-27/")]
    assert len(matching) == 1, f"Duplicate invoices detected: {[i['invoice_number'] for i in matching]}"


def test_restore_original_invoice(H, original_invoice):
    """Restore original values via PUT."""
    inv_id = original_invoice["id"]
    payload = _build_update_payload(original_invoice)
    r = requests.put(f"{BASE_URL}/api/invoices/{inv_id}", json=payload, headers=H)
    assert r.status_code == 200, r.text
    restored = r.json()
    assert restored["gem_contract_no"] == original_invoice.get("gem_contract_no")
    assert float(restored["line_items"][0]["quantity"]) == float(original_invoice["line_items"][0]["quantity"])
    assert restored["invoice_number"] == original_invoice["invoice_number"]


def test_new_invoice_still_uses_post_and_increments(H, original_invoice):
    """Regression: POST /invoices creates a new invoice with next seq. Then cleanup."""
    payload = _build_update_payload(original_invoice)
    # New customer to be safe
    r = requests.post(f"{BASE_URL}/api/invoices", json=payload, headers=H)
    assert r.status_code in (200, 201), r.text
    new_inv = r.json()
    assert new_inv["invoice_number"] == "TE/2026-27/0002", f"Expected 0002, got {new_inv['invoice_number']}"
    new_id = new_inv["id"]

    # Cleanup via mongo (no DELETE endpoint for invoices)
    _mongo_cleanup(invoice_ids=[new_id], reset_counter=True)

    # Verify cleanup
    r2 = requests.get(f"{BASE_URL}/api/invoices", headers=H)
    nums = [i["invoice_number"] for i in r2.json()]
    assert "TE/2026-27/0002" not in nums, f"Cleanup failed, still has: {nums}"


def test_put_on_paid_invoice_returns_400(H, original_invoice):
    """Create disposable invoice, pay it fully, then attempt PUT -> 400."""
    payload = _build_update_payload(original_invoice)
    r = requests.post(f"{BASE_URL}/api/invoices", json=payload, headers=H)
    assert r.status_code in (200, 201), r.text
    inv = r.json()
    inv_id = inv["id"]
    grand_total = inv["grand_total"]

    try:
        pay = requests.post(
            f"{BASE_URL}/api/invoices/{inv_id}/payments",
            json={
                "amount": grand_total,
                "method": "cash",
                "reference": "TEST_PAY",
                "payment_date": inv.get("invoice_date"),
            },
            headers=H,
        )
        assert pay.status_code in (200, 201), f"Payment failed: {pay.status_code} {pay.text}"

        pr = requests.put(f"{BASE_URL}/api/invoices/{inv_id}", json=payload, headers=H)
        assert pr.status_code == 400, f"Expected 400 for paid invoice edit, got {pr.status_code}: {pr.text}"
        assert "paid" in pr.text.lower()
    finally:
        _mongo_cleanup(invoice_ids=[inv_id], reset_counter=True)
