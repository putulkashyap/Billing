"""P3 tests — HSN effective-date enforcement, Purchase Register, ITC, GST Summary,
GSTR-1 Working Data Export. Ensures the existing invoice `TE/2026-27/0001`
stays byte-identical and no permanent test invoice is created."""
import os
import io
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE = f"{API}/api"


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def hdr():
    r = requests.post(f"{BASE}/auth/login", json={"email": os.environ.get("TEST_ADMIN_EMAIL", "hi@trayambak.in"), "password": os.environ.get("TEST_ADMIN_PASSWORD", "Ranjita@1985")})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---------- Baseline snapshot must stay identical across all tests ----------
@pytest.fixture(scope="module")
def baseline_invoice(db):
    return dict(db.invoices.find_one({"invoice_number": "TE/2026-27/0001"}, {"_id": 0}))


@pytest.fixture(scope="module", autouse=True)
def _cleanup(db):
    """Snapshot & restore HSN master and any test artefacts."""
    hsn_before = list(db.hsn_master.find({}, {"_id": 0}))
    yield
    # cleanup any HSN codes with the P3_TEST_ prefix
    db.hsn_master.delete_many({"code": {"$regex": "^P3_TEST_"}})
    # cleanup any test expenses
    db.expenses.delete_many({"bill_number": {"$regex": "^P3_TEST_"}})
    # Restore original HSN state
    codes_after = {d["code"] for d in db.hsn_master.find({}, {"code": 1})}
    codes_before = {d["code"] for d in hsn_before}
    to_delete = codes_after - codes_before
    if to_delete:
        db.hsn_master.delete_many({"code": {"$in": list(to_delete)}})


def test_existing_invoice_untouched_end_to_end(db, baseline_invoice):
    after = db.invoices.find_one({"invoice_number": "TE/2026-27/0001"}, {"_id": 0})
    for k in ("invoice_number", "invoice_date", "taxable_amount", "cgst", "sgst", "igst", "grand_total"):
        assert after[k] == baseline_invoice[k], f"{k} changed"
    assert db.invoices.count_documents({}) == 1
    assert db.credit_notes.count_documents({}) == 0
    c = db.counters.find_one({"_id": "invoice_2026-27"})
    assert c["seq"] == 1, "Next invoice must remain TE/2026-27/0002"


# ---------- HSN CSV import preview + commit + duplicate strategy ----------
def test_hsn_import_flow(hdr, db):
    csv_bytes = io.BytesIO(
        b"Code,Description,GST Rate,Cess Rate,Taxability,ITC Eligible,Effective From,Effective To,Active\n"
        b"P3_TEST_998313,IT services,18,0,taxable,yes,2026-04-01,2027-03-31,yes\n"
        b"P3_TEST_9701,Paintings,12,0,taxable,yes,2026-04-01,,yes\n"
        b",Bad row missing code,18,0,taxable,yes,,,yes\n"
    )
    r = requests.post(f"{BASE}/hsn/import/preview", headers=hdr,
                      files={"file": ("hsn.csv", csv_bytes, "text/csv")})
    assert r.status_code == 200
    prev = r.json()
    assert prev["count"] == 2
    assert any("missing" in e["error"].lower() for e in prev["errors"])
    # Commit with 'skip' strategy
    r2 = requests.post(f"{BASE}/hsn/import/commit", headers=hdr,
                       json={"rows": prev["rows"], "strategy": "skip"})
    assert r2.status_code == 200
    assert r2.json()["inserted"] == 2
    # Second commit → skip existing
    r3 = requests.post(f"{BASE}/hsn/import/commit", headers=hdr,
                       json={"rows": prev["rows"], "strategy": "skip"})
    assert r3.json()["skipped"] == 2 and r3.json()["inserted"] == 0
    # Update strategy overrides
    prev["rows"][0]["description"] = "IT services v2"
    r4 = requests.post(f"{BASE}/hsn/import/commit", headers=hdr,
                       json={"rows": prev["rows"], "strategy": "update"})
    assert r4.json()["updated"] == 2
    row = db.hsn_master.find_one({"code": "P3_TEST_998313"})
    assert row["description"] == "IT services v2"


# ---------- HSN effective-date enforcement at invoice save ----------
def test_hsn_effective_date_rejects_expired(hdr, db):
    # seed a P3 HSN valid ONLY for 2024-04-01 → 2024-09-30
    db.hsn_master.insert_one({
        "id": "p3-expired", "code": "P3_TEST_EXPIRED", "description": "expired",
        "gst_rate": 18.0, "cgst_rate": 9.0, "sgst_rate": 9.0, "igst_rate": 18.0,
        "cess_rate": 0.0, "taxability": "taxable", "itc_eligible": True,
        "effective_from": "2024-04-01", "effective_to": "2024-09-30",
        "active": True, "created_at": "", "updated_at": "",
    })
    payload = {
        "invoice_date": "2026-08-01",
        "customer": {"name": "Probe", "gstin": "", "state_code": "20", "state": "Jharkhand"},
        "place_of_supply_code": "20", "place_of_supply_state": "Jharkhand",
        "line_items": [{
            "description": "test", "hsn": "P3_TEST_EXPIRED", "quantity": 1,
            "unit": "Nos", "rate": 1000, "discount": 0, "tax_rate": 18, "price_type": "exclusive",
        }],
    }
    r = requests.post(f"{BASE}/invoices", headers=hdr, json=payload)
    assert r.status_code == 400, r.text
    assert "not valid for date" in r.text
    # ensure no invoice was created and counter unchanged
    assert db.invoices.count_documents({}) == 1
    assert db.counters.find_one({"_id": "invoice_2026-27"})["seq"] == 1


def test_hsn_rate_mismatch_rejected(hdr, db):
    db.hsn_master.insert_one({
        "id": "p3-12", "code": "P3_TEST_12PCT", "description": "12pct",
        "gst_rate": 12.0, "cgst_rate": 6.0, "sgst_rate": 6.0, "igst_rate": 12.0,
        "cess_rate": 0.0, "taxability": "taxable", "itc_eligible": True,
        "effective_from": "2026-04-01", "effective_to": "",
        "active": True, "created_at": "", "updated_at": "",
    })
    payload = {
        "invoice_date": "2026-08-01",
        "customer": {"name": "Probe", "gstin": "", "state_code": "20", "state": "Jharkhand"},
        "place_of_supply_code": "20", "place_of_supply_state": "Jharkhand",
        "line_items": [{
            "description": "x", "hsn": "P3_TEST_12PCT", "quantity": 1,
            "unit": "Nos", "rate": 100, "discount": 0, "tax_rate": 18, "price_type": "exclusive",
        }],
    }
    r = requests.post(f"{BASE}/invoices", headers=hdr, json=payload)
    assert r.status_code == 400 and "configured at 12" in r.text
    assert db.invoices.count_documents({}) == 1  # no invoice created


def test_hsn_missing_from_master_is_allowed(hdr, db, baseline_invoice):
    """If HSN is not in master, we don't enforce (user-driven rate is trusted)."""
    payload = {
        "invoice_date": "2026-08-01",
        "customer": {"name": "Probe", "gstin": "", "state_code": "24", "state": "Gujarat"},
        "place_of_supply_code": "24", "place_of_supply_state": "Gujarat",
        "line_items": [{
            "description": "x", "hsn": "NOT_IN_MASTER_XYZ", "quantity": 1,
            "unit": "Nos", "rate": 100, "discount": 0, "tax_rate": 18, "price_type": "exclusive",
        }],
    }
    # Would succeed and create an invoice → we DON'T want that. So we mock by
    # attempting the POST inside a lambda but immediately deleting created record
    # if it slipped through. But since we can't easily prevent counter increment,
    # we instead assert the validator function directly.
    import importlib.util, asyncio
    spec = importlib.util.spec_from_file_location("srv2", "/app/backend/server.py")
    srv = importlib.util.module_from_spec(spec); spec.loader.exec_module(srv)
    LI = srv.LineItem
    li = [LI(description="x", hsn="NOT_IN_MASTER_XYZ", quantity=1, rate=100,
             discount=0, tax_rate=18, price_type="exclusive")]
    # Should NOT raise
    asyncio.run(srv._validate_hsn_effective(li, "2026-08-01"))


# ---------- Purchase Register + ITC calculation (uses safe mocked bill) ----------
def test_purchase_register_and_itc(hdr, db, baseline_invoice):
    """Create a temporary expense bill, verify Purchase Register + ITC calc, delete."""
    payload = {
        "vendor_name": "P3_TEST_VENDOR", "vendor_gstin": "27ABCDE1234F1Z5",
        "vendor_state": "Maharashtra", "vendor_state_code": "27",
        "place_of_supply_code": "24", "place_of_supply_state": "Gujarat",
        "reverse_charge": False,
        "bill_number": "P3_TEST_B1", "bill_date": "2026-08-15", "category": "Other",
        "itc_eligible": True,
        "line_items": [
            {"description": "Line A eligible", "hsn": "998313", "quantity": 1, "unit": "Nos",
             "rate": 1000, "tax_rate": 18, "price_type": "exclusive",
             "itc_eligibility": "eligible", "itc_eligible_pct": 100},
            {"description": "Line B ineligible", "hsn": "998313", "quantity": 1, "unit": "Nos",
             "rate": 500, "tax_rate": 18, "price_type": "exclusive",
             "itc_eligibility": "ineligible", "itc_eligible_pct": 0},
            {"description": "Line C partial", "hsn": "998313", "quantity": 1, "unit": "Nos",
             "rate": 500, "tax_rate": 18, "price_type": "exclusive",
             "itc_eligibility": "partial", "itc_eligible_pct": 60},
        ],
    }
    r = requests.post(f"{BASE}/expenses", headers=hdr, json=payload)
    assert r.status_code == 200, r.text
    exp = r.json()
    try:
        # Vendor state 27 vs supplier 24 → IGST-only expense
        assert exp["igst"] > 0 and exp["cgst"] == 0 and exp["sgst"] == 0
        expected_eligible = 180 + 0 + 90 * 0.6  # 180 + 54 = 234
        expected_ineligible = 0 + 90 + 90 * 0.4  # 90 + 36 = 126
        assert abs(exp["itc_eligible_amount"] - expected_eligible) < 1
        assert abs(exp["itc_ineligible_amount"] - expected_ineligible) < 1
        # Purchase register lists it
        rr = requests.get(f"{BASE}/reports/gst-purchase-register", headers=hdr)
        rows = rr.json()["rows"]
        my_rows = [x for x in rows if x["bill_number"] == "P3_TEST_B1"]
        assert len(my_rows) == 3
        assert sum(x["itc_eligible"] for x in my_rows) == pytest.approx(expected_eligible, abs=1)
        assert sum(x["itc_ineligible"] for x in my_rows) == pytest.approx(expected_ineligible, abs=1)
        # CSV export
        rc = requests.get(f"{BASE}/reports/gst-purchase-register?fmt=csv", headers=hdr)
        assert rc.status_code == 200 and "P3_TEST_B1" in rc.text
        # ITC eligibility filter
        rf = requests.get(f"{BASE}/reports/gst-purchase-register?itc_eligibility=ineligible", headers=hdr)
        assert all(x["itc_eligibility"] == "ineligible" for x in rf.json()["rows"])
    finally:
        # Cleanup
        requests.delete(f"{BASE}/expenses/{exp['id']}", headers=hdr)
    # verify invoice still identical
    after = db.invoices.find_one({"invoice_number": "TE/2026-27/0001"}, {"_id": 0})
    for k in ("invoice_number", "taxable_amount", "grand_total"):
        assert after[k] == baseline_invoice[k]


# ---------- GST Summary ----------
def test_gst_summary_indicative_position(hdr):
    r = requests.get(f"{BASE}/reports/gst-summary", headers=hdr)
    d = r.json()
    assert r.status_code == 200
    assert d["invoice_count"] >= 1
    assert d["output"]["total"] == pytest.approx(6742.37, abs=0.02)
    assert d["position"]["indicative_net_gst"] == pytest.approx(6742.37, abs=0.02)
    assert "management" in d["disclaimer"].lower()


# ---------- GSTR-1 Working Export ----------
def test_gstr1_working_export(hdr):
    r = requests.get(f"{BASE}/reports/gstr1-working", headers=hdr)
    assert r.status_code == 200
    d = r.json()
    assert d["count"] >= 1
    assert "portal-ready" in d["disclaimer"].lower() or "NOT a portal" in d["disclaimer"]
    assert isinstance(d["missing_fields_for_portal_json"], list) and len(d["missing_fields_for_portal_json"]) >= 3
    # CSV format
    rc = requests.get(f"{BASE}/reports/gstr1-working?fmt=csv", headers=hdr)
    assert rc.status_code == 200 and "TE/2026-27/0001" in rc.text


# ---------- Regression: expense engine handles multi-rate + intra vs inter ----------
def test_expense_engine_direct():
    import importlib.util
    spec = importlib.util.spec_from_file_location("srv3", "/app/backend/server.py")
    srv = importlib.util.module_from_spec(spec); spec.loader.exec_module(srv)
    L = srv.ExpenseLine
    # Gujarat vendor → Gujarat PoS = intra
    t1 = srv.compute_expense_totals(
        "24ABCDE1234F1Z5",
        [L(description="x", hsn="", quantity=1, unit="Nos", rate=1000, tax_rate=18,
           price_type="exclusive", itc_eligibility="eligible", itc_eligible_pct=100)],
        place_of_supply_code="24", supplier_state_code="24", vendor_state_code="24"
    )
    assert t1["is_intra_state"] is True and t1["cgst"] == 90 and t1["sgst"] == 90
    # Inter-state vendor (Maharashtra) → Gujarat delivery ⇒ vendor charges IGST, ITC partial 40%
    t2 = srv.compute_expense_totals(
        "27ABCDE1234F1Z5",
        [L(description="x", hsn="", quantity=1, unit="Nos", rate=1000, tax_rate=18,
           price_type="exclusive", itc_eligibility="partial", itc_eligible_pct=40)],
        place_of_supply_code="24", supplier_state_code="24", vendor_state_code="27"
    )
    assert t2["is_intra_state"] is False  # vendor 27 ≠ PoS 24 → inter-state
    assert t2["igst"] == 180 and t2["cgst"] == 0
    assert t2["itc_eligible_amount"] == pytest.approx(180 * 0.4, abs=0.1)
    assert t2["itc_ineligible_amount"] == pytest.approx(180 * 0.6, abs=0.1)


def test_final_invoice_state_unchanged(db, baseline_invoice):
    """Final guard: after the entire suite runs, the invoice must be byte-identical."""
    after = db.invoices.find_one({"invoice_number": "TE/2026-27/0001"}, {"_id": 0})
    for k, v in baseline_invoice.items():
        assert after.get(k) == v, f"{k} changed: {baseline_invoice[k]} -> {after.get(k)}"
    assert db.invoices.count_documents({}) == 1
    assert db.credit_notes.count_documents({}) == 0
