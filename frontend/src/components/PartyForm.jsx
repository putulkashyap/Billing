import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATES, GST_REG_TYPES, CUSTOMER_TYPES, isValidGSTIN, gstinStateCode, stateName, isValidPAN } from "@/lib/india";

/** Shared form for Customer & Vendor master records. */
export default function PartyForm({ kind = "customer", form, setForm }) {
  const setField = (k, v) => setForm({ ...form, [k]: v });

  const onGstinBlur = () => {
    const g = (form.gstin || "").trim().toUpperCase();
    if (!g) return;
    const sc = gstinStateCode(g);
    if (sc && !form.state_code) {
      setForm({ ...form, gstin: g, state_code: sc, state: form.state || stateName(sc) });
    }
  };
  const onStateCodeChange = (v) => {
    setForm({ ...form, state_code: v, state: stateName(v) });
  };

  const gstinValid = !form.gstin || isValidGSTIN(form.gstin);
  const panValid = !form.pan || isValidPAN(form.pan);
  const requiresGSTIN = form.gst_reg_type === "regular" || form.gst_reg_type === "composition";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Legal Name *</Label>
          <Input value={form.name || ""} onChange={(e) => setField("name", e.target.value)}
                 data-testid={`${kind}-form-name`} />
        </div>
        <div>
          <Label>Trade Name</Label>
          <Input value={form.trade_name || ""} onChange={(e) => setField("trade_name", e.target.value)}
                 data-testid={`${kind}-form-trade-name`} />
        </div>
      </div>

      {kind === "customer" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Customer Type</Label>
            <Select value={form.customer_type || "b2b"} onValueChange={(v) => setField("customer_type", v)}>
              <SelectTrigger data-testid="customer-form-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CUSTOMER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>GST Reg. Type</Label>
            <Select value={form.gst_reg_type || "regular"} onValueChange={(v) => setField("gst_reg_type", v)}>
              <SelectTrigger data-testid={`${kind}-form-gst-reg-type`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {GST_REG_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active !== false}
                     onChange={(e) => setField("active", e.target.checked)}
                     data-testid={`${kind}-form-active`} />
              <span>Active</span>
            </label>
          </div>
        </div>
      )}
      {kind !== "customer" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>GST Reg. Type</Label>
            <Select value={form.gst_reg_type || "regular"} onValueChange={(v) => setField("gst_reg_type", v)}>
              <SelectTrigger data-testid={`${kind}-form-gst-reg-type`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {GST_REG_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active !== false}
                     onChange={(e) => setField("active", e.target.checked)}
                     data-testid={`${kind}-form-active`} />
              <span>Active</span>
            </label>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>GSTIN {requiresGSTIN && "*"}</Label>
          <Input value={form.gstin || ""} onBlur={onGstinBlur}
                 onChange={(e) => setField("gstin", e.target.value.toUpperCase())}
                 placeholder="e.g. 20AAAAA0000A1Z5"
                 data-testid={`${kind}-form-gstin`} />
          {!gstinValid && <div className="text-[11px] text-red-600 mt-1">Invalid GSTIN format.</div>}
        </div>
        <div>
          <Label>PAN</Label>
          <Input value={form.pan || ""} onChange={(e) => setField("pan", e.target.value.toUpperCase())}
                 placeholder="ABCDE1234F"
                 data-testid={`${kind}-form-pan`} />
          {!panValid && <div className="text-[11px] text-red-600 mt-1">Invalid PAN format.</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>State</Label>
          <Select value={form.state_code || ""} onValueChange={onStateCodeChange}>
            <SelectTrigger data-testid={`${kind}-form-state`}><SelectValue placeholder="Select state…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {INDIAN_STATES.map((s) => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>State Code</Label>
          <Input value={form.state_code || ""} readOnly className="bg-slate-50 font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Billing Address</Label>
          <Textarea rows={2} value={form.billing_address || ""}
                    onChange={(e) => setField("billing_address", e.target.value)}
                    data-testid={`${kind}-form-billing-address`} />
        </div>
        <div>
          <Label>Shipping Address</Label>
          <Textarea rows={2} value={form.shipping_address || ""}
                    onChange={(e) => setField("shipping_address", e.target.value)}
                    data-testid={`${kind}-form-shipping-address`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Contact Person</Label>
          <Input value={form.contact_person || ""} onChange={(e) => setField("contact_person", e.target.value)}
                 data-testid={`${kind}-form-contact-person`} />
        </div>
        <div>
          <Label>Mobile</Label>
          <Input value={form.mobile || ""} onChange={(e) => setField("mobile", e.target.value)}
                 data-testid={`${kind}-form-mobile`} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.email || ""} onChange={(e) => setField("email", e.target.value)}
                 data-testid={`${kind}-form-email`} />
        </div>
      </div>

      <div>
        <Label>Payment Terms</Label>
        <Input value={form.payment_terms || ""} onChange={(e) => setField("payment_terms", e.target.value)}
               placeholder="e.g. Net 30 days"
               data-testid={`${kind}-form-payment-terms`} />
      </div>
    </div>
  );
}
