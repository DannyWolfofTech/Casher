import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useNavigate, Link } from "react-router-dom";
import { Upload, ArrowUpRight, BarChart3, Check, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import SEO from "@/components/SEO";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user);
      if (session?.user) navigate("/dashboard");
    };
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user);
      if (session?.user) navigate("/dashboard");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary selection:text-primary-foreground">
      <SEO
        title="Casher — Plug your financial leaks & save money"
        description="Upload your bank CSV, spot recurring subscriptions, and cancel the ones you don't use. Privacy-first, no bank login."
        path="/"
      />

      {/* Navigation */}
      <nav className="w-full border-b border-foreground/10">
        <div className="max-w-7xl mx-auto py-5 px-6 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to={user ? "/dashboard" : "/"} className="font-serif italic text-3xl tracking-tight text-foreground">
              Casher
            </Link>
            <div className="hidden md:flex gap-7 text-xs font-medium uppercase tracking-[0.18em] text-foreground/60">
              <button onClick={() => navigate("/about")} className="hover:text-foreground transition-colors">{t("about")}</button>
              <button onClick={() => navigate("/pricing")} className="hover:text-foreground transition-colors">Pricing</button>
              <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors">{t("privacy")}</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <button
              onClick={() => navigate("/auth")}
              className="bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-semibold text-sm hover:brightness-110 transition-all"
            >
              {t("getStarted")}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="w-full border-b border-foreground/10">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-32 grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-8">
            <h1 className="font-serif italic text-7xl md:text-[10rem] lg:text-[13rem] leading-[0.85] tracking-tight mb-10 text-foreground">
              Casher
            </h1>
            <div className="w-16 h-px bg-foreground mb-8" />
            <p className="font-serif text-3xl md:text-5xl leading-[1.05] max-w-2xl text-foreground mb-4">
              Plug your <span className="italic">financial leaks<span className="text-primary">.</span></span>
            </p>
            <p className="text-base md:text-lg leading-relaxed max-w-xl text-foreground/70 mb-12 mt-8">
              The UK financial app that helps freelancers spot and cancel unused subscriptions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate("/auth")}
                className="group bg-foreground text-background px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-3 hover:bg-primary transition-colors"
              >
                <Upload className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
                {t("uploadCSV")}
              </button>
              <button
                onClick={() => navigate("/pricing")}
                className="border border-foreground/30 text-foreground px-8 py-4 rounded-full font-semibold hover:bg-foreground/5 transition-colors"
              >
                {t("viewPricing")}
              </button>
            </div>
          </div>
          <aside className="md:col-span-4 flex flex-col justify-end">
            <div className="border-t-4 border-primary pt-6">
              <span className="block text-5xl font-serif mb-2 text-foreground">£420.00</span>
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 font-bold">
                Average annual leak recovered
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* How it works — three steps */}
      <section className="w-full">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-6">
            <h2 className="font-serif text-4xl md:text-6xl tracking-tight text-foreground">
              How it <span className="italic">works.</span>
            </h2>
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 font-bold">Three quiet steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-10 md:p-12 rounded-3xl bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors">
              <div className="w-12 h-12 bg-foreground/10 text-foreground flex items-center justify-center rounded-full mb-8">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 tracking-tight text-foreground">01. Upload</h3>
              <p className="text-foreground/70 leading-relaxed">
                Drag your bank CSV export into the analyzer. No bank logins, no API access — just a file you already have.
              </p>
            </div>
            <div className="p-10 md:p-12 rounded-3xl bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors">
              <div className="w-12 h-12 bg-foreground/10 text-foreground flex items-center justify-center rounded-full mb-8">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 tracking-tight text-foreground">02. Analyze</h3>
              <p className="text-foreground/70 leading-relaxed">
                We cross-reference thousands of UK merchants to surface recurring payments hiding in plain sight.
              </p>
            </div>
            <div className="p-10 md:p-12 rounded-3xl bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors">
              <div className="w-12 h-12 bg-foreground/10 text-foreground flex items-center justify-center rounded-full mb-8">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 tracking-tight text-foreground">03. Save</h3>
              <p className="text-foreground/70 leading-relaxed">
                Get a clear cancel list with direct links and email templates for every subscription you no longer need.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy strip */}
      <section className="w-full border-t border-foreground/10">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-16 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4">
            <Shield className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-serif text-3xl md:text-4xl tracking-tight text-foreground">Your data, <span className="italic">untouched.</span></h3>
          </div>
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { title: "GDPR compliant", body: "Stored in EU regions and removable on request." },
              { title: "Encrypted at rest", body: "Files and tables encrypted with industry standards." },
              { title: "No bank login", body: "We never see your banking credentials. Ever." },
            ].map((item) => (
              <div key={item.title} className="border-t border-foreground/15 pt-4">
                <p className="font-bold text-foreground mb-1">{item.title}</p>
                <p className="text-sm text-foreground/60 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="w-full px-6 md:px-8 py-16">
        <div className="max-w-6xl mx-auto bg-[#1A237E] text-white rounded-[2rem] px-8 md:px-16 py-20 md:py-28 text-center">
          <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] mb-10 italic text-white">
            Stop paying for what <br />you don't use.
          </h2>
          <button
            onClick={() => navigate("/auth")}
            className="inline-flex items-center gap-3 bg-primary text-primary-foreground px-10 py-5 rounded-full font-semibold text-base hover:scale-[1.02] transition-transform"
          >
            {t("getStarted")}
            <ArrowUpRight className="w-5 h-5" />
          </button>
          <p className="mt-10 text-white/70 text-xs uppercase tracking-[0.25em] font-semibold">
            Simple CSV Upload &middot; UK Centric &middot; Secure
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-foreground/10 py-10">
        <div className="max-w-7xl mx-auto px-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-foreground/70">
          <p>&copy; 2025 {t("appName")}. {t("allRightsReserved")}.</p>
          <div className="flex gap-6">
            <button onClick={() => navigate("/about")} className="hover:text-foreground transition-colors">{t("about")}</button>
            <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors">{t("privacyPolicy")}</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
