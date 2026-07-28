import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Plus, Trash2, Edit3 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const empty = { name: "", gstin: "", address: "", phone: "", email: "" };

export default function Customers() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/customers").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error("Name is required");
    try {
      if (editId) await api.put(`/customers/${editId}`, form);
      else await api.post("/customers", form);
      setOpen(false); setForm(empty); setEditId(null); load();
      toast.success(editId ? "Customer updated" : "Customer added");
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this customer?")) return;
    await api.delete(`/customers/${id}`);
    load();
    toast.success("Deleted");
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Directory</div>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">Save frequent billing parties to reuse across invoices.</p>
        </div>
        <Button data-testid="add-customer-btn" onClick={() => { setForm(empty); setEditId(null); setOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Add Customer
        </Button>
      </header>

      <Card className="p-0 border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">GSTIN</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">State</th>
              <th className="px-4 py-3 text-right w-32">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan="6" className="px-4 py-14 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-3 opacity-40" /> No customers yet.
              </td></tr>
            )}
            {list.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.gstin || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.email || "—"}</td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{c.state_code || "—"}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => { setForm({ name: c.name, gstin: c.gstin || "", address: c.address || "", phone: c.phone || "", email: c.email || "" }); setEditId(c.id); setOpen(true); }} className="text-blue-600 text-xs inline-flex items-center gap-1"><Edit3 className="w-3.5 h-3.5" /></button>
                  {isAdmin && <button onClick={() => del(c.id)} className="text-red-500 text-xs inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Customer" : "Add Customer"}</DialogTitle>
            <DialogDescription>Save frequently-billed parties to reuse across invoices.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="customer-form-name" /></div>
            <div><Label>GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} data-testid="customer-form-gstin" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="customer-form-save" className="bg-blue-600 hover:bg-blue-700 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
