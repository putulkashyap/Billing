"""Tests for Invoice Edit + Credit Note features (iteration 4)."""
import os
import pytest
import requests
from datetime import date

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gst-tax-hub-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "hi@trayambak.in")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Ranjita@1985")

# Track created resources for cleanup
created_invoice_ids = []
created_cn_ids = []


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def existing_invoice(headers):
    """Get existing TE/2026-27/0001 - do NOT modify or delete."""
    r = requests.get(f"{API}/invoices", headers=headers)
    assert r.status_code == 200
    invs = [i for i in r.json() if i["invoice_number"] == "TE/2026-27/0001"]
    assert invs, "Expected existing invoice TE/2026-27/0001"
    return invs[0]


def _make_invoice(headers, name="TEST_Disposable", qty=1, rate=1000):
    payload = {
        "order_type": "regular",
        "po_number": "TEST-PO",
        "reference_date": "2026-01-15",
        "invoice_date": "2026-01-15",
        "customer": {"name": name, "gstin": "24AAAAA0000A1Z5", "address": "Test", "phone": "", "email": ""},
        "line_items": [{"description": "Item", "hsn": "1234", "quantity": qty, "unit": "Nos", "rate": rate, "discount": 0, "tax_rate": 18}],
        "notes": "TEST_DISPOSABLE",
    }
    r = requests.post(f"{API}/invoices", headers=headers, json=payload)
    assert r.status_code == 200, r.text
    inv = r.json()
    created_invoice_ids.append(inv["id"])
    return inv


# ---------- PUT /api/invoices/{id} ----------
class TestInvoiceEdit:
    def test_update_pending_invoice(self, headers):
        inv = _make_invoice(headers, name="TEST_EditMe", qty=1, rate=500)
        # Now edit: change qty to 2, rate 600
        payload = {
            "order_type": "regular",
            "po_number": "EDITED-PO",
            "reference_date": "2026-01-20",
            "invoice_date": "2026-01-20",
            "customer": inv["customer"],
            "line_items": [{"description": "Edited Item", "hsn": "1234", "quantity": 2, "unit": "Nos", "rate": 600, "discount": 0, "tax_rate": 18}],
            "notes": "TEST_edited",
        }
        r = requests.put(f"{API}/invoices/{inv['id']}", headers=headers, json=payload)
        assert r.status_code == 200, r.text
        upd = r.json()
        assert upd["po_number"] == "EDITED-PO"
        assert upd["line_items"][0]["description"] == "Edited Item"
        # 2*600=1200 taxable, 18% = 216, grand=1416
        assert upd["taxable_amount"] == 1200.0
        assert upd["grand_total"] == 1416.0
        assert upd["balance"] == 1416.0
        assert upd["status"] == "pending"

        # Verify persistence via GET
        r2 = requests.get(f"{API}/invoices/{inv['id']}", headers=headers)
        assert r2.json()["po_number"] == "EDITED-PO"

    def test_cannot_edit_paid_invoice(self, headers):
        inv = _make_invoice(headers, name="TEST_PaidBlocker", qty=1, rate=1000)
        # Pay it full: grand should be 1180
        assert inv["grand_total"] == 1180.0
        pay = {"amount": 1180.0, "payment_date": "2026-01-15", "method": "Cash", "reference": "TEST"}
        r = requests.post(f"{API}/invoices/{inv['id']}/payments", headers=headers, json=pay)
        assert r.status_code == 200
        assert r.json()["status"] == "paid"

        # Now attempt edit -> 400
        payload = {
            "order_type": "regular", "po_number": "X", "reference_date": "2026-01-15",
            "invoice_date": "2026-01-15", "customer": inv["customer"],
            "line_items": [{"description": "x", "hsn": "1", "quantity": 1, "unit": "Nos", "rate": 100, "discount": 0, "tax_rate": 18}],
            "notes": "",
        }
        r = requests.put(f"{API}/invoices/{inv['id']}", headers=headers, json=payload)
        assert r.status_code == 400
        assert "Paid invoices cannot be edited" in r.json()["detail"]


# ---------- POST /api/credit-notes ----------
class TestCreditNotes:
    def test_create_first_credit_note(self, headers, existing_invoice):
        payload = {
            "invoice_id": existing_invoice["id"],
            "credit_date": "2026-01-20",
            "reason": "TEST_damaged goods partial",
            "line_items": [{"description": "Damaged unit credit", "hsn": "1234", "quantity": 1, "unit": "Nos", "rate": 1000, "discount": 0, "tax_rate": 18}],
            "notes": "TEST_CN1",
        }
        r = requests.post(f"{API}/credit-notes", headers=headers, json=payload)
        assert r.status_code == 200, r.text
        cn = r.json()
        created_cn_ids.append(cn["id"])
        assert cn["credit_note_number"] == "TE/CN/2026-27/0001"
        assert cn["invoice_number"] == "TE/2026-27/0001"
        # 1000 * 1.18 = 1180
        assert cn["grand_total"] == 1180.0
        assert cn["taxable_amount"] == 1000.0

        # Verify invoice updated
        inv_r = requests.get(f"{API}/invoices/{existing_invoice['id']}", headers=headers)
        inv = inv_r.json()
        assert inv["credits_applied"] == 1180.0
        assert inv["balance"] == round(52156 - 1180, 2)
        assert inv["status"] == "partially_paid"

    def test_second_credit_note_increments_number(self, headers, existing_invoice):
        payload = {
            "invoice_id": existing_invoice["id"],
            "credit_date": "2026-01-21",
            "reason": "TEST_second",
            "line_items": [{"description": "Another credit", "hsn": "1234", "quantity": 1, "unit": "Nos", "rate": 500, "discount": 0, "tax_rate": 18}],
        }
        r = requests.post(f"{API}/credit-notes", headers=headers, json=payload)
        assert r.status_code == 200, r.text
        cn = r.json()
        created_cn_ids.append(cn["id"])
        assert cn["credit_note_number"] == "TE/CN/2026-27/0002"
        assert cn["grand_total"] == 590.0

    def test_credit_note_exceeds_limit(self, headers):
        # Create tiny disposable invoice, credit fully, then over-credit
        inv = _make_invoice(headers, name="TEST_ExceedLimit", qty=1, rate=100)
        # grand = 118
        p1 = {
            "invoice_id": inv["id"], "credit_date": "2026-01-15", "reason": "TEST_full",
            "line_items": [{"description": "full", "hsn": "1", "quantity": 1, "unit": "Nos", "rate": 100, "discount": 0, "tax_rate": 18}],
        }
        r1 = requests.post(f"{API}/credit-notes", headers=headers, json=p1)
        assert r1.status_code == 200
        created_cn_ids.append(r1.json()["id"])

        # Now try one more - should fail
        p2 = {
            "invoice_id": inv["id"], "credit_date": "2026-01-15", "reason": "TEST_over",
            "line_items": [{"description": "over", "hsn": "1", "quantity": 1, "unit": "Nos", "rate": 50, "discount": 0, "tax_rate": 18}],
        }
        r2 = requests.post(f"{API}/credit-notes", headers=headers, json=p2)
        assert r2.status_code == 400
        assert "exceeds" in r2.json()["detail"].lower()

    def test_list_and_get_credit_notes(self, headers, existing_invoice):
        r = requests.get(f"{API}/credit-notes", headers=headers)
        assert r.status_code == 200
        cns = r.json()
        assert len(cns) >= 2
        # GET single
        cn_id = created_cn_ids[0]
        r2 = requests.get(f"{API}/credit-notes/{cn_id}", headers=headers)
        assert r2.status_code == 200
        assert r2.json()["id"] == cn_id

        # GET by invoice
        r3 = requests.get(f"{API}/invoices/{existing_invoice['id']}/credit-notes", headers=headers)
        assert r3.status_code == 200
        inv_cns = r3.json()
        assert len(inv_cns) == 2

    def test_summary_includes_credit_fields(self, headers):
        r = requests.get(f"{API}/reports/summary", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "credits_applied" in data
        assert "credit_note_count" in data
        assert data["credit_note_count"] >= 2
        assert data["credits_applied"] > 0
