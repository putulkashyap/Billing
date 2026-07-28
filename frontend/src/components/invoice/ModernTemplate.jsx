import React from "react";
import { fmtINR, fmtINRWithSymbol, numberToWords } from "@/lib/gst";
import { LogoDark } from "@/components/Logo";

const COMPANY = {
  name: "TRAYAMBAK ENTERPRISE",
  gstin: "24AMAPR1170Q1ZT",
  address: "3rd Floor, C8-301, Akshar Pavilion, Vasna Bhayli Main Road, Opp Rosedale Heights, Vadodara, Gujarat - 391410",
  email: "hi@trayambak.in",
  website: "www.trayambak.in",
  bank: {
    holder: "TRAYAMBAK ENTERPRISE",
    name: "IDFC FIRST Bank",
    branch: "Vadodara-Gotri Branch, Vadodara - 390021",
    ac: "69315494820",
    type: "Current Account",
    ifsc: "IDFB0042392",
  },
};

export default function ModernTemplate({ invoice }) {
  const inv = invoice;
  return (
    <div className="text-[11px] leading-relaxed text-slate-900">
      {/* Header — two tone */}
      <div className="flex items-stretch">
        <div className="flex-1 bg-[#0F172A] text-white p-5">
          <LogoDark width={200} height={46} />
          <div className="mt-3 text-[10px] text-slate-300 leading-snug">{COMPANY.address}</div>
          <div className="text-[10px] mt-1 text-slate-300">GSTIN <span className="font-mono text-sky-300">{COMPANY.gstin}</span> · {COMPANY.email} · {COMPANY.website}</div>
        </div>
        <div className="w-64 bg-blue-600 text-white p-5 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] opacity-90">Tax Invoice</div>
            <div className="text-2xl font-heading font-bold mt-1 font-mono">{inv.invoice_number}</div>
          </div>
          <div className="text-[10px] mt-4 space-y-0.5">
            <div><span className="opacity-70">Date:</span> {inv.invoice_date}</div>
            {inv.po_number && <div><span className="opacity-70">PO No:</span> {inv.po_number}</div>}
            {(inv.reference_date || inv.gem_order_date) && <div><span className="opacity-70">PO/Contract Date:</span> {inv.reference_date || inv.gem_order_date}</div>}
          </div>
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-4 mt-5">
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-blue-600 mb-1">Billed To</div>
          <div className="font-semibold text-sm">{inv.customer?.name}</div>
          <div className="text-[10px] whitespace-pre-line text-slate-600 mt-0.5">{inv.customer?.address}</div>
          {inv.customer?.gstin && <div className="text-[10px] mt-1">GSTIN <span className="font-mono">{inv.customer.gstin}</span></div>}
          {inv.customer?.phone && <div className="text-[10px]">Phone: {inv.customer.phone}</div>}
          {inv.customer?.email && <div className="text-[10px]">Email: {inv.customer.email}</div>}
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.2em] text-blue-600 mb-1">Place of Supply</div>
          <div className="text-sm">{inv.customer?.gstin ? `State code ${inv.customer.gstin.slice(0, 2)}` : "Unregistered"}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{inv.is_intra_state ? "Intra-state supply (CGST + SGST)" : "Inter-state supply (IGST)"}</div>
        </div>
      </div>

      {/* Items */}
      <table className="mt-5 w-full">
        <thead>
          <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
            <th className="text-l px-2 py-2 w-6">#</th>
            <th className="text-l px-2 py-2">Description</th>
            <th className="num px-2 py-2 w-16">HSN/SAC</th>
            <th className="num px-2 py-2 w-14">Qty</th>
            <th className="text-l px-2 py-2 w-14">Unit</th>
            <th className="num px-2 py-2 w-20">Rate</th>
            <th className="num px-2 py-2 w-20">Taxable</th>
            <th className="num px-2 py-2 w-14">Tax %</th>
            <th className="num px-2 py-2 w-20">Tax Amt</th>
            <th className="num px-2 py-2 w-24">Total</th>
          </tr>
        </thead>
        <tbody>
          {inv.line_items?.map((it, i) => {
            const gross = (it.quantity || 0) * (it.rate || 0);
            const taxable = gross - (it.discount || 0);
            const tax = taxable * ((it.tax_rate || 0) / 100);
            return (
              <tr key={i} className="border-b border-slate-200">
                <td className="text-l px-2 py-1.5 text-slate-400 font-mono">{i + 1}</td>
                <td className="text-l px-2 py-1.5">{it.description}</td>
                <td className="num px-2 py-1.5 font-mono">{it.hsn || "—"}</td>
                <td className="num px-2 py-1.5">{it.quantity}</td>
                <td className="text-l px-2 py-1.5">{it.unit}</td>
                <td className="num px-2 py-1.5">{fmtINR(it.rate)}</td>
                <td className="num px-2 py-1.5">{fmtINR(taxable)}</td>
                <td className="num px-2 py-1.5">{it.tax_rate}%</td>
                <td className="num px-2 py-1.5">{fmtINR(tax)}</td>
                <td className="num px-2 py-1.5 font-semibold">{fmtINR(taxable + tax)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals + bank */}
      <div className="grid grid-cols-2 gap-4 mt-5">
        <div className="space-y-3">
          <div className="border-l-4 border-blue-600 pl-3">
            <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-1">Amount in Words</div>
            <div className="text-[11px] font-medium">{numberToWords(inv.grand_total)}</div>
          </div>
          <div className="border border-slate-200 p-3">
            <div className="text-[9px] uppercase tracking-[0.2em] text-blue-600 mb-1.5">Payment Details</div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="text-slate-500">A/C Holder</div><div>{COMPANY.bank.holder}</div>
              <div className="text-slate-500">Bank</div><div>{COMPANY.bank.name}</div>
              <div className="text-slate-500">Branch</div><div>{COMPANY.bank.branch}</div>
              <div className="text-slate-500">A/C Type</div><div>{COMPANY.bank.type}</div>
              <div className="text-slate-500">A/C No.</div><div className="font-mono">{COMPANY.bank.ac}</div>
              <div className="text-slate-500">IFSC</div><div className="font-mono">{COMPANY.bank.ifsc}</div>
            </div>
            <div className="text-[10px] mt-2 pt-2 border-t border-slate-200 italic text-slate-600">
              <b>Note:</b> Please make cheques in favor of <b>{COMPANY.name}</b>.
            </div>
          </div>
        </div>

        <div className="text-[11px]">
          <TotalRow label="Subtotal" val={inv.subtotal} />
          {inv.total_discount > 0 && <TotalRow label="Total Discount" val={-inv.total_discount} />}
          <TotalRow label="Taxable Amount" val={inv.taxable_amount} bold />
          {inv.is_intra_state ? (<>
            <TotalRow label="CGST" val={inv.cgst} />
            <TotalRow label="SGST" val={inv.sgst} />
          </>) : <TotalRow label="IGST" val={inv.igst} />}
          <div className="flex justify-between items-baseline bg-slate-900 text-white px-3 py-2.5 mt-2">
            <span className="text-[10px] uppercase tracking-[0.2em]">Grand Total</span>
            <span className="font-mono text-lg font-bold">{fmtINRWithSymbol(inv.grand_total)}</span>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
        <div className="text-[10px] text-slate-600">
          <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-1">Terms & Conditions</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Payment due within 30 days of invoice date.</li>
            <li>All disputes subject to Vadodara jurisdiction only.</li>
            {inv.notes && <li>{inv.notes}</li>}
          </ul>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">For {COMPANY.name}</div>
          <div className="h-14"></div>
          <div className="text-[10px] font-semibold border-t border-slate-400 inline-block px-6 pt-1">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}

const TotalRow = ({ label, val, bold }) => (
  <div className={`flex justify-between px-3 py-1.5 ${bold ? "font-semibold border-t border-slate-300" : ""}`}>
    <span className="text-slate-600">{label}</span>
    <span className="font-mono">{fmtINRWithSymbol(val)}</span>
  </div>
);
