import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { computeTotals, fmtINRWithSymbol, todayISO } from "@/lib/gst";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, ArrowLeft, FileMinus } from "lucide-react";

const emptyItem = () => ({ description: "", hsn: "", quantity: 1, unit: "Nos", rate: 0, discount: 0, tax_rate: 18, price_type: "exclusive" });
const UNITS = ["Nos", "Pcs", "Kg", "Set", "Lot", "Month", "Hours", "Service"];
const TAX_BRACKETS = [0, 5, 12, 18, 28];

export default function CreditNoteForm() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const invoiceId = sp.get("invoice_id");
  const [invoice, setInvoice] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [invoicePicker, setInvoicePicker] = useState([]);

  useEffect(() => {
    api.get("/invoices").then((r) => setInvoicePicker(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!invoiceId) return;
    api.get(`/invoices/${invoiceId}`).then((r) => {
      setInvoice(r.data);
      // Pre-fill items from invoice as starting template
      setItems((r.data.line_items || []).map((it) => ({ ...it })));
    }).catch(() => toast.error("Failed to load invoice"));
  }, [invoiceId]);

  const totals = invoice ? computeTotals(invoice.customer, items) : computeTotals({ gstin: "" }, items);

  const updateItem = (idx, patch) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () => setItems((p) => [...p, emptyItem()]);
  const removeItem = (idx) => setItems((p) => p.length > 1 ? p.filter((_, i) => i !== idx) : p);

  const pickInvoice = (id) => {
    if (id) nav(`/credit-notes/new?invoice_id=${id}`);
  };

  const submit = async () => {
    if (!invoice) return toast.error("Select an invoice first");
    if (!reason.trim()) return toast.error("Reason is required for a credit note");
    if (items.some((it) => !it.description || !it.quantity || !it.rate)) {
      return toast.error("Every line item needs description, quantity and rate");
    }
    setSaving(true);
    try {
      const payload = {
        invoice_id: invoice.id,
        credit_date: date,
        reason,
        line_items: items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          rate: Number(it.rate),
          discount: Number(it.discount || 0),
          tax_rate: Number(it.tax_rate),
        })),
        notes,
      };
      const r = await api.post("/credit-notes", payload);
      toast.success(`Credit note ${r.data.credit_note_number} raised`);
      nav("/credit-notes");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to raise credit note");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-fade-up pb-16">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <button onClick={() => nav(-1)} className="text-xs text-slate-500 flex items-center gap-1 mb-2 hover:text-slate-800">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <FileMinus className="w-8 h-8 text-amber-600" /> Raise Credit Note
          </h1>
          <p className="text-sm text-slate-500 mt-1">Adjusts a previously issued tax invoice. Reduces the customer's outstanding balance.</p>
        </div>
        <Button data-testid="cn-save-btn" onClick={submit} disabled={saving || !invoice} className="bg-amber-600 hover:bg-amber-700 text-white px-6 h-11">
          {saving ? "Saving…" : "Raise Credit Note"}
        </Button>
      </header>

      {/* Invoice reference */}
      <Card className="p-5 border-slate-200 rounded-md">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-3">Against Invoice</div>
        {!invoice ? (
          <div>
            <Label>Select Invoice</Label>
            <Select onValueChange={pickInvoice}>
              <SelectTrigger className="mt-2" data-testid="cn-invoice-picker"><SelectValue placeholder="Choose an invoice…" /></SelectTrigger>
              <SelectContent>
                {invoicePicker.map((i) => <SelectItem key={i.id} value={i.id}>{i.invoice_number} · {i.customer?.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Invoice #</div>
              <div className="font-mono font-semibold" data-testid="cn-ref-invoice">{invoice.invoice_number}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Customer</div>
              <div>{invoice.customer?.name}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">GSTIN</div>
              <div className="font-mono text-xs">{invoice.customer?.gstin || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Invoice Value</div>
              <div className="font-mono font-semibold">{fmtINRWithSymbol(invoice.grand_total)}</div>
            </div>
          </div>
        )}
      </Card>

      {/* Meta */}
      <Card className="p-5 border-slate-200 rounded-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-slate-500">Credit Note Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="cn-date-input" className="mt-1.5" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px] uppercase tracking-wider text-slate-500">Reason *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} data-testid="cn-reason-input" placeholder="e.g. Goods returned, Price adjustment, Rate correction" className="mt-1.5" />
          </div>
        </div>
      </Card>

      {/* Line items */}
      <Card className="p-0 border-slate-200 rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Credit Items</div>
          <Button size="sm" variant="outline" onClick={addItem} className="gap-1" data-testid="cn-add-item"><Plus className="w-3.5 h-3.5" /> Add Item</Button>
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
                  <td className="px-3 py-2"><Input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} data-testid={`cn-item-desc-${i}`} /></td>
                  <td className="px-3 py-2"><Input value={it.hsn} onChange={(e) => updateItem(i, { hsn: e.target.value })} /></td>
                  <td className="px-3 py-2"><Input type="number" min="0" step="0.01" className="text-right font-mono" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} data-testid={`cn-item-qty-${i}`} /></td>
                  <td className="px-3 py-2">
                    <Select value={it.unit} onValueChange={(v) => updateItem(i, { unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2"><Input type="number" min="0" step="0.01" className="text-right font-mono" value={it.rate} onChange={(e) => updateItem(i, { rate: e.target.value })} data-testid={`cn-item-rate-${i}`} /></td>
                  <td className="px-3 py-2"><Input type="number" min="0" step="0.01" className="text-right font-mono" value={it.discount} onChange={(e) => updateItem(i, { discount: e.target.value })} /></td>
                  <td className="px-3 py-2">
                    <Select value={String(it.tax_rate)} onValueChange={(v) => updateItem(i, { tax_rate: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TAX_BRACKETS.map((t) => <SelectItem key={t} value={String(t)}>{t}%</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-900">{fmtINRWithSymbol(taxable)}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Totals + notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 border-slate-200 rounded-md lg:col-span-2">
          <Label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Notes</Label>
          <Textarea rows={4} className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional remarks (optional)" />
        </Card>
        <Card className="p-5 border-slate-200 rounded-md bg-amber-950 text-amber-50">
          <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300 mb-4">Credit Summary</div>
          <div className="space-y-2 font-mono text-sm">
            <SumRow label="Subtotal" val={totals.subtotal} />
            {totals.total_discount > 0 && <SumRow label="Discount" val={-totals.total_discount} />}
            <SumRow label="Taxable Amount" val={totals.taxable_amount} strong />
            {totals.is_intra_state ? (<>
              <SumRow label="CGST" val={totals.cgst} />
              <SumRow label="SGST" val={totals.sgst} />
            </>) : <SumRow label="IGST" val={totals.igst} />}
            <div className="border-t border-amber-800 pt-3 mt-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs uppercase tracking-wider text-amber-300">Credit Total</span>
                <span className="text-2xl font-semibold" data-testid="cn-total">{fmtINRWithSymbol(totals.grand_total)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

const SumRow = ({ label, val, strong }) => (
  <div className="flex justify-between">
    <span className="text-amber-200 text-xs">{label}</span>
    <span className={strong ? "text-white font-semibold" : "text-amber-50"}>{fmtINRWithSymbol(val)}</span>
  </div>
);
