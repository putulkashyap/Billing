// GST / currency helpers — Indian numbering

export const inrFmt = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const fmtINR = (n) => inrFmt.format(Number(n || 0));
export const fmtINRWithSymbol = (n) => `₹ ${fmtINR(n)}`;

export const isGujaratGSTIN = (gstin) => !!gstin && gstin.trim().startsWith("24");

export const gstinStateCode = (g) => {
  const s = String(g || "").trim();
  return /^[0-9]{2}/.test(s) ? s.slice(0, 2) : "";
};

export function computeTotals(party, items, opts = {}) {
  // party: { gstin?, state_code? }
  // opts.supplierStateCode: default "24" (Gujarat) for backward compatibility
  const supplier = opts.supplierStateCode || "24";
  const pos = String(party?.state_code || "").trim() || gstinStateCode(party?.gstin || "");
  // If no PoS AND no GSTIN → unregistered → default to inter-state (IGST)
  const intra = !!pos && pos === supplier;
  let subtotal = 0, total_discount = 0, taxable = 0, cgst = 0, sgst = 0, igst = 0;
  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.rate) || 0;
    const disc = Number(it.discount) || 0;
    const taxRate = Number(it.tax_rate) || 0;
    const gross = qty * rate;
    let line_taxable, tax;
    if (it.price_type === "inclusive") {
      const billed = gross - disc;
      line_taxable = taxRate ? billed / (1 + taxRate / 100) : billed;
      tax = billed - line_taxable;
    } else {
      line_taxable = gross - disc;
      tax = line_taxable * (taxRate / 100);
    }
    subtotal += gross;
    total_discount += disc;
    taxable += line_taxable;
    if (intra) { cgst += tax / 2; sgst += tax / 2; } else { igst += tax; }
  }
  const total_tax = cgst + sgst + igst;
  const grand_total = taxable + total_tax;
  const r = (x) => Math.round(x * 100) / 100;
  return {
    subtotal: r(subtotal),
    total_discount: r(total_discount),
    taxable_amount: r(taxable),
    cgst: r(cgst),
    sgst: r(sgst),
    igst: r(igst),
    total_tax: r(total_tax),
    grand_total: r(grand_total),
    is_intra_state: intra,
  };
}

export function numberToWords(num) {
  const n = Math.floor(Number(num) || 0);
  if (n === 0) return "Zero Rupees Only";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const inWords = (x) => {
    if (x < 20) return a[x];
    if (x < 100) return b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : "");
    if (x < 1000) return a[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + inWords(x % 100) : "");
    return "";
  };
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  let s = "";
  if (crore) s += inWords(crore) + " Crore ";
  if (lakh) s += inWords(lakh) + " Lakh ";
  if (thousand) s += inWords(thousand) + " Thousand ";
  if (rest) s += inWords(rest);
  return s.trim() + " Rupees Only";
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
