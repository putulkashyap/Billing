import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BarChart3, Download } from "lucide-react";
import { fmtINRWithSymbol } from "@/lib/gst";

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

const Cell = ({ label, val, tone = "" }) => (
  <div className={`px-4 py-3 rounded border ${tone}`}>
    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
    <div className="text-lg font-mono mt-1 font-semibold">{fmtINRWithSymbol(val)}</div>
  </div>
);

export default function GstSummary() {
  const [fy, setFy] = useState(FY_LIST()[2].value);
  const [month, setMonth] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { from, to } = fyToRange(fy);
      let f = from, t = to;
      if (month) {
        const [y, mm] = month.split("-");
        const endDay = new Date(Number(y), Number(mm), 0).getDate();
        f = `${y}-${mm.padStart(2, "0")}-01`;
        t = `${y}-${mm.padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
      }
      const p = new URLSearchParams({ from_date: f, to_date: t });
      const r = await api.get(`/reports/gst-summary?${p}`);
      setData(r.data);
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setLoading(false); }
  };

  const downloadGstr1 = async () => {
    try {
      const { from, to } = fyToRange(fy);
      let f = from, t = to;
      if (month) {
        const [y, mm] = month.split("-");
        const endDay = new Date(Number(y), Number(mm), 0).getDate();
        f = `${y}-${mm.padStart(2, "0")}-01`;
        t = `${y}-${mm.padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
      }
      const p = new URLSearchParams({ from_date: f, to_date: t, fmt: "csv" });
      const r = await api.get(`/reports/gstr1-working?${p}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement("a");
      a.href = url; a.download = `gstr1_working_${fy}${month ? `_${month}` : ""}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error("Export failed"); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Working Calculation</div>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" /> GST Summary
          </h1>
          <p className="text-sm text-slate-500 mt-1">Output GST − Eligible ITC = Indicative Net GST Position.</p>
        </div>
        <Button variant="outline" onClick={downloadGstr1} data-testid="gstr1-export" className="gap-2">
          <Download className="w-4 h-4" /> GSTR-1 Working Data Export (CSV)
        </Button>
      </header>

      <Card className="p-4 border-slate-200 rounded-md">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Financial Year</Label>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger data-testid="sum-fy"><SelectValue /></SelectTrigger>
              <SelectContent>{FY_LIST().map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Month (optional)</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} data-testid="sum-month" /></div>
          <div className="flex items-end md:col-span-2">
            <Button onClick={load} data-testid="sum-apply" className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? "Loading…" : "Apply"}
            </Button>
          </div>
        </div>
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 border-slate-200 rounded-md space-y-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Output GST (Sales)</div>
              <div className="grid grid-cols-2 gap-2">
                <Cell label="CGST" val={data.output.cgst} tone="bg-slate-50" />
                <Cell label="SGST" val={data.output.sgst} tone="bg-slate-50" />
                <Cell label="IGST" val={data.output.igst} tone="bg-slate-50" />
                <Cell label="Cess" val={data.output.cess} tone="bg-slate-50" />
              </div>
              <div className="pt-2 border-t border-slate-200">
                <Cell label="Total Output" val={data.output.total} tone="bg-emerald-50 border-emerald-200" />
              </div>
            </Card>

            <Card className="p-5 border-slate-200 rounded-md space-y-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Input GST (Purchases)</div>
              <div className="grid grid-cols-2 gap-2">
                <Cell label="CGST" val={data.input.cgst} tone="bg-slate-50" />
                <Cell label="SGST" val={data.input.sgst} tone="bg-slate-50" />
                <Cell label="IGST" val={data.input.igst} tone="bg-slate-50" />
                <Cell label="Cess" val={data.input.cess} tone="bg-slate-50" />
              </div>
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2">
                <Cell label="Eligible ITC" val={data.itc.eligible} tone="bg-emerald-50 border-emerald-200" />
                <Cell label="Ineligible" val={data.itc.ineligible} tone="bg-red-50 border-red-200" />
              </div>
            </Card>

            <Card className="p-5 border-slate-200 rounded-md space-y-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Position</div>
              <Cell label="Gross Output GST" val={data.position.gross_output_gst} tone="bg-slate-50" />
              <Cell label="Less Eligible ITC" val={data.position.less_eligible_itc} tone="bg-slate-50" />
              <Cell label="= Indicative Net GST" val={data.position.indicative_net_gst}
                    tone={data.position.indicative_net_gst >= 0 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"} />
              <div className="text-[11px] text-slate-500 leading-relaxed">
                {data.disclaimer}
              </div>
            </Card>
          </div>

          <Card className="p-4 border-slate-200 rounded-md text-xs text-slate-500">
            {data.invoice_count} invoice(s) · {data.credit_note_count} credit note(s) · {data.expense_count} expense bill(s) considered.
          </Card>
        </>
      )}
    </div>
  );
}
