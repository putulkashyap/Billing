import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Boxes, Plus, Trash2, Edit3, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const RATES = [0, 0.1, 0.25, 3, 5, 12, 18, 28];
const TAXABILITY = [
  { value: "taxable", label: "Taxable" },
  { value: "exempt", label: "Exempt" },
  { value: "nil_rated", label: "Nil Rated" },
  { value: "zero_rated", label: "Zero Rated" },
];

const empty = {
  code: "", description: "", gst_rate: 18, cess_rate: 0,
  taxability: "taxable", itc_eligible: true,
  effective_from: "", effective_to: "", active: true,
};

export default function HsnMaster() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/hsn").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (h) => {
    setForm({ ...empty, ...h, active: h.active !== false, itc_eligible: h.itc_eligible !== false });
    setEditId(h.id); setOpen(true);
  };

  const save = async () => {
    if (!form.code?.trim()) return toast.error("HSN/SAC code is required");
    setSaving(true);
    try {
      const payload = { ...form, gst_rate: Number(form.gst_rate || 0), cess_rate: Number(form.cess_rate || 0) };
      if (editId) await api.put(`/hsn/${editId}`, payload);
      else await api.post("/hsn", payload);
      setOpen(false); setForm(empty); setEditId(null); load();
      toast.success(editId ? "HSN updated" : "HSN added");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save HSN");
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this HSN entry?")) return;
    try { await api.delete(`/hsn/${id}`); load(); toast.success("Deleted"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const filtered = list.filter((h) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (h.code || "").toLowerCase().includes(s) || (h.description || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Configuration</div>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <Boxes className="w-8 h-8 text-blue-600" /> HSN / SAC Master
          </h1>
          <p className="text-sm text-slate-500 mt-1">Configuration-driven GST rates. Add every HSN/SAC you invoice against.</p>
        </div>
        {isAdmin && (
          <Button data-testid="add-hsn-btn" onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Add HSN / SAC
          </Button>
        )}
      </header>

      <Card className="p-4 border-slate-200 rounded-md flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code / description…" className="pl-9" data-testid="hsn-search" />
        </div>
        <div className="text-sm text-slate-500">{filtered.length} of {list.length}</div>
      </Card>

      <Card className="p-0 border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-right">GST %</th>
              <th className="px-4 py-3 text-right">Cess %</th>
              <th className="px-4 py-3 text-left">Taxability</th>
              <th className="px-4 py-3 text-center">ITC</th>
              <th className="px-4 py-3 text-center">Active</th>
              {isAdmin && <th className="px-4 py-3 text-right w-32">Action</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={isAdmin ? 8 : 7} className="px-4 py-14 text-center text-slate-400">
                <Boxes className="w-8 h-8 mx-auto mb-3 opacity-40" /> No HSN/SAC codes configured yet.
              </td></tr>
            )}
            {filtered.map((h) => (
              <tr key={h.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`hsn-row-${h.code}`}>
                <td className="px-4 py-3 font-mono">{h.code}</td>
                <td className="px-4 py-3">{h.description}</td>
                <td className="px-4 py-3 text-right font-mono">{Number(h.gst_rate || 0).toFixed(2)}%</td>
                <td className="px-4 py-3 text-right font-mono">{Number(h.cess_rate || 0).toFixed(2)}%</td>
                <td className="px-4 py-3 text-xs capitalize">{h.taxability?.replace("_", " ")}</td>
                <td className="px-4 py-3 text-center text-xs">{h.itc_eligible ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-center text-xs">{h.active === false ? "—" : <span className="text-emerald-600">●</span>}</td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(h)} className="text-blue-600 text-xs inline-flex items-center gap-1" data-testid={`hsn-edit-${h.code}`}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => del(h.id)} className="text-red-500 text-xs inline-flex items-center gap-1" data-testid={`hsn-delete-${h.code}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit HSN/SAC" : "Add HSN/SAC"}</DialogTitle>
            <DialogDescription>Set the GST rate and taxability for this HSN/SAC code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>HSN / SAC Code *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="hsn-form-code" />
              </div>
              <div>
                <Label>Taxability</Label>
                <Select value={form.taxability} onValueChange={(v) => setForm({ ...form, taxability: v })}>
                  <SelectTrigger data-testid="hsn-form-taxability"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAXABILITY.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="hsn-form-desc" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>GST Rate</Label>
                <Select value={String(form.gst_rate)} onValueChange={(v) => setForm({ ...form, gst_rate: Number(v) })}>
                  <SelectTrigger data-testid="hsn-form-rate"><SelectValue /></SelectTrigger>
                  <SelectContent>{RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cess Rate</Label>
                <Input type="number" step="0.01" value={form.cess_rate}
                       onChange={(e) => setForm({ ...form, cess_rate: e.target.value })} data-testid="hsn-form-cess" />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.itc_eligible !== false}
                         onChange={(e) => setForm({ ...form, itc_eligible: e.target.checked })} data-testid="hsn-form-itc" />
                  <span>ITC Eligible</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Effective From</Label>
                <Input type="date" value={form.effective_from || ""} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
              </div>
              <div>
                <Label>Effective To</Label>
                <Input type="date" value={form.effective_to || ""} onChange={(e) => setForm({ ...form, effective_to: e.target.value })} />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.active !== false}
                         onChange={(e) => setForm({ ...form, active: e.target.checked })} data-testid="hsn-form-active" />
                  <span>Active</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} data-testid="hsn-form-save" className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? "Saving…" : editId ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
