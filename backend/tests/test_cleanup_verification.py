"""Iteration 3 - Verify dummy invoice cleanup and counter reset."""
import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "hi@trayambak.in"
ADMIN_PASS = "Ranjita@1985"


@pytest.fixture(scope="module")
def headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_invoices_state(headers):
    r = requests.get(f"{API}/invoices", headers=headers)
    assert r.status_code == 200
    invs = r.json()
    print(f"Invoice count: {len(invs)}")
    assert len(invs) == 1, f"Expected 1 invoice, got {len(invs)}"
    inv = invs[0]
    assert inv["invoice_number"] == "TE/2026-27/0001"
    assert inv["customer"]["name"] == "Chief Executive Officer"
    assert inv["grand_total"] == 52156
    # No Preview Test Co
    assert not any("Preview Test" in i.get("customer", {}).get("name", "") for i in invs)


def test_customers_empty(headers):
    r = requests.get(f"{API}/customers", headers=headers)
    assert r.status_code == 200
    assert r.json() == []


def test_users_only_admin(headers):
    r = requests.get(f"{API}/users", headers=headers)
    assert r.status_code == 200
    users = r.json()
    emails = [u["email"] for u in users]
    print(f"Users: {emails}")
    assert emails == [ADMIN_EMAIL], f"Unexpected users: {emails}"


def test_summary_reflects_only_real_invoice(headers):
    r = requests.get(f"{API}/reports/summary", headers=headers)
    assert r.status_code == 200
    data = r.json()
    print(f"Summary: {data}")
    # Should reflect 1 invoice only
    # taxable_revenue should be < 52156 (before tax)
    assert data.get("total_invoices", 0) in (1, None) or data.get("invoice_count", 0) in (1, None)


def test_counter_creates_0002(headers):
    payload = {
        "order_type": "regular",
        "invoice_date": "2026-07-28",
        "customer": {"name": "Verify Counter Co", "gstin": "24AABCT9999R1Z5", "address": "Test"},
        "line_items": [{"description": "Verify", "hsn": "9983", "quantity": 1, "unit": "Nos", "rate": 1000, "discount": 0, "tax_rate": 18}],
    }
    r = requests.post(f"{API}/invoices", json=payload, headers=headers)
    assert r.status_code in (200, 201), r.text
    inv = r.json()
    print(f"Created invoice: {inv.get('invoice_number')}")
    assert inv["invoice_number"] == "TE/2026-27/0002", f"Expected TE/2026-27/0002, got {inv['invoice_number']}"
