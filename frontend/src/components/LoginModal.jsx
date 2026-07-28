import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { LogoDark } from "@/components/Logo";
import { ShieldCheck, X } from "lucide-react";

export default function LoginModal({ open, onClose, onSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success("Welcome back");
      onSuccess?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invalid credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 border-0 bg-transparent shadow-none">
        <VisuallyHidden.Root>
          <DialogTitle>Client and Staff Login</DialogTitle>
          <DialogDescription>Enter your registered TRAYAMBAK ENTERPRISE credentials to access the portal.</DialogDescription>
        </VisuallyHidden.Root>
        <div className="relative rounded-2xl overflow-hidden bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl">
          {/* Glassmorphic header */}
          <div className="relative bg-[#0F172A] p-6 pb-8 text-white overflow-hidden">
            <div className="absolute inset-0 te-grid-bg opacity-30" />
            <div className="relative flex items-center justify-between">
              <LogoDark width={170} height={40} />
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/10" aria-label="Close">
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>
            <div className="relative mt-5">
              <div className="text-xs uppercase tracking-[0.3em] text-sky-400 mb-1">Portal Access</div>
              <div className="text-xl font-heading font-semibold">Client & Staff Login</div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="p-6 pt-5 space-y-4">
            <div>
              <Label htmlFor="lm-email" className="text-[11px] uppercase tracking-wider text-slate-600">Email</Label>
              <Input
                id="lm-email"
                data-testid="modal-login-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.in"
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="lm-password" className="text-[11px] uppercase tracking-wider text-slate-600">Password</Label>
              <Input
                id="lm-password"
                data-testid="modal-login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
                required
              />
            </div>
            <Button
              type="submit"
              data-testid="modal-login-submit"
              disabled={busy}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 font-medium"
            >
              {busy ? "Signing in…" : "Sign In"}
            </Button>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Encrypted session · single-tenant workspace</span>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
