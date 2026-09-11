import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SEO from '@/components/SEO';

export default function Support() {
  return <div className="min-h-screen bg-background">
    <SEO title="Help and support — Casher" description="Get help with Casher sign-in, CSV imports, saved data and account deletion." path="/support" />
    <header className="border-b px-4 py-4"><Button asChild variant="ghost"><Link to="/" aria-label="Back to Casher">Back to Casher</Link></Button></header>
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 text-sm leading-7">
      <h1 className="text-4xl font-semibold">Help and support</h1>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Importing statements</h2><p>Casher currently supports GBP statements from one bank account. Export a CSV with date, description and amount columns, up to 5 MB and 10,000 rows. Use negative amounts for spending and positive amounts for income, or separate debit and credit columns. Other currencies are not supported.</p><p>Totals cover your imported records, not your bank balance. Check skipped-row warnings and correct any categories or recurring-payment suggestions that need review. Casher does not connect to your bank.</p></section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">If an upload is taking too long</h2><p>Keep the app open until it confirms the result. If the result cannot be confirmed, retry the same file; Casher checks whether it was already imported. Check your connection before retrying. The Free plan includes one upload each month.</p></section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Signing in</h2><p>Use your email and password in the mobile app. Choose <Link to="/auth" className="underline">Forgot password</Link> on the sign-in screen to request a reset email. Check your spam folder and open the newest email on the same device where you requested it. Never send us your password or a sign-in link.</p></section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Exporting or removing data</h2><p>Open <Link to="/account" className="underline">Account</Link> to export your saved data on any plan. Clear statement data removes imported records while keeping your login, goals and plan; it does not restore used uploads. Delete account removes your login and saved data and cancels any active Casher subscription. Both actions require a recent sign-in and explicit confirmation. Deleting Casher does not cancel merchants listed in your statements.</p></section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Contact Casher</h2><p>Email <a className="underline" href="mailto:privacy@trycasher.com">privacy@trycasher.com</a> for technical support, privacy requests or complaints. Include your device model, operating-system version, the screen affected and the steps that caused the problem. Describe the error without sending bank statements, card details, security codes or passwords. Remove personal information from screenshots.</p><p><Link className="underline" to="/privacy">Privacy Policy</Link> · <Link className="underline" to="/terms">Terms of Service</Link></p></section>
    </main>
  </div>;
}
