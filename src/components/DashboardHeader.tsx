import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Share2, History } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import logoFull from "@/assets/logo-full.png";

interface DashboardHeaderProps {
  isAdmin: boolean;
  userTier: string;
  hasUser: boolean;
  onSignOut: () => void;
}

const DashboardHeader = ({ isAdmin, userTier, hasUser, onSignOut }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const shareReferral = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const referralCode = `REF${session.user.id.slice(0, 8).toUpperCase()}`;
    const link = `${window.location.origin}/?ref=${referralCode}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Referral link copied!", description: "Share it to earn rewards" });
    } catch {
      toast({ title: "Referral link", description: link });
    }
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-6 flex justify-between items-center">
        <Link to={hasUser ? "/dashboard" : "/"}>
          <img src={logoFull} alt="Casher" className="h-14 cursor-pointer" />
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSelector />
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/history")}>
            <History className="mr-2 h-4 w-4" />
            History
          </Button>
          <Button variant="outline" size="sm" onClick={shareReferral}>
            <Share2 className="mr-2 h-4 w-4" />
            {t("share")}
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => navigate("/admin")}>{t("adminPanel")}</Button>
          )}
          {userTier === "free" && (
            <Button variant="outline" onClick={() => navigate("/pricing")}>{t("upgradeToPro")}</Button>
          )}
          {userTier !== "free" && (
            <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
              {userTier === "premium" ? "Premium" : "Pro"} Plan
            </Badge>
          )}
          <Button variant="ghost" onClick={onSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {t("signOut")}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
