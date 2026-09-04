import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import SEO from "@/components/SEO";

const Privacy = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Privacy Policy — Casher"
        description="How Casher collects, processes, and protects your data: CSV-only processing, encrypted storage, and how to request deletion."
        path="/privacy"
      />
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Data Collection</h2>
            <p>
              Casher collects only the data necessary to provide our subscription management service. 
              This includes your email address and bank transaction data from uploaded CSV files. 
              We process uploaded CSV data solely for subscription detection and categorization. 
              No banking credentials are stored or shared with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Data Storage</h2>
            <p>
              Uploaded CSV files are processed in memory and are not retained as files after processing —
              we do not store your raw bank statements. The transactions, detected subscriptions and upload
              history produced from them are stored in our managed database so your dashboard can display
              them, and remain there until you ask us to remove them. To have your data deleted, email us
              and we will action the request; in-app one-click deletion is not available yet.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">GDPR Compliance</h2>
            <p>
              Casher is built around UK GDPR principles. As a UK/EU user, you can exercise the following rights by contacting us:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Request a copy of your data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of data collection</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent for data processing</li>
            </ul>
            <p className="mt-2">
              We process your data lawfully, fairly, and transparently. Your CSV files are processed only for the 
              purpose you uploaded them for, and you retain full control over your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Data Security</h2>
            <p>
              All data transmission is encrypted using HTTPS, and stored data sits in a managed database
              with encryption at rest and row-level access rules so each account can only read its own
              records. We never store banking credentials or login information. Transaction descriptions
              are stored as they appear in your CSV and are not anonymised, so avoid uploading statements
              containing details you do not want stored.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Third-Party Services</h2>
            <p>
              We use Stripe for payment processing. Stripe has their own privacy policy and we do not 
              store your credit card information on our servers. No transaction data is shared with 
              Stripe or any other third party.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Cookies</h2>
            <p>
              We only use essential cookies and local browser storage for authentication and keeping you
              signed in. Casher does not load advertising or analytics cookies, and we do not track you
              across other websites.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Contact</h2>
            <p>
              For any privacy-related questions or requests, please contact us at privacy@trycasher.com
            </p>
          </section>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Last updated:</strong> 4 September 2026
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Privacy;