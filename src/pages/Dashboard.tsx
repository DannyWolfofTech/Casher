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
import { OnboardingModal } from "@/components/OnboardingModal";
import TransactionsTable from "@/components/TransactionsTable";
import { useTranslation } from "react-i18next";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [potentialSavings, setPotentialSavings] = useState(0);
  const [userTier, setUserTier] = useState<string>("free");
  const [uploadsUsed, setUploadsUsed] = useState(0);
  const [canUpload, setCanUpload] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t: tLegacy } = useLanguage();
  const { t } = useTranslation();

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

      // Fetch user profile for tier and upload limits
      const { data: profileData } = await supabase
        .from("profiles")
        .select("subscription_tier, monthly_uploads_used, uploads_reset_date")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileData) {
        setUserTier(profileData.subscription_tier || "free");
        setUploadsUsed(profileData.monthly_uploads_used || 0);

        // Check if we need to reset monthly uploads
        const resetDate = new Date(profileData.uploads_reset_date);
        const now = new Date();
        if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
          await supabase
            .from("profiles")
            .update({ 
              monthly_uploads_used: 0,
              uploads_reset_date: new Date().toISOString().split('T')[0]
            })
            .eq("user_id", session.user.id);
          setUploadsUsed(0);
        }

        // Check upload limit
        const uploadLimit = profileData.subscription_tier === "free" ? 1 : Infinity;
        setCanUpload((profileData.monthly_uploads_used || 0) < uploadLimit);
        
        // Show onboarding for new users with no uploads
        if ((profileData.monthly_uploads_used || 0) === 0 && !localStorage.getItem('onboarding_seen')) {
          setShowOnboarding(true);
          localStorage.setItem('onboarding_seen', 'true');
        }
      }

      // Check subscription status
      await checkSubscription(session);
      
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkSubscription(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkSubscription = async (session: any) => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (!error && data) {
        setUserTier(data.tier || "free");
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [refreshKey]);

  const fetchDashboardData = async () => {
    try {
      // Fetch transactions for monthly spending
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount');
      
      const total = transactions?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;
      setMonthlySpending(total);

      // Fetch subscriptions
      const { data: subscriptions } = await supabase
        .from('detected_subscriptions')
        .select('amount, estimated_annual_cost')
        .eq('status', 'active');
      
      setSubscriptionCount(subscriptions?.length || 0);
      
      const savings = subscriptions?.reduce((sum, s) => sum + (Number(s.estimated_annual_cost) || 0), 0) || 0;
      setPotentialSavings(savings);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

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
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">{tLegacy("appName")}</h1>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={shareReferral}>
              <Share2 className="mr-2 h-4 w-4" />
              {tLegacy("share")}
            </Button>
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate("/admin")}>
                {tLegacy("adminPanel")}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/pricing")}>
              {tLegacy("upgradeToPro")}
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {tLegacy("signOut")}
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
              <div className="text-2xl font-bold">£{monthlySpending.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{monthlySpending === 0 ? 'Upload CSV to see data' : 'This month'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subscription Leaks</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscriptionCount}</div>
              <p className="text-xs text-muted-foreground">Detected subscriptions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{potentialSavings.toFixed(2)}</div>
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
              {!canUpload && userTier === "free" ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm font-medium">Upload limit reached</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Free tier allows 1 upload per month. Used: {uploadsUsed}/1
                    </p>
                  </div>
                  <Button 
                    onClick={() => navigate("/pricing")} 
                    className="w-full" 
                    size="lg"
                  >
                    Upgrade to Pro for Unlimited Uploads
                  </Button>
                </div>
              ) : (
                <>
                  <Button 
                    onClick={() => setShowUpload(true)} 
                    className="w-full" 
                    size="lg"
                    disabled={!canUpload}
                  >
                    <Upload className="mr-2 h-5 w-5" />
                    Upload Bank Statement CSV
                  </Button>
                  {userTier === "free" && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Uploads used: {uploadsUsed}/1 this month
                    </p>
                  )}
                </>
              )}
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
          <CSVUpload onUploadComplete={async () => {
            setShowUpload(false);
            
            // Increment upload count
            if (user) {
              await supabase
                .from("profiles")
                .update({ 
                  monthly_uploads_used: uploadsUsed + 1 
                })
                .eq("user_id", user.id);
              
              setUploadsUsed(prev => prev + 1);
              const uploadLimit = userTier === "free" ? 1 : Infinity;
              setCanUpload((uploadsUsed + 1) < uploadLimit);
            }
            
            setRefreshKey(prev => prev + 1);
          }} />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <SpendingChart refreshKey={refreshKey} />
          <SubscriptionsList refreshKey={refreshKey} />
        </div>

        <TransactionsTable refreshKey={refreshKey} userTier={userTier} />

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