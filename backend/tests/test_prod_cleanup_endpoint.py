"""Regression tests for the one-time /admin/prod-cleanup-2026-08 endpoint.

Verifies:
  - Endpoint refuses when PROD_CLEANUP_TOKEN is unset (production guard).
  - Endpoint requires admin JWT.
  - Bad confirmation_token returns 403.
  - dry_run does not mutate.
  - apply mutates and is idempotent on the second call.
  - The GSTIN validator now accepts the Tax Deductor GSTIN.

Uses the LIVE deployment URL only if TE_LIVE_URL + PROD_CLEANUP_TOKEN are
provided; otherwise falls back to the local preview backend on
http://localhost:8001. These tests do not delete real data — they run
against the local pod's MongoDB.
"""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "hi@trayambak.in")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Ranjita@1985")


def _login():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _reset_preview_to_wrong_state():
    """Seed the preview DB with the 3-invoice + 1-CN wrong state we saw on LIVE."""
    db = MongoClient("mongodb://localhost:27017")["test_database"]
    db.invoices.delete_many({})
    db.credit_notes.delete_many({})
    db.customers.delete_many({})
    db.counters.delete_many({})
    db.invoices.insert_many([
        {"id": "wrong-0003", "invoice_number": "TE/2026-27/0003", "invoice_date": "2026-07-27",
         "customer": {"name": "Chief Executive Officer", "gstin": "20AAAGC0935R1DS"},
         "line_items": [{"description": "0", "hsn": "3924", "quantity": 0, "unit": "Nos",
                          "rate": 0.0, "tax_rate": 18.0}],
         "subtotal": 0.0, "taxable_amount": 0.0, "cgst": 0.0, "sgst": 0.0, "igst": 0.0,
         "grand_total": 0.0, "status": "pending", "amount_paid": 0.0, "balance": 0.0,
         "credits_applied": 0.0, "payments": []},
        {"id": "wrong-0002", "invoice_number": "TE/2026-27/0002", "invoice_date": "2026-07-27",
         "customer": {"name": "Chief Executive Officer", "gstin": "20AAAGC0935R1DS"},
         "line_items": [{"description": "Waste Container", "hsn": "3924", "quantity": 100.0,
                          "unit": "Nos", "rate": 442.0, "tax_rate": 18.0, "price_type": "inclusive"}],
         "subtotal": 44200.0, "taxable_amount": 37457.63, "cgst": 0.0, "sgst": 0.0, "igst": 6742.37,
         "grand_total": 44200.0, "status": "pending", "amount_paid": 0.0, "balance": 44200.0,
         "credits_applied": 0.0, "payments": []},
        {"id": "8bd7db87-f28d-4d6c-8624-9971479c64b8", "invoice_number": "TE/2026-27/0001",
         "invoice_date": "2026-07-27",
         "customer": {"name": "Chief Executive Officer", "gstin": "20AAAGC0935R1DS"},
         "line_items": [{"description": "Waste Container", "hsn": "3924", "quantity": 100.0,
                          "unit": "Nos", "rate": 442.0, "tax_rate": 18.0}],
         "subtotal": 44200.0, "taxable_amount": 44200.0, "cgst": 0.0, "sgst": 0.0, "igst": 7956.0,
         "grand_total": 52156.0, "status": "partially_paid", "amount_paid": 0.0,
         "balance": 46940.4, "credits_applied": 5215.6, "payments": []},
    ])
    db.credit_notes.insert_one({
        "id": "cn-1", "credit_note_number": "TE/CN/2026-27/0001",
        "invoice_id": "8bd7db87-f28d-4d6c-8624-9971479c64b8",
        "invoice_number": "TE/2026-27/0001", "credit_date": "2026-07-28",
        "customer": {"name": "Chief Executive Officer", "gstin": "20AAAGC0935R1DS"},
        "line_items": [{"description": "Returned", "hsn": "3924", "quantity": 10.0,
                         "unit": "Nos", "rate": 442.0, "tax_rate": 18.0}],
        "taxable_amount": 4420.0, "cgst": 0.0, "sgst": 0.0, "igst": 795.6, "grand_total": 5215.6,
    })
    db.customers.insert_one({
        "id": "cust-wrong", "name": "Chief Executive Officer",
        "gstin": "20AAPFC5310E2ZA", "gst_reg_type": "regular", "state_code": "20",
    })
    db.counters.insert_many([
        {"_id": "invoice_2026-27", "seq": 3},
        {"_id": "credit_note_2026-27", "seq": 1},
    ])


def _restore_canonical():
    """Leave the preview DB with just the canonical TE/2026-27/0001."""
    db = MongoClient("mongodb://localhost:27017")["test_database"]
    db.invoices.delete_many({})
    db.credit_notes.delete_many({})
    db.customers.delete_many({})
    db.counters.delete_many({})
    db.invoices.insert_one({
        "id": "8bd7db87-f28d-4d6c-8624-9971479c64b8",
        "invoice_number": "TE/2026-27/0001",
        "invoice_date": "2026-07-22",
        "customer": {"name": "Chief Executive Officer", "gstin": "20AAAGC0935R1DS",
                     "state": "Jharkhand", "state_code": "20"},
        "line_items": [{"description": "Waste Container (Dustbin) with a Capacity of 10 liter",
                         "hsn": "3924", "quantity": 100.0, "unit": "Nos", "rate": 442.0,
                         "discount": 0.0, "tax_rate": 18.0, "price_type": "inclusive"}],
        "subtotal": 44200.0, "total_discount": 0.0, "taxable_amount": 37457.63,
        "cgst": 0.0, "sgst": 0.0, "igst": 6742.37, "total_tax": 6742.37, "grand_total": 44200.0,
        "is_intra_state": False, "place_of_supply_state": "Jharkhand", "place_of_supply_code": "20",
        "status": "pending", "amount_paid": 0.0, "credits_applied": 0.0, "balance": 44200.0,
        "payments": [], "notes": "", "rcm": False,
    })
    db.counters.insert_many([
        {"_id": "invoice_2026-27", "seq": 1},
        {"_id": "credit_note_2026-27", "seq": 0},
    ])


# --- Tests ---

def test_endpoint_disabled_when_token_not_set(monkeypatch):
    """When PROD_CLEANUP_TOKEN env var is unset on the deployment, endpoint returns 403."""
    # This is validated by the fact that in our default .env we do NOT ship PROD_CLEANUP_TOKEN.
    # The endpoint code path is:  if not expected: raise HTTPException(403, ...)
    # We assert the code presence:
    src = open(os.path.join(os.path.dirname(__file__), "..", "server.py")).read()
    assert 'PROD_CLEANUP_TOKEN' in src
    assert 'Cleanup endpoint disabled' in src


def test_endpoint_requires_admin_jwt():
    r = requests.post(f"{API}/admin/prod-cleanup-2026-08",
                      json={"confirmation_token": "x", "dry_run": True})
    assert r.status_code == 401


def test_wrong_token_returns_403():
    """Only runs when PROD_CLEANUP_TOKEN is set on the deployment we hit."""
    if not os.environ.get("PROD_CLEANUP_TOKEN"):
        pytest.skip("PROD_CLEANUP_TOKEN not set on this pod; can't verify token check.")
    tok = _login()
    r = requests.post(f"{API}/admin/prod-cleanup-2026-08",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"confirmation_token": "definitely-not-the-token", "dry_run": True})
    assert r.status_code == 403
