import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LogOut, Share2, History, Menu } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  const go = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  const planBadge = userTier !== "free" ? (
    <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
      {userTier === "premium" ? "Premium" : "Pro"} Plan
    </Badge>
  ) : null;

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex max-w-full items-center justify-between gap-2 px-4 py-4 md:py-6">
        <Link to={hasUser ? "/dashboard" : "/"} className="shrink-0">
          <img src={logoFull} alt="Casher" className="h-10 cursor-pointer md:h-14" />
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-3 lg:flex">
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
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>{t("adminPanel")}</Button>
          )}
          {userTier === "free" && (
            <Button variant="outline" size="sm" onClick={() => navigate("/pricing")}>{t("upgradeToPro")}</Button>
          )}
          {planBadge}
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {t("signOut")}
          </Button>
        </div>

        {/* Mobile / tablet navigation */}
        <div className="flex items-center gap-2 lg:hidden">
          {planBadge}
          <ThemeToggle />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-xs">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-3">
                <LanguageSelector />
                <Button variant="outline" className="justify-start" onClick={() => go("/dashboard/history")}>
                  <History className="mr-2 h-4 w-4" />
                  History
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => { setMenuOpen(false); shareReferral(); }}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  {t("share")}
                </Button>
                {isAdmin && (
                  <Button variant="outline" className="justify-start" onClick={() => go("/admin")}>
                    {t("adminPanel")}
                  </Button>
                )}
                {userTier === "free" && (
                  <Button variant="outline" className="justify-start" onClick={() => go("/pricing")}>
                    {t("upgradeToPro")}
                  </Button>
                )}
                <Button variant="ghost" className="justify-start" onClick={() => { setMenuOpen(false); onSignOut(); }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("signOut")}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
