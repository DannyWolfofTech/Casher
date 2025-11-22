import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface SubscriptionsListProps {
  refreshKey?: number;
}

const SubscriptionsList = ({ refreshKey = 0 }: SubscriptionsListProps) => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    fetchSubscriptions();
  }, [refreshKey]);

  const fetchSubscriptions = async () => {
    try {
      // Check for test mode
      const testMode = localStorage.getItem('test_mode');
      
      if (testMode === 'true') {
        const testSubscriptions = JSON.parse(localStorage.getItem('test_subscriptions') || '[]');
        setSubscriptions(testSubscriptions);
      } else {
        const { data, error } = await supabase
          .from('detected_subscriptions')
          .select('*')
          .eq('status', 'active')
          .order('amount', { ascending: false });

        if (error) throw error;
        setSubscriptions(data || []);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (serviceName: string, cancellationUrl: string | null) => {
    if (cancellationUrl) {
      window.open(cancellationUrl, '_blank');
      return;
    }

    // Map of common services to their cancellation URLs
    const cancellationUrls: { [key: string]: string } = {
      'netflix': 'https://www.netflix.com/cancelplan',
      'spotify': 'https://www.spotify.com/account/subscription/',
      'amazon prime': 'https://www.amazon.co.uk/gp/primecentral/cancel',
      'amazon': 'https://www.amazon.co.uk/gp/primecentral/cancel',
      'prime': 'https://www.amazon.co.uk/gp/primecentral/cancel',
    };

    const serviceLower = serviceName.toLowerCase();
    const matchedUrl = Object.keys(cancellationUrls).find(key => 
      serviceLower.includes(key)
    );

    if (matchedUrl) {
      window.open(cancellationUrls[matchedUrl], '_blank');
    } else if (serviceLower.includes('gym') || serviceLower.includes('fitness')) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent('cancel ' + serviceName + ' membership')}`;
      window.open(searchUrl, '_blank');
    } else {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent('cancel ' + serviceName)}`;
      window.open(searchUrl, '_blank');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("detectedSubscriptions")}</CardTitle>
        <CardDescription>{t("recurringPayments")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-muted-foreground py-8">{t("loading")}</div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {t("noSubscriptionsYet")}
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{sub.service_name}</h3>
                    <Badge variant="secondary">{sub.frequency}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    £{parseFloat(sub.amount).toFixed(2)} {t("perFrequency", { frequency: sub.frequency })}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendingDown className="h-3 w-3" />
                    Annual cost: £{sub.estimated_annual_cost 
                      ? parseFloat(sub.estimated_annual_cost).toFixed(2) 
                      : (parseFloat(sub.amount) * (sub.frequency === 'monthly' ? 12 : sub.frequency === 'yearly' ? 1 : 12)).toFixed(2)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(sub.service_name, sub.cancellation_url)}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("cancelSubscription")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionsList;