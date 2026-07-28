import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { fmtINRWithSymbol } from "@/lib/gst";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "./Dashboard";
import { FileText, Eye, Search, Plus, Pencil, FileMinus } from "lucide-react";
import InvoicePreview from "@/components/invoice/InvoicePreview";

export default function Invoices() {
  const nav = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [previewInv, setPreviewInv] = useState(null);

  const load = () => api.get("/invoices").then((r) => setInvoices(r.data));
  useEffect(() => { load(); }, []);

  const filtered = invoices.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      i.invoice_number.toLowerCase().includes(s) ||
      (i.customer?.name || "").toLowerCase().includes(s) ||
      (i.customer?.gstin || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Ledger</div>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900">Tax Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">All finalized GST invoices. Edit and delete are disabled on finalized records.</p>
        </div>
        <Link
          to="/invoices/new"
          data-testid="invoices-new-btn"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md text-sm"
        >
          <Plus className="w-4 h-4" /> New Invoice
        </Link>
      </header>

      <Card className="p-4 border-slate-200 rounded-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              data-testid="invoice-search-input"
              placeholder="Search by number, customer, GSTIN…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]" data-testid="invoice-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partially_paid">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-0 border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Invoice #</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">GSTIN</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Taxable</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-right">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="11" className="px-4 py-16 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-3 opacity-40" />
                No invoices match your filter.
              </td></tr>
            )}
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`invoice-row-${inv.invoice_number}`}>
                <td className="px-4 py-3 font-mono text-slate-900">{inv.invoice_number}</td>
                <td className="px-4 py-3 text-slate-800">{inv.customer?.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{inv.customer?.gstin || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${inv.order_type === 'gem' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                    {inv.order_type === "gem" ? "GeM" : "B2B/B2C"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{inv.invoice_date}</td>
                <td className="px-4 py-3 text-right font-mono">{fmtINRWithSymbol(inv.taxable_amount)}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-600">{fmtINRWithSymbol(inv.total_tax)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{fmtINRWithSymbol(inv.grand_total)}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-700">{fmtINRWithSymbol(inv.balance)}</td>
                <td className="px-4 py-3 text-right"><StatusPill status={inv.status} /></td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-3 justify-end">
                    <button
                      data-testid={`invoice-view-${inv.invoice_number}`}
                      onClick={() => setPreviewInv(inv)}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                      title="View / Download"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    {inv.status !== "paid" && (
                      <button
                        data-testid={`invoice-edit-${inv.invoice_number}`}
                        onClick={() => nav(`/invoices/${inv.id}/edit`)}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-xs"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    <button
                      data-testid={`invoice-credit-${inv.invoice_number}`}
                      onClick={() => nav(`/credit-notes/new?invoice_id=${inv.id}`)}
                      className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 text-xs"
                      title="Raise Credit Note"
                    >
                      <FileMinus className="w-3.5 h-3.5" /> Credit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {previewInv && <InvoicePreview invoice={previewInv} onClose={() => setPreviewInv(null)} onUpdated={(i) => setPreviewInv(i)} />}
    </div>
  );
}
