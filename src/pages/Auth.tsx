import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Send welcome email for all sign-ins (Resend will deduplicate)
        try {
          await supabase.functions.invoke("send-welcome-email", {
            body: { email: session.user.email },
          });
          console.log("Welcome email sent to:", session.user.email);
        } catch (err) {
          console.log("Welcome email error:", err);
        }

        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = credentialsSchema.safeParse({ email, password });
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Please check your details and try again.";
      toast({
        title: "Invalid details",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const redirectUrl = `${window.location.origin}/`;
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
      } else {
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
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestMode = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    console.log("Entering test mode");
    localStorage.setItem("casher_test_mode", "true");
    localStorage.setItem("casher_test_user", '{"id":"test-123","email":"demo@test.com"}');
    window.location.href = "/dashboard";
  };

  const title = isSignUp ? "Create your account" : "Welcome back";
  const description = isSignUp
    ? "Create an account with your email and a password."
    : "Sign in with your email and password.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{title}</CardTitle>
          <CardDescription className="text-center">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? "Create Account" : "Log In"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {isSignUp ? (
              <Button
                type="button"
                variant="link"
                className="px-0"
                onClick={() => setIsSignUp(false)}
              >
                Already have an account? Log in
              </Button>
            ) : (
              <Button
                type="button"
                variant="link"
                className="px-0"
                onClick={() => setIsSignUp(true)}
              >
                Don't have an account? Create one
              </Button>
            )}
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">For Testing</span>
            </div>
          </div>

          <Button variant="secondary" className="w-full" onClick={handleTestMode}>
            Skip Login (Test Mode)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
