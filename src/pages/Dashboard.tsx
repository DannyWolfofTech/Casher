import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Upload, PieChart as PieChartIcon, TrendingDown, Share2 } from "lucide-react";
import CSVUpload from "@/components/CSVUpload";
import SpendingChart from "@/components/SpendingChart";
import SubscriptionsList from "@/components/SubscriptionsList";
import SavingsGoals from "@/components/SavingsGoals";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }
      
      setUser(session.user);
      
      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      setIsAdmin(!!roleData);
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const shareReferral = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const referralCode = `REF${session.user.id.slice(0, 8).toUpperCase()}`;
    const link = `${window.location.origin}/?ref=${referralCode}`;
    
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "Referral link copied!",
        description: "Share it to earn rewards",
      });
    } catch {
      toast({
        title: "Referral link",
        description: link,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">{t("appName")}</h1>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={shareReferral}>
              <Share2 className="mr-2 h-4 w-4" />
              {t("share")}
            </Button>
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate("/admin")}>
                {t("adminPanel")}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/pricing")}>
              {t("upgradeToPro")}
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {t("signOut")}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Spending</CardTitle>
              <PieChartIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£0.00</div>
              <p className="text-xs text-muted-foreground">Upload CSV to see data</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subscription Leaks</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Detected subscriptions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£0.00</div>
              <p className="text-xs text-muted-foreground">Per year</p>
            </CardContent>
          </Card>
        </div>

        {!showUpload ? (
          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Upload your bank statement CSV to analyze your spending and detect subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowUpload(true)} className="w-full" size="lg">
                <Upload className="mr-2 h-5 w-5" />
                Upload Bank Statement CSV
              </Button>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">How to export from your bank:</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• HSBC: Log in → Statements → Download as CSV</li>
                  <li>• NatWest: Log in → Accounts → Export transactions</li>
                  <li>• Barclays: Log in → Statements → Export CSV</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          <CSVUpload onUploadComplete={() => setShowUpload(false)} />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <SpendingChart />
          <SubscriptionsList />
        </div>

        <SavingsGoals />

        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Bank Connect (Coming Soon)</CardTitle>
            <CardDescription>
              Connect your bank directly for automatic transaction tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Join the waitlist to get early access to automatic bank connections via Moneyhub API
            </p>
            <Button variant="outline">Join Waitlist</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;