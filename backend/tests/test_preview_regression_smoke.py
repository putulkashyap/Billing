"""
READ-ONLY regression smoke test on PREVIEW environment.
Verifies no application code was accidentally altered while preparing
production cleanup scripts, and that all Preview-side functionality
still works exactly as after P4 freeze.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gst-tax-hub-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "hi@trayambak.in")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Ranjita@1985")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_health_root():
    r = requests.get(f"{BASE_URL}/api/", timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, dict)
    # Should mention app name in some field
    print("health:", body)


def test_login_returns_jwt(token):
    assert isinstance(token, str) and len(token) > 20


def test_invoices_single_seed(auth):
    r = requests.get(f"{BASE_URL}/api/invoices", headers=auth, timeout=30)
    assert r.status_code == 200
    data = r.json()
    # accept list or {items:[]}
    items = data if isinstance(data, list) else data.get("items") or data.get("invoices") or []
    assert len(items) == 1, f"expected 1 invoice, got {len(items)}: {items}"
    inv = items[0]
    assert inv.get("invoice_number") == "TE/2026-27/0001"
    assert abs(float(inv.get("grand_total", 0)) - 44200) < 0.5
    assert abs(float(inv.get("taxable_amount", 0)) - 37457.63) < 0.5
    assert abs(float(inv.get("igst", 0) or 0) - 6742.37) < 0.5
    assert float(inv.get("cgst", 0) or 0) == 0
    assert float(inv.get("sgst", 0) or 0) == 0
    assert str(inv.get("invoice_date", "")).startswith("2026-07-22")


def test_credit_notes_empty(auth):
    r = requests.get(f"{BASE_URL}/api/credit-notes", headers=auth, timeout=30)
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("items") or []
    assert items == [] or len(items) == 0


def test_gstr1_dryrun_july_blocked(auth):
    r = requests.get(f"{BASE_URL}/api/reports/gstr1-portal-json?fp=072026&dryrun=true", headers=auth, timeout=30)
    assert r.status_code == 400, f"expected 400 blocked, got {r.status_code} {r.text}"
    body = r.json()
    detail = body.get("detail", body)
    assert detail.get("status") == "BLOCKED"
    errs = str(detail.get("errors") or detail)
    assert "TE/2026-27/0001" in errs
    assert "place" in errs.lower() or "Place of Supply" in errs


def test_gstr1_dryrun_august_pass(auth):
    r = requests.get(f"{BASE_URL}/api/reports/gstr1-portal-json?fp=082026&dryrun=true", headers=auth, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "PASS"
    assert "validations_implemented" in body
    assert "validations_not_implemented" in body


def test_company_settings(auth):
    r = requests.get(f"{BASE_URL}/api/company", headers=auth, timeout=30)
    assert r.status_code == 200
    c = r.json()
    assert c.get("gstin") == "24AMAPR1170Q1ZT"
    assert str(c.get("state_code")) == "24"


def test_hsn_list(auth):
    r = requests.get(f"{BASE_URL}/api/hsn", headers=auth, timeout=30)
    assert r.status_code == 200


def test_vendors_list(auth):
    r = requests.get(f"{BASE_URL}/api/vendors", headers=auth, timeout=30)
    assert r.status_code == 200


def test_customers_list(auth):
    r = requests.get(f"{BASE_URL}/api/customers", headers=auth, timeout=30)
    assert r.status_code == 200


def test_gst_sales_register(auth):
    r = requests.get(f"{BASE_URL}/api/reports/gst-sales-register", headers=auth, timeout=30)
    assert r.status_code == 200
    body = r.json()
    rows = body.get("rows") or body.get("items") or (body if isinstance(body, list) else [])
    count = body.get("count") if isinstance(body, dict) else len(rows)
    if count is None:
        count = len(rows)
    assert count >= 1
    target = next((row for row in rows if row.get("invoice_number") == "TE/2026-27/0001"), None)
    assert target is not None, f"TE/2026-27/0001 not in rows: {rows}"
    assert abs(float(target.get("invoice_value", 0)) - 44200) < 0.5
    assert float(target.get("gst_rate", 0)) == 18


def test_gst_summary(auth):
    r = requests.get(f"{BASE_URL}/api/reports/gst-summary", headers=auth, timeout=30)
    assert r.status_code == 200
    body = r.json()
    output = body.get("output", {})
    position = body.get("position", {})
    assert abs(float(output.get("igst", 0)) - 6742.37) < 1.0
    assert abs(float(position.get("indicative_net_gst", 0)) - 6742.37) < 1.0
