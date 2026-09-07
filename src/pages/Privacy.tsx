import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SEO from '@/components/SEO';

export default function Privacy() {
  return <div className="min-h-screen bg-background">
    <SEO title="Privacy Policy — Casher" description="What Casher stores, why it is used, and how to export or delete your personal data." path="/privacy" />
    <header className="border-b px-4 py-4"><Button asChild variant="ghost"><Link to="/">Back to Casher</Link></Button></header>
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 text-sm leading-7">
      <h1 className="text-4xl font-semibold">Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: 7 September 2026</p>
      <section className="space-y-3"><h2 className="text-xl font-semibold">What we collect and why</h2>
        <p>Casher uses your account email, sign-in information, profile preferences and plan status to provide your account. If you choose Google sign-in on the website, Google supplies the identity information needed to authenticate you. We also store transactions you import, recurring-payment suggestions, corrections you make, savings goals and upload history to provide spending analysis. Transaction descriptions are stored as supplied; they are not anonymised. Transaction data is banking information, separate from your bank login credentials. Casher never asks for your bank password, PIN or bank security codes.</p>
        <p>We process the account and dashboard data needed to provide the service you request. We use limited operational records to protect accounts, prevent abuse, diagnose faults and handle support requests under our legitimate interests in running the service. Payment and accounting records may also be processed to meet legal obligations. Casher does not sell your transaction data or use it for advertising.</p>
      </section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Bank connections and payments</h2>
        <p>Spending analysis currently uses the CSV data you upload. Automatic bank connections are unavailable. Before any future optional connection, we will explain the provider, data requested, consent period and how to disconnect. Authentication will take place through the provider and your bank. Buying Pro does not connect your bank or give Casher access to your bank account.</p>
        <p>Stripe handles web subscription payments on its hosted checkout. Casher stores the Stripe customer reference and subscription status needed to manage access. Your statement contents are not sent to Stripe, and Casher does not store full payment-card details. The mobile companion app has no in-app purchases.</p>
      </section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Storage and service providers</h2>
        <p>CSV files are read on your device and processed by our server. The raw uploaded file is not retained as a file; the resulting transaction records and upload metadata are saved. Lovable Cloud and its Supabase infrastructure host the website, account authentication and database. Stripe processes billing. Sentry receives limited technical failure reports; session recording is disabled, and our error-report filter removes dynamic error messages, account details, request data and callback tokens.</p>
        <p>Our email services process delivery addresses and message contents for account messages and support. The privacy mailbox uses Forward Email to route incoming mail to the operator's mailbox and Zoho Mail to send replies and retain sent correspondence. Do not email passwords, full card details or bank security codes. These providers may process data in different countries. Their service terms and data-protection arrangements govern their processing; contact us for information about the providers and transfer arrangements relevant to your request.</p>
      </section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Retention and deletion</h2>
        <p>Saved dashboard data remains while your account exists. In <Link className="underline" to="/account">Account</Link>, every plan can export saved data and request permanent account deletion after a recent sign-in and explicit confirmation. Deletion removes your sign-in, profile, imported transactions, corrections, detected subscriptions, goals and upload history. Any active Casher subscription is cancelled immediately before deletion completes. If billing cancellation cannot be confirmed, the account is kept so the operation can be retried, and new purchases are blocked.</p>
        <p>Daily cleanup removes operational webhook records and minimal deleted-account and closed-customer references after 90 days. These references help prevent billing replays and reapply deletions after a backup restore. Email delivery logs are removed after 30 days; queued or archived mail older than one day is removed during daily cleanup. Suppression records may remain to honour unsubscribe requests and avoid sending mail to addresses that bounce or report abuse. Stripe and the operator may retain payment records for legal and accounting requirements.</p>
        <p>Managed database backups normally expire after approximately 14 days, so deleted records may remain in restricted backups until those backups expire. A recovery procedure must reapply deletions before restored data returns to service. Removing the app from your device does not delete the account or cancel a subscription.</p>
      </section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Your choices and rights</h2>
        <p>You can correct imported records in Casher and export saved dashboard data from Account without upgrading. For access to other personal data, correction, deletion, restriction, portability or an objection to processing, email <a className="underline" href="mailto:privacy@trycasher.com">privacy@trycasher.com</a>. Rights depend on the processing involved; we may need to verify your identity. Where processing relies on consent, you can withdraw it without affecting earlier lawful processing. Some data is necessary to provide an account.</p>
        <p>You can complain to the <a className="underline" href="https://ico.org.uk/make-a-complaint/" rel="noreferrer">Information Commissioner's Office</a> if you are concerned about how your personal data is handled.</p>
      </section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Device storage and security</h2>
        <p>HTTPS protects data in transit. The managed database uses encryption at rest and account access rules. Website sign-in uses browser storage; native sessions use the device's Keychain or Keystore-backed encrypted storage. Language, appearance and onboarding preferences are also saved locally. We do not load advertising cookies or cross-site tracking.</p>
        <p>Native exports temporarily use the app cache so you can save or share them. Old export files are removed when the app next starts or exports after an hour. Files you save or share outside Casher remain under your control. Casher requests access to files you choose, rather than general access to your bank or device storage. No service can guarantee absolute security; keep your account and device protected.</p>
      </section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Contact and updates</h2><p>For privacy questions, support or complaints, email <a className="underline" href="mailto:privacy@trycasher.com">privacy@trycasher.com</a>. We will update this policy when processing changes and explain material changes affecting your account.</p></section>
    </main>
  </div>;
}
