"""TRAYAMBAK ENTERPRISE — GST Billing & Reconciliation Backend."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
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
        line_taxable = line_gross - it.discount
        subtotal += line_gross
        total_discount += it.discount
        taxable += line_taxable
        tax_amt = line_taxable * (it.tax_rate / 100.0)
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
    # Fiscal year: Apr-Mar
    today = datetime.now(timezone.utc)
    year = today.year
    month = today.month
    if month >= 4:
        fy_start, fy_end = year, year + 1
    else:
        fy_start, fy_end = year - 1, year
    fy = f"{fy_start}-{str(fy_end)[2:]}"
    counter_key = f"invoice_{fy}"
    doc = await db.counters.find_one_and_update(
        {"_id": counter_key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc.get("seq", 1)
    return f"TE/{fy}/{seq:04d}"


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
    balance = round(grand - new_paid, 2)
    if balance <= 0.001:
        status_str = "paid"
        balance = 0.0
    elif new_paid > 0:
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


# ---------- Reports ----------
@api.get("/reports/summary")
async def summary(user=Depends(get_current_user)):
    docs = await db.invoices.find({}, {"_id": 0}).to_list(5000)
    tot_taxable = sum(d.get("taxable_amount", 0) for d in docs)
    tot_cgst = sum(d.get("cgst", 0) for d in docs)
    tot_sgst = sum(d.get("sgst", 0) for d in docs)
    tot_igst = sum(d.get("igst", 0) for d in docs)
    tot_grand = sum(d.get("grand_total", 0) for d in docs)
    tot_paid = sum(d.get("amount_paid", 0) for d in docs)
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
        "outstanding": r(tot_outstanding),
        "invoice_count": len(docs),
        "status_counts": counts,
    }


@api.get("/")
async def root():
    return {"app": "Trayambak Enterprise GST Billing API", "status": "ok"}


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
