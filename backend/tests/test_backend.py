"""Backend tests for TRAYAMBAK GST Billing API - Iteration 2."""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://gst-tax-hub-2.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "hi@trayambak.in"
ADMIN_PASS = os.environ.get("TEST_ADMIN_PASSWORD", "Ranjita@1985")

TS = int(time.time())


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def gujarat_customer(admin_headers):
    payload = {
        "name": f"TEST_GJ_Customer_{TS}",
        "gstin": "24ABCDE1234F1Z5",
        "address": "Ahmedabad, Gujarat",
        "phone": "9999999999",
        "email": f"gj_{TS}@test.com",
    }
    r = requests.post(f"{API}/customers", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def maharashtra_customer(admin_headers):
    payload = {
        "name": f"TEST_MH_Customer_{TS}",
        "gstin": "27ABCDE1234F1Z5",
        "address": "Mumbai, MH",
        "phone": "8888888888",
        "email": f"mh_{TS}@test.com",
    }
    r = requests.post(f"{API}/customers", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    return r.json()


# -------- Auth --------
class TestAuth:
    def test_login_admin(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and data["user"]["role"] == "admin"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401


# -------- Invoices --------
class TestInvoices:
    def test_create_gujarat_intra_state_invoice(self, admin_headers, gujarat_customer):
        payload = {
            "order_type": "regular",
            "po_number": "PO-TEST-1",
            "invoice_date": "2026-01-15",
            "customer": gujarat_customer,
            "line_items": [
                {"description": "Test Item", "hsn": "1234", "quantity": 2, "unit": "Nos", "rate": 5000, "discount": 0, "tax_rate": 18}
            ],
            "notes": "TEST intra",
        }
        r = requests.post(f"{API}/invoices", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["is_intra_state"] is True
        assert inv["cgst"] == 900.0
        assert inv["sgst"] == 900.0
        assert inv["igst"] == 0.0
        assert inv["grand_total"] == 11800.0
        assert inv["invoice_number"].startswith("TE/")
        assert "_id" not in inv
        # Persistence
        g = requests.get(f"{API}/invoices/{inv['id']}", headers=admin_headers)
        assert g.status_code == 200
        assert g.json()["grand_total"] == 11800.0
        pytest.gujarat_invoice_id = inv["id"]
        pytest.gujarat_invoice_grand = inv["grand_total"]

    def test_create_maharashtra_inter_state_invoice(self, admin_headers, maharashtra_customer):
        payload = {
            "order_type": "regular",
            "invoice_date": "2026-01-15",
            "customer": maharashtra_customer,
            "line_items": [
                {"description": "Inter Item", "hsn": "5678", "quantity": 1, "unit": "Nos", "rate": 10000, "discount": 0, "tax_rate": 18}
            ],
        }
        r = requests.post(f"{API}/invoices", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["is_intra_state"] is False
        assert inv["cgst"] == 0.0
        assert inv["sgst"] == 0.0
        assert inv["igst"] == 1800.0
        assert inv["grand_total"] == 11800.0
        pytest.mh_invoice_id = inv["id"]

    def test_partial_payment(self, admin_headers):
        iid = pytest.gujarat_invoice_id
        r = requests.post(
            f"{API}/invoices/{iid}/payments",
            json={"amount": 5000, "payment_date": "2026-01-16", "method": "UPI", "reference": "UPI-TEST-1"},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["status"] == "partially_paid"
        assert inv["amount_paid"] == 5000.0
        assert inv["balance"] == 6800.0

    def test_full_payment(self, admin_headers):
        iid = pytest.gujarat_invoice_id
        r = requests.post(
            f"{API}/invoices/{iid}/payments",
            json={"amount": 6800, "payment_date": "2026-01-17", "method": "Bank Transfer", "reference": "UTR-TEST-2"},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["status"] == "paid"
        assert inv["balance"] == 0.0
        assert inv["amount_paid"] == 11800.0


# -------- Reports --------
class TestReports:
    def test_summary_aggregates(self, admin_headers):
        r = requests.get(f"{API}/reports/summary", headers=admin_headers)
        assert r.status_code == 200, r.text
        s = r.json()
        for k in ["taxable_revenue", "cgst", "sgst", "igst", "grand_total", "amount_paid", "outstanding", "invoice_count", "status_counts"]:
            assert k in s
        assert s["invoice_count"] >= 2
        assert s["cgst"] >= 900.0
        assert s["sgst"] >= 900.0
        assert s["igst"] >= 1800.0


# -------- Users / Staff --------
class TestUsers:
    def test_create_staff_and_login(self, admin_headers):
        email = f"test_staff_{TS}@example.com"
        pwd = "StaffPass@123"
        r = requests.post(
            f"{API}/users",
            json={"email": email, "name": "TEST Staff", "password": pwd, "role": "staff"},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        u = r.json()
        assert "_id" not in u
        assert "password_hash" not in u
        assert u["email"] == email
        assert u["role"] == "staff"
        assert "id" in u and "created_at" in u
        # Login as staff
        lr = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
        assert lr.status_code == 200, lr.text
        assert lr.json()["user"]["role"] == "staff"
        pytest.staff_email = email
        pytest.staff_pwd = pwd

    def test_staff_forbidden_on_admin_endpoint(self, admin_headers):
        # Login as staff
        lr = requests.post(f"{API}/auth/login", json={"email": pytest.staff_email, "password": pytest.staff_pwd})
        token = lr.json()["token"]
        r = requests.get(f"{API}/users", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403
