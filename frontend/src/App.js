import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Invoices from "@/pages/Invoices";
import InvoiceForm from "@/pages/InvoiceForm";
import Customers from "@/pages/Customers";
import Reconciliation from "@/pages/Reconciliation";
import Staff from "@/pages/Staff";
import CreditNotes from "@/pages/CreditNotes";
import CreditNoteForm from "@/pages/CreditNoteForm";
import Layout from "@/components/Layout";

function Protected({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/invoices" element={<Protected><Invoices /></Protected>} />
            <Route path="/invoices/new" element={<Protected><InvoiceForm /></Protected>} />
            <Route path="/invoices/:id/edit" element={<Protected><InvoiceForm /></Protected>} />
            <Route path="/credit-notes" element={<Protected><CreditNotes /></Protected>} />
            <Route path="/credit-notes/new" element={<Protected><CreditNoteForm /></Protected>} />
            <Route path="/customers" element={<Protected><Customers /></Protected>} />
            <Route path="/reconciliation" element={<Protected><Reconciliation /></Protected>} />
            <Route path="/staff" element={<Protected><Staff /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
