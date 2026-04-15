import { useEffect, useState, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, TrendingDown, CheckCircle2, Activity, Download, Filter, TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import logoFull from "@/assets/logo-full.png";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface HistoricalData {
  month: string;
  cost: number;
  date: Date;
}

interface CategoryData {
  name: string;
  value: number;
}

interface Subscription {
  id: string;
  service_name: string;
  amount: number;
  estimated_annual_cost: number;
  created_at: string;
  status: string;
  frequency: string;
}

interface YoYComparison {
  metric: string;
  currentYear: number;
  previousYear: number;
  change: number;
  changePercent: number;
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
  const [cancelledSubs, setCancelledSubs] = useState<Subscription[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  const [yoyComparison, setYoyComparison] = useState<YoYComparison[]>([]);
  
  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  
  const exportRef = useRef<HTMLDivElement>(null);
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
        setAllSubscriptions(allSubs);
        calculateMetrics(allSubs);
        calculateYoYComparison(allSubs);
      }

      // Fetch upload history for trend
      const { data: uploads } = await supabase
        .from('upload_history')
        .select('*')
        .eq('user_id', userId)
        .order('upload_date', { ascending: true });

      if (uploads && uploads.length > 0) {
        const trend = uploads.map(u => {
          let dateObj: Date;
          try {
            dateObj = new Date(u.upload_date);
            if (isNaN(dateObj.getTime()) && typeof u.upload_date === 'string' && u.upload_date.includes('/')) {
              const parts = u.upload_date.split('/');
              if (parts.length === 3) {
                dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              }
            }
          } catch (e) {
            dateObj = new Date();
          }
          
          return {
            month: format(dateObj, 'MMM yyyy'),
            cost: Number(u.total_spending),
            date: dateObj
          };
        });
        setTrendData(trend);
      }

    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const calculateMetrics = (subs: Subscription[]) => {
    let filtered = subs;
    
    if (dateFrom || dateTo) {
      filtered = filtered.filter(sub => {
        const subDate = new Date(sub.created_at);
        if (dateFrom && subDate < dateFrom) return false;
        if (dateTo && subDate > dateTo) return false;
        return true;
      });
    }
    
    if (selectedCategory !== "all") {
      filtered = filtered.filter(sub => getCategoryFromName(sub.service_name) === selectedCategory);
    }
    
    if (selectedStatus !== "all") {
      filtered = filtered.filter(sub => sub.status === selectedStatus);
    }

    setTotalDetected(filtered.length);
    
    const active = filtered.filter(s => s.status === 'active');
    setActiveSubscriptions(active.length);

    const cancelled = filtered.filter(s => s.status === 'cancelled');
    setCancelledSubs(cancelled);
    
    const savings = cancelled.reduce((sum, s) => sum + (Number(s.estimated_annual_cost) || 0), 0);
    setAnnualSavings(savings);

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
  };

  const calculateYoYComparison = (subs: Subscription[]) => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    const currentYearSubs = subs.filter(s => new Date(s.created_at).getFullYear() === currentYear);
    const previousYearSubs = subs.filter(s => new Date(s.created_at).getFullYear() === previousYear);

    const currentActive = currentYearSubs.filter(s => s.status === 'active').length;
    const previousActive = previousYearSubs.filter(s => s.status === 'active').length;

    const currentCancelled = currentYearSubs.filter(s => s.status === 'cancelled');
    const previousCancelled = previousYearSubs.filter(s => s.status === 'cancelled');

    const currentSavings = currentCancelled.reduce((sum, s) => sum + (Number(s.estimated_annual_cost) || 0), 0);
    const previousSavings = previousCancelled.reduce((sum, s) => sum + (Number(s.estimated_annual_cost) || 0), 0);

    const comparisons: YoYComparison[] = [
      {
        metric: "Active Subscriptions",
        currentYear: currentActive,
        previousYear: previousActive,
        change: currentActive - previousActive,
        changePercent: previousActive > 0 ? ((currentActive - previousActive) / previousActive) * 100 : 0
      },
      {
        metric: "Cancelled Subscriptions",
        currentYear: currentCancelled.length,
        previousYear: previousCancelled.length,
        change: currentCancelled.length - previousCancelled.length,
        changePercent: previousCancelled.length > 0 ? ((currentCancelled.length - previousCancelled.length) / previousCancelled.length) * 100 : 0
      },
      {
        metric: "Annual Savings",
        currentYear: currentSavings,
        previousYear: previousSavings,
        change: currentSavings - previousSavings,
        changePercent: previousSavings > 0 ? ((currentSavings - previousSavings) / previousSavings) * 100 : 0
      }
    ];

    setYoyComparison(comparisons);
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


  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedCategory("all");
    setSelectedStatus("all");
  };

  useEffect(() => {
    if (allSubscriptions.length > 0) {
      calculateMetrics(allSubscriptions);
    }
  }, [dateFrom, dateTo, selectedCategory, selectedStatus]);

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

      <main className="container mx-auto px-4 py-8 space-y-8" ref={exportRef}>
        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <CardTitle>Filters</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                {showFilters ? "Hide" : "Show"} Filters
              </Button>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">To Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Streaming">Streaming</SelectItem>
                      <SelectItem value="Fitness">Fitness</SelectItem>
                      <SelectItem value="Software">Software</SelectItem>
                      <SelectItem value="Insurance">Insurance</SelectItem>
                      <SelectItem value="Telecom">Telecom</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
                {(dateFrom || dateTo || selectedCategory !== "all" || selectedStatus !== "all") && (
                  <Badge variant="secondary">
                    Filters Active
                  </Badge>
                )}
              </div>
            </CardContent>
          )}
        </Card>

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

        {/* Year-over-Year Comparison */}
        {yoyComparison.length > 0 && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Year-over-Year Comparison
              </CardTitle>
              <CardDescription>
                Compare {new Date().getFullYear()} vs {new Date().getFullYear() - 1}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {yoyComparison.map((comparison, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{comparison.metric}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">{new Date().getFullYear()}: </span>
                          <span className="font-medium">
                            {comparison.metric === "Annual Savings" ? `£${comparison.currentYear.toFixed(2)}` : comparison.currentYear}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{new Date().getFullYear() - 1}: </span>
                          <span className="font-medium">
                            {comparison.metric === "Annual Savings" ? `£${comparison.previousYear.toFixed(2)}` : comparison.previousYear}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-lg font-bold flex items-center gap-1",
                        comparison.change > 0 ? "text-primary" : comparison.change < 0 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {comparison.change > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : comparison.change < 0 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : null}
                        {comparison.change > 0 ? "+" : ""}{comparison.changePercent.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {comparison.change > 0 ? "+" : ""}{comparison.metric === "Annual Savings" ? `£${comparison.change.toFixed(2)}` : comparison.change}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
              <CardTitle>Subscription Breakdown</CardTitle>
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
