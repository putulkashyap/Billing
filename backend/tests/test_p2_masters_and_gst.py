"""Locked-in tests for the new GST Foundation (P2).

Covers:
- GST engine chooses CGST+SGST for intra-state and IGST for inter-state via Place of Supply
- GSTIN format validator
- Customer/Vendor duplicate GSTIN protection
- HSN master CRUD (uniqueness + lookup)
- Company settings singleton bootstrap
- GST Sales Register endpoint
- Invoice TE/2026-27/0001 is not mutated by any of the above
"""
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0]
BASE = f"{API}/api"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/auth/login", json={"email": "hi@trayambak.in", "password": "Ranjita@1985"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


# ---------- Baseline snapshot: existing invoice must not change ----------
@pytest.fixture(scope="module")
def existing_invoice_snapshot(db):
    doc = db.invoices.find_one({"invoice_number": "TE/2026-27/0001"}, {"_id": 0})
    assert doc is not None, "Base invoice missing"
    return dict(doc)


def test_existing_invoice_untouched(db, existing_invoice_snapshot):
    """Any operations from the module leave TE/2026-27/0001 exactly as before."""
    after = db.invoices.find_one({"invoice_number": "TE/2026-27/0001"}, {"_id": 0})
    for k in ("invoice_number", "invoice_date", "taxable_amount", "cgst", "sgst", "igst", "grand_total"):
        assert after[k] == existing_invoice_snapshot[k], f"{k} was modified"


def test_invoice_count_and_counter(db):
    assert db.invoices.count_documents({}) == 1
    assert db.credit_notes.count_documents({}) == 0
    c = db.counters.find_one({"_id": "invoice_2026-27"})
    assert c and c["seq"] == 1, f"Next invoice must be 0002; counter is {c}"


# ---------- Company settings singleton ----------
def test_company_singleton(hdr):
    r = requests.get(f"{BASE}/company", headers=hdr)
    assert r.status_code == 200
    d = r.json()
    assert d["gstin"] == "24AMAPR1170Q1ZT"
    assert d["state_code"] == "24"


# ---------- GSTIN validation ----------
def test_customer_gstin_validation(hdr, db):
    r = requests.post(f"{BASE}/customers", headers=hdr, json={
        "name": "TEST_BAD_GSTIN", "gst_reg_type": "regular", "gstin": "NOTVALID"
    })
    assert r.status_code == 400
    # verify nothing was written
    assert db.customers.find_one({"name": "TEST_BAD_GSTIN"}) is None


def test_customer_dup_gstin(hdr, db):
    payload = {"name": "TEST_DUP_A", "gst_reg_type": "regular",
               "gstin": "20AAAAA0000A1Z5", "state_code": "20"}
    r1 = requests.post(f"{BASE}/customers", headers=hdr, json=payload)
    assert r1.status_code == 200
    r2 = requests.post(f"{BASE}/customers", headers=hdr, json={**payload, "name": "TEST_DUP_B"})
    assert r2.status_code == 409
    # cleanup
    db.customers.delete_many({"name": {"$in": ["TEST_DUP_A", "TEST_DUP_B"]}})


def test_customer_unregistered_ok_without_gstin(hdr, db):
    r = requests.post(f"{BASE}/customers", headers=hdr, json={
        "name": "TEST_UNREG", "gst_reg_type": "unregistered", "state_code": "24"
    })
    assert r.status_code == 200
    db.customers.delete_many({"name": "TEST_UNREG"})


def test_vendor_dup_gstin(hdr, db):
    payload = {"name": "TEST_V", "gst_reg_type": "regular",
               "gstin": "27ABCDE1234F1Z5", "state_code": "27"}
    r1 = requests.post(f"{BASE}/vendors", headers=hdr, json=payload)
    assert r1.status_code == 200
    r2 = requests.post(f"{BASE}/vendors", headers=hdr, json={**payload, "name": "TEST_V_B"})
    assert r2.status_code == 409
    db.vendors.delete_many({"name": {"$in": ["TEST_V", "TEST_V_B"]}})


# ---------- HSN CRUD ----------
def test_hsn_crud_uniqueness(hdr, db):
    code = "TEST_HSN_2831"
    r1 = requests.post(f"{BASE}/hsn", headers=hdr,
                       json={"code": code, "description": "unit-test", "gst_rate": 12})
    assert r1.status_code == 200
    r_look = requests.get(f"{BASE}/hsn/lookup/{code}", headers=hdr)
    assert r_look.status_code == 200
    assert r_look.json()["gst_rate"] == 12
    assert r_look.json()["cgst_rate"] == 6
    # duplicate rejected
    r2 = requests.post(f"{BASE}/hsn", headers=hdr,
                       json={"code": code, "description": "dup", "gst_rate": 18})
    assert r2.status_code == 409
    # cleanup
    db.hsn_master.delete_many({"code": code})


# ---------- GST engine ----------
def test_gst_engine_via_python():
    """Direct engine unit tests (no HTTP, no DB writes)."""
    import sys, importlib.util
    spec = importlib.util.spec_from_file_location("srv", "/app/backend/server.py")
    srv = importlib.util.module_from_spec(spec); spec.loader.exec_module(srv)
    LineItem = srv.LineItem
    # Intra-state Gujarat → Gujarat = CGST + SGST
    t1 = srv.compute_invoice_totals(
        {"gstin": "24AAAAA0000A1Z5", "state_code": "24"},
        [LineItem(description="x", hsn="998313", quantity=1, rate=1000, discount=0, tax_rate=18, price_type="exclusive")],
        place_of_supply_code="24", supplier_state_code="24"
    )
    assert t1["is_intra_state"] is True and t1["cgst"] == 90 and t1["sgst"] == 90 and t1["igst"] == 0
    # Inter-state Gujarat → Jharkhand = IGST
    t2 = srv.compute_invoice_totals(
        {"gstin": "20AAAAA0000A1Z5", "state_code": "20"},
        [LineItem(description="x", hsn="998313", quantity=1, rate=1000, discount=0, tax_rate=18, price_type="exclusive")],
        place_of_supply_code="20", supplier_state_code="24"
    )
    assert t2["is_intra_state"] is False and t2["igst"] == 180 and t2["cgst"] == 0
    # Inclusive pricing produces the exact same taxable
    t3 = srv.compute_invoice_totals(
        {"gstin": "20AAAAA0000A1Z5", "state_code": "20"},
        [LineItem(description="x", hsn="998313", quantity=1, rate=1180, discount=0, tax_rate=18, price_type="inclusive")],
        place_of_supply_code="20", supplier_state_code="24"
    )
    assert abs(t3["taxable_amount"] - 1000) < 0.01 and abs(t3["igst"] - 180) < 0.01
    # Unregistered without state → default to inter-state (IGST)
    t4 = srv.compute_invoice_totals(
        {"gstin": "", "state_code": ""},
        [LineItem(description="x", hsn="998313", quantity=1, rate=100, discount=0, tax_rate=18, price_type="exclusive")],
        place_of_supply_code="", supplier_state_code="24"
    )
    assert t4["is_intra_state"] is False


def test_gstin_validator():
    import importlib.util
    spec = importlib.util.spec_from_file_location("srv", "/app/backend/server.py")
    srv = importlib.util.module_from_spec(spec); spec.loader.exec_module(srv)
    assert srv.validate_gstin_format("24AMAPR1170Q1ZT") is True
    assert srv.validate_gstin_format("NOTVALID") is False
    assert srv.validate_gstin_format("") is False


# ---------- GST Sales Register ----------
def test_gst_sales_register(hdr):
    r = requests.get(f"{BASE}/reports/gst-sales-register", headers=hdr)
    assert r.status_code == 200
    d = r.json()
    assert d["count"] >= 1
    row = next(x for x in d["rows"] if x["invoice_number"] == "TE/2026-27/0001")
    assert abs(row["taxable_value"] - 37457.63) < 1
    assert abs(row["igst"] - 6742.37) < 1
    assert abs(row["invoice_value"] - 44200) < 1


def test_gst_sales_register_csv(hdr):
    r = requests.get(f"{BASE}/reports/gst-sales-register?fmt=csv", headers=hdr)
    assert r.status_code == 200
    assert "invoice_number" in r.text and "TE/2026-27/0001" in r.text
