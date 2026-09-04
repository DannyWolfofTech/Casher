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

      // Upload allowance is read-only for the client. The database decides
      // (and resets) it using server time via get_upload_usage(); the browser
      // never writes monthly_uploads_used or uploads_reset_date.
      const { data: usageRows } = await supabase.rpc("get_upload_usage" as never);
      const rawUsage: unknown = usageRows;
      const usage = (Array.isArray(rawUsage) ? rawUsage[0] : rawUsage) as

        | { uploads_used: number; upload_limit: number | null; tier: string }
        | null
        | undefined;

      if (usage) {
        const currentUploads = Number(usage.uploads_used ?? 0);
        const uploadLimit = usage.upload_limit === null || usage.upload_limit === undefined
          ? Infinity
          : Number(usage.upload_limit);

        setUserTier(usage.tier || "free");
        setUploadsUsed(currentUploads);
        setCanUpload(currentUploads < uploadLimit);

        if (currentUploads === 0 && !localStorage.getItem('onboarding_seen')) {
          setShowOnboarding(true);
          localStorage.setItem('onboarding_seen', 'true');
        }
      } else {
        // Pre-migration fallback: read the counters without ever writing them.
        // The server remains the authority; this is display only.
        const { data: profileData } = await supabase
          .from("profiles")
          .select("subscription_tier, monthly_uploads_used, uploads_reset_date")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (profileData) {
          const tier = profileData.subscription_tier || "free";
          const limit = tier === "free" ? 1 : Infinity;
          const now = new Date();
          const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
          const resetDate = profileData.uploads_reset_date
            ? new Date(String(profileData.uploads_reset_date))
            : null;
          const used = !resetDate || resetDate.getTime() < periodStart.getTime()
            ? 0
            : Number(profileData.monthly_uploads_used ?? 0);

          setUserTier(tier);
          setUploadsUsed(used);
          setCanUpload(used < limit);

          if (used === 0 && !localStorage.getItem('onboarding_seen')) {
            setShowOnboarding(true);
            localStorage.setItem('onboarding_seen', 'true');
          }
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
