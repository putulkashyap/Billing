import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { fmtINRWithSymbol, todayISO } from "@/lib/gst";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatusPill } from "./Dashboard";
import { Wallet, Search, TrendingUp, AlertTriangle, MessageCircle, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

export default function Reconciliation() {
  const [invoices, setInvoices] = useState([]);
  const [aging, setAging] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [payOpen, setPayOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [payment, setPayment] = useState({ amount: 0, payment_date: todayISO(), method: "Bank Transfer", reference: "", notes: "" });

  const load = () => {
    api.get("/invoices").then((r) => setInvoices(r.data));
    api.get("/reports/aging").then((r) => setAging(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    return invoices.reduce((acc, i) => {
      acc.taxable += i.taxable_amount || 0;
      acc.cgst += i.cgst || 0;
      acc.sgst += i.sgst || 0;
      acc.igst += i.igst || 0;
      acc.grand += i.grand_total || 0;
      acc.paid += i.amount_paid || 0;
      acc.outstanding += i.balance || 0;
      return acc;
    }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0, paid: 0, outstanding: 0 });
  }, [invoices]);

  const filtered = invoices.filter((i) => {
    if (status !== "all" && i.status !== status) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return i.invoice_number.toLowerCase().includes(s) || (i.customer?.name || "").toLowerCase().includes(s);
  });

  const openPay = (inv) => {
    setTarget(inv);
    setPayment({ amount: inv.balance, payment_date: todayISO(), method: "Bank Transfer", reference: "", notes: "" });
    setPayOpen(true);
  };

  const sendWhatsAppReminder = async (inv) => {
    try {
      const r = await api.get(`/reminders/whatsapp/${inv.id}`);
      window.open(r.data.whatsapp_url, "_blank");
      if (!r.data.phone) toast.info("Add customer phone to auto-fill the WhatsApp recipient.");
    } catch (e) { toast.error("Could not prepare reminder"); }
  };

  const sendEmailReminder = async (inv) => {
    try {
      const r = await api.get(`/reminders/whatsapp/${inv.id}`);
      const subj = encodeURIComponent(`Payment reminder — Invoice ${inv.invoice_number}`);
      const body = encodeURIComponent(r.data.message);
      window.location.href = `mailto:${r.data.email || ""}?subject=${subj}&body=${body}`;
    } catch (e) { toast.error("Could not prepare reminder"); }
  };

  const submitPay = async () => {
    if (!payment.amount || payment.amount <= 0) return toast.error("Enter a valid amount");
    try {
      await api.post(`/invoices/${target.id}/payments`, { ...payment, amount: Number(payment.amount) });
      toast.success("Payment recorded");
      setPayOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const cards = [
    { label: "Taxable Revenue", val: totals.taxable, tone: "blue" },
    { label: "CGST Collected", val: totals.cgst, tone: "sky" },
    { label: "SGST Collected", val: totals.sgst, tone: "sky" },
    { label: "IGST Collected", val: totals.igst, tone: "sky" },
    { label: "Received", val: totals.paid, tone: "green" },
    { label: "Outstanding", val: totals.outstanding, tone: "amber" },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <header>
        <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Money In</div>
        <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900 flex items-center gap-3">
          <Wallet className="w-8 h-8 text-blue-600" /> Account Reconciliation
        </h1>
        <p className="text-sm text-slate-500 mt-1">Log payments against invoices and track outstanding receivables.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4 border-slate-200 rounded-md">
            <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-2">{c.label}</div>
            <div className="text-lg font-mono font-semibold text-slate-900" data-testid={`recon-${c.label.toLowerCase().replace(/\s+/g,'-')}`}>{fmtINRWithSymbol(c.val)}</div>
          </Card>
        ))}
      </div>

      {/* Aging Analysis */}
      {aging && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-3">Outstanding Aging Analysis</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["0-30", "31-60", "60+"].map((k) => {
              const b = aging.buckets[k] || { count: 0, amount: 0, invoices: [] };
              const overdue = k !== "0-30";
              return (
                <Card key={k} className={`p-5 rounded-md ${overdue && b.amount > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {overdue && b.amount > 0 ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <Clock className="w-4 h-4 text-slate-500" />}
                      <span className="text-xs uppercase tracking-wider text-slate-600">{k} days</span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">{b.count} inv.</span>
                  </div>
                  <div className="mt-3 text-2xl font-mono font-semibold" data-testid={`aging-${k}`}>{fmtINRWithSymbol(b.amount)}</div>
                  {overdue && b.amount > 0 && (
                    <div className="mt-2 text-xs text-amber-700 font-medium">Payment overdue</div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Card className="p-4 border-slate-200 rounded-md flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52" data-testid="recon-status-filter"><SelectValue /></SelectTrigger>
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
              <th className="px-4 py-3 text-left">Invoice</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-right">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="8" className="px-4 py-14 text-center text-slate-400">
                <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-40" /> Nothing to reconcile.
              </td></tr>
            )}
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono">{inv.invoice_number}</td>
                <td className="px-4 py-3">{inv.customer?.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{inv.invoice_date}</td>
                <td className="px-4 py-3 text-right font-mono">{fmtINRWithSymbol(inv.grand_total)}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-700">{fmtINRWithSymbol(inv.amount_paid)}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-700">{fmtINRWithSymbol(inv.balance)}</td>
                <td className="px-4 py-3 text-right"><StatusPill status={inv.status} /></td>
                <td className="px-4 py-3 text-right">
                  {inv.status !== "paid" && (
                    <button onClick={() => openPay(inv)} className="text-blue-600 text-xs hover:underline" data-testid={`log-payment-${inv.invoice_number}`}>Log Payment</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Payment · {target?.invoice_number}</DialogTitle>
            <DialogDescription>Record a full or partial payment received against this invoice.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-slate-500">Outstanding: <span className="font-mono text-amber-700">{fmtINRWithSymbol(target?.balance)}</span></div>
            <div><Label>Amount</Label><Input type="number" step="0.01" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} data-testid="pay-amount-input" /></div>
            <div><Label>Payment Date</Label><Input type="date" value={payment.payment_date} onChange={(e) => setPayment({ ...payment, payment_date: e.target.value })} /></div>
            <div>
              <Label>Method</Label>
              <Select value={payment.method} onValueChange={(v) => setPayment({ ...payment, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Bank Transfer", "UPI", "Cheque", "Cash", "NEFT/RTGS"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reference / UTR / Cheque No.</Label><Input value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} data-testid="pay-ref-input" /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={submitPay} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="pay-save-btn">Save Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
