import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, PieChart, Shield, TrendingDown, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

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
          <h1 className="text-2xl font-bold text-primary">SubSaver</h1>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => navigate("/privacy")}>
              Privacy
            </Button>
            <Button onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <section className="py-20 text-center">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Stop Wasting Money on<br />Forgotten Subscriptions
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            SubSaver analyzes your bank statements to detect recurring payments and helps you cancel unused subscriptions. Save hundreds per year.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")}>
              <Upload className="mr-2 h-5 w-5" />
              Upload CSV & Start Saving
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/pricing")}>
              View Pricing
            </Button>
          </div>
        </section>

        <section className="py-16">
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Upload className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Easy Upload</CardTitle>
                <CardDescription>
                  Simply export and upload your bank statement CSV
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Works with HSBC, NatWest, Barclays, and most UK banks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <PieChart className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Smart Analysis</CardTitle>
                <CardDescription>
                  AI-powered categorization and subscription detection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Automatically identifies recurring payments and subscription leaks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingDown className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Save Money</CardTitle>
                <CardDescription>
                  One-click cancellation links and email templates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get direct links to cancel subscriptions you don't use
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="py-16 text-center">
          <h2 className="text-3xl font-bold mb-8">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div>
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Export CSV</h3>
              <p className="text-sm text-muted-foreground">
                Download your bank statement as CSV
              </p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">Upload File</h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop your CSV file
              </p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Review Analysis</h3>
              <p className="text-sm text-muted-foreground">
                See your subscriptions and spending
              </p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h3 className="font-semibold mb-2">Cancel & Save</h3>
              <p className="text-sm text-muted-foreground">
                One-click cancellation links
              </p>
            </div>
          </div>
        </section>

        <section className="py-16">
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="text-center">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle className="text-2xl">Your Data is Safe</CardTitle>
              <CardDescription className="text-base">
                We take your privacy seriously
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">GDPR Compliant</p>
                    <p className="text-sm text-muted-foreground">Full compliance with data protection</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Encrypted Storage</p>
                    <p className="text-sm text-muted-foreground">Bank-level encryption</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Auto-Deletion</p>
                    <p className="text-sm text-muted-foreground">Raw data deleted after analysis</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="py-16 text-center">
          <div className="bg-muted/50 rounded-lg p-8 max-w-3xl mx-auto">
            <p className="text-sm text-muted-foreground mb-4">
              <strong>Disclaimer:</strong> SubSaver provides information and tools to help you manage subscriptions. 
              This is not financial advice. Always review your financial decisions independently.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 SubSaver. All rights reserved.</p>
          <Button variant="link" onClick={() => navigate("/privacy")}>
            Privacy Policy
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Index;
