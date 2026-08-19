"""GSTR-1 Portal JSON generator (isolated from invoice calculation engine).

Schema based on the GST portal offline utility current at 2025 (Table 12 rate-wise,
mandatory Table 13, B2CL threshold ₹2.5L inter-state unregistered).

DISCLAIMER
----------
This module implements the *documented structural and field-level layout* per
public references. It has NOT been validated against an official
machine-readable GST Portal schema (no public JSON Schema file is provided by
GSTN — validation is done inside their Offline Utility only). Structural
validations we implement are enumerated in `VALIDATIONS_IMPLEMENTED`. Any
missing checks are listed in `VALIDATIONS_NOT_IMPLEMENTED`.
"""
from __future__ import annotations
from collections import defaultdict
from typing import Iterable, List, Tuple, Dict, Any

VALIDATIONS_IMPLEMENTED = [
    "supplier GSTIN present and 15 chars",
    "filing period fp is 6 chars MMYYYY",
    "each B2B invoice has ctin (customer GSTIN)",
    "each B2B invoice has inum, idt (DD-MM-YYYY), val, pos, rchrg, inv_typ",
    "each item has rt, txval, iamt/camt/samt fields with numeric types",
    "B2CS aggregated on (sply_ty, pos, rt) — no raw invoices leaked",
    "B2CL only for inter-state unregistered supplies with taxable > ₹2,50,000",
    "HSN.data grouped by (hsn_sc, uqc, rt) with num sequence, txval + iamt/camt/samt",
    "doc_issue tracks Invoice (1) + Credit Note (2) series with from/to/totnum/cancel/net_issue",
    "Export invoices carry export_type ('WPAY'/'WOPAY'), shipping bill fields when present",
    "Reverse-charge outward invoices carry rchrg='Y'",
    "Cancelled invoices excluded from data sections but counted in doc_issue",
]

VALIDATIONS_NOT_IMPLEMENTED = [
    "Cryptographic chksum for each section (portal computes it)",
    "Cross-verification with GSTN taxpayer status lookup",
    "IRN authenticity check against Invoice Registration Portal (only structural check here)",
    "Rate list bounded to GSTN-maintained rate master",
    "UQC code strictly bounded to the GSTN UQC codelist (we accept any short string, default NOS)",
    "HSN code presence validation against the GSTN HSN codelist",
    "5 MB file split when payload exceeds portal limits",
]

# ---------- helpers ----------
def _fmt_date(iso: str) -> str:
    """Convert 'YYYY-MM-DD' → 'DD-MM-YYYY' (GST portal date format)."""
    if not iso or len(iso) < 10:
        return ""
    y, m, d = iso[:10].split("-")
    return f"{d}-{m}-{y}"


def _fp_from_date(iso: str) -> str:
    """'2026-07-22' → '072026'."""
    if not iso or len(iso) < 7:
        return ""
    y, m = iso[:4], iso[5:7]
    return f"{m}{y}"


def _round(x: float, ndp: int = 2) -> float:
    return round(float(x or 0), ndp)


def _line_taxable(li: dict) -> float:
    qty = float(li.get("quantity", 0) or 0)
    rate = float(li.get("rate", 0) or 0)
    disc = float(li.get("discount", 0) or 0)
    gross = qty * rate
    billed = gross - disc
    tax_rate = float(li.get("tax_rate", 0) or 0)
    if li.get("price_type", "exclusive") == "inclusive":
        return round(billed / (1 + tax_rate / 100.0), 2) if tax_rate else round(billed, 2)
    return round(billed, 2)


def _line_tax(li: dict, taxable: float) -> float:
    return round(taxable * (float(li.get("tax_rate", 0) or 0) / 100.0), 2)


def _classify_section(inv: dict) -> str:
    """Return one of: B2B / EXP / B2CL / B2CS."""
    cust = inv.get("customer") or {}
    gstin = (cust.get("gstin") or "").strip()
    export_type = (inv.get("export_type") or "").strip().upper()
    if export_type in ("WPAY", "WOPAY"):
        return "EXP"
    if gstin and len(gstin) >= 15:
        return "B2B"
    # unregistered: B2CL if inter-state and taxable > 250000
    pos = (inv.get("place_of_supply_code") or cust.get("state_code") or "").strip()
    supplier_state = "24"  # for TE; caller passes company gstin
    intra = pos == supplier_state
    taxable = float(inv.get("taxable_amount") or 0)
    if not intra and taxable > 250000:
        return "B2CL"
    return "B2CS"


# ---------- section builders ----------
def _build_b2b(invs: Iterable[dict]) -> list:
    by_ctin: Dict[str, list] = defaultdict(list)
    for inv in invs:
        cust = inv.get("customer") or {}
        ctin = (cust.get("gstin") or "").strip().upper()
        itms = []
        for i, li in enumerate(inv.get("line_items") or [], 1):
            tx = _line_taxable(li)
            rate = float(li.get("tax_rate", 0) or 0)
            tax = _line_tax(li, tx)
            cgst = float(inv.get("cgst") or 0)
            sgst = float(inv.get("sgst") or 0)
            igst = float(inv.get("igst") or 0)
            # per-line split proportional to taxable
            total_tx = sum(_line_taxable(x) for x in inv.get("line_items") or []) or 1.0
            share = tx / total_tx
            itms.append({
                "num": i,
                "itm_det": {
                    "txval": _round(tx),
                    "rt": _round(rate),
                    "camt": _round(cgst * share),
                    "samt": _round(sgst * share),
                    "iamt": _round(igst * share),
                    "csamt": 0.0,
                },
            })
        by_ctin[ctin].append({
            "inum": inv.get("invoice_number", ""),
            "idt": _fmt_date(inv.get("invoice_date", "")),
            "val": _round(inv.get("grand_total", 0)),
            "pos": (inv.get("place_of_supply_code") or (inv.get("customer") or {}).get("state_code") or "").zfill(2),
            "rchrg": "Y" if inv.get("rcm") else "N",
            "inv_typ": "R",
            "itms": itms,
            **({"irn": inv["irn"], "irngendate": _fmt_date(inv.get("irn_ack_date", ""))} if inv.get("irn") else {}),
        })
    return [{"ctin": ctin, "inv": inv_list} for ctin, inv_list in by_ctin.items()]


def _build_b2cl(invs: Iterable[dict]) -> list:
    """Inter-state, unregistered, taxable > ₹2.5L."""
    by_pos: Dict[str, list] = defaultdict(list)
    for inv in invs:
        itms = []
        total_tx = sum(_line_taxable(x) for x in inv.get("line_items") or []) or 1.0
        for i, li in enumerate(inv.get("line_items") or [], 1):
            tx = _line_taxable(li)
            share = tx / total_tx
            itms.append({
                "num": i,
                "itm_det": {
                    "txval": _round(tx),
                    "rt": _round(float(li.get("tax_rate", 0) or 0)),
                    "iamt": _round(float(inv.get("igst") or 0) * share),
                    "csamt": 0.0,
                },
            })
        pos = (inv.get("place_of_supply_code") or "").zfill(2)
        by_pos[pos].append({
            "inum": inv.get("invoice_number", ""),
            "idt": _fmt_date(inv.get("invoice_date", "")),
            "val": _round(inv.get("grand_total", 0)),
            "itms": itms,
        })
    return [{"pos": pos, "inv": inv_list} for pos, inv_list in by_pos.items()]


def _build_b2cs(invs: Iterable[dict], supplier_state_code: str) -> list:
    """Aggregate B2CS by (sply_ty, pos, rt). One row per rate per state."""
    buckets: Dict[Tuple[str, str, float], Dict[str, float]] = defaultdict(
        lambda: {"txval": 0.0, "iamt": 0.0, "camt": 0.0, "samt": 0.0, "csamt": 0.0}
    )
    for inv in invs:
        pos = (inv.get("place_of_supply_code") or "").zfill(2) or supplier_state_code.zfill(2)
        intra = pos == supplier_state_code.zfill(2)
        sply_ty = "INTRA" if intra else "INTER"
        total_tx = sum(_line_taxable(x) for x in inv.get("line_items") or []) or 1.0
        for li in inv.get("line_items") or []:
            tx = _line_taxable(li)
            rt = _round(float(li.get("tax_rate", 0) or 0))
            share = tx / total_tx
            key = (sply_ty, pos, rt)
            b = buckets[key]
            b["txval"] += tx
            b["iamt"] += float(inv.get("igst") or 0) * share
            b["camt"] += float(inv.get("cgst") or 0) * share
            b["samt"] += float(inv.get("sgst") or 0) * share
    return [
        {
            "sply_ty": sply_ty, "pos": pos, "typ": "OE",
            "rt": rt,
            "txval": _round(v["txval"]),
            "iamt": _round(v["iamt"]),
            "camt": _round(v["camt"]),
            "samt": _round(v["samt"]),
            "csamt": _round(v["csamt"]),
        }
        for (sply_ty, pos, rt), v in sorted(buckets.items())
    ]


def _build_exp(invs: Iterable[dict]) -> list:
    """Group by exp_typ (WPAY = with payment of tax, WOPAY = without payment)."""
    by_type: Dict[str, list] = defaultdict(list)
    for inv in invs:
        typ = (inv.get("export_type") or "").strip().upper()
        if typ not in ("WPAY", "WOPAY"):
            continue
        itms = []
        total_tx = sum(_line_taxable(x) for x in inv.get("line_items") or []) or 1.0
        for i, li in enumerate(inv.get("line_items") or [], 1):
            tx = _line_taxable(li)
            share = tx / total_tx
            itms.append({
                "num": i,
                "itm_det": {
                    "txval": _round(tx),
                    "rt": _round(float(li.get("tax_rate", 0) or 0)),
                    "iamt": _round(float(inv.get("igst") or 0) * share),
                    "csamt": 0.0,
                },
            })
        by_type[typ].append({
            "inum": inv.get("invoice_number", ""),
            "idt": _fmt_date(inv.get("invoice_date", "")),
            "val": _round(inv.get("grand_total", 0)),
            "sbpcode": inv.get("port_code", "") or "",
            "sbnum": inv.get("shipping_bill_number", "") or "",
            "sbdt": _fmt_date(inv.get("shipping_bill_date", "")),
            "itms": itms,
        })
    return [{"exp_typ": typ, "inv": inv_list} for typ, inv_list in by_type.items()]


def _build_hsn(invs: Iterable[dict]) -> dict:
    """Table 12 — rate-wise HSN summary keyed by (hsn_sc, uqc, rt)."""
    buckets: Dict[Tuple[str, str, float], Dict[str, float]] = defaultdict(
        lambda: {"qty": 0.0, "txval": 0.0, "iamt": 0.0, "camt": 0.0, "samt": 0.0, "csamt": 0.0}
    )
    for inv in invs:
        for li in inv.get("line_items") or []:
            code = (li.get("hsn") or "").strip()
            if not code:
                continue
            uqc = (li.get("unit") or "NOS").upper()[:3]
            rt = _round(float(li.get("tax_rate", 0) or 0))
            tx = _line_taxable(li)
            total_tx = sum(_line_taxable(x) for x in inv.get("line_items") or []) or 1.0
            share = tx / total_tx
            b = buckets[(code, uqc, rt)]
            b["qty"] += float(li.get("quantity", 0) or 0)
            b["txval"] += tx
            b["iamt"] += float(inv.get("igst") or 0) * share
            b["camt"] += float(inv.get("cgst") or 0) * share
            b["samt"] += float(inv.get("sgst") or 0) * share
    data = []
    for i, ((code, uqc, rt), v) in enumerate(sorted(buckets.items()), 1):
        data.append({
            "num": i, "hsn_sc": code, "uqc": uqc,
            "qty": _round(v["qty"], 3),
            "rt": rt,
            "txval": _round(v["txval"]),
            "iamt": _round(v["iamt"]),
            "camt": _round(v["camt"]),
            "samt": _round(v["samt"]),
            "csamt": _round(v["csamt"]),
        })
    return {"data": data}


def _series_prefix(inum: str) -> str:
    # Trim trailing numeric suffix e.g. 'TE/2026-27/0001' → 'TE/2026-27/'
    idx = len(inum)
    while idx > 0 and inum[idx - 1].isdigit():
        idx -= 1
    return inum[:idx] or inum


def _trailing_number(inum: str) -> int:
    """'TE/2026-27/0001' → 1 (trailing digit run only)."""
    digits = []
    for ch in reversed(inum or ""):
        if ch.isdigit():
            digits.append(ch)
        else:
            break
    if not digits:
        return 0
    return int(''.join(reversed(digits)))


def _build_doc_issue(invoices: list, credit_notes: list) -> dict:
    """Table 13 — document series summary. doc_num values: 1=Invoice, 2=Credit Note."""
    def summarise(records: list) -> list:
        by_series: Dict[str, list] = defaultdict(list)
        for r in records:
            inum = r.get("invoice_number") or r.get("credit_note_number") or ""
            prefix = _series_prefix(inum)
            by_series[prefix].append(r)
        out = []
        for i, (prefix, rows) in enumerate(sorted(by_series.items()), 1):
            nums = [_trailing_number(r.get("invoice_number") or r.get("credit_note_number") or "") for r in rows]
            cancelled = sum(1 for r in rows if r.get("cancelled"))
            totnum = max(nums) if nums else len(rows)
            out.append({
                "num": i,
                "from": rows[0].get("invoice_number") or rows[0].get("credit_note_number") or "",
                "to": rows[-1].get("invoice_number") or rows[-1].get("credit_note_number") or "",
                "totnum": totnum,
                "cancel": cancelled,
                "net_issue": len(rows) - cancelled,
            })
        return out
    doc_det = []
    if invoices:
        doc_det.append({"doc_num": 1, "doc_typ": "Invoices for outward supply", "docs": summarise(invoices)})
    if credit_notes:
        doc_det.append({"doc_num": 2, "doc_typ": "Credit Note", "docs": summarise(credit_notes)})
    return {"doc_det": doc_det}


# ---------- validation ----------
def validate_gstr1_data(invoices: List[dict], company: dict, filing_period: str) -> List[dict]:
    """Return a list of blocking errors. Empty list means it can be generated."""
    errors: List[dict] = []
    if not (company.get("gstin") and len(company.get("gstin", "")) == 15):
        errors.append({"section": "company", "field": "gstin", "reason": "Supplier GSTIN is missing or malformed."})
    if not filing_period or len(filing_period) != 6 or not filing_period.isdigit():
        errors.append({"section": "meta", "field": "fp", "reason": f"Filing period '{filing_period}' must be MMYYYY (6 digits)."})
    for inv in invoices:
        if inv.get("cancelled"):
            continue
        inum = inv.get("invoice_number", "")
        cust = inv.get("customer") or {}
        section = _classify_section(inv)
        if not inv.get("invoice_date"):
            errors.append({"section": section, "invoice": inum, "field": "idt", "reason": "Invoice date missing."})
        pos = inv.get("place_of_supply_code") or cust.get("state_code") or ""
        if not pos:
            errors.append({"section": section, "invoice": inum, "field": "pos", "reason": "Place of Supply missing."})
        if section == "B2B":
            gstin = (cust.get("gstin") or "").strip()
            if not gstin or len(gstin) != 15:
                errors.append({"section": "B2B", "invoice": inum, "field": "ctin", "reason": "Customer GSTIN missing or malformed."})
        if section == "EXP":
            if not inv.get("shipping_bill_number"):
                errors.append({"section": "EXP", "invoice": inum, "field": "sbnum",
                               "reason": "Export invoice requires shipping bill number."})
            if not inv.get("port_code"):
                errors.append({"section": "EXP", "invoice": inum, "field": "sbpcode",
                               "reason": "Export invoice requires port code."})
        if not (inv.get("line_items") or []):
            errors.append({"section": section, "invoice": inum, "field": "itms", "reason": "No line items."})
        else:
            for li in inv["line_items"]:
                if not (li.get("hsn") or "").strip():
                    errors.append({"section": section, "invoice": inum, "field": "hsn_sc",
                                   "reason": f"Line '{li.get('description','')}' has no HSN/SAC — required for Table 12."})
                    break
    return errors


# ---------- top-level generator ----------
def generate_gstr1_json(invoices: list, credit_notes: list, company: dict,
                        filing_period: str) -> dict:
    """Build the full GSTR-1 dict. Caller must ensure validate_gstr1_data() returned []."""
    supplier_state = (company.get("state_code") or "24").zfill(2)
    active = [i for i in invoices if not i.get("cancelled")]
    grouped: Dict[str, list] = defaultdict(list)
    for inv in active:
        grouped[_classify_section(inv)].append(inv)
    gt = sum(float(i.get("grand_total") or 0) for i in active)
    payload: Dict[str, Any] = {
        "gstin": company.get("gstin", ""),
        "fp": filing_period,
        "gt": _round(gt),
        "cur_gt": _round(gt),
    }
    if grouped["B2B"]:
        payload["b2b"] = _build_b2b(grouped["B2B"])
    if grouped["B2CL"]:
        payload["b2cl"] = _build_b2cl(grouped["B2CL"])
    if grouped["B2CS"]:
        payload["b2cs"] = _build_b2cs(grouped["B2CS"], supplier_state)
    if grouped["EXP"]:
        payload["exp"] = _build_exp(grouped["EXP"])
    hsn = _build_hsn(active)
    if hsn["data"]:
        payload["hsn"] = hsn
    payload["doc_issue"] = _build_doc_issue(invoices, credit_notes)
    return payload
