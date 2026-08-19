import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogoSVG, LogoDark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Truck, FileCheck2, Award, Building2, Mail, MapPin, ChevronRight, Sparkles, PackageCheck, Landmark, Menu, X } from "lucide-react";
import LoginModal from "@/components/LoginModal";

export default function Landing() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = useNavigate();

  const scrollTo = (id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => scrollTo("hero")} className="shrink-0" data-testid="header-logo">
            <LogoSVG width={200} height={46} />
          </button>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-700">
            <button onClick={() => scrollTo("hero")} className="hover:text-blue-600 transition-colors" data-testid="nav-home">Home</button>
            <button onClick={() => scrollTo("about")} className="hover:text-blue-600 transition-colors" data-testid="nav-about">About Us</button>
            <button onClick={() => scrollTo("services")} className="hover:text-blue-600 transition-colors" data-testid="nav-services">Services & Supply Solutions</button>
            <button onClick={() => scrollTo("contact")} className="hover:text-blue-600 transition-colors" data-testid="nav-contact">Contact Us</button>
          </nav>
          <div className="flex items-center gap-3">
            <Button
              data-testid="header-login-btn"
              onClick={() => setLoginOpen(true)}
              className="hidden md:inline-flex bg-slate-900 hover:bg-blue-600 text-white h-10 px-5 gap-2 transition-colors"
            >
              Client & Staff Login <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <button className="md:hidden p-2" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden px-6 py-4 border-t border-slate-200 bg-white space-y-3 text-sm">
            <button onClick={() => scrollTo("hero")} className="block w-full text-left">Home</button>
            <button onClick={() => scrollTo("about")} className="block w-full text-left">About Us</button>
            <button onClick={() => scrollTo("services")} className="block w-full text-left">Services & Supply Solutions</button>
            <button onClick={() => scrollTo("contact")} className="block w-full text-left">Contact Us</button>
            <Button onClick={() => { setLoginOpen(true); setMenuOpen(false); }} className="w-full bg-slate-900 text-white">Client & Staff Login</Button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="hero" className="relative overflow-hidden">
        <div className="absolute inset-0 te-grid-bg opacity-40 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-60 pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-sky-100 rounded-full blur-3xl opacity-60 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 grid md:grid-cols-2 gap-10 items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="w-3 h-3" /> Gujarat · GSTIN 24AMAPR1170Q1ZT
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-semibold tracking-tight leading-[1.05] text-slate-900">
              Reliable <span className="text-blue-600">B2B & Retail Supply</span> Solutions for Government & Corporate Enterprise
            </h1>
            <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">
              Empowering seamless procurement, GeM order fulfillment, and quality trading with complete GST transparency across India.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                data-testid="hero-services-btn"
                onClick={() => scrollTo("services")}
                className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-6 gap-2 text-base"
              >
                Our Services <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                data-testid="hero-portal-btn"
                onClick={() => setLoginOpen(true)}
                variant="outline"
                className="h-12 px-6 border-slate-300 text-slate-900 hover:bg-slate-900 hover:text-white transition-colors text-base"
              >
                Portal Login
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-200 pt-8 max-w-lg">
              <Stat number="100%" label="GST Compliant" />
              <Stat number="Pan-India" label="Delivery Reach" />
              <Stat number="GeM ✓" label="Registered" />
            </div>
          </div>
          <div className="relative animate-fade-up hidden md:block">
            <div className="relative bg-[#0F172A] rounded-2xl p-8 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 te-grid-bg opacity-30" />
              <div className="relative">
                <LogoDark width={220} height={50} />
                <div className="mt-8 space-y-4">
                  <FeatureRow icon={<PackageCheck className="w-4 h-4 text-sky-400" />} label="GeM Tender Fulfillment" />
                  <FeatureRow icon={<Truck className="w-4 h-4 text-sky-400" />} label="Bulk Commercial Supply" />
                  <FeatureRow icon={<FileCheck2 className="w-4 h-4 text-sky-400" />} label="GST-Compliant Invoicing" />
                  <FeatureRow icon={<Landmark className="w-4 h-4 text-sky-400" />} label="Transparent Financials" />
                </div>
                <div className="mt-8 pt-6 border-t border-slate-800">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-sky-400 mb-1">Trade Registered</div>
                  <div className="text-white font-mono text-xs">Vadodara · Gujarat · 391410</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-12">
          <div className="md:col-span-1">
            <div className="text-xs uppercase tracking-[0.3em] text-blue-600 mb-4">About Us</div>
            <h2 className="text-3xl sm:text-4xl font-heading font-semibold tracking-tight text-slate-900">
              A premier Gujarati commercial trading firm
            </h2>
          </div>
          <div className="md:col-span-2 space-y-6 text-slate-700 leading-relaxed">
            <p className="text-lg">
              <span className="font-heading font-semibold text-slate-900">TRAYAMBAK ENTERPRISE</span> specialises in retail supply, Government e-Marketplace (GeM) order fulfillment, and enterprise procurement — serving public departments and corporate buyers with disciplined logistics and fiscal transparency.
            </p>
            <p className="text-base">
              Registered in Vadodara, Gujarat and operating under GSTIN 24AMAPR1170Q1ZT, we combine trading expertise with a modern billing operations stack — every invoice is fully GST-compliant, every payment is reconciled to the paisa, and every consignment leaves with documented traceability.
            </p>
            <div className="grid grid-cols-2 gap-6 pt-6">
              <Value icon={<Award className="w-5 h-5" />} title="Quality Assurance" desc="Every article vetted against buyer specifications before dispatch." />
              <Value icon={<Truck className="w-5 h-5" />} title="On-Time Logistics" desc="Committed delivery windows with pan-India reach." />
              <Value icon={<ShieldCheck className="w-5 h-5" />} title="Legal Compliance" desc="Full GST, HSN/SAC, and consignee documentation." />
              <Value icon={<Landmark className="w-5 h-5" />} title="Transparent Financials" desc="Audit-ready invoicing and reconciliation." />
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-14">
            <div className="text-xs uppercase tracking-[0.3em] text-blue-600 mb-4">Supply Services</div>
            <h2 className="text-3xl sm:text-4xl font-heading font-semibold tracking-tight text-slate-900">
              What we deliver, end-to-end
            </h2>
            <p className="text-slate-600 mt-4">Three focused practices, one accountable enterprise.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <ServiceCard
              index="01"
              title="GeM Tender Order Fulfillment"
              desc="Direct submissions, contract management, and dispatch against Government e-Marketplace tenders — with buyer department documentation, delivery challans, and consignee-ready invoices."
              icon={<Building2 className="w-6 h-6" />}
              testid="service-gem"
            />
            <ServiceCard
              index="02"
              title="Bulk Commercial & Industrial Retail Supply"
              desc="High-volume supply to corporates and B2B partners — flexible unit configurations (Pcs, Nos, Kg, Set, Lot, Service) with same-day quote turnaround."
              icon={<Truck className="w-6 h-6" />}
              testid="service-bulk"
            />
            <ServiceCard
              index="03"
              title="Multi-Category Article Procurement & Distribution"
              desc="Sourcing across categories, verified vendors, and consolidated distribution — one purchase order across multiple HSN classifications."
              icon={<PackageCheck className="w-6 h-6" />}
              testid="service-procurement"
            />
          </div>
        </div>
      </section>

      {/* Contact & Footer */}
      <section id="contact" className="bg-[#0F172A] text-slate-100 py-20 relative overflow-hidden">
        <div className="absolute inset-0 te-grid-bg opacity-20" />
        <div className="relative max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-10">
          <div className="md:col-span-1">
            <LogoDark width={220} height={50} />
            <p className="text-sm text-slate-400 mt-6 leading-relaxed">
              For procurement queries, tender enquiries, and enterprise partnership requests — reach us via our official channel below.
            </p>
          </div>
          <div className="md:col-span-2 grid sm:grid-cols-2 gap-8">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-sky-400 mb-3">Registered Office</div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
                <div className="text-sm text-slate-300 leading-relaxed">
                  <div className="font-semibold text-white">TRAYAMBAK ENTERPRISE</div>
                  Akshar Pavilion,<br />
                  Vasna Bhayli Main Road,<br />
                  Opp Rosedale Heights,<br />
                  Vadodara, Gujarat — 391410
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-sky-400 mb-3">Official Contact</div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-sky-400" />
                  <a href="mailto:hi@trayambak.in" className="text-slate-100 hover:text-sky-300" data-testid="contact-email">hi@trayambak.in</a>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  <span className="font-mono text-slate-300">GSTIN 24AMAPR1170Q1ZT</span>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-sky-400" />
                  <span className="text-slate-300">State: Gujarat (Code 24)</span>
                </div>
              </div>
              <Button
                data-testid="footer-login-btn"
                onClick={() => setLoginOpen(true)}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white h-11 gap-2"
              >
                Access Client & Staff Portal <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="relative mt-16 border-t border-slate-800 pt-6 max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-slate-500 font-mono">
          <div>© {new Date().getFullYear()} TRAYAMBAK ENTERPRISE · Vadodara, Gujarat</div>
          <div>Trading · GeM Supply · Corporate Procurement</div>
        </div>
      </section>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => { setLoginOpen(false); nav("/dashboard"); }} />
    </div>
  );
}

const Stat = ({ number, label }) => (
  <div>
    <div className="text-2xl font-heading font-semibold text-slate-900">{number}</div>
    <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">{label}</div>
  </div>
);

const FeatureRow = ({ icon, label }) => (
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-md bg-slate-800/60 border border-slate-700 flex items-center justify-center">{icon}</div>
    <span className="text-slate-200 text-sm">{label}</span>
  </div>
);

const Value = ({ icon, title, desc }) => (
  <div>
    <div className="w-10 h-10 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">{icon}</div>
    <div className="mt-3 font-heading font-semibold text-slate-900">{title}</div>
    <div className="text-sm text-slate-600 mt-1">{desc}</div>
  </div>
);

const ServiceCard = ({ index, title, desc, icon, testid }) => (
  <div className="group bg-white border border-slate-200 rounded-xl p-8 hover:border-blue-400 hover:shadow-lg transition-all duration-300" data-testid={testid}>
    <div className="flex items-start justify-between mb-6">
      <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center group-hover:bg-blue-600 transition-colors">{icon}</div>
      <div className="text-xs font-mono text-slate-400 tracking-wider">{index}</div>
    </div>
    <h3 className="font-heading text-xl font-semibold text-slate-900">{title}</h3>
    <p className="text-sm text-slate-600 mt-3 leading-relaxed">{desc}</p>
  </div>
);
