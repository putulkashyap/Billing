import React from "react";
import { fmtINR, fmtINRWithSymbol, numberToWords } from "@/lib/gst";

const COMPANY = {
  name: "TRAYAMBAK ENTERPRISE",
  gstin: "24AMAPR1170Q1ZT",
  address: "3rd Floor, C8-301, Akshar Pavilion, Vasna Bhayli Main Road, Opp Rosedale Heights, Vadodara, Gujarat - 391410",
  email: "hi@trayambak.in",
  bank: { name: "IDFC FIRST Bank", branch: "Vadodara-Gotri", ac: "69315494820", ifsc: "IDFB0042392" },
};

export default function CompactTemplate({ invoice }) {
  const inv = invoice;
  return (
    <div className="text-[10px] leading-snug text-slate-900">
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="42" height="42">
            <rect x="5" y="5" width="90" height="90" rx="18" fill="#0F172A" />
            <path d="M 24 32 C 24 26, 30 24, 38 24 L 72 24 C 76 24, 78 27, 76 31 L 70 40 C 69 42, 66 43, 63 43 L 34 43 Z" fill="#2563EB" />
            <path d="M 43 38 L 59 38 L 59 76 C 59 81, 54 85, 48 85 L 43 85 L 43 38 Z" fill="#3B82F6" />
            <path d="M 59 24 L 78 24 C 80 24, 82 26, 80 29 L 70 44 L 59 34 Z" fill="#60A5FA" />
          </svg>
          <div>
            <div className="text-base font-heading font-bold tracking-tight">{COMPANY.name}</div>
            <div className="text-[9px] text-slate-600 max-w-md leading-snug">{COMPANY.address}</div>
            <div className="text-[9px] mt-0.5">GSTIN <span className="font-mono">{COMPANY.gstin}</span> · {COMPANY.email}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.15em] text-slate-500">Tax Invoice</div>
          <div className="text-base font-mono font-bold">{inv.invoice_number}</div>
          <div className="text-[9px]">Date: {inv.invoice_date}</div>
        </div>
      </div>

      {/* Compact meta strip */}
      <div className="grid grid-cols-4 gap-2 mt-2 text-[9px]">
        <div className="border border-slate-300 px-2 py-1">
          <div className="text-slate-500 uppercase tracking-wider text-[8px]">Customer</div>
          <div className="font-semibold">{inv.customer?.name}</div>
        </div>
        <div className="border border-slate-300 px-2 py-1">
          <div className="text-slate-500 uppercase tracking-wider text-[8px]">GSTIN</div>
          <div className="font-mono">{inv.customer?.gstin || "—"}</div>
        </div>
        <div className="border border-slate-300 px-2 py-1">
          <div className="text-slate-500 uppercase tracking-wider text-[8px]">{inv.order_type === "gem" ? "GeM Contract" : "PO No."}</div>
          <div className="font-mono">{inv.order_type === "gem" ? (inv.gem_contract_no || "—") : (inv.po_number || "—")}</div>
        </div>
        <div className="border border-slate-300 px-2 py-1">
          <div className="text-slate-500 uppercase tracking-wider text-[8px]">Supply Type</div>
          <div>{inv.is_intra_state ? "Intra-state" : "Inter-state"}</div>
        </div>
        <div className="border border-slate-300 px-2 py-1 col-span-4">
          <div className="text-slate-500 uppercase tracking-wider text-[8px]">Bill To Address</div>
          <div>{inv.customer?.address || "—"}</div>
        </div>
      </div>

      {/* Items dense */}
      <table className="mt-2 w-full border border-slate-900">
        <thead className="bg-slate-100 text-[9px] uppercase tracking-wider">
          <tr>
            <th className="border border-slate-800 text-l px-1 py-1 w-6">#</th>
            <th className="border border-slate-800 text-l px-1 py-1">Description</th>
            <th className="border border-slate-800 num px-1 py-1 w-14">HSN</th>
            <th className="border border-slate-800 num px-1 py-1 w-10">Qty</th>
            <th className="border border-slate-800 text-l px-1 py-1 w-10">Unit</th>
            <th className="border border-slate-800 num px-1 py-1 w-16">Rate</th>
            <th className="border border-slate-800 num px-1 py-1 w-16">Disc</th>
            <th className="border border-slate-800 num px-1 py-1 w-10">Tax%</th>
            <th className="border border-slate-800 num px-1 py-1 w-16">CGST</th>
            <th className="border border-slate-800 num px-1 py-1 w-16">SGST</th>
            <th className="border border-slate-800 num px-1 py-1 w-16">IGST</th>
            <th className="border border-slate-800 num px-1 py-1 w-20">Amount</th>
          </tr>
        </thead>
        <tbody className="text-[9px]">
          {inv.line_items?.map((it, i) => {
            const gross = (it.quantity || 0) * (it.rate || 0);
            const taxable = gross - (it.discount || 0);
            const tax = taxable * ((it.tax_rate || 0) / 100);
            const cgst = inv.is_intra_state ? tax / 2 : 0;
            const sgst = inv.is_intra_state ? tax / 2 : 0;
            const igst = inv.is_intra_state ? 0 : tax;
            return (
              <tr key={i}>
                <td className="border border-slate-300 text-l px-1">{i + 1}</td>
                <td className="border border-slate-300 text-l px-1">{it.description}</td>
                <td className="border border-slate-300 num px-1 font-mono">{it.hsn || "—"}</td>
                <td className="border border-slate-300 num px-1">{it.quantity}</td>
                <td className="border border-slate-300 text-l px-1">{it.unit}</td>
                <td className="border border-slate-300 num px-1">{fmtINR(it.rate)}</td>
                <td className="border border-slate-300 num px-1">{fmtINR(it.discount || 0)}</td>
                <td className="border border-slate-300 num px-1">{it.tax_rate}%</td>
                <td className="border border-slate-300 num px-1">{cgst ? fmtINR(cgst) : "—"}</td>
                <td className="border border-slate-300 num px-1">{sgst ? fmtINR(sgst) : "—"}</td>
                <td className="border border-slate-300 num px-1">{igst ? fmtINR(igst) : "—"}</td>
                <td className="border border-slate-300 num px-1 font-semibold">{fmtINR(taxable + tax)}</td>
              </tr>
            );
          })}
          <tr className="bg-slate-50 font-semibold">
            <td colSpan="7" className="border border-slate-800 text-l px-1 py-1">Totals</td>
            <td className="border border-slate-800"></td>
            <td className="border border-slate-800 num px-1">{inv.cgst ? fmtINR(inv.cgst) : "—"}</td>
            <td className="border border-slate-800 num px-1">{inv.sgst ? fmtINR(inv.sgst) : "—"}</td>
            <td className="border border-slate-800 num px-1">{inv.igst ? fmtINR(inv.igst) : "—"}</td>
            <td className="border border-slate-800 num px-1">{fmtINR(inv.grand_total)}</td>
          </tr>
        </tbody>
      </table>

      {/* Bottom strip */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-[9px]">
        <div className="border border-slate-300 p-2 col-span-2">
          <div className="text-slate-500 uppercase tracking-wider text-[8px] mb-0.5">Amount in Words</div>
          <div>{numberToWords(inv.grand_total)}</div>
          <div className="mt-1.5 pt-1.5 border-t border-slate-200">
            <span className="text-slate-500">Bank:</span> {COMPANY.bank.name} · {COMPANY.bank.branch} · <span className="font-mono">A/C {COMPANY.bank.ac}</span> · <span className="font-mono">IFSC {COMPANY.bank.ifsc}</span>
          </div>
        </div>
        <div className="border border-slate-300 p-2">
          <div className="flex justify-between"><span>Taxable</span><span className="font-mono">{fmtINR(inv.taxable_amount)}</span></div>
          {inv.is_intra_state ? (<>
            <div className="flex justify-between"><span>CGST</span><span className="font-mono">{fmtINR(inv.cgst)}</span></div>
            <div className="flex justify-between"><span>SGST</span><span className="font-mono">{fmtINR(inv.sgst)}</span></div>
          </>) : <div className="flex justify-between"><span>IGST</span><span className="font-mono">{fmtINR(inv.igst)}</span></div>}
          <div className="flex justify-between mt-1 pt-1 border-t border-slate-300 font-bold">
            <span>TOTAL</span><span className="font-mono">{fmtINRWithSymbol(inv.grand_total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-300 flex justify-between text-[9px]">
        <div className="text-slate-600 max-w-md">{inv.notes || "Payment due within 30 days. Subject to Vadodara jurisdiction."}</div>
        <div className="text-right">
          <div className="text-slate-500">For {COMPANY.name}</div>
          <div className="h-8"></div>
          <div className="border-t border-slate-400 inline-block px-4 pt-0.5 font-semibold">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}
