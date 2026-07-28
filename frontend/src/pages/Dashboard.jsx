import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtINRWithSymbol } from "@/lib/gst";
import { Card } from "@/components/ui/card";
import { TrendingUp, Wallet, Receipt, IndianRupee, ArrowUpRight, FileCheck2, Clock, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    api.get("/reports/summary").then((r) => setSummary(r.data)).catch(() => {});
    api.get("/invoices").then((r) => setInvoices(r.data.slice(0, 6))).catch(() => {});
  }, []);

  const cards = [
    { label: "Taxable Revenue", value: summary?.taxable_revenue, icon: TrendingUp, tone: "blue" },
    { label: "Total CGST", value: summary?.cgst, icon: Receipt, tone: "sky" },
    { label: "Total SGST", value: summary?.sgst, icon: Receipt, tone: "sky" },
    { label: "Total IGST", value: summary?.igst, icon: IndianRupee, tone: "sky" },
    { label: "Amount Paid", value: summary?.amount_paid, icon: FileCheck2, tone: "green" },
    { label: "Outstanding", value: summary?.outstanding, icon: Wallet, tone: "amber" },
  ];

  return (
    <div className="space-y-8 animate-fade-up" data-testid="dashboard-root">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Overview</div>
          <h1 className="text-4xl sm:text-5xl font-heading font-semibold tracking-tight text-slate-900">
            Fiscal Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Live snapshot of billing, tax collection, and receivables — TRAYAMBAK ENTERPRISE
          </p>
        </div>
        <Link
          to="/invoices/new"
          data-testid="dashboard-new-invoice"
          className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-md hover:bg-slate-800 transition-colors"
        >
          Create Invoice <ArrowUpRight className="w-4 h-4" />
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5 border-slate-200 rounded-md hover:border-blue-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.tone === "green" ? "text-emerald-500" : c.tone === "amber" ? "text-amber-500" : "text-blue-600"}`} />
            </div>
            <div className="text-xl font-mono font-semibold text-slate-900" data-testid={`stat-${c.label.toLowerCase().replace(/\s+/g,'-')}`}>
              {summary ? fmtINRWithSymbol(c.value) : "—"}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-0 border-slate-200 rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Recent</div>
              <h3 className="text-lg font-heading font-semibold text-slate-900">Latest Invoices</h3>
            </div>
            <Link to="/invoices" className="text-xs text-blue-600 hover:underline" data-testid="dashboard-view-all-invoices">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-[10px] uppercase tracking-wider">
                <th className="px-5 py-2 text-left">Invoice #</th>
                <th className="px-5 py-2 text-left">Customer</th>
                <th className="px-5 py-2 text-left">Date</th>
                <th className="px-5 py-2 text-right">Amount</th>
                <th className="px-5 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-400 text-sm">No invoices yet. Create your first one.</td></tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-slate-900">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-slate-700">{inv.customer?.name}</td>
                  <td className="px-5 py-3 text-slate-500 font-mono">{inv.invoice_date}</td>
                  <td className="px-5 py-3 text-right font-mono text-slate-900">{fmtINRWithSymbol(inv.grand_total)}</td>
                  <td className="px-5 py-3 text-right"><StatusPill status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5 border-slate-200 rounded-md">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-1">Legal Identity</div>
          <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" /> TRAYAMBAK ENTERPRISE
          </h3>
          <dl className="space-y-3 text-sm">
            <Detail label="Proprietor" value="Ranjita Rai" />
            <Detail label="GSTIN" value="24AMAPR1170Q1ZT" mono />
            <Detail label="State" value="Gujarat (24)" />
            <Detail label="Bank" value="IDFC FIRST — Gotri" />
            <Detail label="A/C" value="69315494820" mono />
            <Detail label="IFSC" value="IDFB0042392" mono />
          </dl>
          <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Last sync {format(new Date(), "PPp")}
          </div>
        </Card>
      </div>
    </div>
  );
}

const Detail = ({ label, value, mono }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-slate-500">{label}</dt>
    <dd className={`text-slate-900 text-right ${mono ? "font-mono" : ""}`}>{value}</dd>
  </div>
);

export const StatusPill = ({ status }) => {
  const map = {
    paid: { bg: "bg-emerald-50", tx: "text-emerald-700", ring: "ring-emerald-200", label: "Paid" },
    pending: { bg: "bg-amber-50", tx: "text-amber-700", ring: "ring-amber-200", label: "Pending" },
    partially_paid: { bg: "bg-blue-50", tx: "text-blue-700", ring: "ring-blue-200", label: "Partially Paid" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${s.bg} ${s.tx} ${s.ring}`}>
      {s.label}
    </span>
  );
};
