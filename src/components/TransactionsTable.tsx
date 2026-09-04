import { useEffect, useState } from "react";
import { captureApiError } from "@/lib/sentry";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, ChevronLeft, ChevronRight, Download, RefreshCw, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatSignedAmount, isCredit } from "@/lib/transactions";
import { buildTransactionsCsv, exportFileName } from "@/lib/csv-export";
import { CANCELED_CATEGORY, nextTransactionCategory, syncLinkedSubscriptionStatus } from "@/lib/subscription-link";


interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  /** null on legacy rows imported before signed cash-flow support. */
  direction?: "debit" | "credit" | null;
}


interface TransactionsTableProps {
  refreshKey: number;
  userTier: string;
  /** Notifies the dashboard so subscription counts/savings stay in sync. */
  onDataChanged?: () => void;
}

const TransactionsTable = ({ refreshKey, userTier, onDataChanged }: TransactionsTableProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cancelModal, setCancelModal] = useState<{ open: boolean; transaction: Transaction | null }>({
    open: false,
    transaction: null,
  });
  const { toast } = useToast();
  const { t } = useTranslation();
  const itemsPerPage = 25;

  useEffect(() => {
    fetchTransactions();
  }, [refreshKey, currentPage, searchQuery]);

  /**
   * Single source of truth for the current search/sort so that the export
   * matches exactly what the table is showing (minus pagination).
   */
  const buildQuery = (options?: { count?: 'exact' }) => {
    let query = supabase
      .from('transactions')
      .select('*', options?.count ? { count: options.count } : undefined)
      .order('date', { ascending: false });

    // Sanitize and apply search filter
    const sanitized = searchQuery.trim().replace(/[%_\\]/g, '');
    if (sanitized) {
      query = query.or(`description.ilike.%${sanitized}%,category.ilike.%${sanitized}%`);
    }
    return query;
  };

  const fetchTransactions = async () => {
    try {
      setError(false);
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, error, count } = await buildQuery({ count: 'exact' }).range(from, to);

      if (error) throw error;

      setTransactions((data ?? []) as unknown as Transaction[]);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (err) {
      console.error('Error fetching transactions:', err);
      captureApiError(err, { operation: 'fetchTransactions' });
      setError(true);
    }
  };

  /** Fetch every row matching the current filter/sort, not just this page. */
  const fetchAllMatchingTransactions = async (): Promise<Transaction[]> => {
    const pageSize = 1000;
    const all: Transaction[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await buildQuery().range(offset, offset + pageSize - 1);
      if (error) throw error;
      const batch = (data ?? []) as unknown as Transaction[];
      all.push(...batch);
      if (batch.length < pageSize) break;
    }
    return all;
  };

  const handleExport = async () => {
    if (userTier === 'free') {
      toast({
        title: t("upgradeToProExport"),
        description: t("exportFeatureDesc"),
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const rows = await fetchAllMatchingTransactions();
      const csv = buildTransactionsCsv(rows);

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName();
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: t("exportSuccessful"),
        description: t("exportedTransactions"),
      });
    } catch (err) {
      captureApiError(err, { operation: 'exportTransactions' });
      toast({
        title: t('error'),
        description: t('failedToLoadData'),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const getCancellationInstructions = (category: string, description: string) => {
    const desc = description.toLowerCase();
    
    if (desc.includes('netflix')) {
      return {
        website: 'netflix.com/cancelplan',
        steps: ['Go to netflix.com/cancelplan', 'Sign in to your account', 'Click "Finish Cancellation"']
      };
    }
    if (desc.includes('spotify')) {
      return {
        website: 'spotify.com/account/subscription',
        steps: ['Go to spotify.com/account', 'Click "Subscription"', 'Click "Cancel Premium"']
      };
    }
    if (desc.includes('gym') || desc.includes('fitness')) {
      return {
        website: null,
        steps: ['Contact your gym directly', 'Provide 30 days notice in writing', 'Request cancellation confirmation']
      };
    }
    
    return {
      website: null,
      steps: ['Contact the company directly', 'Request subscription cancellation', 'Ask for confirmation email']
    };
  };

  const handleCancelSubscription = (transaction: Transaction) => {
    setCancelModal({ open: true, transaction });
  };

  /**
   * Marks a transaction as canceled/uncanceled and keeps the linked detected
   * subscription row in the same state. Only an unambiguous single match
   * (same amount + recognisable service name) is ever touched.
   */
  /**
   * Flip the linked detected subscription. Database errors are surfaced, never
   * swallowed, so the caller can compensate and report failure.
   */
  const syncLinkedSubscription = (transaction: Transaction, canceled: boolean) =>
    syncLinkedSubscriptionStatus(transaction, canceled, {
      listSubscriptions: async () => {
        const { data, error } = await supabase
          .from('detected_subscriptions')
          .select('id, service_name, amount, status, estimated_annual_cost');
        if (error) throw error;
        return data ?? [];
      },
      updateSubscriptionStatus: async (id, status) => {
        const { error } = await supabase
          .from('detected_subscriptions')
          .update({ status })
          .eq('id', id);
        if (error) throw error;
      },
    });

  const handleMarkCanceled = async () => {
    const transaction = cancelModal.transaction;
    if (!transaction) return;

    const canceled = transaction.category !== CANCELED_CATEGORY;
    const previousCategory = transaction.category;
    let categoryChanged = false;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category: nextTransactionCategory(canceled) })
        .eq('id', transaction.id);

      if (error) throw error;
      categoryChanged = true;

      await syncLinkedSubscription(transaction, canceled);

      toast({
        title: t('success'),
        description: t('markedAsCanceled'),
      });

      setCancelModal({ open: false, transaction: null });
      fetchTransactions();
      onDataChanged?.();
    } catch (error) {
      // Compensate: the subscription write failed after the category write, so
      // roll the transaction back rather than leaving the two out of sync.
      if (categoryChanged) {
        const { error: revertError } = await supabase
          .from('transactions')
          .update({ category: previousCategory })
          .eq('id', transaction.id);
        if (revertError) {
          captureApiError(revertError, { operation: 'markSubscriptionCanceledRevert' });
        }
      }
      captureApiError(error, { operation: 'markSubscriptionCanceled' });
      toast({
        title: t('error'),
        description: t('failedToUpdate'),
        variant: 'destructive',
      });
      fetchTransactions();
    }
  };

  if (transactions.length === 0 && !searchQuery && !error) {
    return null;
  }

  if (error && transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('allTransactions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-8">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm">{t("failedToLoadData")}</p>
            <Button variant="outline" size="sm" onClick={fetchTransactions}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("retry")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('allTransactions')}</CardTitle>
            <CardDescription>{t('transactionsDescription')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={userTier === 'free' || exporting}>
            <Download className="mr-2 h-4 w-4" />
            {t('export')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchTransactions')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('description')}</TableHead>
                  <TableHead className="text-right">{t('amount')}</TableHead>
                  <TableHead>{t('category')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t('noResults')}
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(transaction.date).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                      <TableCell className={`text-right font-medium ${isCredit(transaction) ? 'text-primary' : 'text-foreground'}`}>
                        {formatSignedAmount(transaction)}
                      </TableCell>

                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.category === 'Subscription' 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : transaction.category === 'Fitness'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {transaction.category || t("other")}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(transaction.category === 'Subscription' || transaction.category === CANCELED_CATEGORY) && (
                          <Button variant="ghost" size="sm" onClick={() => handleCancelSubscription(transaction)}>
                            <X className="h-4 w-4 mr-1" />
                            {t('cancel')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {t("pageOf", { current: currentPage, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={cancelModal.open} onOpenChange={(open) => setCancelModal({ open, transaction: cancelModal.transaction })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelTitle', { name: cancelModal.transaction?.description || '' })}</DialogTitle>
            <DialogDescription>{t('cancelInstructions')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {cancelModal.transaction && (() => {
              const instructions = getCancellationInstructions(
                cancelModal.transaction.category || '',
                cancelModal.transaction.description
              );
              return (
                <div className="space-y-3">
                  {instructions.steps.map((step, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </span>
                      <p className="text-sm">{step}</p>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-4">
                    {instructions.website && (
                      <Button onClick={() => window.open(`https://${instructions.website}`, '_blank')} className="flex-1">
                        {t('openWebsite')}
                      </Button>
                    )}
                    <Button onClick={handleMarkCanceled} variant="outline" className="flex-1">
                      {t('markCanceled')}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TransactionsTable;
