import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtINRWithSymbol, computeTotals, todayISO } from "@/lib/gst";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatusPill } from "./Dashboard";
import { toast } from "sonner";
import { Receipt, Plus, Trash2, Search, Paperclip, Eye, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FileUploader from "@/components/FileUploader";

const UNITS = ["Nos", "Pcs", "Kg", "Set", "Lot", "Month", "Hours", "Service"];
const TAX_BRACKETS = [0, 5, 12, 18, 28];
const emptyItem = () => ({ description: "", hsn: "", quantity: 1, unit: "Nos", rate: 0, tax_rate: 18, price_type: "exclusive" });

export default function Expenses() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm());

  function initialForm() {
    return {
      vendor_name: "", vendor_gstin: "", bill_number: "", bill_date: todayISO(),
      category: "Other", itc_eligible: true, notes: "",
      line_items: [emptyItem()],
      attachments: [],
    };
  }

  const load = () => api.get("/expenses").then((r) => setList(r.data));
  useEffect(() => { load(); api.get("/expenses/categories").then((r) => setCategories(r.data.categories)).catch(() => {}); }, []);

  const openNew = () => { setEditing(null); setForm(initialForm()); setOpen(true); };
  const openEdit = (e) => {
    setEditing(e);
    setForm({
      vendor_name: e.vendor_name, vendor_gstin: e.vendor_gstin || "", bill_number: e.bill_number,
      bill_date: e.bill_date, category: e.category || "Other", itc_eligible: e.itc_eligible !== false,
      notes: e.notes || "",
      line_items: (e.line_items || []).map((it) => ({ price_type: "exclusive", ...it })),
      attachments: e.attachments || [],
    });
    setOpen(true);
  };

  const updateItem = (idx, patch) => setForm((p) => ({ ...p, line_items: p.line_items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  const addItem = () => setForm((p) => ({ ...p, line_items: [...p.line_items, emptyItem()] }));
  const removeItem = (idx) => setForm((p) => ({ ...p, line_items: p.line_items.length > 1 ? p.line_items.filter((_, i) => i !== idx) : p.line_items }));

  const preview = computeTotals({ gstin: form.vendor_gstin }, form.line_items);

  const save = async () => {
    if (!form.vendor_name || !form.bill_number || !form.bill_date) return toast.error("Vendor, bill no. and date are required");
    if (form.line_items.some((it) => !it.description || !it.quantity || !it.rate)) return toast.error("Each line item needs description, quantity and rate");
    try {
      const payload = {
        ...form,
        line_items: form.line_items.map((it) => ({
          ...it, quantity: Number(it.quantity), rate: Number(it.rate), tax_rate: Number(it.tax_rate),
        })),
      };
      if (editing) await api.put(`/expenses/${editing.id}`, payload);
      else await api.post("/expenses", payload);
      toast.success(editing ? "Expense updated" : "Expense recorded");
      setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const del = async (e) => {
    if (!window.confirm(`Delete expense ${e.bill_number}?`)) return;
    try { await api.delete(`/expenses/${e.id}`); load(); toast.success("Deleted"); }
    catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const filtered = list.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return e.vendor_name.toLowerCase().includes(s) || e.bill_number.toLowerCase().includes(s) || (e.vendor_gstin || "").toLowerCase().includes(s);
  });

  const totals = list.reduce((a, e) => {
    a.paid += e.amount_paid || 0;
    a.outstanding += e.balance || 0;
    a.itc += e.itc_eligible ? (e.total_tax || 0) : 0;
    a.count += 1;
    return a;
  }, { paid: 0, outstanding: 0, itc: 0, count: 0 });

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Purchases & Overheads</div>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <Receipt className="w-8 h-8 text-blue-600" /> Expenses & Vendor Bills
          </h1>
          <p className="text-sm text-slate-500 mt-1">Record purchases and bills. Eligible GST becomes Input Tax Credit for GST settlement.</p>
        </div>
        <Button onClick={openNew} data-testid="add-expense-btn" className="bg-blue-600 hover:bg-blue-700 text-white gap-2"><Plus className="w-4 h-4" /> Record Expense</Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total Bills" value={totals.count} num={false} />
        <Kpi label="Amount Paid Out" value={totals.paid} />
        <Kpi label="Payable" value={totals.outstanding} tone="amber" />
        <Kpi label="ITC Eligible" value={totals.itc} tone="green" />
      </div>

      <Card className="p-4 border-slate-200 rounded-md flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor / bill #…" className="pl-9" data-testid="expense-search" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52" data-testid="expense-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partially_paid">Partially Paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-0 border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Bill #</th>
              <th className="px-4 py-3 text-left">Vendor</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Taxable</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">ITC</th>
              <th className="px-4 py-3 text-center">Docs</th>
              <th className="px-4 py-3 text-right">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="11" className="px-4 py-14 text-center text-slate-400">
                <Receipt className="w-8 h-8 mx-auto mb-3 opacity-40" /> No expenses recorded yet.
              </td></tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`expense-row-${e.bill_number}`}>
                <td className="px-4 py-3 font-mono">{e.bill_number}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{e.vendor_name}</div>
                  <div className="text-xs font-mono text-slate-500">{e.vendor_gstin || "—"}</div>
                </td>
                <td className="px-4 py-3 text-xs"><span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">{e.category}</span></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.bill_date}</td>
                <td className="px-4 py-3 text-right font-mono">{fmtINRWithSymbol(e.taxable_amount)}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-600">{fmtINRWithSymbol(e.total_tax)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{fmtINRWithSymbol(e.grand_total)}</td>
                <td className="px-4 py-3 text-center">{e.itc_eligible ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-400 mx-auto" />}</td>
                <td className="px-4 py-3 text-center">
                  {(e.attachments || []).length > 0 ? (
                    <a href={e.attachments[0].url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 text-xs" data-testid={`expense-doc-${e.bill_number}`}>
                      <Paperclip className="w-3.5 h-3.5" /> {e.attachments.length}
                    </a>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right"><StatusPill status={e.status} /></td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => openEdit(e)} data-testid={`expense-edit-${e.bill_number}`} className="text-blue-600 text-xs">Edit</button>
                  {isAdmin && <button onClick={() => del(e)} className="text-red-500 text-xs"><Trash2 className="w-3.5 h-3.5 inline" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Expense — ${editing.bill_number}` : "Record New Expense"}</DialogTitle>
            <DialogDescription>Enter vendor bill details. Eligible GST is tracked as Input Tax Credit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto te-scroll pr-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><Label>Vendor Name *</Label><Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} data-testid="exp-vendor-name" /></div>
              <div><Label>Vendor GSTIN</Label><Input value={form.vendor_gstin} onChange={(e) => setForm({ ...form, vendor_gstin: e.target.value.toUpperCase() })} data-testid="exp-vendor-gstin" placeholder="24XXXX…" /></div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="exp-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Bill Number *</Label><Input value={form.bill_number} onChange={(e) => setForm({ ...form, bill_number: e.target.value })} data-testid="exp-bill-no" /></div>
              <div><Label>Bill Date *</Label><Input type="date" value={form.bill_date} onChange={(e) => setForm({ ...form, bill_date: e.target.value })} data-testid="exp-bill-date" /></div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.itc_eligible} onChange={(e) => setForm({ ...form, itc_eligible: e.target.checked })} data-testid="exp-itc-eligible" />
                  <span>ITC Eligible</span>
                </label>
              </div>
            </div>

            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Line Items</span>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3" /> Add</Button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-2 py-2 text-left">Description</th>
                    <th className="px-2 py-2 text-left w-20">HSN</th>
                    <th className="px-2 py-2 text-right w-16">Qty</th>
                    <th className="px-2 py-2 text-left w-20">Unit</th>
                    <th className="px-2 py-2 text-right w-24">Rate</th>
                    <th className="px-2 py-2 text-right w-16">Tax %</th>
                    <th className="px-2 py-2 text-left w-24">Type</th>
                    <th className="px-2 py-2 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.line_items.map((it, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1.5"><Input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} data-testid={`exp-item-desc-${i}`} /></td>
                      <td className="px-2 py-1.5"><Input value={it.hsn} onChange={(e) => updateItem(i, { hsn: e.target.value })} /></td>
                      <td className="px-2 py-1.5"><Input type="number" step="0.01" className="text-right font-mono" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} data-testid={`exp-item-qty-${i}`} /></td>
                      <td className="px-2 py-1.5">
                        <Select value={it.unit} onValueChange={(v) => updateItem(i, { unit: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5"><Input type="number" step="0.01" className="text-right font-mono" value={it.rate} onChange={(e) => updateItem(i, { rate: e.target.value })} data-testid={`exp-item-rate-${i}`} /></td>
                      <td className="px-2 py-1.5">
                        <Select value={String(it.tax_rate)} onValueChange={(v) => updateItem(i, { tax_rate: Number(v) })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{TAX_BRACKETS.map(t => <SelectItem key={t} value={String(t)}>{t}%</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={it.price_type} onValueChange={(v) => updateItem(i, { price_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="exclusive">Excl.</SelectItem>
                            <SelectItem value="inclusive">Incl.</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5"><button onClick={() => removeItem(i)}><Trash2 className="w-4 h-4 text-slate-400" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <FileUploader
              attachments={form.attachments}
              onChange={(atts) => setForm({ ...form, attachments: atts })}
              testIdPrefix="exp-attach"
            />

            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="bg-slate-900 text-white rounded-md p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Taxable</span><span className="font-mono">{fmtINRWithSymbol(preview.taxable_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Tax</span><span className="font-mono">{fmtINRWithSymbol(preview.total_tax)}</span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-slate-700">
                <span className="text-sky-400 uppercase text-xs tracking-wider">Grand Total</span>
                <span className="font-mono text-xl font-semibold" data-testid="exp-preview-total">{fmtINRWithSymbol(preview.grand_total)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="exp-save-btn" className="bg-blue-600 hover:bg-blue-700 text-white">{editing ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Kpi = ({ label, value, tone, num = true }) => {
  const c = tone === "amber" ? "text-amber-700" : tone === "green" ? "text-emerald-700" : "text-slate-900";
  return (
    <Card className="p-4 border-slate-200 rounded-md">
      <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-2">{label}</div>
      <div className={`text-lg font-mono font-semibold ${c}`}>{num ? fmtINRWithSymbol(value) : value}</div>
    </Card>
  );
};
