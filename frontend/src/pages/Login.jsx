import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoSVG, LogoDark } from "@/components/Logo";
import { toast } from "sonner";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success("Welcome back");
      nav("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden md:flex bg-[#0F172A] text-slate-100 p-12 flex-col justify-between overflow-hidden">
        <div className="te-grid-bg absolute inset-0 opacity-30" />
        <div className="relative">
          <LogoDark width={260} height={60} />
        </div>
        <div className="relative space-y-8 max-w-md">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-sky-400 mb-3">Fiscal Operations Suite</div>
            <h1 className="text-4xl lg:text-5xl font-heading font-semibold leading-none tracking-tight">
              GST Billing & <br /> Account Reconciliation
            </h1>
            <p className="mt-5 text-slate-300 text-sm leading-relaxed">
              Purpose-built for TRAYAMBAK ENTERPRISE — a precision toolkit for invoice generation,
              intra/inter-state tax computation, and payment reconciliation across GeM and B2B channels.
            </p>
          </div>
        </div>
        <div className="relative text-xs text-slate-500 font-mono">
          © {new Date().getFullYear()} TRAYAMBAK ENTERPRISE · Vadodara, Gujarat
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-8 flex justify-center">
            <LogoSVG width={220} height={50} />
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm animate-fade-up">
            <div className="mb-6">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Sign in</div>
              <h2 className="text-2xl font-heading font-semibold text-slate-900">Access your workspace</h2>
              <p className="text-sm text-slate-500 mt-1">Use your registered credentials to continue.</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-xs uppercase tracking-wider text-slate-600">Email</Label>
                <Input
                  id="email"
                  data-testid="login-email-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hi@trayambak.in"
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-slate-600">Password</Label>
                <Input
                  id="password"
                  data-testid="login-password-input"
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
                data-testid="login-submit-button"
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 font-medium"
              >
                {busy ? "Signing in…" : "Sign In"}
              </Button>
            </form>
            <div className="mt-6 pt-5 border-t border-slate-100 text-xs text-slate-500 font-mono">
              Secure sign-in
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Metric = () => null;
