import React, { useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, Download, AlertTriangle, CheckCircle2, FileJson } from "lucide-react";

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MONTH_LABEL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function Gstr1Portal() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const fp = `${month}${year}`;

  const runDryRun = async () => {
    setBusy(true); setStatus(null);
    try {
      const r = await api.get(`/reports/gstr1-portal-json?fp=${fp}&dryrun=true`);
      setStatus({ ok: true, ...r.data });
      toast.success("Validation passed — ready to generate JSON");
    } catch (e) {
      const d = e?.response?.data?.detail;
      setStatus({ ok: false, ...(d || { message: "Validation failed" }) });
    } finally { setBusy(false); }
  };

  const downloadJson = async () => {
    setBusy(true);
    try {
      const r = await api.get(`/reports/gstr1-portal-json?fp=${fp}`);
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `gstr1_${fp}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("GSTR-1 JSON downloaded");
    } catch (e) {
      const d = e?.response?.data?.detail;
      setStatus({ ok: false, ...(d || { message: "Blocked" }) });
      toast.error("Cannot generate — see errors below");
    } finally { setBusy(false); }
  };

  const yearNow = new Date().getFullYear();
  const years = [yearNow - 2, yearNow - 1, yearNow, yearNow + 1].map(String);

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Compliance</div>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" /> GSTR-1 Portal JSON
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Validate outward supplies for a filing period and generate the portal JSON. Not automatically validated against a machine-readable GSTN schema — see below.
          </p>
        </div>
      </header>

      <Card className="p-5 border-slate-200 rounded-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label>Filing Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger data-testid="gstr1-month"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={m} value={m}>{MONTH_LABEL[i]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Filing Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger data-testid="gstr1-year"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="text-sm">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Filing Period</div>
            <div className="font-mono text-lg mt-1">{fp}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={runDryRun} disabled={busy} data-testid="gstr1-validate" className="gap-2">
              <ShieldCheck className="w-4 h-4" /> Validate
            </Button>
            <Button onClick={downloadJson} disabled={busy} data-testid="gstr1-download" className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Download className="w-4 h-4" /> Generate & Download
            </Button>
          </div>
        </div>
      </Card>

      {status && (
        <Card className="p-5 border-slate-200 rounded-md space-y-4">
          {status.ok || status.status === "PASS" ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
              <div>
                <div className="font-semibold">PASS — Ready for GSTR-1 JSON generation.</div>
                <div className="text-xs opacity-80">
                  {status.invoice_count ?? 0} invoice(s) · {status.credit_note_count ?? 0} credit note(s) considered
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 text-red-700 rounded border border-red-200">
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">BLOCKED — {status.message || "validation failed"}</div>
                {status.errors?.length > 0 && (
                  <ul className="text-xs mt-2 space-y-1">
                    {status.errors.map((e, i) => (
                      <li key={i} data-testid={`gstr1-error-${i}`}>
                        <b>{e.section || ""}{e.invoice ? ` · ${e.invoice}` : ""}</b>
                        {e.field ? ` · [${e.field}] ` : " "}
                        {e.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {(status.validations_implemented || status.validations_not_implemented) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="border border-emerald-200 rounded p-3 bg-emerald-50/40">
                <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 mb-2">Validations we run</div>
                <ul className="space-y-1 text-emerald-800">
                  {(status.validations_implemented || []).map((v, i) => <li key={i}>• {v}</li>)}
                </ul>
              </div>
              <div className="border border-amber-200 rounded p-3 bg-amber-50/40">
                <div className="text-[10px] uppercase tracking-[0.2em] text-amber-700 mb-2">Validations we DO NOT run</div>
                <ul className="space-y-1 text-amber-800">
                  {(status.validations_not_implemented || []).map((v, i) => <li key={i}>• {v}</li>)}
                </ul>
                <div className="text-[11px] text-amber-700 mt-2">
                  This output is <b>not</b> automatically validated against a machine-readable GSTN schema — you must still review it in the GST portal's Offline Utility before uploading.
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="p-5 border-slate-200 rounded-md text-xs text-slate-600 leading-relaxed">
        <div className="flex items-start gap-3">
          <FileJson className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-900 mb-1">Sections generated</div>
            <div>
              <b>B2B</b> (registered customers) · <b>B2CL</b> (inter-state unregistered ₹2.5L+) ·
              <b> B2CS</b> (aggregated by state × rate) · <b>EXP</b> (WPAY/WOPAY with shipping bill) ·
              <b> HSN</b> Table 12 rate-wise · <b>doc_issue</b> Table 13 (issued + cancelled).
            </div>
            <div className="mt-2 text-slate-500">
              The existing <a className="underline text-blue-600" href="/gst-summary">GSTR-1 Working Data Export (CSV)</a> remains available for offline review.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
