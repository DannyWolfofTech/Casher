import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, PieChart, Shield, CheckCircle, TrendingUp, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import logoFull from "@/assets/logo-full.png";
const Index = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const {
    t
  } = useLanguage();
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      setUser(session?.user);
      if (session?.user) {
        navigate("/dashboard");
      }
    };
    checkUser();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user);
      if (session?.user) {
        navigate("/dashboard");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  return <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <img src={logoFull} alt="Casher" className="h-14 cursor-pointer" onClick={() => user ? navigate("/dashboard") : navigate("/")} />
          <div className="flex gap-4 items-center">
            <LanguageSelector />
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate("/about")}>
              {t("about")}
            </Button>
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
          <img src={logoFull} alt="Casher" className="h-32 mx-auto mb-6" />
          <p className="text-2xl md:text-3xl text-muted-foreground mb-8 max-w-2xl mx-auto font-medium">
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
                <TrendingUp className="h-10 w-10 text-primary mb-2" />
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

        {/* Download App Section */}
        <section className="py-16 text-center">
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/20 border-primary/20">
            <CardHeader>
              <Download className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle className="text-2xl">{t("downloadApp")}</CardTitle>
              <CardDescription className="text-base">
                {t("downloadAppDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="gap-2"
                  onClick={() => window.open('#', '_blank')}
                >
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  {t("downloadIOS")}
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open('#', '_blank')}
                >
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/>
                  </svg>
                  {t("downloadAndroid")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {t("comingSoon")}
              </p>
            </CardContent>
          </Card>
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
    </div>;
};
export default Index;