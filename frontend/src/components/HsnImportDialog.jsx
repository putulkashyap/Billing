import React, { useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UploadCloud, AlertCircle, CheckCircle2 } from "lucide-react";

const HEADERS_TEMPLATE = "Code,Description,GST Rate,Cess Rate,Taxability,ITC Eligible,Effective From,Effective To,Active\n";

export default function HsnImportDialog({ open, setOpen, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [strategy, setStrategy] = useState("skip");
  const [busy, setBusy] = useState(false);

  const reset = () => { setFile(null); setPreview(null); setStrategy("skip"); };

  const doPreview = async () => {
    if (!file) { toast.error("Pick a CSV file first"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const base = process.env.REACT_APP_BACKEND_URL;
      const r = await axios.post(`${base}/api/hsn/import/preview`, fd, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      });
      setPreview(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to parse CSV");
    } finally { setBusy(false); }
  };

  const doCommit = async () => {
    if (!preview?.rows?.length) return toast.error("Nothing to import");
    setBusy(true);
    try {
      const r = await api.post("/hsn/import/commit", { rows: preview.rows, strategy });
      toast.success(`Imported: ${r.data.inserted} added · ${r.data.updated} updated · ${r.data.skipped} skipped`);
      setOpen(false); reset(); onImported?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to commit");
    } finally { setBusy(false); }
  };

  const downloadTemplate = () => {
    const blob = new Blob([HEADERS_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "hsn_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import HSN / SAC (CSV)</DialogTitle>
          <DialogDescription>
            Upload a CSV → preview validation → confirm to commit. Header row is required.
          </DialogDescription>
        </DialogHeader>

        {!preview && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-md p-8 text-center">
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)}
                     data-testid="hsn-import-file" />
              {file && <div className="text-xs text-slate-500 mt-2">{file.name} — {(file.size / 1024).toFixed(1)} KB</div>}
              <div className="mt-4">
                <button className="text-blue-600 text-xs underline" onClick={downloadTemplate} data-testid="hsn-import-template">
                  Download CSV template
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Required columns: <b>Code</b>, <b>GST Rate</b>. Optional: Description, Cess Rate, Taxability, ITC Eligible, Effective From (YYYY-MM-DD), Effective To (YYYY-MM-DD), Active.
            </div>
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {preview.count} row(s) valid
              </div>
              {preview.conflict_count > 0 && (
                <div className="px-3 py-2 bg-amber-50 text-amber-700 rounded flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {preview.conflict_count} conflict(s) with existing HSN
                </div>
              )}
              {preview.errors?.length > 0 && (
                <div className="px-3 py-2 bg-red-50 text-red-700 rounded flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {preview.errors.length} error(s)
                </div>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto te-scroll border border-slate-200 rounded">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-left">Effective</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100" data-testid={`preview-row-${r.code}`}>
                      <td className="px-3 py-1.5 font-mono">{r.code}</td>
                      <td className="px-3 py-1.5">{r.description}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{r.gst_rate}%</td>
                      <td className="px-3 py-1.5 font-mono">{r.effective_from || "—"} → {r.effective_to || "∞"}</td>
                      <td className="px-3 py-1.5">
                        {r.exists ? <span className="text-amber-600">conflict</span> : <span className="text-emerald-600">new</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.errors?.length > 0 && (
              <div className="text-xs bg-red-50 text-red-700 rounded p-3 max-h-40 overflow-y-auto">
                {preview.errors.map((e, i) => (
                  <div key={i}>Line {e.line}{e.code ? ` (${e.code})` : ""}: {e.error}</div>
                ))}
              </div>
            )}

            <div>
              <Label>Strategy for existing codes</Label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger data-testid="hsn-import-strategy"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip (keep existing)</SelectItem>
                  <SelectItem value="update">Update existing</SelectItem>
                  <SelectItem value="version">Deactivate old & insert new</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-[11px] text-slate-500 mt-1">
                Historical invoices remain untouched — HSN master changes only affect FUTURE invoices.
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }} data-testid="hsn-import-cancel">Cancel</Button>
          {!preview
            ? <Button onClick={doPreview} disabled={!file || busy} data-testid="hsn-import-preview" className="bg-blue-600 hover:bg-blue-700 text-white">
                {busy ? "Parsing…" : "Preview"}
              </Button>
            : <Button onClick={doCommit} disabled={busy || !preview.rows.length} data-testid="hsn-import-commit" className="bg-blue-600 hover:bg-blue-700 text-white">
                {busy ? "Importing…" : `Commit ${preview.rows.length} row(s)`}
              </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
