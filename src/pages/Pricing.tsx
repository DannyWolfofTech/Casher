import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { STRIPE_TIERS } from "@/config/stripe";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, ArrowLeft, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import SEO from "@/components/SEO";
import { planCtaState, PREMIUM_PURCHASABLE, type PlanKey } from "@/lib/pricing-cta";
import { redirectToCheckout } from "@/lib/checkout-redirect";


// Hardcoded Stripe Publishable Key (Test Mode)
const STRIPE_PK = "pk_test_51SCrpvJMS012Ip2AFxn0fgxc5MFSSQ21FKjTQzMWcY67b1XrTC0JaW7zMQ8DXUsHRd0BQa07qzsfgHNv0O3EQWRu00bHXyvXld";

const Pricing = () => {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userTier, setUserTier] = useState<string>("free");
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  // SEO handled by <SEO /> component below

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setUserTier(profile?.subscription_tier || "free");
      }
    };
    checkUser();
  }, []);

  const handleSubscribe = async (priceId: string) => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to subscribe",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setLoadingTier(priceId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { priceId },
      });

      if (error) throw error;

      // Same-tab navigation: a post-await window.open() is silently blocked as
      // an unsolicited popup, which produced a spinner-then-nothing no-op.
      redirectToCheckout(data?.url);
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "We couldn't start checkout. Please try again in a moment.";
      toast({
        title: "Checkout unavailable",
        description: message,
        variant: "destructive",
      });
      setLoadingTier(null);
    }

  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setEmailLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-welcome-email", {
        body: { email },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Welcome email sent! Check your inbox for pro tips.",
      });
      setEmail("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to subscribe";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
    setEmailLoading(false);
  };

  const plans = [
    {
      name: t("free"),
      nameKey: "free",
      price: "£0",
      priceId: "",
      description: t("perfectForGettingStarted"),
      comingSoon: false,
      features: [
        t("oneUploadPerMonth"),
        t("basicCategorization"),
        t("viewInsights"),
        t("multiLanguage"),
        t("lightDarkMode"),
      ],
      limits: [
        t("noExports"),
        t("noAdvancedFilters"),
        t("limitedDashboard"),
      ],
    },
    {
      name: t("pro"),
      nameKey: "pro",
      price: STRIPE_TIERS.pro.price,
      priceId: STRIPE_TIERS.pro.priceId,
      description: t("forRegularUsers"),
      comingSoon: false,
      features: [
        t("unlimitedUploads"),
        t("advancedFiltersSearch"),
        t("csvExportsFeature"),
        t("detailedReports"),
        t("priorityEmailSupport"),
        t("monthlySavingsSummary"),
      ],
      limits: [],
      popular: true,
    },
    {
      name: t("premium"),
      nameKey: "premium",
      price: STRIPE_TIERS.premium.price,
      priceId: STRIPE_TIERS.premium.priceId,
      description: t("forPowerUsers"),
      comingSoon: !PREMIUM_PURCHASABLE,
      features: [
        t("allProFeatures"),
        t("aiInsights"),
        t("customRecommendations"),
        t("priorityChatSupport"),
        t("earlyAccess"),
        t("quarterlyReview"),
      ],
      limits: [],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Pricing — Casher subscription tracker plans"
        description="Free, Pro (£9.99/mo) and Premium (£14.99/mo) plans for CSV-based subscription tracking. Pick the plan that fits your savings goals."
        path="/pricing"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Casher Pro",
            description: "Unlimited CSV uploads, filters, and exports for tracking subscriptions.",
            offers: {
              "@type": "Offer",
              price: "9.99",
              priceCurrency: "GBP",
              url: "https://trycasher.com/pricing",
              availability: "https://schema.org/InStock",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Casher Premium",
            description: "Everything in Pro, plus upcoming AI insight features. Not yet available to buy.",
            offers: {
              "@type": "Offer",
              price: "14.99",
              priceCurrency: "GBP",
              url: "https://trycasher.com/pricing",
              availability: "https://schema.org/PreOrder",
            },
          },
        ]}
      />
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
          <h1 className="text-2xl font-bold text-primary">Casher</h1>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto w-full max-w-full overflow-x-hidden px-4 py-8 md:py-16">
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              {t("chooseYourPlan")}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              {t("startSavingToday")}
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto mb-12 md:mb-16 md:pt-4">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`flex flex-col ${plan.popular ? "border-primary shadow-lg md:scale-105" : ""}`}
              >
              {plan.popular && (
                  <div className="bg-primary text-primary-foreground text-center py-2 text-sm font-semibold rounded-t-lg">
                    {t("mostPopular")}
                  </div>
                )}
                {plan.comingSoon && (
                  <div className="bg-muted text-muted-foreground text-center py-2 text-sm font-semibold rounded-t-lg">
                    {t("comingSoonShort")}
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl md:text-3xl">{plan.name}</CardTitle>
                  <CardDescription className="text-base">{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl md:text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{t("perMonth")}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <Check className="mr-2 h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm md:text-base">{feature}</span>
                      </li>
                    ))}
                    {plan.limits && plan.limits.length > 0 && (
                      <>
                        <li className="pt-2 border-t">
                          <span className="text-sm font-semibold text-muted-foreground">{t("limitations")}</span>
                        </li>
                        {plan.limits.map((limit, idx) => (
                          <li key={idx} className="flex items-start text-muted-foreground">
                            <X className="mr-2 h-5 w-5 flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{limit}</span>
                          </li>
                        ))}
                      </>
                    )}
                  </ul>
                </CardContent>
                <CardFooter>
                  {(() => {
                    const cta = planCtaState(plan.nameKey as PlanKey, !!user, userTier);
                    return (
                      <Button
                        className="w-full"
                        size="lg"
                        variant={cta.action === "none" ? "outline" : plan.popular ? "default" : "outline"}
                        onClick={() => {
                          if (cta.action === "signup") navigate("/auth");
                          if (cta.action === "checkout") handleSubscribe(plan.priceId);
                        }}
                        disabled={cta.disabled || (loadingTier !== null && cta.action === "checkout")}
                      >
                        {loadingTier === plan.priceId ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {t(cta.labelKey)}
                      </Button>
                    );
                  })()}
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="max-w-5xl mx-auto mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8">
              {t("featureComparison")}
            </h2>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[36rem] border-collapse bg-card rounded-lg overflow-hidden text-sm md:text-base">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-3 md:p-4 font-semibold">{t("feature")}</th>
                    <th className="text-center p-3 md:p-4 font-semibold">{t("free")}</th>
                    <th className="text-center p-3 md:p-4 font-semibold bg-primary/10">{t("pro")}</th>
                    <th className="text-center p-3 md:p-4 font-semibold">
                      {t("premium")}
                      {!PREMIUM_PURCHASABLE && (
                        <span className="block text-xs font-normal text-muted-foreground">{t("comingSoonShort")}</span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-3 md:p-4">{t("csvUploads")}</td>
                    <td className="text-center p-3 md:p-4">{t("onePerMonth")}</td>
                    <td className="text-center p-3 md:p-4 bg-primary/5">{t("unlimited")}</td>
                    <td className="text-center p-3 md:p-4">{t("unlimited")}</td>
                  </tr>
                  <tr>
                    <td className="p-3 md:p-4">{t("transactionCategorization")}</td>
                    <td className="text-center p-3 md:p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-3 md:p-4 bg-primary/5"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-3 md:p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                  </tr>
                  <tr>
                    <td className="p-3 md:p-4">{t("subscriptionDetection")}</td>
                    <td className="text-center p-3 md:p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-3 md:p-4 bg-primary/5"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-3 md:p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                  </tr>
                  <tr>
                    <td className="p-3 md:p-4">{t("advancedFilters")}</td>
                    <td className="text-center p-3 md:p-4"><X className="inline h-5 w-5 text-muted-foreground" /></td>
                    <td className="text-center p-3 md:p-4 bg-primary/5"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-3 md:p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                  </tr>
                  <tr>
                    <td className="p-3 md:p-4">{t("csvExports")}</td>
                    <td className="text-center p-3 md:p-4"><X className="inline h-5 w-5 text-muted-foreground" /></td>
                    <td className="text-center p-3 md:p-4 bg-primary/5"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-3 md:p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                  </tr>
                  <tr>
                    <td className="p-3 md:p-4">{t("aiPoweredInsights")}</td>
                    <td className="text-center p-3 md:p-4"><X className="inline h-5 w-5 text-muted-foreground" /></td>
                    <td className="text-center p-3 md:p-4 bg-primary/5"><X className="inline h-5 w-5 text-muted-foreground" /></td>
                    <td className="text-center p-3 md:p-4 text-xs md:text-sm text-muted-foreground">{t("comingSoonShort")}</td>
                  </tr>
                  <tr>
                    <td className="p-3 md:p-4">{t("support")}</td>
                    <td className="text-center p-3 md:p-4">{t("community")}</td>
                    <td className="text-center p-3 md:p-4 bg-primary/5">{t("email")}</td>
                    <td className="text-center p-3 md:p-4">{t("priorityChat")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Email Signup */}
          <div className="max-w-2xl mx-auto mb-12 md:mb-16">
            <Card className="border-border/70 bg-card shadow-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl md:text-3xl">{t("getWeeklyProTips")}</CardTitle>
                <CardDescription className="text-base">
                  {t("subscribeForTips")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmailSignup} className="flex flex-col sm:flex-row gap-4">
                  <Input
                    type="email"
                    placeholder={t("enterYourEmail")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-grow"
                    required
                  />
                  <Button type="submit" disabled={emailLoading} size="lg">
                    {emailLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t("subscribe")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>{t("gdprCompliance")}</p>
          <p>{t("cancelAnytime")}</p>
        </div>
      </main>
    </div>
  );
};

export default Pricing;