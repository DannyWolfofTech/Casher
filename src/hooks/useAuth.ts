import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userTier, setUserTier] = useState<string>("free");
  const [uploadsUsed, setUploadsUsed] = useState(0);
  const [canUpload, setCanUpload] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigate = useNavigate();
  const lastSubCheckRef = useRef<number>(0);

  const checkSubscription = async () => {
    // Throttle: at most once every 60s, regardless of trigger
    const now = Date.now();
    if (now - lastSubCheckRef.current < 60_000) return;
    lastSubCheckRef.current = now;
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
    const checkUser = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) console.error('Session error:', sessionError);
      if (!session) { navigate("/auth"); return; }

      setUser(session.user);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!roleData);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("subscription_tier, monthly_uploads_used, uploads_reset_date")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileData) {
        setUserTier(profileData.subscription_tier || "free");
        let currentUploads = profileData.monthly_uploads_used || 0;

        const resetDate = new Date(profileData.uploads_reset_date);
        const now = new Date();
        if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
          await supabase
            .from("profiles")
            .update({ monthly_uploads_used: 0, uploads_reset_date: new Date().toISOString().split('T')[0] })
            .eq("user_id", session.user.id);
          currentUploads = 0;
        }

        setUploadsUsed(currentUploads);
        const uploadLimit = profileData.subscription_tier === "free" ? 1 : Infinity;
        setCanUpload(currentUploads < uploadLimit);

        if ((profileData.monthly_uploads_used || 0) === 0 && !localStorage.getItem('onboarding_seen')) {
          setShowOnboarding(true);
          localStorage.setItem('onboarding_seen', 'true');
        }
      }

      await checkSubscription();
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      // Only re-check subscription on actual sign-in, not on token refresh
      if (event === "SIGNED_IN") {
        checkSubscription();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return {
    user, loading, isAdmin, userTier, uploadsUsed, canUpload,
    showOnboarding, setShowOnboarding, setUploadsUsed, setCanUpload,
    setUserTier, handleSignOut,
  };
};
