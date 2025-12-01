import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, TrendingDown, CheckCircle2, Activity } from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import logoFull from "@/assets/logo-full.png";
import { format } from "date-fns";

interface HistoricalData {
  month: string;
  cost: number;
  date: Date;
}

interface CategoryData {
  name: string;
  value: number;
}

interface CancelledSubscription {
  id: string;
  service_name: string;
  amount: number;
  estimated_annual_cost: number;
  created_at: string;
  status: string;
}

const COLORS = ['#00C853', '#1A237E', '#64B5F6', '#81C784', '#4FC3F7', '#AED581'];

const History = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [totalDetected, setTotalDetected] = useState(0);
  const [annualSavings, setAnnualSavings] = useState(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [trendData, setTrendData] = useState<HistoricalData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [cancelledSubs, setCancelledSubs] = useState<CancelledSubscription[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }
    
    setUser(session.user);
    await fetchHistoryData(session.user.id);
    setLoading(false);
  };

  const fetchHistoryData = async (userId: string) => {
    try {
      // Fetch all subscriptions for metrics
      const { data: allSubs } = await supabase
        .from('detected_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (allSubs) {
        setTotalDetected(allSubs.length);
        
        const active = allSubs.filter(s => s.status === 'active');
        setActiveSubscriptions(active.length);

        const cancelled = allSubs.filter(s => s.status === 'cancelled');
        setCancelledSubs(cancelled);
        
        const savings = cancelled.reduce((sum, s) => sum + (Number(s.estimated_annual_cost) || 0), 0);
        setAnnualSavings(savings);

        // Category breakdown (for active subscriptions)
        const categoryMap: { [key: string]: number } = {};
        active.forEach(sub => {
          const name = sub.service_name;
          const category = getCategoryFromName(name);
          categoryMap[category] = (categoryMap[category] || 0) + Number(sub.amount);
        });

        const catData = Object.entries(categoryMap).map(([name, value]) => ({
          name,
          value: Number(value.toFixed(2))
        }));
        setCategoryData(catData);
      }

      // Fetch upload history for trend
      const { data: uploads } = await supabase
        .from('upload_history')
        .select('*')
        .eq('user_id', userId)
        .order('upload_date', { ascending: true });

      if (uploads && uploads.length > 0) {
        const trend = uploads.map(u => ({
          month: format(new Date(u.upload_date), 'MMM yyyy'),
          cost: Number(u.total_spending),
          date: new Date(u.upload_date)
        }));
        setTrendData(trend);
      }

    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const getCategoryFromName = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('prime')) return 'Streaming';
    if (lower.includes('gym') || lower.includes('fitness') || lower.includes('sport')) return 'Fitness';
    if (lower.includes('adobe') || lower.includes('microsoft') || lower.includes('cloud')) return 'Software';
    if (lower.includes('insurance')) return 'Insurance';
    if (lower.includes('phone') || lower.includes('mobile')) return 'Telecom';
    return 'Other';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={logoFull} alt="Casher" className="h-14 cursor-pointer" onClick={() => navigate("/dashboard")} />
          </div>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Metrics */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Detected</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDetected}</div>
              <p className="text-xs text-muted-foreground">All-time subscriptions found</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Annual Savings</CardTitle>
              <TrendingDown className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">£{annualSavings.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">From cancelled subscriptions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSubscriptions}</div>
              <p className="text-xs text-muted-foreground">Currently recurring</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Fixed Costs Trend</CardTitle>
              <CardDescription>Track your spending over time</CardDescription>
            </CardHeader>
            <CardContent>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="cost" 
                      stroke="#00C853" 
                      strokeWidth={2}
                      name="Total Spending (£)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <p>Upload more CSVs to see your trend</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
              <CardDescription>Where your money goes</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                      label={(entry) => `${entry.name}: £${entry.value}`}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <p>No active subscriptions to categorize</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Subscription Graveyard */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Subscription Graveyard
            </CardTitle>
            <CardDescription>
              Celebrating your smart cancellation decisions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cancelledSubs.length > 0 ? (
              <div className="space-y-3">
                {cancelledSubs.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-primary/10 bg-primary/5"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="font-semibold">{sub.service_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Cancelled on {format(new Date(sub.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">
                        £{sub.estimated_annual_cost?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-xs text-muted-foreground">saved per year</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No cancelled subscriptions yet.</p>
                <p className="text-sm mt-2">Start canceling unused services to see your savings here!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default History;
