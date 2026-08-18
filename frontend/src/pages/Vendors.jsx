import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Truck, Plus, Trash2, Edit3, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PartyForm from "@/components/PartyForm";
import { isValidGSTIN, isValidPAN, stateName } from "@/lib/india";

const empty = {
  name: "", trade_name: "", gstin: "", pan: "",
  gst_reg_type: "regular", state: "", state_code: "",
  billing_address: "", shipping_address: "",
  contact_person: "", mobile: "", email: "", payment_terms: "", active: true,
};

export default function Vendors() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/vendors").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (v) => {
    setForm({ ...empty, ...v, active: v.active !== false });
    setEditId(v.id); setOpen(true);
  };

  const save = async () => {
    if (!form.name?.trim()) return toast.error("Legal name is required");
    const registered = form.gst_reg_type === "regular" || form.gst_reg_type === "composition";
    if (registered && !form.gstin) return toast.error("GSTIN is required for a registered vendor");
    if (form.gstin && !isValidGSTIN(form.gstin)) return toast.error("GSTIN format is invalid");
    if (form.pan && !isValidPAN(form.pan)) return toast.error("PAN format is invalid");
    setSaving(true);
    try {
      if (editId) await api.put(`/vendors/${editId}`, form);
      else await api.post("/vendors", form);
      setOpen(false); setForm(empty); setEditId(null); load();
      toast.success(editId ? "Vendor updated" : "Vendor added");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save vendor");
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this vendor?")) return;
    try { await api.delete(`/vendors/${id}`); load(); toast.success("Deleted"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const filtered = list.filter((v) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (v.name || "").toLowerCase().includes(s)
      || (v.trade_name || "").toLowerCase().includes(s)
      || (v.gstin || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Directory</div>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <Truck className="w-8 h-8 text-blue-600" /> Vendors
          </h1>
          <p className="text-sm text-slate-500 mt-1">Save frequently-billing vendors and re-use them across expenses.</p>
        </div>
        <Button data-testid="add-vendor-btn" onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Add Vendor
        </Button>
      </header>

      <Card className="p-4 border-slate-200 rounded-md flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / trade name / GSTIN…" className="pl-9" data-testid="vendor-search" />
        </div>
        <div className="text-sm text-slate-500">{filtered.length} of {list.length}</div>
      </Card>

      <Card className="p-0 border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Name / Trade</th>
              <th className="px-4 py-3 text-left">GSTIN</th>
              <th className="px-4 py-3 text-left">State</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-center">Active</th>
              <th className="px-4 py-3 text-right w-32">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="6" className="px-4 py-14 text-center text-slate-400">
                <Truck className="w-8 h-8 mx-auto mb-3 opacity-40" /> No vendors yet.
              </td></tr>
            )}
            {filtered.map((v) => (
              <tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`vendor-row-${v.id}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{v.name}</div>
                  {v.trade_name && <div className="text-xs text-slate-500">{v.trade_name}</div>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{v.gstin || "—"}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {v.state_code ? `${v.state_code} · ${v.state || stateName(v.state_code)}` : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <div>{v.contact_person || "—"}</div>
                  <div className="text-slate-500 font-mono">{v.mobile || ""}</div>
                </td>
                <td className="px-4 py-3 text-center">
                  {v.active === false ? <span className="text-xs text-slate-400">Inactive</span> : <span className="text-xs text-emerald-600">●</span>}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openEdit(v)} className="text-blue-600 text-xs inline-flex items-center gap-1" data-testid={`vendor-edit-${v.id}`}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {isAdmin && (
                    <button onClick={() => del(v.id)} className="text-red-500 text-xs inline-flex items-center gap-1" data-testid={`vendor-delete-${v.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
            <DialogDescription>
              Registered vendors must have a valid GSTIN. Duplicate GSTINs are prevented automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto te-scroll pr-2">
            <PartyForm kind="vendor" form={form} setForm={setForm} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} data-testid="vendor-form-save" className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? "Saving…" : editId ? "Update Vendor" : "Save Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
