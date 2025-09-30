import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Data Collection</h2>
            <p>
              SubSaver collects only the data necessary to provide our subscription management service. 
              This includes your email address, bank transaction data from uploaded CSV files, and detected subscription information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Data Storage</h2>
            <p>
              All uploaded transaction data is temporarily stored for analysis purposes and is automatically 
              deleted after processing. We do not permanently store your raw bank statements. Detected 
              subscriptions and analysis results are stored securely in our encrypted database.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">GDPR Compliance</h2>
            <p>
              We are fully compliant with GDPR regulations. You have the right to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Request a copy of your data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of data collection at any time</li>
              <li>Export your data in a portable format</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Data Security</h2>
            <p>
              We use industry-standard encryption and security measures to protect your data. 
              All data transmission is encrypted using HTTPS, and stored data is encrypted at rest.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Third-Party Services</h2>
            <p>
              We use Stripe for payment processing. Stripe has their own privacy policy and we do not 
              store your credit card information on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We also use analytics 
              cookies to improve our service. You can disable non-essential cookies in your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Contact</h2>
            <p>
              For any privacy-related questions or requests, please contact us at privacy@subsaver.com
            </p>
          </section>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Last updated:</strong> {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Privacy;