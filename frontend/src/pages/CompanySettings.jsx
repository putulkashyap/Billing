import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Save } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { INDIAN_STATES, isValidGSTIN, isValidPAN, gstinStateCode, stateName } from "@/lib/india";

export default function CompanySettings() {
  const { isAdmin } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/company").then((r) => setForm(r.data));
  useEffect(() => { load(); }, []);

  if (!form) return <div className="p-6 text-slate-500">Loading…</div>;

  const setField = (k, v) => setForm({ ...form, [k]: v });
  const onGstinBlur = () => {
    const g = (form.gstin || "").trim().toUpperCase();
    const sc = gstinStateCode(g);
    if (sc) setForm({ ...form, gstin: g, state_code: sc, state: stateName(sc) });
    else setField("gstin", g);
  };
  const onStateCode = (v) => setForm({ ...form, state_code: v, state: stateName(v) });

  const save = async () => {
    if (form.gstin && !isValidGSTIN(form.gstin)) return toast.error("Invalid GSTIN format");
    if (form.pan && !isValidPAN(form.pan)) return toast.error("Invalid PAN format");
    setSaving(true);
    try {
      const r = await api.put("/company", form);
      setForm(r.data);
      toast.success("Company settings saved");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Configuration</div>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" /> Company Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">Supplier identity, GSTIN, place of supply origin & bank details used across invoices.</p>
        </div>
        {isAdmin && (
          <Button onClick={save} disabled={saving} data-testid="company-save-btn" className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Settings"}
          </Button>
        )}
      </header>

      <Card className="p-6 border-slate-200 rounded-md space-y-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Legal Identity</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Legal Name</Label>
            <Input value={form.legal_name || ""} onChange={(e) => setField("legal_name", e.target.value)}
                   disabled={!isAdmin} data-testid="company-legal-name" />
          </div>
          <div>
            <Label>Trade Name</Label>
            <Input value={form.trade_name || ""} onChange={(e) => setField("trade_name", e.target.value)}
                   disabled={!isAdmin} data-testid="company-trade-name" />
          </div>
          <div>
            <Label>GSTIN</Label>
            <Input value={form.gstin || ""} onBlur={onGstinBlur}
                   onChange={(e) => setField("gstin", e.target.value.toUpperCase())}
                   disabled={!isAdmin} data-testid="company-gstin" />
          </div>
          <div>
            <Label>PAN</Label>
            <Input value={form.pan || ""} onChange={(e) => setField("pan", e.target.value.toUpperCase())}
                   disabled={!isAdmin} data-testid="company-pan" />
          </div>
          <div>
            <Label>State</Label>
            <Select value={form.state_code || ""} onValueChange={onStateCode} disabled={!isAdmin}>
              <SelectTrigger data-testid="company-state"><SelectValue placeholder="Select state…" /></SelectTrigger>
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
        <div>
          <Label>Address</Label>
          <Textarea rows={2} value={form.address || ""} onChange={(e) => setField("address", e.target.value)}
                    disabled={!isAdmin} data-testid="company-address" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Email</Label>
            <Input value={form.email || ""} onChange={(e) => setField("email", e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone || ""} onChange={(e) => setField("phone", e.target.value)} disabled={!isAdmin} />
          </div>
        </div>
      </Card>

      <Card className="p-6 border-slate-200 rounded-md space-y-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Bank Details (printed on invoices)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Bank Name</Label>
            <Input value={form.bank_name || ""} onChange={(e) => setField("bank_name", e.target.value)} disabled={!isAdmin} data-testid="company-bank-name" />
          </div>
          <div>
            <Label>Branch</Label>
            <Input value={form.bank_branch || ""} onChange={(e) => setField("bank_branch", e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <Label>Account Number</Label>
            <Input value={form.bank_account || ""} onChange={(e) => setField("bank_account", e.target.value)} disabled={!isAdmin} data-testid="company-bank-account" />
          </div>
          <div>
            <Label>IFSC</Label>
            <Input value={form.bank_ifsc || ""} onChange={(e) => setField("bank_ifsc", e.target.value.toUpperCase())} disabled={!isAdmin} data-testid="company-bank-ifsc" />
          </div>
        </div>
      </Card>
    </div>
  );
}
