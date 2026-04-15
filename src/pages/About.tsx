import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import logoFull from "@/assets/logo-full.png";

const About = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <Link to={user ? "/dashboard" : "/"}>
            <img src={logoFull} alt="Casher" className="h-14 cursor-pointer" />
          </Link>
          <div className="flex gap-4 items-center">
            <LanguageSelector />
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate("/about")}>
              {t("about")}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/privacy")}>
              {t("privacy")}
            </Button>
            {user ? (
              <Button onClick={() => navigate("/dashboard")}>
                {t("dashboard")}
              </Button>
            ) : (
              <Button onClick={() => navigate("/auth")}>
                {t("getStarted")}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4">
        {/* Hero Section */}
        <section className="py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            {t("aboutHeroTitle")}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            {t("aboutHeroSubtitle")}
          </p>
        </section>

        {/* Why CSV Section */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-12 w-12 text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-4">
                  {t("whyCsvTitle")}
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {t("whyCsvBody")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security Features */}
        <section className="py-16">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-6 rounded-lg bg-card border">
              <Lock className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t("noBankLogin")}</h3>
              <p className="text-sm text-muted-foreground">{t("noBankLoginDesc")}</p>
            </div>
            <div className="text-center p-6 rounded-lg bg-card border">
              <Shield className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t("hundredPercentSecure")}</h3>
              <p className="text-sm text-muted-foreground">{t("hundredPercentSecureDesc")}</p>
            </div>
            <div className="text-center p-6 rounded-lg bg-card border">
              <Target className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t("youInControl")}</h3>
              <p className="text-sm text-muted-foreground">{t("youInControlDesc")}</p>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">
              {t("missionTitle")}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              {t("missionBody")}
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 text-center">
          <div className="bg-primary/5 rounded-2xl p-12 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">{t("readyToSave")}</h2>
            <p className="text-muted-foreground mb-6">{t("readyToSaveDesc")}</p>
            <Button size="lg" onClick={() => navigate("/auth")}>
              {t("getStarted")}
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 {t("appName")}. {t("allRightsReserved")}.</p>
          <div className="flex gap-4 justify-center mt-2">
            <Button variant="link" onClick={() => navigate("/about")}>
              {t("about")}
            </Button>
            <Button variant="link" onClick={() => navigate("/privacy")}>
              {t("privacyPolicy")}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;
