import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { computeTotals, fmtINRWithSymbol, isGujaratGSTIN, todayISO } from "@/lib/gst";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, ArrowLeft, Landmark } from "lucide-react";

const emptyItem = () => ({ description: "", hsn: "", quantity: 1, unit: "Nos", rate: 0, discount: 0, tax_rate: 18 });
const UNITS = ["Nos", "Pcs", "Kg", "Set", "Lot", "Month", "Hours", "Service"];
const TAX_BRACKETS = [0, 5, 12, 18, 28];

export default function InvoiceForm() {
  const nav = useNavigate();
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const [orderType, setOrderType] = useState("regular");
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState({ name: "", gstin: "", address: "", phone: "", email: "" });
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [items, setItems] = useState([emptyItem()]);
  const [gem, setGem] = useState({ gem_contract_no: "", gem_order_date: "", buyer_department: "", delivery_date: "" });
  const [reg, setReg] = useState({ po_number: "", reference_date: "" });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");

  useEffect(() => { api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/invoices/${editId}`).then((r) => {
      const inv = r.data;
      if (inv.status === "paid") {
        toast.error("Paid invoices cannot be edited");
        nav("/invoices");
        return;
      }
      setInvoiceNumber(inv.invoice_number);
      setOrderType(inv.order_type);
      setCustomer(inv.customer || { name: "", gstin: "", address: "", phone: "", email: "" });
      setInvoiceDate(inv.invoice_date);
      setItems((inv.line_items || []).map((it) => ({ ...it })));
      setGem({
        gem_contract_no: inv.gem_contract_no || "",
        gem_order_date: inv.gem_order_date || "",
        buyer_department: inv.buyer_department || "",
        delivery_date: inv.delivery_date || "",
      });
      setReg({ po_number: inv.po_number || "", reference_date: inv.reference_date || "" });
      setNotes(inv.notes || "");
    }).catch(() => { toast.error("Failed to load invoice"); nav("/invoices"); });
  }, [editId, isEdit, nav]);

  const totals = computeTotals(customer, items);

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((p) => [...p, emptyItem()]);
  const removeItem = (idx) => setItems((p) => p.length > 1 ? p.filter((_, i) => i !== idx) : p);

  const pickCustomer = (id) => {
    const c = customers.find((c) => c.id === id);
    if (c) setCustomer({ name: c.name, gstin: c.gstin || "", address: c.address || "", phone: c.phone || "", email: c.email || "" });
  };

  const submit = async () => {
    if (!customer.name) { toast.error("Customer name is required"); return; }
    if (items.some((it) => !it.description || !it.quantity || !it.rate)) {
      toast.error("Every line item needs description, quantity and rate"); return;
    }
    setSaving(true);
    try {
      const payload = {
        order_type: orderType,
        ...(orderType === "gem" ? gem : {}),
        ...(orderType === "regular" ? reg : {}),
        invoice_date: invoiceDate,
        customer,
        line_items: items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          rate: Number(it.rate),
          discount: Number(it.discount || 0),
          tax_rate: Number(it.tax_rate),
        })),
        notes,
      };
      const r = await api.post("/invoices", payload);
      toast.success(`Invoice ${r.data.invoice_number} created`);
      nav("/invoices");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  const intra = isGujaratGSTIN(customer.gstin);

  return (
    <div className="space-y-6 animate-fade-up pb-16">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <button onClick={() => nav(-1)} className="text-xs text-slate-500 flex items-center gap-1 mb-2 hover:text-slate-800">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900">
            {isEdit ? `Edit Invoice · ${invoiceNumber}` : "New Tax Invoice"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEdit
              ? "You can edit this invoice until it is fully paid."
              : "Fill line items manually. GST is auto-calculated based on customer GSTIN."}
          </p>
        </div>
        <Button
          data-testid="invoice-save-btn"
          onClick={submit}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-11"
        >
          {saving ? "Saving…" : isEdit ? "Update Invoice" : "Save Invoice"}
        </Button>
      </header>

      {/* Order Type Toggle */}
      <Card className="p-5 border-slate-200 rounded-md">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-3">Order Type</div>
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
          <button
            data-testid="order-type-gem"
            onClick={() => setOrderType("gem")}
            className={`px-4 py-2 text-sm font-medium ${orderType === "gem" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
          >GeM Order</button>
          <button
            data-testid="order-type-regular"
            onClick={() => setOrderType("regular")}
            className={`px-4 py-2 text-sm font-medium ${orderType === "regular" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
          >Regular B2B / B2C</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
          <Field label="Invoice Date">
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} data-testid="invoice-date-input" />
          </Field>
          {orderType === "gem" ? (
            <>
              <Field label="GeM Contract / PO No.">
                <Input value={gem.gem_contract_no} onChange={(e) => setGem({ ...gem, gem_contract_no: e.target.value })} data-testid="gem-contract-input" />
              </Field>
              <Field label="GeM Order Date">
                <Input type="date" value={gem.gem_order_date} onChange={(e) => setGem({ ...gem, gem_order_date: e.target.value })} />
              </Field>
              <Field label="Delivery Date">
                <Input type="date" value={gem.delivery_date} onChange={(e) => setGem({ ...gem, delivery_date: e.target.value })} />
              </Field>
              <Field label="Buyer Department / Organization" className="md:col-span-4">
                <Input value={gem.buyer_department} onChange={(e) => setGem({ ...gem, buyer_department: e.target.value })} data-testid="gem-buyer-input" />
              </Field>
            </>
          ) : (
            <>
              <Field label="PO Number">
                <Input value={reg.po_number} onChange={(e) => setReg({ ...reg, po_number: e.target.value })} data-testid="po-number-input" />
              </Field>
              <Field label="Reference Date">
                <Input type="date" value={reg.reference_date} onChange={(e) => setReg({ ...reg, reference_date: e.target.value })} />
              </Field>
            </>
          )}
        </div>
      </Card>

      {/* Customer */}
      <Card className="p-5 border-slate-200 rounded-md">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Bill To</div>
          {customers.length > 0 && (
            <div className="w-64">
              <Select onValueChange={pickCustomer}>
                <SelectTrigger data-testid="customer-picker">
                  <SelectValue placeholder="Load from saved…" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Customer Name *">
            <Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} data-testid="customer-name-input" />
          </Field>
          <Field label="GSTIN (optional)">
            <Input value={customer.gstin} onChange={(e) => setCustomer({ ...customer, gstin: e.target.value.toUpperCase() })} placeholder="24XXXXX…" data-testid="customer-gstin-input" />
            <div className="text-[11px] mt-1 font-mono">
              {customer.gstin ? (
                intra ? <span className="text-emerald-600">Intra-state (Gujarat) → CGST + SGST</span> : <span className="text-blue-600">Inter-state → IGST</span>
              ) : <span className="text-slate-400">Unregistered → IGST</span>}
            </div>
          </Field>
          <Field label="Phone">
            <Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </Field>
          <Field label="Address" className="md:col-span-2">
            <Textarea rows={2} value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* Line items */}
      <Card className="p-0 border-slate-200 rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Line Items</div>
          <Button size="sm" variant="outline" onClick={addItem} data-testid="add-line-item" className="gap-1"><Plus className="w-3.5 h-3.5" /> Add Item</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">HSN/SAC</th>
              <th className="px-3 py-2 text-right w-20">Qty</th>
              <th className="px-3 py-2 text-left w-24">Unit</th>
              <th className="px-3 py-2 text-right w-28">Rate (₹)</th>
              <th className="px-3 py-2 text-right w-24">Discount</th>
              <th className="px-3 py-2 text-right w-20">Tax %</th>
              <th className="px-3 py-2 text-right w-32">Amount</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const gross = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
              const taxable = gross - Number(it.discount || 0);
              return (
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 text-slate-400 font-mono">{i + 1}</td>
                  <td className="px-3 py-2"><Input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} data-testid={`item-desc-${i}`} placeholder="Service / article" /></td>
                  <td className="px-3 py-2"><Input value={it.hsn} onChange={(e) => updateItem(i, { hsn: e.target.value })} data-testid={`item-hsn-${i}`} /></td>
                  <td className="px-3 py-2"><Input type="number" min="0" step="0.01" className="text-right font-mono" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} data-testid={`item-qty-${i}`} /></td>
                  <td className="px-3 py-2">
                    <Select value={it.unit} onValueChange={(v) => updateItem(i, { unit: v })}>
                      <SelectTrigger data-testid={`item-unit-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2"><Input type="number" min="0" step="0.01" className="text-right font-mono" value={it.rate} onChange={(e) => updateItem(i, { rate: e.target.value })} data-testid={`item-rate-${i}`} /></td>
                  <td className="px-3 py-2"><Input type="number" min="0" step="0.01" className="text-right font-mono" value={it.discount} onChange={(e) => updateItem(i, { discount: e.target.value })} /></td>
                  <td className="px-3 py-2">
                    <Select value={String(it.tax_rate)} onValueChange={(v) => updateItem(i, { tax_rate: Number(v) })}>
                      <SelectTrigger data-testid={`item-tax-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{TAX_BRACKETS.map((t) => <SelectItem key={t} value={String(t)}>{t}%</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-900">{fmtINRWithSymbol(taxable)}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-500" data-testid={`item-remove-${i}`}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Totals + Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 border-slate-200 rounded-md lg:col-span-2">
          <Label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Notes / Terms</Label>
          <Textarea rows={4} className="mt-2" placeholder="Payment terms, delivery notes, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="mt-4 flex items-start gap-2 text-xs text-slate-500 border-t border-slate-100 pt-4">
            <Landmark className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              Payments to <b>IDFC FIRST Bank</b> · A/c Holder <b>TRAYAMBAK ENTERPRISE</b> · Current A/c <span className="font-mono">69315494820</span> · IFSC <span className="font-mono">IDFB0042392</span> (Vadodara-Gotri Branch)
            </div>
          </div>
        </Card>

        <Card className="p-5 border-slate-200 rounded-md bg-slate-900 text-slate-100">
          <div className="text-[11px] uppercase tracking-[0.2em] text-sky-400 mb-4">Summary</div>
          <div className="space-y-2 font-mono text-sm">
            <SumRow label="Subtotal" val={totals.subtotal} />
            {totals.total_discount > 0 && <SumRow label="Discount" val={-totals.total_discount} />}
            <SumRow label="Taxable Amount" val={totals.taxable_amount} strong />
            {intra ? (
              <>
                <SumRow label={`CGST`} val={totals.cgst} muted />
                <SumRow label={`SGST`} val={totals.sgst} muted />
              </>
            ) : <SumRow label={`IGST`} val={totals.igst} muted />}
            <div className="border-t border-slate-700 pt-3 mt-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs uppercase tracking-wider text-sky-300">Grand Total</span>
                <span className="text-2xl font-semibold" data-testid="totals-grand">{fmtINRWithSymbol(totals.grand_total)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

const Field = ({ label, children, className = "" }) => (
  <div className={className}>
    <Label className="text-[11px] uppercase tracking-wider text-slate-500">{label}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);

const SumRow = ({ label, val, muted, strong }) => (
  <div className="flex justify-between">
    <span className={`${muted ? "text-slate-400" : "text-slate-300"} text-xs`}>{label}</span>
    <span className={`${strong ? "text-white font-semibold" : "text-slate-100"}`}>{fmtINRWithSymbol(val)}</span>
  </div>
);
