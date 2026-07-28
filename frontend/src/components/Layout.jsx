import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogoSVG } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, FileText, Users, Wallet, UserCog, LogOut, PlusCircle, FileMinus } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/invoices", label: "Invoices", icon: FileText, testid: "nav-invoices" },
  { to: "/credit-notes", label: "Credit Notes", icon: FileMinus, testid: "nav-credit-notes" },
  { to: "/reconciliation", label: "Reconciliation", icon: Wallet, testid: "nav-reconciliation" },
  { to: "/customers", label: "Customers", icon: Users, testid: "nav-customers" },
  { to: "/staff", label: "Staff", icon: UserCog, testid: "nav-staff", adminOnly: true },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-[#0F172A] text-slate-100 flex flex-col border-r border-slate-800">
        <div className="px-5 py-6 border-b border-slate-800">
          <div className="scale-90 origin-left">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" width="200" height="46">
              <g transform="translate(5, 5)">
                <rect x="5" y="5" width="90" height="90" rx="18" fill="#38BDF8" />
                <path d="M 24 32 C 24 26, 30 24, 38 24 L 72 24 C 76 24, 78 27, 76 31 L 70 40 C 69 42, 66 43, 63 43 L 34 43 Z" fill="#0F172A" />
                <path d="M 43 38 L 59 38 L 59 76 C 59 81, 54 85, 48 85 L 43 85 L 43 38 Z" fill="#1E293B" />
                <path d="M 59 24 L 78 24 C 80 24, 82 26, 80 29 L 70 44 L 59 34 Z" fill="#334155" />
              </g>
              <text x="115" y="58" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="32" fill="#F8FAFC" letterSpacing="2">TRAYAMBAK</text>
              <text x="117" y="84" fontFamily="Outfit, sans-serif" fontWeight="700" fontSize="14" fill="#38BDF8" letterSpacing="5">ENTERPRISE</text>
            </svg>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {NAV.filter(n => !n.adminOnly || isAdmin).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600/20 text-sky-300 border border-blue-600/40"
                    : "text-slate-300 hover:bg-slate-800/60 border border-transparent"
                }`
              }
            >
              <n.icon className="w-4 h-4" />
              <span className="font-medium">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <Button
            data-testid="new-invoice-cta"
            onClick={() => nav("/invoices/new")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <PlusCircle className="w-4 h-4" /> New Invoice
          </Button>
          <div className="flex items-center justify-between px-1">
            <div>
              <div className="text-sm font-semibold text-slate-100" data-testid="current-user-name">{user?.name}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">{user?.role}</div>
            </div>
            <button
              data-testid="logout-button"
              onClick={() => { logout(); nav("/login"); }}
              className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
