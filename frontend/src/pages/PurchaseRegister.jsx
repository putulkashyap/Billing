import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileSpreadsheet, Download, Filter } from "lucide-react";
import { fmtINRWithSymbol } from "@/lib/gst";
import { INDIAN_STATES, stateName } from "@/lib/india";

const RATES = ["", "0", "5", "12", "18", "28"];
const FY_LIST = () => {
  const y = new Date().getFullYear();
  return [-2, -1, 0, 1].map((o) => {
    const s = y + o;
    return { value: `${s}-${String(s + 1).slice(2)}`, label: `${s}-${String(s + 1).slice(2)}` };
  });
};

const fyToRange = (fy) => {
  const [a] = fy.split("-");
  return { from: `${a}-04-01`, to: `${Number(a) + 1}-03-31` };
};

export default function PurchaseRegister() {
  const [fy, setFy] = useState(FY_LIST()[2].value);
  const [month, setMonth] = useState("");
  const [vendor, setVendor] = useState("");
  const [state, setState] = useState("");
  const [gstRate, setGstRate] = useState("");
  const [hsn, setHsn] = useState("");
  const [itc, setItc] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const build = () => {
    const { from, to } = fyToRange(fy);
    let f = from, t = to;
    if (month) {
      const [y, mm] = month.split("-");
      const start = `${y}-${mm.padStart(2, "0")}-01`;
      const endDay = new Date(Number(y), Number(mm), 0).getDate();
      const end = `${y}-${mm.padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
      f = start; t = end;
    }
    const p = new URLSearchParams();
    if (f) p.set("from_date", f);
    if (t) p.set("to_date", t);
    if (vendor) p.set("vendor", vendor);
    if (state && state !== "__all__") p.set("state", stateName(state));
    if (gstRate && gstRate !== "__all__") p.set("gst_rate", gstRate);
    if (hsn) p.set("hsn", hsn);
    if (itc && itc !== "__all__") p.set("itc_eligibility", itc);
    return p;
  };

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/reports/gst-purchase-register?${build()}`);
      setRows(r.data.rows || []);
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setLoading(false); }
  };

  const exportCsv = async () => {
    try {
      const p = build(); p.set("fmt", "csv");
      const r = await api.get(`/reports/gst-purchase-register?${p}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement("a");
      a.href = url; a.download = `gst_purchase_register_${fy}${month ? `_${month}` : ""}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error("Export failed"); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, []);

  const totals = rows.reduce((a, r) => ({
    taxable: a.taxable + Number(r.taxable_value || 0),
    cgst: a.cgst + Number(r.cgst || 0),
    sgst: a.sgst + Number(r.sgst || 0),
    igst: a.igst + Number(r.igst || 0),
    itc_e: a.itc_e + Number(r.itc_eligible || 0),
    itc_i: a.itc_i + Number(r.itc_ineligible || 0),
    total: a.total + Number(r.total || 0),
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, itc_e: 0, itc_i: 0, total: 0 });

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">ITC Working</div>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-blue-600" /> GST Purchase Register
          </h1>
          <p className="text-sm text-slate-500 mt-1">Vendor bills, GST paid, eligible/ineligible ITC. Working view — not a GSTR-2B reconciliation.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={run} data-testid="pr-apply" className="gap-2">
            <Filter className="w-4 h-4" /> Apply Filters
          </Button>
          <Button onClick={exportCsv} data-testid="pr-export" className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </header>

      <Card className="p-4 border-slate-200 rounded-md">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <div>
            <Label>Financial Year</Label>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger data-testid="pr-fy"><SelectValue /></SelectTrigger>
              <SelectContent>{FY_LIST().map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Month</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} data-testid="pr-month" /></div>
          <div><Label>Vendor</Label><Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Search…" data-testid="pr-vendor" /></div>
          <div>
            <Label>State</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger data-testid="pr-state"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__all__">Any</SelectItem>
                {INDIAN_STATES.map((s) => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>GST Rate</Label>
            <Select value={gstRate} onValueChange={setGstRate}>
              <SelectTrigger data-testid="pr-rate"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any</SelectItem>
                {RATES.filter(Boolean).map((r) => <SelectItem key={r} value={r}>{r}%</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>HSN / SAC</Label><Input value={hsn} onChange={(e) => setHsn(e.target.value)} data-testid="pr-hsn" /></div>
          <div>
            <Label>ITC</Label>
            <Select value={itc} onValueChange={setItc}>
              <SelectTrigger data-testid="pr-itc"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any</SelectItem>
                <SelectItem value="eligible">Eligible</SelectItem>
                <SelectItem value="ineligible">Ineligible</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-0 border-slate-200 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Bill #</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Vendor</th>
                <th className="px-3 py-2 text-left">GSTIN</th>
                <th className="px-3 py-2 text-left">PoS</th>
                <th className="px-3 py-2 text-left">HSN</th>
                <th className="px-3 py-2 text-right">Taxable</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">CGST</th>
                <th className="px-3 py-2 text-right">SGST</th>
                <th className="px-3 py-2 text-right">IGST</th>
                <th className="px-3 py-2 text-right">ITC Elig.</th>
                <th className="px-3 py-2 text-right">ITC Inelig.</th>
                <th className="px-3 py-2 text-center">RCM</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="15" className="px-3 py-10 text-center text-slate-400">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan="15" className="px-3 py-14 text-center text-slate-400">No purchase bills in the selected period.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`pr-row-${i}`}>
                  <td className="px-3 py-2 font-mono">{r.bill_number}</td>
                  <td className="px-3 py-2 font-mono">{r.bill_date}</td>
                  <td className="px-3 py-2">{r.vendor}</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{r.vendor_gstin || "—"}</td>
                  <td className="px-3 py-2">{r.place_of_supply_code}</td>
                  <td className="px-3 py-2 font-mono">{r.hsn || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtINRWithSymbol(r.taxable_value)}</td>
                  <td className="px-3 py-2 text-right">{Number(r.gst_rate).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtINRWithSymbol(r.cgst)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtINRWithSymbol(r.sgst)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtINRWithSymbol(r.igst)}</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-700">{fmtINRWithSymbol(r.itc_eligible)}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-600">{fmtINRWithSymbol(r.itc_ineligible)}</td>
                  <td className="px-3 py-2 text-center">{r.reverse_charge ? "Yes" : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{fmtINRWithSymbol(r.total)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-slate-100 font-mono">
                  <td colSpan="6" className="px-3 py-2 text-right uppercase text-[10px] tracking-wider">Totals</td>
                  <td className="px-3 py-2 text-right">{fmtINRWithSymbol(totals.taxable)}</td>
                  <td></td>
                  <td className="px-3 py-2 text-right">{fmtINRWithSymbol(totals.cgst)}</td>
                  <td className="px-3 py-2 text-right">{fmtINRWithSymbol(totals.sgst)}</td>
                  <td className="px-3 py-2 text-right">{fmtINRWithSymbol(totals.igst)}</td>
                  <td className="px-3 py-2 text-right">{fmtINRWithSymbol(totals.itc_e)}</td>
                  <td className="px-3 py-2 text-right">{fmtINRWithSymbol(totals.itc_i)}</td>
                  <td></td>
                  <td className="px-3 py-2 text-right">{fmtINRWithSymbol(totals.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
