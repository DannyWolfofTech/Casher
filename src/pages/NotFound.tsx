import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import logoFull from "@/assets/logo-full.png";
import SEO from "@/components/SEO";

const NotFound = () => {
  const location = useLocation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <SEO
        title="Page not found — Casher"
        description="The page you were looking for does not exist. Head back to Casher to keep tracking your subscriptions."
        path={location.pathname}
        noindex
      />
      <div className="w-full max-w-md text-center space-y-6">
        <img src={logoFull} alt="Casher" className="mx-auto h-12" />
        <Compass aria-hidden="true" className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-4xl font-bold text-foreground">Page not found</h1>
        <p className="text-muted-foreground">
          We couldn&apos;t find the page you were looking for. It may have moved or never existed.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/">Back to home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
