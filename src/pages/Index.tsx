import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, PieChart, Shield, TrendingDown, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user);
      
      if (session?.user) {
        navigate("/dashboard");
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user);
      if (session?.user) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">{t("appName")}</h1>
          <div className="flex gap-4 items-center">
            <LanguageSelector />
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate("/privacy")}>
              {t("privacy")}
            </Button>
            <Button onClick={() => navigate("/auth")}>
              {t("getStarted")}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <section className="py-20 text-center">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {t("appName")}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t("tagline")}
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")}>
              <Upload className="mr-2 h-5 w-5" />
              {t("uploadCSV")}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/pricing")}>
              {t("viewPricing")}
            </Button>
          </div>
        </section>

        <section className="py-16">
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Upload className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t("easyUpload")}</CardTitle>
                <CardDescription>
                  {t("easyUploadDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t("easyUploadDetails")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <PieChart className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t("smartAnalysis")}</CardTitle>
                <CardDescription>
                  {t("smartAnalysisDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t("smartAnalysisDetails")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingDown className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{t("saveMoney")}</CardTitle>
                <CardDescription>
                  {t("saveMoneyDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t("saveMoneyDetails")}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="py-16 text-center">
          <h2 className="text-3xl font-bold mb-8">{t("howItWorks")}</h2>
          <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div>
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">{t("exportCSV")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("exportCSVDesc")}
              </p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">{t("uploadFile")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("uploadFileDesc")}
              </p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">{t("reviewAnalysis")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("reviewAnalysisDesc")}
              </p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h3 className="font-semibold mb-2">{t("cancelAndSave")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("cancelAndSaveDesc")}
              </p>
            </div>
          </div>
        </section>

        <section className="py-16">
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="text-center">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle className="text-2xl">{t("yourDataIsSafe")}</CardTitle>
              <CardDescription className="text-base">
                {t("privacyDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{t("gdprCompliant")}</p>
                    <p className="text-sm text-muted-foreground">{t("gdprDesc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{t("encryptedStorage")}</p>
                    <p className="text-sm text-muted-foreground">{t("encryptedStorageDesc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{t("autoDeletion")}</p>
                    <p className="text-sm text-muted-foreground">{t("autoDeletionDesc")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="py-16 text-center">
          <div className="bg-muted/50 rounded-lg p-8 max-w-3xl mx-auto">
            <p className="text-sm text-muted-foreground mb-4">
              <strong>{t("disclaimer")}</strong> {t("disclaimerText")}
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 {t("appName")}. {t("allRightsReserved")}.</p>
          <Button variant="link" onClick={() => navigate("/privacy")}>
            {t("privacyPolicy")}
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Index;
