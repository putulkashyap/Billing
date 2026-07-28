import React, { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import GemTemplate from "./GemTemplate";
import ModernTemplate from "./ModernTemplate";
import CompactTemplate from "./CompactTemplate";

const TEMPLATES = [
  { id: "gem", label: "GeM / Govt Supply" },
  { id: "modern", label: "Modern Corporate" },
  { id: "compact", label: "Compact Single-Page" },
];

export default function InvoicePreview({ invoice, onClose }) {
  const [tpl, setTpl] = useState(invoice?.order_type === "gem" ? "gem" : "modern");
  const printRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (!printRef.current) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const w = 210;
      const h = (canvas.height * w) / canvas.width;
      let y = 0;
      const pageH = 297;
      if (h <= pageH) {
        pdf.addImage(img, "PNG", 0, 0, w, h);
      } else {
        // multi-page
        let remaining = h;
        while (remaining > 0) {
          pdf.addImage(img, "PNG", 0, y, w, h);
          remaining -= pageH;
          y -= pageH;
          if (remaining > 0) pdf.addPage();
        }
      }
      pdf.save(`${invoice.invoice_number.replace(/\//g, "_")}.pdf`);
    } finally { setBusy(false); }
  };

  const Template = tpl === "gem" ? GemTemplate : tpl === "modern" ? ModernTemplate : CompactTemplate;

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 gap-0 max-h-[95vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Preview</div>
              <div className="font-mono text-sm font-semibold" data-testid="preview-invoice-number">{invoice.invoice_number}</div>
            </div>
            <div className="ml-6">
              <Select value={tpl} onValueChange={setTpl}>
                <SelectTrigger className="w-64" data-testid="template-selector"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={download} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white gap-2" data-testid="download-pdf-btn">
              <Download className="w-4 h-4" /> {busy ? "Rendering…" : "Download PDF"}
            </Button>
            <button onClick={onClose} className="p-2 rounded-md hover:bg-slate-200"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-y-auto te-scroll bg-slate-200 p-6" style={{ maxHeight: "calc(95vh - 60px)" }}>
          <div className="flex justify-center">
            <div ref={printRef} className="a4-page shadow-lg">
              <Template invoice={invoice} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
