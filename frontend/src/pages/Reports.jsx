import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtINRWithSymbol, todayISO } from "@/lib/gst";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, TrendingDown, Wallet, Building2, PieChart, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export default function Reports() {
  const [tab, setTab] = useState("pnl");
  const fy = getFiscalYearRange();
  const [range, setRange] = useState({ from: fy.from, to: fy.to });
  const [pnl, setPnl] = useState(null);
  const [gst, setGst] = useState(null);
  const [bs, setBs] = useState(null);

  const load = () => {
    const params = { from_date: range.from, to_date: range.to };
    api.get("/reports/pnl", { params }).then((r) => setPnl(r.data)).catch(() => {});
    api.get("/reports/gst-settlement", { params }).then((r) => setGst(r.data)).catch(() => {});
    api.get("/reports/balance-sheet", { params: { as_of: range.to } }).then((r) => setBs(r.data)).catch(() => {});
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range.from, range.to]);

  return (
    <div className="space-y-6 animate-fade-up">
      <header>
        <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Financial Statements</div>
        <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" /> Reports
        </h1>
        <p className="text-sm text-slate-500 mt-1">Auto-generated Profit & Loss, Balance Sheet and GST Settlement across your chosen period.</p>
      </header>

      {/* Range */}
      <Card className="p-4 border-slate-200 rounded-md flex flex-wrap items-end gap-4">
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-slate-500">From</Label>
          <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="mt-1.5" data-testid="report-from-date" />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-slate-500">To</Label>
          <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="mt-1.5" data-testid="report-to-date" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Preset label="This Month" onClick={() => setRange(monthRange())} testid="preset-month" />
          <Preset label="This Quarter" onClick={() => setRange(quarterRange())} testid="preset-quarter" />
          <Preset label={`FY ${fy.label}`} onClick={() => setRange(fy)} testid="preset-fy" />
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="bg-slate-100 border border-slate-200">
          <TabsTrigger value="pnl" data-testid="tab-pnl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="bs" data-testid="tab-bs">Balance Sheet</TabsTrigger>
          <TabsTrigger value="gst" data-testid="tab-gst">GST Settlement</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl">
          <Card className="p-6 border-slate-200 rounded-md">
            {!pnl ? <div className="text-slate-400">Loading…</div> : (
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-6">
                  <div className="text-xs uppercase tracking-[0.3em] text-blue-600">Profit & Loss Statement</div>
                  <div className="font-heading text-2xl font-semibold mt-1">TRAYAMBAK ENTERPRISE</div>
                  <div className="text-sm text-slate-500 font-mono">{range.from} → {range.to}</div>
                </div>
                <div className="space-y-1">
                  <PnlRow label="Gross Revenue (net of credit notes)" value={pnl.gross_revenue} strong />
                  <PnlRow label="Less: Cost of Goods Sold (Raw Material + Logistics)" value={-pnl.cogs} />
                  <PnlRow label="Gross Profit" value={pnl.gross_profit} strong border />
                  <div className="mt-2 mb-1 text-[10px] uppercase tracking-wider text-slate-500 pt-3">Operating Expenses</div>
                  {Object.entries(pnl.expense_breakdown || {}).filter(([k]) => !["Raw Material","Logistics"].includes(k)).map(([k,v]) => (
                    <PnlRow key={k} label={k} value={-v} indent />
                  ))}
                  <PnlRow label="Total Operating Expenses" value={-pnl.operating_expenses} border />
                  <PnlRow label="Net Profit" value={pnl.net_profit} strong huge />
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-slate-500">Net Margin</span>
                    <span className="font-mono font-semibold text-emerald-700">{pnl.net_margin_percent}%</span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="bs">
          <Card className="p-6 border-slate-200 rounded-md">
            {!bs ? <div className="text-slate-400">Loading…</div> : (
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-6">
                  <div className="text-xs uppercase tracking-[0.3em] text-blue-600">Balance Sheet</div>
                  <div className="font-heading text-2xl font-semibold mt-1">TRAYAMBAK ENTERPRISE</div>
                  <div className="text-sm text-slate-500 font-mono">As of {bs.as_of}</div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-300">
                      <ArrowUpCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Assets</span>
                    </div>
                    <BsRow label="Cash / Bank (IDFC FIRST)" value={bs.assets.cash_bank} icon={<Wallet className="w-3.5 h-3.5" />} />
                    <BsRow label="Accounts Receivable" value={bs.assets.accounts_receivable} icon={<TrendingUp className="w-3.5 h-3.5" />} />
                    <BsRow label="Input Tax Credit Balance" value={bs.assets.input_tax_credit} icon={<PieChart className="w-3.5 h-3.5" />} />
                    <BsRow label="Total Assets" value={bs.assets.total} strong />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-300">
                      <ArrowDownCircle className="w-4 h-4 text-amber-600" />
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Liabilities & Equity</span>
                    </div>
                    <BsRow label="Accounts Payable" value={bs.liabilities.accounts_payable} icon={<TrendingDown className="w-3.5 h-3.5" />} />
                    <BsRow label="Net GST Payable" value={bs.liabilities.gst_payable} icon={<PieChart className="w-3.5 h-3.5" />} />
                    <BsRow label="Total Liabilities" value={bs.liabilities.total} border />
                    <BsRow label="Proprietor's Capital" value={bs.equity.proprietor_capital} icon={<Building2 className="w-3.5 h-3.5" />} />
                    <BsRow label="Retained Earnings" value={bs.equity.retained_earnings} />
                    <BsRow label="Total Equity" value={bs.equity.total} border />
                    <BsRow label="Total Liabilities & Equity" value={bs.liabilities.total + bs.equity.total} strong />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="gst">
          <Card className="p-6 border-slate-200 rounded-md">
            {!gst ? <div className="text-slate-400">Loading…</div> : (
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-6">
                  <div className="text-xs uppercase tracking-[0.3em] text-blue-600">GST Settlement Ledger</div>
                  <div className="font-heading text-2xl font-semibold mt-1">Net GST Liability</div>
                  <div className="text-sm text-slate-500 font-mono">{range.from} → {range.to}</div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <GstBlock title="Output GST (Sales)" data={gst.output_gst} />
                  <GstBlock title="Input Tax Credit" data={gst.input_tax_credit} tone="emerald" />
                  <GstBlock title="Net Payable" data={gst.net_liability} tone="amber" strong />
                </div>
                <div className="mt-6 p-5 bg-slate-900 text-white rounded-md flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-[0.2em] text-sky-400">Net GST Liability</span>
                  <span className="text-3xl font-mono font-bold" data-testid="gst-net-total">{fmtINRWithSymbol(gst.net_liability.total)}</span>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const Preset = ({ label, onClick, testid }) => (
  <button data-testid={testid} onClick={onClick} className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:border-blue-500 hover:text-blue-600 transition-colors">{label}</button>
);

const PnlRow = ({ label, value, strong, border, indent, huge }) => (
  <div className={`flex justify-between py-1.5 ${border ? "border-t border-slate-200 pt-2" : ""} ${huge ? "text-lg mt-2 pt-3 border-t-2 border-slate-900" : ""}`}>
    <span className={`${indent ? "pl-4 text-slate-600" : strong ? "text-slate-900 font-semibold" : "text-slate-700"}`}>{label}</span>
    <span className={`font-mono ${strong ? "font-semibold text-slate-900" : "text-slate-800"}`}>{fmtINRWithSymbol(value)}</span>
  </div>
);

const BsRow = ({ label, value, icon, strong, border }) => (
  <div className={`flex justify-between py-1.5 ${border ? "border-t border-slate-200 pt-2 mt-1" : ""}`}>
    <span className={`flex items-center gap-2 ${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}>
      {icon && <span className="text-slate-400">{icon}</span>}{label}
    </span>
    <span className={`font-mono ${strong ? "font-semibold" : ""}`}>{fmtINRWithSymbol(value)}</span>
  </div>
);

const GstBlock = ({ title, data, tone, strong }) => {
  const bg = tone === "emerald" ? "bg-emerald-50 border-emerald-200" : tone === "amber" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200";
  return (
    <div className={`border rounded-md p-4 ${bg}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">{title}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-slate-600">CGST</span><span className="font-mono">{fmtINRWithSymbol(data.cgst)}</span></div>
        <div className="flex justify-between"><span className="text-slate-600">SGST</span><span className="font-mono">{fmtINRWithSymbol(data.sgst)}</span></div>
        <div className="flex justify-between"><span className="text-slate-600">IGST</span><span className="font-mono">{fmtINRWithSymbol(data.igst)}</span></div>
        <div className="flex justify-between pt-1 mt-1 border-t border-slate-300"><span className="font-semibold">Total</span><span className={`font-mono font-semibold ${strong ? "text-lg" : ""}`}>{fmtINRWithSymbol(data.total)}</span></div>
      </div>
    </div>
  );
};

function getFiscalYearRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const start = m >= 4 ? y : y - 1;
  const end = start + 1;
  return { from: `${start}-04-01`, to: `${end}-03-31`, label: `${start}-${String(end).slice(2)}` };
}
function monthRange() {
  const d = new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const from = new Date(y, m, 1).toISOString().slice(0, 10);
  const to = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}
function quarterRange() {
  const d = new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const qStart = Math.floor(m / 3) * 3;
  const from = new Date(y, qStart, 1).toISOString().slice(0, 10);
  const to = new Date(y, qStart + 3, 0).toISOString().slice(0, 10);
  return { from, to };
}
