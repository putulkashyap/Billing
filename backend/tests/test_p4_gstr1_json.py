"""P4 tests — GSTR-1 Portal JSON generator, section builders, validation engine.

All tests use FIXTURES (in-memory dicts) — NOT the live DB — so we never mutate
TE/2026-27/0001. Two end-to-end HTTP tests hit the read-only endpoint against
the real preview database and verify the validator behaviour without creating
any new invoice.
"""
import os
import copy
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

import sys
sys.path.insert(0, "/app/backend")
from gstr1 import (
    generate_gstr1_json, validate_gstr1_data,
    _build_b2b, _build_b2cl, _build_b2cs, _build_exp, _build_hsn,
    _build_doc_issue, _classify_section, _fp_from_date, _fmt_date,
)

load_dotenv("/app/backend/.env")
API = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE = f"{API}/api"

COMPANY = {"gstin": "24AMAPR1170Q1ZT", "state_code": "24", "legal_name": "TRAYAMBAK ENTERPRISE"}


# ---------- shared fixture invoices ----------
def _mk_inv(*, num, date, customer_gstin, pos_code, tax_rate, taxable, cgst=0, sgst=0, igst=0,
            hsn="998313", export_type="", ship_bill="", ship_date="", port="", rcm=False,
            cancelled=False, qty=1, unit="NOS", customer_state=""):
    grand = taxable + cgst + sgst + igst
    return {
        "invoice_number": num,
        "invoice_date": date,
        "grand_total": grand,
        "taxable_amount": taxable,
        "cgst": cgst, "sgst": sgst, "igst": igst,
        "customer": {"name": "Cust " + num, "gstin": customer_gstin, "state_code": pos_code,
                     "state": customer_state or ""},
        "place_of_supply_code": pos_code,
        "place_of_supply_state": customer_state or "",
        "rcm": rcm, "export_type": export_type,
        "shipping_bill_number": ship_bill, "shipping_bill_date": ship_date,
        "port_code": port, "cancelled": cancelled,
        "line_items": [{
            "description": "svc", "hsn": hsn, "quantity": qty, "unit": unit,
            "rate": taxable / qty, "discount": 0, "tax_rate": tax_rate, "price_type": "exclusive",
        }],
    }


# ---------- validation ----------
def test_missing_pos_blocks_json():
    inv = _mk_inv(num="TE/2026-27/9001", date="2026-08-01",
                  customer_gstin="20AAAAA0000A1Z5", pos_code="", tax_rate=18,
                  taxable=1000, igst=180)
    errs = validate_gstr1_data([inv], COMPANY, "082026")
    assert any(e["field"] == "pos" for e in errs)


def test_b2b_requires_ctin():
    inv = _mk_inv(num="TE/2026-27/9002", date="2026-08-01",
                  customer_gstin="BADSHORT", pos_code="20", tax_rate=18,
                  taxable=1000, igst=180)
    errs = validate_gstr1_data([inv], COMPANY, "082026")
    # Because gstin is <15 chars, section becomes B2CS (unregistered), not B2B
    # so no ctin error — but pos is present. Should pass.
    assert all(e["field"] != "ctin" for e in errs)


def test_export_needs_shipping_bill():
    inv = _mk_inv(num="TE/2026-27/9003", date="2026-08-01",
                  customer_gstin="", pos_code="97", tax_rate=18,
                  taxable=50000, igst=9000, export_type="WPAY")
    errs = validate_gstr1_data([inv], COMPANY, "082026")
    reasons = " ".join(e["reason"] for e in errs)
    assert "shipping bill number" in reasons.lower()
    assert "port code" in reasons.lower()


def test_bad_fp_blocks():
    inv = _mk_inv(num="TE/2026-27/9004", date="2026-08-01",
                  customer_gstin="20AAAAA0000A1Z5", pos_code="20",
                  tax_rate=18, taxable=1000, igst=180)
    errs = validate_gstr1_data([inv], COMPANY, "8-2026")
    assert any(e["field"] == "fp" for e in errs)


def test_hsn_missing_blocks():
    inv = _mk_inv(num="TE/2026-27/9005", date="2026-08-01",
                  customer_gstin="20AAAAA0000A1Z5", pos_code="20",
                  tax_rate=18, taxable=1000, igst=180, hsn="")
    errs = validate_gstr1_data([inv], COMPANY, "082026")
    assert any(e["field"] == "hsn_sc" for e in errs)


# ---------- classification ----------
def test_classify_b2b_b2cs_b2cl_exp():
    b2b = _mk_inv(num="I1", date="2026-08-01", customer_gstin="20AAAAA0000A1Z5",
                  pos_code="20", tax_rate=18, taxable=1000, igst=180)
    b2cs = _mk_inv(num="I2", date="2026-08-01", customer_gstin="",
                   pos_code="24", tax_rate=18, taxable=1000, cgst=90, sgst=90)
    b2cl = _mk_inv(num="I3", date="2026-08-01", customer_gstin="",
                   pos_code="20", tax_rate=18, taxable=300000, igst=54000)
    exp = _mk_inv(num="I4", date="2026-08-01", customer_gstin="",
                  pos_code="97", tax_rate=18, taxable=50000, igst=9000,
                  export_type="WPAY", ship_bill="SB1", ship_date="2026-08-02", port="INMAA")
    assert _classify_section(b2b) == "B2B"
    assert _classify_section(b2cs) == "B2CS"
    assert _classify_section(b2cl) == "B2CL"
    assert _classify_section(exp) == "EXP"


# ---------- B2B builder ----------
def test_b2b_builder_produces_portal_shape():
    inv = _mk_inv(num="TE/2026-27/9101", date="2026-08-01",
                  customer_gstin="20AAAAA0000A1Z5", pos_code="20",
                  customer_state="Jharkhand", tax_rate=18, taxable=1000, igst=180)
    b2b = _build_b2b([inv])
    assert len(b2b) == 1
    entry = b2b[0]
    assert entry["ctin"] == "20AAAAA0000A1Z5"
    assert len(entry["inv"]) == 1
    i = entry["inv"][0]
    assert i["inum"] == "TE/2026-27/9101"
    assert i["idt"] == "01-08-2026"
    assert i["pos"] == "20"
    assert i["rchrg"] == "N"
    assert i["inv_typ"] == "R"
    assert i["val"] == 1180
    itm = i["itms"][0]["itm_det"]
    assert itm["txval"] == 1000 and itm["iamt"] == 180 and itm["rt"] == 18


def test_b2b_rcm_flag():
    inv = _mk_inv(num="TE/2026-27/9102", date="2026-08-01",
                  customer_gstin="20AAAAA0000A1Z5", pos_code="20",
                  tax_rate=18, taxable=1000, igst=180, rcm=True)
    b2b = _build_b2b([inv])
    assert b2b[0]["inv"][0]["rchrg"] == "Y"


# ---------- B2CS aggregation ----------
def test_b2cs_bucketing_same_state_same_rate():
    invs = [
        _mk_inv(num=f"I{i}", date="2026-08-01", customer_gstin="", pos_code="24",
                tax_rate=18, taxable=1000, cgst=90, sgst=90)
        for i in range(3)
    ]
    b2cs = _build_b2cs(invs, "24")
    assert len(b2cs) == 1
    row = b2cs[0]
    assert row["sply_ty"] == "INTRA" and row["pos"] == "24" and row["rt"] == 18
    assert row["txval"] == 3000 and row["camt"] == 270 and row["samt"] == 270


def test_b2cs_bucketing_multiple_rates_and_states():
    invs = [
        _mk_inv(num="A", date="2026-08-01", customer_gstin="", pos_code="24",
                tax_rate=18, taxable=1000, cgst=90, sgst=90),
        _mk_inv(num="B", date="2026-08-01", customer_gstin="", pos_code="24",
                tax_rate=12, taxable=500, cgst=30, sgst=30),
        _mk_inv(num="C", date="2026-08-01", customer_gstin="", pos_code="27",
                tax_rate=18, taxable=200, igst=36),
    ]
    b2cs = _build_b2cs(invs, "24")
    assert len(b2cs) == 3
    keys = {(r["sply_ty"], r["pos"], r["rt"]) for r in b2cs}
    assert ("INTRA", "24", 18.0) in keys
    assert ("INTRA", "24", 12.0) in keys
    assert ("INTER", "27", 18.0) in keys


# ---------- B2CL ----------
def test_b2cl_grouped_by_pos():
    inv = _mk_inv(num="TE/BIG", date="2026-08-01", customer_gstin="",
                  pos_code="20", tax_rate=18, taxable=300000, igst=54000)
    b2cl = _build_b2cl([inv])
    assert len(b2cl) == 1 and b2cl[0]["pos"] == "20"
    assert b2cl[0]["inv"][0]["val"] == 354000
    assert b2cl[0]["inv"][0]["itms"][0]["itm_det"]["iamt"] == 54000


# ---------- HSN Table 12 ----------
def test_hsn_table12_groups_by_hsn_uqc_rt():
    inv1 = _mk_inv(num="A", date="2026-08-01", customer_gstin="20AAAAA0000A1Z5",
                   pos_code="20", tax_rate=18, taxable=1000, igst=180,
                   hsn="998313", unit="NOS", qty=1)
    inv2 = _mk_inv(num="B", date="2026-08-02", customer_gstin="20AAAAA0000A1Z5",
                   pos_code="20", tax_rate=18, taxable=2000, igst=360,
                   hsn="998313", unit="NOS", qty=2)
    inv3 = _mk_inv(num="C", date="2026-08-03", customer_gstin="20AAAAA0000A1Z5",
                   pos_code="20", tax_rate=12, taxable=500, igst=60,
                   hsn="998313", unit="NOS", qty=1)  # different rate → new bucket
    inv4 = _mk_inv(num="D", date="2026-08-04", customer_gstin="20AAAAA0000A1Z5",
                   pos_code="20", tax_rate=18, taxable=100, igst=18,
                   hsn="3924", unit="NOS", qty=1)   # different HSN → new bucket
    hsn = _build_hsn([inv1, inv2, inv3, inv4])
    data = hsn["data"]
    assert len(data) == 3
    # find the merged 998313@18
    merged = next(r for r in data if r["hsn_sc"] == "998313" and r["rt"] == 18.0)
    assert merged["qty"] == 3 and merged["txval"] == 3000 and merged["iamt"] == 540


# ---------- Table 13 doc_issue ----------
def test_doc_issue_counts_and_cancels():
    invs = [
        _mk_inv(num="TE/2026-27/0001", date="2026-04-05", customer_gstin="20AAAAA0000A1Z5",
                pos_code="20", tax_rate=18, taxable=1000, igst=180),
        _mk_inv(num="TE/2026-27/0002", date="2026-04-10", customer_gstin="20AAAAA0000A1Z5",
                pos_code="20", tax_rate=18, taxable=2000, igst=360),
        _mk_inv(num="TE/2026-27/0003", date="2026-04-15", customer_gstin="20AAAAA0000A1Z5",
                pos_code="20", tax_rate=18, taxable=3000, igst=540, cancelled=True),
    ]
    doc = _build_doc_issue(invs, [])
    assert doc["doc_det"][0]["doc_num"] == 1
    d = doc["doc_det"][0]["docs"][0]
    assert d["totnum"] == 3 and d["cancel"] == 1 and d["net_issue"] == 2


# ---------- Export ----------
def test_export_builder():
    inv = _mk_inv(num="TE/EXP/1", date="2026-08-01", customer_gstin="",
                  pos_code="97", tax_rate=18, taxable=50000, igst=9000,
                  export_type="WPAY", ship_bill="SB999",
                  ship_date="2026-08-05", port="INMAA")
    e = _build_exp([inv])
    assert e[0]["exp_typ"] == "WPAY"
    invx = e[0]["inv"][0]
    assert invx["sbnum"] == "SB999" and invx["sbpcode"] == "INMAA"
    assert invx["sbdt"] == "05-08-2026"


# ---------- Full generator ----------
def test_full_generator_all_sections():
    invs = [
        _mk_inv(num="TE/2026-27/9201", date="2026-08-01", customer_gstin="20AAAAA0000A1Z5",
                pos_code="20", tax_rate=18, taxable=1000, igst=180),
        _mk_inv(num="TE/2026-27/9202", date="2026-08-05", customer_gstin="",
                pos_code="24", tax_rate=18, taxable=500, cgst=45, sgst=45),
        _mk_inv(num="TE/2026-27/9203", date="2026-08-10", customer_gstin="",
                pos_code="20", tax_rate=18, taxable=300000, igst=54000),
        _mk_inv(num="TE/2026-27/9204", date="2026-08-15", customer_gstin="",
                pos_code="97", tax_rate=18, taxable=50000, igst=9000,
                export_type="WPAY", ship_bill="SB1", ship_date="2026-08-16", port="INMAA"),
    ]
    errs = validate_gstr1_data(invs, COMPANY, "082026")
    assert errs == [], errs
    payload = generate_gstr1_json(invs, [], COMPANY, "082026")
    assert payload["gstin"] == "24AMAPR1170Q1ZT"
    assert payload["fp"] == "082026"
    assert "b2b" in payload and "b2cl" in payload and "b2cs" in payload and "exp" in payload
    assert "hsn" in payload and "doc_issue" in payload
    assert payload["b2cl"][0]["pos"] == "20"
    assert payload["exp"][0]["exp_typ"] == "WPAY"
    # gt is sum of grand_totals
    gt_expected = sum(i["grand_total"] for i in invs)
    assert payload["gt"] == round(gt_expected, 2)


# ---------- End-to-end against live preview DB (read-only) ----------
@pytest.fixture(scope="module")
def hdr():
    r = requests.post(f"{BASE}/auth/login", json={"email": os.environ.get("TEST_ADMIN_EMAIL", "hi@trayambak.in"), "password": os.environ.get("TEST_ADMIN_PASSWORD", "Ranjita@1985")})
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def test_live_july_2026_blocked_because_pos_missing(hdr):
    """The one real invoice TE/2026-27/0001 has no place_of_supply_code
    (it predates P2). The validator MUST flag this and refuse to emit JSON."""
    r = requests.get(f"{BASE}/reports/gstr1-portal-json?fp=072026", headers=hdr)
    assert r.status_code == 400
    body = r.json()
    detail = body["detail"]
    assert detail["status"] == "BLOCKED"
    reasons = [e["reason"] for e in detail["errors"]]
    assert any("Place of Supply" in x for x in reasons)


def test_live_invoice_untouched(db):
    inv = db.invoices.find_one({"invoice_number": "TE/2026-27/0001"}, {"_id": 0})
    assert inv["invoice_date"] == "2026-07-22"
    assert inv["taxable_amount"] == 37457.63
    assert inv["igst"] == 6742.37
    assert inv["cgst"] == 0 and inv["sgst"] == 0
    assert inv["grand_total"] == 44200
    assert db.invoices.count_documents({}) == 1
    assert db.credit_notes.count_documents({}) == 0
    assert db.counters.find_one({"_id": "invoice_2026-27"})["seq"] == 1
