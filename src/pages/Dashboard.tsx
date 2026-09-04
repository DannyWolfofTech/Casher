import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardData } from "@/hooks/useDashboardData";
import DashboardHeader from "@/components/DashboardHeader";
import DashboardSummaryCards from "@/components/DashboardSummaryCards";
import { OnboardingModal } from "@/components/OnboardingModal";
import CSVUpload from "@/components/CSVUpload";
import SpendingChart from "@/components/SpendingChart";
import SubscriptionsList from "@/components/SubscriptionsList";
import SavingsGoals from "@/components/SavingsGoals";
import TransactionsTable from "@/components/TransactionsTable";
import UploadHistory from "@/components/UploadHistory";
import ProgressTracker from "@/components/ProgressTracker";
import SEO from "@/components/SEO";

const Dashboard = () => {
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, loading, isAdmin, userTier, uploadsUsed, canUpload, showOnboarding, setShowOnboarding, setUploadsUsed, setCanUpload, handleSignOut } = useAuth();
  const { monthlySpending, subscriptionCount, potentialSavings } = useDashboardData(user?.id, refreshKey);

  // The server owns the upload counter and the upload_history record. The
  // client only mirrors what process-csv reports back.
  const handleUploadComplete = async (uploadResult?: UploadResult) => {
    if (uploadResult?.usage) {
      setUploadsUsed(uploadResult.usage.uploadsUsed);
      setCanUpload(uploadResult.usage.canUpload);
    }

    // A rejected upload (e.g. quota exceeded) keeps the upload panel open.
    if (uploadResult?.code && uploadResult.code !== "OK" && uploadResult.code !== "REPLAY") {
      return;
    }

    setShowUpload(false);
    setRefreshKey(prev => prev + 1);
  };


  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Dashboard — Casher"
        description="Your Casher dashboard: spending overview, recurring subscriptions, and savings opportunities."
        path="/dashboard"
        noindex
      />
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <DashboardHeader isAdmin={isAdmin} userTier={userTier} hasUser={!!user} onSignOut={handleSignOut} />
      <main className="container mx-auto px-4 py-8 space-y-8">
        <DashboardSummaryCards monthlySpending={monthlySpending} subscriptionCount={subscriptionCount} potentialSavings={potentialSavings} />
        <ProgressTracker userId={user?.id} currentMonthSpending={monthlySpending} refreshKey={refreshKey} />
        {!showUpload ? (
          <Card>
            <CardHeader><CardTitle>Get Started</CardTitle><CardDescription>Upload your bank statement CSV to discover hidden subscription costs and start saving money</CardDescription></CardHeader>
            <CardContent>
              {!canUpload && userTier === "free" ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm font-medium">{t("uploadLimitReached")}</p>
                    <p className="text-xs text-muted-foreground mt-1">Uploads used: {uploadsUsed}/1</p>
                  </div>
                  <Button onClick={() => navigate("/pricing")} className="w-full" size="lg">{t("upgradeForUnlimited")}</Button>
                </div>
              ) : (
                <>
                  <Button onClick={() => setShowUpload(true)} className="w-full" size="lg" disabled={!canUpload}><Upload className="mr-2 h-5 w-5" />Upload CSV</Button>
                  {userTier === "free" && <p className="text-xs text-muted-foreground mt-2 text-center">Uploads used: {uploadsUsed}/1</p>}
                </>
              )}
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">{t("howToExport")}</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• HSBC: Log in → Statements → Download as CSV</li>
                  <li>• NatWest: Log in → Accounts → Export transactions</li>
                  <li>• Barclays: Log in → Statements → Export CSV</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : <CSVUpload onUploadComplete={handleUploadComplete} />}
        <div className="grid gap-6 md:grid-cols-2">
          <SpendingChart refreshKey={refreshKey} />
          <SubscriptionsList refreshKey={refreshKey} userId={user?.id} />
        </div>
        <UploadHistory userId={user?.id} refreshKey={refreshKey} />
        <TransactionsTable refreshKey={refreshKey} userTier={userTier} />
        <SavingsGoals />
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardHeader><CardTitle>{t("bankConnect")}</CardTitle><CardDescription>{t("bankConnectDesc")}</CardDescription></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{t("bankConnectPrompt")}</p>
            <Button variant="outline">{t("joinWaitlist")}</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
