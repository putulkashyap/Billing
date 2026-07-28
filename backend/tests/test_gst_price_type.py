"""Backend tests for inclusive/exclusive GST engine + landing page routing - Iteration 6."""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "hi@trayambak.in"
ADMIN_PASS = "Ranjita@1985"
TS = int(time.time())

created_invoice_ids = []


@pytest.fixture(scope="module")
def headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def gj_customer(headers):
    r = requests.post(f"{API}/customers", json={
        "name": f"TEST_GJ_PT_{TS}", "gstin": "24ABCDE1234F1Z5",
        "address": "Vadodara, GJ", "phone": "9999900000", "email": f"gjpt_{TS}@t.com",
    }, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _make_invoice(headers, customer, line_items):
    payload = {
        "order_type": "regular",
        "invoice_date": "2026-01-15",
        "customer": customer,
        "line_items": line_items,
    }
    r = requests.post(f"{API}/invoices", json=payload, headers=headers)
    assert r.status_code == 200, r.text
    inv = r.json()
    created_invoice_ids.append(inv["id"])
    return inv


# ---------- Inclusive GST math ----------
def test_inclusive_gst_single_line(headers, gj_customer):
    inv = _make_invoice(headers, gj_customer, [{
        "description": "TEST inclusive", "hsn": "0000",
        "quantity": 1, "unit": "Nos", "rate": 1180, "discount": 0,
        "tax_rate": 18, "price_type": "inclusive",
    }])
    assert inv["taxable_amount"] == 1000.00
    assert inv["cgst"] == 90.00
    assert inv["sgst"] == 90.00
    assert inv["igst"] == 0
    assert inv["grand_total"] == 1180.00
    assert inv["is_intra_state"] is True


def test_exclusive_gst_regression(headers, gj_customer):
    inv = _make_invoice(headers, gj_customer, [{
        "description": "TEST exclusive", "hsn": "0000",
        "quantity": 1, "unit": "Nos", "rate": 1000, "discount": 0,
        "tax_rate": 18, "price_type": "exclusive",
    }])
    assert inv["taxable_amount"] == 1000.00
    assert inv["cgst"] == 90.00
    assert inv["sgst"] == 90.00
    assert inv["grand_total"] == 1180.00


def test_mixed_line_items(headers, gj_customer):
    inv = _make_invoice(headers, gj_customer, [
        {"description": "TEST mixed incl", "hsn": "0000", "quantity": 1, "unit": "Nos",
         "rate": 590, "discount": 0, "tax_rate": 18, "price_type": "inclusive"},
        {"description": "TEST mixed excl", "hsn": "0000", "quantity": 1, "unit": "Nos",
         "rate": 500, "discount": 0, "tax_rate": 18, "price_type": "exclusive"},
    ])
    assert inv["taxable_amount"] == 1000.00
    assert inv["total_tax"] == 180.00
    assert inv["grand_total"] == 1180.00
    # per-line price_type persisted
    assert inv["line_items"][0]["price_type"] == "inclusive"
    assert inv["line_items"][1]["price_type"] == "exclusive"


def test_inclusive_zero_tax_no_divzero(headers, gj_customer):
    inv = _make_invoice(headers, gj_customer, [{
        "description": "TEST zero tax incl", "hsn": "0000",
        "quantity": 2, "unit": "Nos", "rate": 250, "discount": 0,
        "tax_rate": 0, "price_type": "inclusive",
    }])
    # billed = 500, tax_rate 0 -> taxable = 500 exactly
    assert inv["taxable_amount"] == 500.00
    assert inv["total_tax"] == 0
    assert inv["grand_total"] == 500.00


def test_get_persisted_invoice_has_price_type(headers, gj_customer):
    inv = _make_invoice(headers, gj_customer, [
        {"description": "TEST persist a", "quantity": 1, "rate": 1180, "tax_rate": 18, "price_type": "inclusive"},
        {"description": "TEST persist b", "quantity": 1, "rate": 500, "tax_rate": 18, "price_type": "exclusive"},
    ])
    r = requests.get(f"{API}/invoices/{inv['id']}", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["line_items"][0]["price_type"] == "inclusive"
    assert data["line_items"][1]["price_type"] == "exclusive"


# ---------- Cleanup: delete TEST invoices + rewind counter ----------
def test_zzz_cleanup(headers):
    for iid in created_invoice_ids:
        r = requests.delete(f"{API}/invoices/{iid}", headers=headers)
        assert r.status_code in (200, 204), r.text
    # verify user's TE/2026-27/0001 still there
    r = requests.get(f"{API}/invoices", headers=headers)
    assert r.status_code == 200
    invs = r.json()
    nums = [i["invoice_number"] for i in invs]
    assert "TE/2026-27/0001" in nums, f"User invoice missing! Found: {nums}"
