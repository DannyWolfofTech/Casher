import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, ArrowLeft, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";

const Pricing = () => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set page title and meta tags
    document.title = "Pricing - Casher | CSV Transaction Categorizer & Subscription Tracker";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Choose your Casher plan: Free basic categorization, Pro unlimited uploads with filters & exports (£9.99/mo), or Premium with AI insights (£14.99/mo). CSV transaction categorizer.");
    }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user);
    };
    checkUser();
  }, []);

  const handleSubscribe = async (planName: string, priceId: string) => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to subscribe",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { 
          priceId,
          tier: planName.toLowerCase()
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    }
    setLoading(false);
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to subscribe",
        variant: "destructive",
      });
    }
    setEmailLoading(false);
  };

  const plans = [
    {
      name: "Free",
      price: "£0",
      priceId: "",
      description: "Perfect for getting started",
      features: [
        "1 CSV upload per month",
        "Basic transaction categorization",
        "View insights & spot subscriptions",
        "Multi-language support",
        "Light/dark mode",
      ],
      limits: [
        "No CSV exports",
        "No advanced filters",
        "Limited dashboard access",
      ],
    },
    {
      name: "Pro",
      price: "£9.99",
      priceId: "price_1QrgOhP3g2xFZS3kADN8cXYZ",
      description: "For regular users",
      features: [
        "Unlimited CSV uploads",
        "Advanced filters & search",
        "CSV exports",
        "Detailed spending reports",
        "Priority email support",
        "Monthly savings summary",
      ],
      limits: [],
      popular: true,
    },
    {
      name: "Premium",
      price: "£14.99",
      priceId: "price_1QrgPJP3g2xFZS3kBQM9dYZA",
      description: "For power users",
      features: [
        "All Pro features",
        "AI-powered insights",
        "Custom financial recommendations",
        "Priority chat support",
        "Early access to features",
        "Quarterly financial review",
      ],
      limits: [],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-primary">Casher</h1>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-16">
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              Choose Your Plan
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Start saving money on unused subscriptions today
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto mb-12 md:mb-16">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`flex flex-col ${plan.popular ? "border-primary shadow-lg scale-105" : ""}`}
              >
                {plan.popular && (
                  <div className="bg-primary text-primary-foreground text-center py-2 text-sm font-semibold rounded-t-lg">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl md:text-3xl">{plan.name}</CardTitle>
                  <CardDescription className="text-base">{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl md:text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <Check className="mr-2 h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm md:text-base">{feature}</span>
                      </li>
                    ))}
                    {plan.limits && plan.limits.length > 0 && (
                      <>
                        <li className="pt-2 border-t">
                          <span className="text-sm font-semibold text-muted-foreground">Limitations:</span>
                        </li>
                        {plan.limits.map((limit) => (
                          <li key={limit} className="flex items-start text-muted-foreground">
                            <X className="mr-2 h-5 w-5 flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{limit}</span>
                          </li>
                        ))}
                      </>
                    )}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    size="lg"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => plan.name === "Free" ? navigate("/auth") : handleSubscribe(plan.name, plan.priceId)}
                    disabled={loading && plan.name !== "Free"}
                  >
                    {loading && plan.name !== "Free" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {plan.name === "Free" ? "Get Started Free" : "Upgrade Now"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="max-w-5xl mx-auto mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8">
              Feature Comparison
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-card rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-4 font-semibold">Feature</th>
                    <th className="text-center p-4 font-semibold">Free</th>
                    <th className="text-center p-4 font-semibold bg-primary/10">Pro</th>
                    <th className="text-center p-4 font-semibold">Premium</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-4">CSV Uploads</td>
                    <td className="text-center p-4">1/month</td>
                    <td className="text-center p-4 bg-primary/5">Unlimited</td>
                    <td className="text-center p-4">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="p-4">Transaction Categorization</td>
                    <td className="text-center p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-4 bg-primary/5"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                  </tr>
                  <tr>
                    <td className="p-4">Subscription Detection</td>
                    <td className="text-center p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-4 bg-primary/5"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                  </tr>
                  <tr>
                    <td className="p-4">Advanced Filters</td>
                    <td className="text-center p-4"><X className="inline h-5 w-5 text-muted-foreground" /></td>
                    <td className="text-center p-4 bg-primary/5"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                  </tr>
                  <tr>
                    <td className="p-4">CSV Exports</td>
                    <td className="text-center p-4"><X className="inline h-5 w-5 text-muted-foreground" /></td>
                    <td className="text-center p-4 bg-primary/5"><Check className="inline h-5 w-5 text-primary" /></td>
                    <td className="text-center p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                  </tr>
                  <tr>
                    <td className="p-4">AI-Powered Insights</td>
                    <td className="text-center p-4"><X className="inline h-5 w-5 text-muted-foreground" /></td>
                    <td className="text-center p-4 bg-primary/5"><X className="inline h-5 w-5 text-muted-foreground" /></td>
                    <td className="text-center p-4"><Check className="inline h-5 w-5 text-primary" /></td>
                  </tr>
                  <tr>
                    <td className="p-4">Support</td>
                    <td className="text-center p-4">Community</td>
                    <td className="text-center p-4 bg-primary/5">Email</td>
                    <td className="text-center p-4">Priority Chat</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Email Signup */}
          <div className="max-w-2xl mx-auto mb-12 md:mb-16">
            <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl md:text-3xl">Get Weekly Pro Tips</CardTitle>
                <CardDescription className="text-base">
                  Subscribe to receive expert financial advice and money-saving strategies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmailSignup} className="flex flex-col sm:flex-row gap-4">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-grow"
                    required
                  />
                  <Button type="submit" disabled={emailLoading} size="lg">
                    {emailLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Subscribe
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>All plans include GDPR-compliant data handling & multi-language support</p>
          <p>Cancel anytime, no questions asked • 30-day money-back guarantee</p>
        </div>
      </main>
    </div>
  );
};

export default Pricing;