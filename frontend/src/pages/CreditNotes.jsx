import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { fmtINRWithSymbol } from "@/lib/gst";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileMinus, Search, Eye } from "lucide-react";
import CreditNotePreview from "@/components/invoice/CreditNotePreview";

export default function CreditNotes() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState(null);
  const nav = useNavigate();

  useEffect(() => { api.get("/credit-notes").then((r) => setList(r.data)).catch(() => {}); }, []);

  const filtered = list.filter((c) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.credit_note_number.toLowerCase().includes(s) ||
      (c.invoice_number || "").toLowerCase().includes(s) ||
      (c.customer?.name || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Adjustments</div>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <FileMinus className="w-8 h-8 text-amber-600" /> Credit Notes
          </h1>
          <p className="text-sm text-slate-500 mt-1">GST-compliant credit notes issued against tax invoices.</p>
        </div>
      </header>

      <Card className="p-4 border-slate-200 rounded-md">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by CN number, invoice, or customer…" className="pl-9" data-testid="credit-note-search" />
        </div>
      </Card>

      <Card className="p-0 border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Credit Note #</th>
              <th className="px-4 py-3 text-left">Ref. Invoice</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-right">Taxable</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="9" className="px-4 py-16 text-center text-slate-400">
                <FileMinus className="w-8 h-8 mx-auto mb-3 opacity-40" />
                No credit notes yet. Raise one from any invoice's <b>Credit</b> action.
              </td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`credit-note-row-${c.credit_note_number}`}>
                <td className="px-4 py-3 font-mono text-slate-900">{c.credit_note_number}</td>
                <td className="px-4 py-3 font-mono text-xs text-blue-700">{c.invoice_number}</td>
                <td className="px-4 py-3">{c.customer?.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.credit_date}</td>
                <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate">{c.reason || "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{fmtINRWithSymbol(c.taxable_amount)}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-600">{fmtINRWithSymbol(c.total_tax)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-amber-700">{fmtINRWithSymbol(c.grand_total)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    data-testid={`credit-note-view-${c.credit_note_number}`}
                    onClick={() => setPreview(c)}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {preview && <CreditNotePreview creditNote={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
