import { lazy, Suspense, useLayoutEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { isNativeApp } from './lib/mobile-platform';
import MobileRuntime from './components/MobileRuntime';
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const History = lazy(() => import("./pages/History"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Account = lazy(() => import("./pages/Account"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const About = lazy(() => import("./pages/About"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function RouteScrollReset() {
  const {pathname} = useLocation();
  useLayoutEffect(() => { window.scrollTo(0,0); },[pathname]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RouteScrollReset />
            <MobileRuntime />
            <Suspense fallback={<div role="status" className="p-8 text-muted-foreground">Loading page…</div>}>
            <Routes>
              <Route path="/" element={isNativeApp() ? <Navigate to="/auth" replace /> : <Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/history" element={<History />} />
              <Route path="/pricing" element={isNativeApp() ? <Navigate to="/dashboard" replace /> : <Pricing />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/account" element={<Account />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/about" element={<About />} />
              <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
