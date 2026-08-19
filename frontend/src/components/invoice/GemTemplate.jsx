import React from "react";
import { fmtINR, fmtINRWithSymbol, numberToWords } from "@/lib/gst";
import { LogoSVG } from "@/components/Logo";

const COMPANY = {
  name: "TRAYAMBAK ENTERPRISE",
  proprietor: "Ranjita Rai",
  gstin: "24AMAPR1170Q1ZT",
  address: "Akshar Pavilion, Vasna Bhayli Main Road, Opp Rosedale Heights, Vadodara, Gujarat - 391410",
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

export default function GemTemplate({ invoice }) {
  const inv = invoice;
  return (
    <div className="text-[11px] leading-relaxed text-slate-900">
      {/* Header — brand + company info on left, only TAX INVOICE title on right */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
        <div>
          <LogoSVG width={220} height={50} />
          <div className="mt-2 text-[10px] text-slate-600 max-w-xs leading-snug">{COMPANY.address}</div>
          <div className="text-[10px] mt-1"><b>GSTIN:</b> <span className="font-mono">{COMPANY.gstin}</span> · <b>Email:</b> {COMPANY.email} · <b>Web:</b> {COMPANY.website}</div>
        </div>
        <div className="text-right self-center">
          <div className="text-3xl font-heading font-bold tracking-tight">TAX INVOICE</div>
        </div>
      </div>

      {/* Invoice identity + order meta */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <MetaBox title="Invoice No." value={inv.invoice_number} mono />
        <MetaBox title="Invoice Date" value={inv.invoice_date} mono />
        <MetaBox title="Contract / PO No." value={inv.gem_contract_no || inv.po_number || "—"} />
        <MetaBox title="PO / Contract Date" value={inv.gem_order_date || inv.reference_date || "—"} />
        <MetaBox title="Buyer Department / Organization" value={inv.buyer_department || "—"} full />
        <MetaBox title="Place of Supply" value={inv.customer?.gstin ? `State code ${inv.customer.gstin.slice(0,2)} · ${inv.is_intra_state ? "Intra-state" : "Inter-state"}` : "Unregistered · Inter-state"} />
      </div>

      {/* Supplier + Bill To */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="border border-slate-300 p-3">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Supplier / Seller</div>
          <div className="font-semibold">{COMPANY.name}</div>
          <div className="text-[10px]">Proprietor: {COMPANY.proprietor}</div>
          <div className="text-[10px] mt-1 whitespace-pre-line leading-snug">{COMPANY.address}</div>
          <div className="text-[10px] mt-1"><b>GSTIN:</b> <span className="font-mono">{COMPANY.gstin}</span></div>
          <div className="text-[10px]"><b>State Code:</b> <span className="font-mono">24 · Gujarat</span></div>
          <div className="text-[10px] mt-1"><b>Email:</b> {COMPANY.email}</div>
          <div className="text-[10px]"><b>Website:</b> {COMPANY.website}</div>
        </div>
        <div className="border border-slate-300 p-3">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Bill To / Consignee</div>
          <div className="font-semibold">{inv.customer?.name}</div>
          <div className="text-[10px] whitespace-pre-line leading-snug">{inv.customer?.address}</div>
          {inv.customer?.gstin && <div className="text-[10px] mt-1"><b>GSTIN:</b> <span className="font-mono">{inv.customer.gstin}</span></div>}
          {inv.customer?.gstin && <div className="text-[10px]"><b>State Code:</b> <span className="font-mono">{inv.customer.gstin.slice(0,2)}</span></div>}
          {inv.customer?.phone && <div className="text-[10px]"><b>Phone:</b> {inv.customer.phone}</div>}
          {inv.customer?.email && <div className="text-[10px]"><b>Email:</b> {inv.customer.email}</div>}
        </div>
      </div>

      {/* Items */}
      <table className="mt-4 border border-slate-900">
        <thead className="bg-slate-100 text-[10px] uppercase tracking-wider">
          <tr>
            <th className="border border-slate-900 text-l w-6">#</th>
            <th className="border border-slate-900 text-l">Description of Goods / Services</th>
            <th className="border border-slate-900 num w-16">HSN/SAC</th>
            <th className="border border-slate-900 num w-14">Qty</th>
            <th className="border border-slate-900 text-l w-14">Unit</th>
            <th className="border border-slate-900 num w-20">Rate</th>
            <th className="border border-slate-900 num w-20">Disc.</th>
            <th className="border border-slate-900 num w-16">Tax %</th>
            <th className="border border-slate-900 num w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.line_items?.map((it, i) => {
            const gross = (it.quantity || 0) * (it.rate || 0);
            const taxable = gross - (it.discount || 0);
            return (
              <tr key={i}>
                <td className="border border-slate-300 text-l">{i + 1}</td>
                <td className="border border-slate-300 text-l">{it.description}</td>
                <td className="border border-slate-300 num">{it.hsn || "—"}</td>
                <td className="border border-slate-300 num">{it.quantity}</td>
                <td className="border border-slate-300 text-l">{it.unit}</td>
                <td className="border border-slate-300 num">{fmtINR(it.rate)}</td>
                <td className="border border-slate-300 num">{fmtINR(it.discount || 0)}</td>
                <td className="border border-slate-300 num">{it.tax_rate}%</td>
                <td className="border border-slate-300 num">{fmtINR(taxable)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <div className="border border-slate-300 p-3">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Amount in Words</div>
            <div className="text-[11px] font-medium">{numberToWords(inv.grand_total)}</div>
          </div>
          <div className="border border-slate-300 p-3 mt-2">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Bank Details</div>
            <div className="text-[10px]"><b>A/C Holder:</b> {COMPANY.bank.holder}</div>
            <div className="text-[10px]"><b>Bank:</b> {COMPANY.bank.name}</div>
            <div className="text-[10px]"><b>Branch:</b> {COMPANY.bank.branch}</div>
            <div className="text-[10px]"><b>A/C Type:</b> {COMPANY.bank.type}</div>
            <div className="text-[10px]"><b>A/C No.:</b> <span className="font-mono">{COMPANY.bank.ac}</span></div>
            <div className="text-[10px]"><b>IFSC:</b> <span className="font-mono">{COMPANY.bank.ifsc}</span></div>
            <div className="text-[10px] mt-1.5 pt-1.5 border-t border-slate-200 italic">
              <b>Note:</b> Please make cheques in favor of <b>{COMPANY.name}</b>.
            </div>
          </div>
        </div>
        <table className="border border-slate-900 self-start">
          <tbody className="text-[11px]">
            <SumTR label="Taxable Amount" val={inv.taxable_amount} />
            {inv.is_intra_state ? (<>
              <SumTR label="CGST" val={inv.cgst} />
              <SumTR label="SGST" val={inv.sgst} />
            </>) : <SumTR label="IGST" val={inv.igst} />}
            <SumTR label="Total Tax" val={inv.total_tax} />
            <tr className="bg-slate-900 text-white">
              <td className="border border-slate-900 text-l font-semibold px-2 py-2">GRAND TOTAL</td>
              <td className="border border-slate-900 num font-bold px-2 py-2 text-base">{fmtINRWithSymbol(inv.grand_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="text-[10px] text-slate-600 leading-relaxed">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Declaration</div>
          We declare that this invoice shows the actual price of the goods / services described and that all particulars are true and correct.
          {inv.notes && <div className="mt-2 pt-2 border-t border-slate-200">{inv.notes}</div>}
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

const MetaBox = ({ title, value, full, mono }) => (
  <div className={`border border-slate-300 p-2 ${full ? "col-span-2" : ""}`}>
    <div className="text-[9px] uppercase tracking-wider text-slate-500">{title}</div>
    <div className={`text-[11px] font-medium mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
  </div>
);

const SumTR = ({ label, val }) => (
  <tr>
    <td className="border border-slate-300 text-l px-2 py-1 text-slate-600">{label}</td>
    <td className="border border-slate-300 num px-2 py-1 w-32">{fmtINRWithSymbol(val)}</td>
  </tr>
);
