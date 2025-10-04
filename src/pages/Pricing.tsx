import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Pricing = () => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const plans = [
    {
      name: "Free",
      price: "£0",
      priceId: "",
      description: "Perfect for getting started",
      features: [
        "1 CSV upload per month",
        "How to Upload CSV guide",
        "Multi-language support",
        "Light/dark mode",
      ],
    },
    {
      name: "Pro",
      price: "£9.99",
      priceId: "price_pro_monthly",
      description: "For regular users",
      features: [
        "Unlimited CSV uploads",
        "Detailed spending reports",
        "Priority support",
        "Bank access",
        "PDF exports",
        "Monthly savings summary email",
        "Basic CSV tips",
      ],
      popular: true,
    },
    {
      name: "Premium",
      price: "£14.99",
      priceId: "price_premium_monthly",
      description: "For power users",
      features: [
        "All Pro features",
        "Dashboard with recurrent profiles",
        "Custom FinanceAI tip",
        "Priority feature requests",
      ],
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground">
            Start saving money on unused subscriptions
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.popular ? "border-primary shadow-lg" : ""}
            >
              {plan.popular && (
                <div className="bg-primary text-primary-foreground text-center py-2 text-sm font-semibold rounded-t-lg">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="mr-2 h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan.name, plan.priceId)}
                  disabled={loading || plan.name === "Free"}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {plan.name === "Free" ? "Current Plan" : "Subscribe"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>All plans include our GDPR-compliant data handling</p>
          <p className="mt-2">Cancel anytime, no questions asked</p>
        </div>
      </main>
    </div>
  );
};

export default Pricing;