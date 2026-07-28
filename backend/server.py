"""TRAYAMBAK ENTERPRISE — GST Billing & Reconciliation Backend."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
import mimetypes
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from urllib.parse import quote

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'trayambak-dev-secret-change-me')
JWT_ALGO = 'HS256'
JWT_EXPIRE_HOURS = 24 * 7

app = FastAPI(title="Trayambak GST Billing API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logger = logging.getLogger("trayambak")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


# ---------- Utilities ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------- Models ----------
class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: str
    role: Literal["admin", "staff"]
    created_at: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: Literal["admin", "staff"] = "staff"


class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    gstin: Optional[str] = ""
    state_code: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class CustomerCreate(BaseModel):
    name: str
    gstin: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""


class LineItem(BaseModel):
    description: str
    hsn: Optional[str] = ""
    quantity: float
    unit: str = "Nos"
    rate: float
    discount: float = 0.0  # absolute amount
    tax_rate: float = 18.0  # percent
    price_type: Literal["exclusive", "inclusive"] = "exclusive"


class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    amount: float
    payment_date: str
    method: str = "Bank Transfer"  # UTR, Cheque, Cash, UPI
    reference: Optional[str] = ""
    notes: Optional[str] = ""
    logged_at: str = Field(default_factory=now_iso)


class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    order_type: Literal["gem", "regular"] = "regular"
    # GeM fields
    gem_contract_no: Optional[str] = ""
    gem_order_date: Optional[str] = ""
    buyer_department: Optional[str] = ""
    delivery_date: Optional[str] = ""
    # Regular fields
    po_number: Optional[str] = ""
    reference_date: Optional[str] = ""
    # Common
    invoice_date: str
    customer: dict  # snapshot
    line_items: List[dict]
    subtotal: float
    total_discount: float
    taxable_amount: float
    cgst: float
    sgst: float
    igst: float
    total_tax: float
    grand_total: float
    is_intra_state: bool
    notes: Optional[str] = ""
    status: Literal["pending", "partially_paid", "paid"] = "pending"
    amount_paid: float = 0.0
    credits_applied: float = 0.0
    balance: float = 0.0
    payments: List[dict] = []
    created_by: str = ""
    created_at: str = Field(default_factory=now_iso)


class InvoiceCreate(BaseModel):
    order_type: Literal["gem", "regular"] = "regular"
    gem_contract_no: Optional[str] = ""
    gem_order_date: Optional[str] = ""
    buyer_department: Optional[str] = ""
    delivery_date: Optional[str] = ""
    po_number: Optional[str] = ""
    reference_date: Optional[str] = ""
    invoice_date: str
    customer: dict
    line_items: List[LineItem]
    notes: Optional[str] = ""


class PaymentCreate(BaseModel):
    amount: float
    payment_date: str
    method: str = "Bank Transfer"
    reference: Optional[str] = ""
    notes: Optional[str] = ""


class CreditNote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    credit_note_number: str
    invoice_id: str
    invoice_number: str
    credit_date: str
    reason: str = ""
    customer: dict  # snapshot from invoice
    line_items: List[dict]
    subtotal: float
    total_discount: float
    taxable_amount: float
    cgst: float
    sgst: float
    igst: float
    total_tax: float
    grand_total: float
    is_intra_state: bool
    notes: Optional[str] = ""
    created_by: str = ""
    created_at: str = Field(default_factory=now_iso)


class CreditNoteCreate(BaseModel):
    invoice_id: str
    credit_date: str
    reason: str = ""
    line_items: List[LineItem]
    notes: Optional[str] = ""


# ---------- GST Engine ----------
def is_gujarat_gstin(gstin: str) -> bool:
    return bool(gstin) and gstin.strip().startswith("24")


def compute_invoice_totals(customer: dict, items: List[LineItem]) -> dict:
    intra = is_gujarat_gstin(customer.get("gstin", ""))
    subtotal = 0.0
    total_discount = 0.0
    taxable = 0.0
    cgst = sgst = igst = 0.0
    for it in items:
        line_gross = it.quantity * it.rate
        subtotal += line_gross
        total_discount += it.discount
        if it.price_type == "inclusive":
            # rate is inclusive of tax; extract taxable backwards
            billed = line_gross - it.discount
            line_taxable = billed / (1 + it.tax_rate / 100.0) if it.tax_rate else billed
            tax_amt = billed - line_taxable
        else:
            line_taxable = line_gross - it.discount
            tax_amt = line_taxable * (it.tax_rate / 100.0)
        taxable += line_taxable
        if intra:
            cgst += tax_amt / 2
            sgst += tax_amt / 2
        else:
            igst += tax_amt
    total_tax = cgst + sgst + igst
    grand = taxable + total_tax
    r = lambda x: round(x, 2)
    return {
        "subtotal": r(subtotal),
        "total_discount": r(total_discount),
        "taxable_amount": r(taxable),
        "cgst": r(cgst),
        "sgst": r(sgst),
        "igst": r(igst),
        "total_tax": r(total_tax),
        "grand_total": r(grand),
        "is_intra_state": intra,
    }


async def next_invoice_number() -> str:
    return await _next_number("invoice", "TE")


async def next_credit_note_number() -> str:
    return await _next_number("credit_note", "TE/CN")


async def _next_number(prefix_key: str, display_prefix: str) -> str:
    # Fiscal year: Apr-Mar
    today = datetime.now(timezone.utc)
    year = today.year
    month = today.month
    if month >= 4:
        fy_start, fy_end = year, year + 1
    else:
        fy_start, fy_end = year - 1, year
    fy = f"{fy_start}-{str(fy_end)[2:]}"
    counter_key = f"{prefix_key}_{fy}"
    doc = await db.counters.find_one_and_update(
        {"_id": counter_key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc.get("seq", 1)
    return f"{display_prefix}/{fy}/{seq:04d}"


# ---------- Startup: seed admin ----------
@app.on_event("startup")
async def on_startup():
    admin_email = "hi@trayambak.in"
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        admin = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Ranjita Rai",
            "role": "admin",
            "password_hash": hash_password("Ranjita@1985"),
            "created_at": now_iso(),
        }
        await db.users.insert_one(admin)
        logger.info("Seeded admin user: %s", admin_email)
    # ensure indexes
    await db.users.create_index("email", unique=True)
    await db.invoices.create_index("invoice_number", unique=True)
    await db.credit_notes.create_index("credit_note_number", unique=True)


# ---------- Auth routes ----------
@api.post("/auth/login")
async def login(inp: LoginIn):
    user = await db.users.find_one({"email": inp.email.lower()})
    if not user or not verify_password(inp.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
        },
    }


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ---------- Staff / users ----------
@api.get("/users")
async def list_users(user=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users


@api.post("/users")
async def create_user(inp: UserCreate, user=Depends(require_admin)):
    email = inp.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": inp.name,
        "role": inp.role,
        "password_hash": hash_password(inp.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@api.delete("/users/{uid}")
async def delete_user(uid: str, user=Depends(require_admin)):
    if uid == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"id": uid})
    return {"ok": True}


# ---------- Customers ----------
@api.get("/customers")
async def list_customers(user=Depends(get_current_user)):
    docs = await db.customers.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api.post("/customers")
async def create_customer(inp: CustomerCreate, user=Depends(get_current_user)):
    c = Customer(**inp.model_dump())
    state_code = c.gstin[:2] if c.gstin else ""
    doc = c.model_dump()
    doc["state_code"] = state_code
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/customers/{cid}")
async def update_customer(cid: str, inp: CustomerCreate, user=Depends(get_current_user)):
    upd = inp.model_dump()
    upd["state_code"] = upd["gstin"][:2] if upd["gstin"] else ""
    r = await db.customers.update_one({"id": cid}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    doc = await db.customers.find_one({"id": cid}, {"_id": 0})
    return doc


@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user=Depends(require_admin)):
    await db.customers.delete_one({"id": cid})
    return {"ok": True}


# ---------- Invoices ----------
@api.get("/invoices")
async def list_invoices(user=Depends(get_current_user)):
    docs = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api.get("/invoices/{iid}")
async def get_invoice(iid: str, user=Depends(get_current_user)):
    doc = await db.invoices.find_one({"id": iid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return doc


@api.post("/invoices")
async def create_invoice(inp: InvoiceCreate, user=Depends(get_current_user)):
    totals = compute_invoice_totals(inp.customer, inp.line_items)
    inv_no = await next_invoice_number()
    inv = Invoice(
        invoice_number=inv_no,
        order_type=inp.order_type,
        gem_contract_no=inp.gem_contract_no,
        gem_order_date=inp.gem_order_date,
        buyer_department=inp.buyer_department,
        delivery_date=inp.delivery_date,
        po_number=inp.po_number,
        reference_date=inp.reference_date,
        invoice_date=inp.invoice_date,
        customer=inp.customer,
        line_items=[li.model_dump() for li in inp.line_items],
        notes=inp.notes or "",
        created_by=user["id"],
        balance=totals["grand_total"],
        **totals,
    )
    doc = inv.model_dump()
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/invoices/{iid}/payments")
async def add_payment(iid: str, inp: PaymentCreate, user=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": iid})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    pay = Payment(**inp.model_dump())
    new_paid = round(float(inv.get("amount_paid", 0.0)) + pay.amount, 2)
    grand = float(inv["grand_total"])
    credits = float(inv.get("credits_applied", 0.0))
    balance = round(grand - new_paid - credits, 2)
    if balance <= 0.001:
        status_str = "paid"
        balance = 0.0
    elif new_paid > 0 or credits > 0:
        status_str = "partially_paid"
    else:
        status_str = "pending"
    await db.invoices.update_one(
        {"id": iid},
        {
            "$push": {"payments": pay.model_dump()},
            "$set": {"amount_paid": new_paid, "balance": balance, "status": status_str},
        },
    )
    doc = await db.invoices.find_one({"id": iid}, {"_id": 0})
    return doc


@api.put("/invoices/{iid}")
async def update_invoice(iid: str, inp: InvoiceCreate, user=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": iid})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Paid invoices cannot be edited")
    totals = compute_invoice_totals(inp.customer, inp.line_items)
    amount_paid = float(inv.get("amount_paid", 0.0))
    credits = float(inv.get("credits_applied", 0.0))
    balance = round(totals["grand_total"] - amount_paid - credits, 2)
    if balance <= 0.001:
        status_str = "paid"
        balance = 0.0
    elif amount_paid > 0 or credits > 0:
        status_str = "partially_paid"
    else:
        status_str = "pending"
    update = {
        "order_type": inp.order_type,
        "gem_contract_no": inp.gem_contract_no or "",
        "gem_order_date": inp.gem_order_date or "",
        "buyer_department": inp.buyer_department or "",
        "delivery_date": inp.delivery_date or "",
        "po_number": inp.po_number or "",
        "reference_date": inp.reference_date or "",
        "invoice_date": inp.invoice_date,
        "customer": inp.customer,
        "line_items": [li.model_dump() for li in inp.line_items],
        "notes": inp.notes or "",
        "balance": balance,
        "status": status_str,
        **totals,
    }
    await db.invoices.update_one({"id": iid}, {"$set": update})
    doc = await db.invoices.find_one({"id": iid}, {"_id": 0})
    return doc


# ---------- Credit Notes ----------
@api.get("/credit-notes")
async def list_credit_notes(user=Depends(get_current_user)):
    docs = await db.credit_notes.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api.get("/credit-notes/{cid}")
async def get_credit_note(cid: str, user=Depends(get_current_user)):
    doc = await db.credit_notes.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Credit note not found")
    return doc


@api.get("/invoices/{iid}/credit-notes")
async def list_credit_notes_for_invoice(iid: str, user=Depends(get_current_user)):
    docs = await db.credit_notes.find({"invoice_id": iid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api.post("/credit-notes")
async def create_credit_note(inp: CreditNoteCreate, user=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": inp.invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    totals = compute_invoice_totals(inv["customer"], inp.line_items)
    grand = totals["grand_total"]
    # Guardrail: credit cannot exceed the remaining invoice value net of prior credits
    existing_credits = float(inv.get("credits_applied", 0.0))
    grand_inv = float(inv["grand_total"])
    max_creditable = round(grand_inv - existing_credits, 2)
    if grand > max_creditable + 0.001:
        raise HTTPException(
            status_code=400,
            detail=f"Credit amount ₹{grand:.2f} exceeds remaining creditable value ₹{max_creditable:.2f}",
        )
    cn_no = await next_credit_note_number()
    cn = CreditNote(
        credit_note_number=cn_no,
        invoice_id=inv["id"],
        invoice_number=inv["invoice_number"],
        credit_date=inp.credit_date,
        reason=inp.reason,
        customer=inv["customer"],
        line_items=[li.model_dump() for li in inp.line_items],
        notes=inp.notes or "",
        created_by=user["id"],
        **totals,
    )
    doc = cn.model_dump()
    await db.credit_notes.insert_one(doc)
    doc.pop("_id", None)
    # Update invoice credits_applied and recompute balance & status
    new_credits = round(existing_credits + grand, 2)
    amount_paid = float(inv.get("amount_paid", 0.0))
    new_balance = round(grand_inv - amount_paid - new_credits, 2)
    if new_balance <= 0.001:
        status_str = "paid"
        new_balance = 0.0
    elif amount_paid > 0 or new_credits > 0:
        status_str = "partially_paid"
    else:
        status_str = "pending"
    await db.invoices.update_one(
        {"id": inv["id"]},
        {"$set": {"credits_applied": new_credits, "balance": new_balance, "status": status_str}},
    )
    return doc


# ---------- Reports ----------
@api.get("/reports/summary")
async def summary(user=Depends(get_current_user)):
    docs = await db.invoices.find({}, {"_id": 0}).to_list(5000)
    cns = await db.credit_notes.find({}, {"_id": 0}).to_list(5000)
    tot_taxable = sum(d.get("taxable_amount", 0) for d in docs) - sum(c.get("taxable_amount", 0) for c in cns)
    tot_cgst = sum(d.get("cgst", 0) for d in docs) - sum(c.get("cgst", 0) for c in cns)
    tot_sgst = sum(d.get("sgst", 0) for d in docs) - sum(c.get("sgst", 0) for c in cns)
    tot_igst = sum(d.get("igst", 0) for d in docs) - sum(c.get("igst", 0) for c in cns)
    tot_grand = sum(d.get("grand_total", 0) for d in docs)
    tot_paid = sum(d.get("amount_paid", 0) for d in docs)
    tot_credits = sum(d.get("credits_applied", 0) for d in docs)
    tot_outstanding = sum(d.get("balance", 0) for d in docs)
    counts = {"paid": 0, "pending": 0, "partially_paid": 0}
    for d in docs:
        counts[d.get("status", "pending")] = counts.get(d.get("status", "pending"), 0) + 1
    r = lambda x: round(x, 2)
    return {
        "taxable_revenue": r(tot_taxable),
        "cgst": r(tot_cgst),
        "sgst": r(tot_sgst),
        "igst": r(tot_igst),
        "grand_total": r(tot_grand),
        "amount_paid": r(tot_paid),
        "credits_applied": r(tot_credits),
        "outstanding": r(tot_outstanding),
        "invoice_count": len(docs),
        "credit_note_count": len(cns),
        "status_counts": counts,
    }


@api.get("/")
async def root():
    return {"app": "Trayambak Enterprise GST Billing API", "status": "ok"}


# ================== EXPENSES / VENDOR BILLS ==================
EXPENSE_CATEGORIES = ["Raw Material", "Logistics", "Office Overhead", "Bank Charges", "Utilities", "Professional Fees", "Marketing", "Other"]


class ExpenseLine(BaseModel):
    description: str
    hsn: Optional[str] = ""
    quantity: float = 1.0
    unit: str = "Nos"
    rate: float
    tax_rate: float = 18.0
    price_type: Literal["exclusive", "inclusive"] = "exclusive"


class Attachment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    url: str
    content_type: Optional[str] = ""
    size: int = 0
    uploaded_at: str = Field(default_factory=now_iso)


class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_name: str
    vendor_gstin: Optional[str] = ""
    bill_number: str
    bill_date: str
    category: str = "Other"
    line_items: List[dict] = []
    subtotal: float = 0.0
    taxable_amount: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    igst: float = 0.0
    total_tax: float = 0.0
    grand_total: float = 0.0
    is_intra_state: bool = True
    itc_eligible: bool = True
    notes: Optional[str] = ""
    attachments: List[dict] = []
    status: Literal["pending", "partially_paid", "paid"] = "pending"
    amount_paid: float = 0.0
    balance: float = 0.0
    payments: List[dict] = []
    created_by: str = ""
    created_at: str = Field(default_factory=now_iso)


class ExpenseCreate(BaseModel):
    vendor_name: str
    vendor_gstin: Optional[str] = ""
    bill_number: str
    bill_date: str
    category: str = "Other"
    line_items: List[ExpenseLine]
    itc_eligible: bool = True
    notes: Optional[str] = ""
    attachments: List[dict] = []


def compute_expense_totals(vendor_gstin: str, items: List[ExpenseLine]) -> dict:
    intra = is_gujarat_gstin(vendor_gstin or "")
    subtotal = 0.0
    taxable = 0.0
    cgst = sgst = igst = 0.0
    for it in items:
        gross = it.quantity * it.rate
        subtotal += gross
        if it.price_type == "inclusive":
            line_taxable = gross / (1 + it.tax_rate / 100.0) if it.tax_rate else gross
            tax_amt = gross - line_taxable
        else:
            line_taxable = gross
            tax_amt = line_taxable * (it.tax_rate / 100.0)
        taxable += line_taxable
        if intra:
            cgst += tax_amt / 2
            sgst += tax_amt / 2
        else:
            igst += tax_amt
    total_tax = cgst + sgst + igst
    r = lambda x: round(x, 2)
    return {
        "subtotal": r(subtotal),
        "taxable_amount": r(taxable),
        "cgst": r(cgst),
        "sgst": r(sgst),
        "igst": r(igst),
        "total_tax": r(total_tax),
        "grand_total": r(taxable + total_tax),
        "is_intra_state": intra,
    }


@api.get("/expenses")
async def list_expenses(user=Depends(get_current_user)):
    docs = await db.expenses.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api.get("/expenses/categories")
async def list_categories(user=Depends(get_current_user)):
    return {"categories": EXPENSE_CATEGORIES}


@api.post("/expenses")
async def create_expense(inp: ExpenseCreate, user=Depends(get_current_user)):
    totals = compute_expense_totals(inp.vendor_gstin or "", inp.line_items)
    doc = Expense(
        vendor_name=inp.vendor_name,
        vendor_gstin=inp.vendor_gstin or "",
        bill_number=inp.bill_number,
        bill_date=inp.bill_date,
        category=inp.category,
        line_items=[li.model_dump() for li in inp.line_items],
        itc_eligible=inp.itc_eligible,
        notes=inp.notes or "",
        attachments=inp.attachments or [],
        created_by=user["id"],
        balance=totals["grand_total"],
        **totals,
    ).model_dump()
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/expenses/{eid}")
async def update_expense(eid: str, inp: ExpenseCreate, user=Depends(get_current_user)):
    exp = await db.expenses.find_one({"id": eid})
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    if exp.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Paid expenses cannot be edited")
    totals = compute_expense_totals(inp.vendor_gstin or "", inp.line_items)
    amount_paid = float(exp.get("amount_paid", 0.0))
    balance = round(totals["grand_total"] - amount_paid, 2)
    status_str = "paid" if balance <= 0.001 else ("partially_paid" if amount_paid > 0 else "pending")
    upd = {
        "vendor_name": inp.vendor_name,
        "vendor_gstin": inp.vendor_gstin or "",
        "bill_number": inp.bill_number,
        "bill_date": inp.bill_date,
        "category": inp.category,
        "line_items": [li.model_dump() for li in inp.line_items],
        "itc_eligible": inp.itc_eligible,
        "notes": inp.notes or "",
        "attachments": inp.attachments or [],
        "balance": max(balance, 0.0),
        "status": status_str,
        **totals,
    }
    await db.expenses.update_one({"id": eid}, {"$set": upd})
    doc = await db.expenses.find_one({"id": eid}, {"_id": 0})
    return doc


@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user=Depends(require_admin)):
    r = await db.expenses.delete_one({"id": eid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"ok": True}


@api.post("/expenses/{eid}/payments")
async def add_expense_payment(eid: str, inp: PaymentCreate, user=Depends(get_current_user)):
    exp = await db.expenses.find_one({"id": eid})
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    pay = Payment(**inp.model_dump())
    new_paid = round(float(exp.get("amount_paid", 0.0)) + pay.amount, 2)
    grand = float(exp["grand_total"])
    balance = round(grand - new_paid, 2)
    status_str = "paid" if balance <= 0.001 else "partially_paid"
    if balance <= 0.001:
        balance = 0.0
    await db.expenses.update_one(
        {"id": eid},
        {"$push": {"payments": pay.model_dump()},
         "$set": {"amount_paid": new_paid, "balance": balance, "status": status_str}},
    )
    doc = await db.expenses.find_one({"id": eid}, {"_id": 0})
    return doc


# ================== UPLOADS / DOCUMENT VAULT ==================
ALLOWED_MIME = {"application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_UPLOAD_MB = 10


@api.post("/uploads")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    ct = (file.content_type or "").lower()
    if ct not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ct}. Allowed: PDF, PNG, JPG, WebP")
    contents = await file.read()
    size = len(contents)
    if size > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_UPLOAD_MB} MB")
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else mimetypes.guess_extension(ct) or "bin").lower()
    fid = f"{uuid.uuid4().hex}.{ext}"
    fpath = UPLOAD_DIR / fid
    with open(fpath, "wb") as f:
        f.write(contents)
    url = f"/api/uploads/{fid}"
    return {
        "id": fid,
        "filename": file.filename,
        "url": url,
        "content_type": ct,
        "size": size,
        "uploaded_at": now_iso(),
    }


@api.get("/uploads/{fid}")
async def get_upload(fid: str):
    # Public access to uploaded files (URL is unguessable UUID)
    fpath = UPLOAD_DIR / fid
    if not fpath.exists() or ".." in fid or "/" in fid:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(fpath))


@api.post("/invoices/{iid}/attachments")
async def attach_to_invoice(iid: str, attachment: Attachment, user=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": iid})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    await db.invoices.update_one({"id": iid}, {"$push": {"attachments": attachment.model_dump()}})
    return {"ok": True}


@api.delete("/invoices/{iid}/attachments/{aid}")
async def detach_from_invoice(iid: str, aid: str, user=Depends(get_current_user)):
    await db.invoices.update_one({"id": iid}, {"$pull": {"attachments": {"id": aid}}})
    return {"ok": True}


# ================== FINANCIAL REPORTS ==================
def parse_date(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    return s[:10]


@api.get("/reports/aging")
async def aging_report(user=Depends(get_current_user)):
    """Categorize outstanding invoices into 0-30, 31-60, 60+ day buckets."""
    today = datetime.now(timezone.utc).date()
    docs = await db.invoices.find({"status": {"$ne": "paid"}}, {"_id": 0}).to_list(5000)
    buckets = {"0-30": {"count": 0, "amount": 0.0, "invoices": []},
               "31-60": {"count": 0, "amount": 0.0, "invoices": []},
               "60+": {"count": 0, "amount": 0.0, "invoices": []}}
    for d in docs:
        try:
            inv_date = datetime.fromisoformat(d.get("invoice_date", "")).date() if len(d.get("invoice_date", "")) >= 10 else today
        except Exception:
            inv_date = today
        days = (today - inv_date).days
        key = "0-30" if days <= 30 else ("31-60" if days <= 60 else "60+")
        buckets[key]["count"] += 1
        buckets[key]["amount"] = round(buckets[key]["amount"] + float(d.get("balance", 0.0)), 2)
        buckets[key]["invoices"].append({
            "id": d.get("id"),
            "invoice_number": d.get("invoice_number"),
            "customer": d.get("customer", {}).get("name", ""),
            "customer_phone": d.get("customer", {}).get("phone", ""),
            "customer_email": d.get("customer", {}).get("email", ""),
            "invoice_date": d.get("invoice_date"),
            "grand_total": d.get("grand_total", 0.0),
            "balance": d.get("balance", 0.0),
            "days_overdue": days,
            "status": d.get("status"),
        })
    return {
        "as_of": today.isoformat(),
        "buckets": buckets,
        "total_outstanding": round(sum(b["amount"] for b in buckets.values()), 2),
    }


@api.get("/reports/gst-settlement")
async def gst_settlement(from_date: Optional[str] = None, to_date: Optional[str] = None,
                         user=Depends(get_current_user)):
    """Compute Net GST Liability = Output GST (from invoices - credit notes) - ITC (from ITC-eligible expenses)."""
    inv_q = {}
    exp_q = {}
    if from_date:
        inv_q.setdefault("invoice_date", {})["$gte"] = from_date
        exp_q.setdefault("bill_date", {})["$gte"] = from_date
    if to_date:
        inv_q.setdefault("invoice_date", {})["$lte"] = to_date
        exp_q.setdefault("bill_date", {})["$lte"] = to_date
    cn_q = {}
    if from_date:
        cn_q.setdefault("credit_date", {})["$gte"] = from_date
    if to_date:
        cn_q.setdefault("credit_date", {})["$lte"] = to_date
    invs = await db.invoices.find(inv_q, {"_id": 0}).to_list(5000)
    cns = await db.credit_notes.find(cn_q, {"_id": 0}).to_list(5000)
    exps = await db.expenses.find(exp_q, {"_id": 0}).to_list(5000)
    r = lambda x: round(x, 2)
    out_cgst = r(sum(i.get("cgst", 0) for i in invs) - sum(c.get("cgst", 0) for c in cns))
    out_sgst = r(sum(i.get("sgst", 0) for i in invs) - sum(c.get("sgst", 0) for c in cns))
    out_igst = r(sum(i.get("igst", 0) for i in invs) - sum(c.get("igst", 0) for c in cns))
    itc_cgst = r(sum(e.get("cgst", 0) for e in exps if e.get("itc_eligible", True)))
    itc_sgst = r(sum(e.get("sgst", 0) for e in exps if e.get("itc_eligible", True)))
    itc_igst = r(sum(e.get("igst", 0) for e in exps if e.get("itc_eligible", True)))
    net_cgst = r(out_cgst - itc_cgst)
    net_sgst = r(out_sgst - itc_sgst)
    net_igst = r(out_igst - itc_igst)
    return {
        "from_date": from_date,
        "to_date": to_date,
        "output_gst": {"cgst": out_cgst, "sgst": out_sgst, "igst": out_igst, "total": r(out_cgst + out_sgst + out_igst)},
        "input_tax_credit": {"cgst": itc_cgst, "sgst": itc_sgst, "igst": itc_igst, "total": r(itc_cgst + itc_sgst + itc_igst)},
        "net_liability": {"cgst": net_cgst, "sgst": net_sgst, "igst": net_igst, "total": r(net_cgst + net_sgst + net_igst)},
    }


@api.get("/reports/pnl")
async def pnl_report(from_date: Optional[str] = None, to_date: Optional[str] = None,
                     user=Depends(get_current_user)):
    """Profit & Loss for a period."""
    inv_q, exp_q, cn_q = {}, {}, {}
    if from_date:
        inv_q.setdefault("invoice_date", {})["$gte"] = from_date
        exp_q.setdefault("bill_date", {})["$gte"] = from_date
        cn_q.setdefault("credit_date", {})["$gte"] = from_date
    if to_date:
        inv_q.setdefault("invoice_date", {})["$lte"] = to_date
        exp_q.setdefault("bill_date", {})["$lte"] = to_date
        cn_q.setdefault("credit_date", {})["$lte"] = to_date
    invs = await db.invoices.find(inv_q, {"_id": 0}).to_list(5000)
    cns = await db.credit_notes.find(cn_q, {"_id": 0}).to_list(5000)
    exps = await db.expenses.find(exp_q, {"_id": 0}).to_list(5000)
    r = lambda x: round(x, 2)
    gross_revenue = r(sum(i.get("taxable_amount", 0) for i in invs) - sum(c.get("taxable_amount", 0) for c in cns))
    # Aggregate expenses by category
    expense_by_cat = {}
    for e in exps:
        cat = e.get("category", "Other")
        expense_by_cat[cat] = r(expense_by_cat.get(cat, 0) + float(e.get("taxable_amount", 0)))
    # COGS = Raw Material + Logistics (simple heuristic)
    cogs = r(expense_by_cat.get("Raw Material", 0) + expense_by_cat.get("Logistics", 0))
    op_expenses = r(sum(v for k, v in expense_by_cat.items() if k not in ("Raw Material", "Logistics")))
    gross_profit = r(gross_revenue - cogs)
    net_profit = r(gross_profit - op_expenses)
    margin = round((net_profit / gross_revenue * 100), 2) if gross_revenue > 0 else 0.0
    return {
        "from_date": from_date,
        "to_date": to_date,
        "gross_revenue": gross_revenue,
        "cogs": cogs,
        "gross_profit": gross_profit,
        "operating_expenses": op_expenses,
        "expense_breakdown": expense_by_cat,
        "net_profit": net_profit,
        "net_margin_percent": margin,
    }


@api.get("/reports/balance-sheet")
async def balance_sheet(as_of: Optional[str] = None, user=Depends(get_current_user)):
    """Simple Balance Sheet snapshot."""
    ao = as_of[:10] if as_of else datetime.now(timezone.utc).date().isoformat()
    inv_q = {"invoice_date": {"$lte": ao}}
    exp_q = {"bill_date": {"$lte": ao}}
    cn_q = {"credit_date": {"$lte": ao}}
    invs = await db.invoices.find(inv_q, {"_id": 0}).to_list(5000)
    cns = await db.credit_notes.find(cn_q, {"_id": 0}).to_list(5000)
    exps = await db.expenses.find(exp_q, {"_id": 0}).to_list(5000)
    r = lambda x: round(x, 2)
    # Cash/Bank = payments received - payments paid out
    cash = r(sum(i.get("amount_paid", 0) for i in invs) - sum(e.get("amount_paid", 0) for e in exps))
    accounts_receivable = r(sum(i.get("balance", 0) for i in invs))
    accounts_payable = r(sum(e.get("balance", 0) for e in exps))
    itc_balance = r(sum(e.get("cgst", 0) + e.get("sgst", 0) + e.get("igst", 0) for e in exps if e.get("itc_eligible", True)))
    gst_output = r(sum(i.get("total_tax", 0) for i in invs) - sum(c.get("total_tax", 0) for c in cns))
    gst_payable = r(max(gst_output - itc_balance, 0))
    total_assets = r(cash + accounts_receivable + max(itc_balance - gst_output, 0))
    total_liabilities = r(accounts_payable + gst_payable)
    # P&L (approx, all-time up to as_of)
    revenue = r(sum(i.get("taxable_amount", 0) for i in invs) - sum(c.get("taxable_amount", 0) for c in cns))
    expenses_total = r(sum(e.get("taxable_amount", 0) for e in exps))
    retained_earnings = r(revenue - expenses_total)
    proprietor_capital = r(total_assets - total_liabilities - retained_earnings)
    return {
        "as_of": ao,
        "assets": {
            "cash_bank": cash,
            "accounts_receivable": accounts_receivable,
            "input_tax_credit": max(itc_balance - gst_output, 0),
            "total": total_assets,
        },
        "liabilities": {
            "accounts_payable": accounts_payable,
            "gst_payable": gst_payable,
            "total": total_liabilities,
        },
        "equity": {
            "proprietor_capital": proprietor_capital,
            "retained_earnings": retained_earnings,
            "total": r(proprietor_capital + retained_earnings),
        },
    }


@api.get("/reminders/whatsapp/{iid}")
async def whatsapp_reminder(iid: str, user=Depends(get_current_user)):
    """Generate a WhatsApp deep link with a pre-drafted payment reminder for a customer."""
    inv = await db.invoices.find_one({"id": iid}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    phone = (inv.get("customer", {}) or {}).get("phone", "").strip()
    phone_digits = "".join(c for c in phone if c.isdigit())
    if phone_digits and not phone_digits.startswith("91"):
        phone_digits = "91" + phone_digits[-10:]
    msg = (
        f"Dear {inv.get('customer',{}).get('name','Customer')},\n\n"
        f"This is a friendly reminder from TRAYAMBAK ENTERPRISE regarding invoice "
        f"{inv.get('invoice_number')} dated {inv.get('invoice_date')}.\n\n"
        f"Outstanding balance: INR {inv.get('balance', 0):.2f}\n"
        f"Bank: IDFC FIRST | A/C 69315494820 | IFSC IDFB0042392\n\n"
        f"Please arrange payment at your earliest convenience. Thank you!\n\n"
        f"— hi@trayambak.in"
    )
    encoded = quote(msg)
    wa_url = f"https://wa.me/{phone_digits}?text={encoded}" if phone_digits else f"https://wa.me/?text={encoded}"
    return {
        "whatsapp_url": wa_url,
        "phone": phone,
        "email": (inv.get("customer", {}) or {}).get("email", ""),
        "invoice_number": inv.get("invoice_number"),
        "message": msg,
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
