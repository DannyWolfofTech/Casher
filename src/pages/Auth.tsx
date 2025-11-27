import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const credentialsSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<null | "signup" | "signin">(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session) {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const validate = () => {
    const result = credentialsSchema.safeParse({ email, password });
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Please check your details and try again.";
      toast({
        title: "Invalid details",
        description: message,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    if (!validate()) return;

    setLoading("signup");
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error("Sign up error:", error);
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Account created",
        description: "Your account has been created and you're now signed in.",
      });
      navigate("/dashboard");
    } finally {
      setLoading(null);
    }
  };

  const handleSignIn = async () => {
    if (!validate()) return;

    setLoading("signin");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Signed in",
        description: "Welcome back!",
      });
      navigate("/dashboard");
    } finally {
      setLoading(null);
    }
  };

  const handleTestMode = () => {
    console.log("Entering test mode");
    localStorage.setItem("casher_test_mode", "true");
    localStorage.setItem("casher_test_user", '{"id":"test-123","email":"demo@test.com"}');
    window.location.href = "/dashboard";
  };

  return (
    <>
      <Helmet>
        <title>Casher Login | Email & Password Access</title>
        <meta
          name="description"
          content="Sign in or create your Casher account using email and password to analyze your freelance finances."
        />
        <link rel="canonical" href={`${window.location.origin}/auth`} />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Sign up or sign in</CardTitle>
            <CardDescription className="text-center">
              Use your email and password to access your Casher dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  className="w-full"
                  disabled={loading !== null}
                  onClick={handleSignUp}
                >
                  {loading === "signup" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading !== null}
                  onClick={handleSignIn}
                >
                  {loading === "signin" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </div>
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">For Testing</span>
              </div>
            </div>

            <Button variant="secondary" className="w-full" type="button" onClick={handleTestMode}>
              Skip Login (Test Mode)
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Auth;
