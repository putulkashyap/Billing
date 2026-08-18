// Indian states + GSTIN helpers. Keep this data local so we don't ping an API for a static list.
export const INDIAN_STATES = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh (Old)" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
  { code: "99", name: "Overseas / SEZ" },
];

export const STATE_BY_CODE = Object.fromEntries(INDIAN_STATES.map((s) => [s.code, s.name]));
export const stateName = (code) => STATE_BY_CODE[String(code || "").padStart(2, "0")] || "";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;

export const isValidGSTIN = (g) => {
  const s = String(g || "").trim().toUpperCase();
  return !!s && GSTIN_RE.test(s);
};

export const gstinStateCode = (g) => {
  const s = String(g || "").trim();
  return /^[0-9]{2}/.test(s) ? s.slice(0, 2) : "";
};

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const isValidPAN = (p) => {
  const s = String(p || "").trim().toUpperCase();
  return !!s && PAN_RE.test(s);
};

export const GST_REG_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "composition", label: "Composition" },
  { value: "unregistered", label: "Unregistered" },
  { value: "other", label: "Other" },
];

export const CUSTOMER_TYPES = [
  { value: "b2b", label: "B2B" },
  { value: "b2c", label: "B2C" },
  { value: "gov", label: "Government" },
  { value: "gem", label: "GeM" },
  { value: "sez", label: "SEZ / Export" },
];
