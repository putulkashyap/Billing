import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import GemTemplate from "./GemTemplate";
import ModernTemplate from "./ModernTemplate";
import CompactTemplate from "./CompactTemplate";

const TEMPLATES = [
  { id: "gem", label: "Government Supply" },
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
    const el = printRef.current;
    const originalMinHeight = el.style.minHeight;
    // Collapse min-height so canvas captures only real content (no trailing blank page)
    el.style.minHeight = "auto";
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWmm = 210;
      const pageHmm = 297;
      const pxPerMm = canvas.width / pageWmm; // horizontal scale
      const pageHpx = Math.floor(pageHmm * pxPerMm); // pixels per A4 page

      // True multi-page: slice source canvas into page-sized chunks
      let renderedPx = 0;
      let pageIndex = 0;
      while (renderedPx < canvas.height - 1) {
        const sliceHpx = Math.min(pageHpx, canvas.height - renderedPx);
        // Skip trailing near-empty slices (< 20mm of content)
        if (pageIndex > 0 && sliceHpx < pxPerMm * 20) break;
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHpx;
        const ctx = pageCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0, renderedPx, canvas.width, sliceHpx,
          0, 0, canvas.width, sliceHpx
        );
        const img = pageCanvas.toDataURL("image/jpeg", 0.95);
        const sliceHmm = sliceHpx / pxPerMm;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(img, "JPEG", 0, 0, pageWmm, sliceHmm);
        renderedPx += sliceHpx;
        pageIndex += 1;
      }
      pdf.save(`${invoice.invoice_number.replace(/\//g, "_")}.pdf`);
    } finally {
      el.style.minHeight = originalMinHeight;
      setBusy(false);
    }
  };

  const Template = tpl === "gem" ? GemTemplate : tpl === "modern" ? ModernTemplate : CompactTemplate;

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 gap-0 max-h-[95vh] overflow-hidden">
        <VisuallyHidden.Root>
          <DialogTitle>Invoice Preview {invoice.invoice_number}</DialogTitle>
          <DialogDescription>
            Preview and download A4 PDF for invoice {invoice.invoice_number}. Choose between Government Supply, Modern Corporate, or Compact templates.
          </DialogDescription>
        </VisuallyHidden.Root>
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
            <button onClick={onClose} aria-label="Close preview" className="p-2 rounded-md hover:bg-slate-200"><X className="w-4 h-4" /></button>
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
