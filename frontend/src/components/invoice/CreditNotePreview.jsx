import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { fmtINR, fmtINRWithSymbol, numberToWords } from "@/lib/gst";
import { LogoSVG } from "@/components/Logo";

const COMPANY = {
  name: "TRAYAMBAK ENTERPRISE",
  proprietor: "Ranjita Rai",
  gstin: "24AMAPR1170Q1ZT",
  address: "3rd Floor, C8-301, Akshar Pavilion, Vasna Bhayli Main Road, Opp Rosedale Heights, Vadodara, Gujarat - 391410",
  email: "hi@trayambak.in",
};

export default function CreditNotePreview({ creditNote, onClose }) {
  const printRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const cn = creditNote;

  const download = async () => {
    if (!printRef.current) return;
    setBusy(true);
    const el = printRef.current;
    const originalMinHeight = el.style.minHeight;
    el.style.minHeight = "auto";
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWmm = 210;
      const pageHmm = 297;
      const pxPerMm = canvas.width / pageWmm;
      const pageHpx = Math.floor(pageHmm * pxPerMm);
      let renderedPx = 0;
      let pageIndex = 0;
      while (renderedPx < canvas.height - 1) {
        const sliceHpx = Math.min(pageHpx, canvas.height - renderedPx);
        if (pageIndex > 0 && sliceHpx < pxPerMm * 20) break;
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHpx;
        const ctx = pageCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);
        const img = pageCanvas.toDataURL("image/jpeg", 0.95);
        const sliceHmm = sliceHpx / pxPerMm;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(img, "JPEG", 0, 0, pageWmm, sliceHmm);
        renderedPx += sliceHpx;
        pageIndex += 1;
      }
      pdf.save(`${cn.credit_note_number.replace(/\//g, "_")}.pdf`);
    } finally {
      el.style.minHeight = originalMinHeight;
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!cn} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 gap-0 max-h-[95vh] overflow-hidden">
        <VisuallyHidden.Root>
          <DialogTitle>Credit Note Preview {cn.credit_note_number}</DialogTitle>
          <DialogDescription>Preview and download A4 PDF for credit note {cn.credit_note_number}.</DialogDescription>
        </VisuallyHidden.Root>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">Credit Note Preview</div>
            <div className="font-mono text-sm font-semibold" data-testid="cn-preview-number">{cn.credit_note_number}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={download} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white gap-2" data-testid="cn-download-pdf">
              <Download className="w-4 h-4" /> {busy ? "Rendering…" : "Download PDF"}
            </Button>
            <button onClick={onClose} aria-label="Close preview" className="p-2 rounded-md hover:bg-slate-200"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-y-auto te-scroll bg-slate-200 p-6" style={{ maxHeight: "calc(95vh - 60px)" }}>
          <div className="flex justify-center">
            <div ref={printRef} className="a4-page shadow-lg">
              <CreditNoteBody cn={cn} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreditNoteBody({ cn }) {
  return (
    <div className="text-[11px] leading-relaxed text-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-amber-600 pb-4">
        <div>
          <LogoSVG width={220} height={50} />
          <div className="mt-2 text-[10px] text-slate-600 max-w-xs leading-snug">{COMPANY.address}</div>
          <div className="text-[10px] mt-1"><b>GSTIN:</b> <span className="font-mono">{COMPANY.gstin}</span> · <b>Email:</b> {COMPANY.email}</div>
        </div>
        <div className="text-right">
          <div className="inline-block bg-amber-100 text-amber-800 px-3 py-1 text-xs uppercase tracking-[0.2em] font-semibold rounded">Credit Note</div>
          <div className="text-2xl font-heading font-bold mt-2">{cn.credit_note_number}</div>
          <div className="text-[10px] text-slate-600 mt-1">Date: {cn.credit_date}</div>
          <div className="text-[10px] text-slate-600">Against Invoice: <span className="font-mono font-semibold text-slate-900">{cn.invoice_number}</span></div>
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="border border-slate-300 p-3">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Supplier / Seller</div>
          <div className="font-semibold">{COMPANY.name}</div>
          <div className="text-[10px]">Proprietor: {COMPANY.proprietor}</div>
          <div className="text-[10px] mt-1 leading-snug">{COMPANY.address}</div>
          <div className="text-[10px] mt-1"><b>GSTIN:</b> <span className="font-mono">{COMPANY.gstin}</span></div>
          <div className="text-[10px]"><b>Email:</b> {COMPANY.email}</div>
        </div>
        <div className="border border-slate-300 p-3">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Bill To / Consignee</div>
          <div className="font-semibold">{cn.customer?.name}</div>
          <div className="text-[10px] whitespace-pre-line leading-snug">{cn.customer?.address}</div>
          {cn.customer?.gstin && <div className="text-[10px] mt-1"><b>GSTIN:</b> <span className="font-mono">{cn.customer.gstin}</span></div>}
          {cn.customer?.gstin && <div className="text-[10px]"><b>State Code:</b> <span className="font-mono">{cn.customer.gstin.slice(0,2)}</span></div>}
          {cn.customer?.phone && <div className="text-[10px]"><b>Phone:</b> {cn.customer.phone}</div>}
        </div>
      </div>

      {/* Reason */}
      <div className="mt-4 border border-slate-300 p-3 bg-amber-50">
        <div className="text-[9px] uppercase tracking-wider text-amber-700 mb-1">Reason for Credit</div>
        <div className="text-[11px] font-medium">{cn.reason || "—"}</div>
      </div>

      {/* Items */}
      <table className="mt-4 border border-slate-900 w-full">
        <thead className="bg-slate-100 text-[10px] uppercase tracking-wider">
          <tr>
            <th className="border border-slate-900 text-l px-2 py-1 w-6">#</th>
            <th className="border border-slate-900 text-l px-2 py-1">Description of Goods / Services</th>
            <th className="border border-slate-900 num px-2 py-1 w-16">HSN/SAC</th>
            <th className="border border-slate-900 num px-2 py-1 w-14">Qty</th>
            <th className="border border-slate-900 text-l px-2 py-1 w-14">Unit</th>
            <th className="border border-slate-900 num px-2 py-1 w-20">Rate</th>
            <th className="border border-slate-900 num px-2 py-1 w-20">Disc.</th>
            <th className="border border-slate-900 num px-2 py-1 w-16">Tax %</th>
            <th className="border border-slate-900 num px-2 py-1 w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          {cn.line_items?.map((it, i) => {
            const gross = (it.quantity || 0) * (it.rate || 0);
            const taxable = gross - (it.discount || 0);
            return (
              <tr key={i}>
                <td className="border border-slate-300 text-l px-2 py-1">{i + 1}</td>
                <td className="border border-slate-300 text-l px-2 py-1">{it.description}</td>
                <td className="border border-slate-300 num px-2 py-1">{it.hsn || "—"}</td>
                <td className="border border-slate-300 num px-2 py-1">{it.quantity}</td>
                <td className="border border-slate-300 text-l px-2 py-1">{it.unit}</td>
                <td className="border border-slate-300 num px-2 py-1">{fmtINR(it.rate)}</td>
                <td className="border border-slate-300 num px-2 py-1">{fmtINR(it.discount || 0)}</td>
                <td className="border border-slate-300 num px-2 py-1">{it.tax_rate}%</td>
                <td className="border border-slate-300 num px-2 py-1">{fmtINR(taxable)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="border border-slate-300 p-3">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Credit Amount in Words</div>
          <div className="text-[11px] font-medium">{numberToWords(cn.grand_total)}</div>
          {cn.notes && (
            <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-600">{cn.notes}</div>
          )}
        </div>
        <table className="border border-slate-900 self-start">
          <tbody className="text-[11px]">
            <tr>
              <td className="border border-slate-300 text-l px-2 py-1 text-slate-600">Taxable Amount</td>
              <td className="border border-slate-300 num px-2 py-1 w-32">{fmtINRWithSymbol(cn.taxable_amount)}</td>
            </tr>
            {cn.is_intra_state ? (
              <>
                <tr>
                  <td className="border border-slate-300 text-l px-2 py-1 text-slate-600">CGST</td>
                  <td className="border border-slate-300 num px-2 py-1">{fmtINRWithSymbol(cn.cgst)}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 text-l px-2 py-1 text-slate-600">SGST</td>
                  <td className="border border-slate-300 num px-2 py-1">{fmtINRWithSymbol(cn.sgst)}</td>
                </tr>
              </>
            ) : (
              <tr>
                <td className="border border-slate-300 text-l px-2 py-1 text-slate-600">IGST</td>
                <td className="border border-slate-300 num px-2 py-1">{fmtINRWithSymbol(cn.igst)}</td>
              </tr>
            )}
            <tr>
              <td className="border border-slate-300 text-l px-2 py-1 text-slate-600">Total Tax</td>
              <td className="border border-slate-300 num px-2 py-1">{fmtINRWithSymbol(cn.total_tax)}</td>
            </tr>
            <tr className="bg-amber-600 text-white">
              <td className="border border-amber-700 text-l font-semibold px-2 py-2">TOTAL CREDIT</td>
              <td className="border border-amber-700 num font-bold px-2 py-2 text-base">{fmtINRWithSymbol(cn.grand_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="text-[10px] text-slate-600 leading-relaxed">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Declaration</div>
          This credit note is issued in respect of the referenced tax invoice under Section 34 of the CGST Act, 2017.
        </div>
        <div className="text-right border-t border-slate-300 pt-2">
          <div className="text-[10px] text-slate-500">For {COMPANY.name}</div>
          <div className="h-14"></div>
          <div className="text-[10px] font-semibold border-t border-slate-400 inline-block px-6 pt-1">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}
