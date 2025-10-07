import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
}

interface TransactionsTableProps {
  refreshKey: number;
  userTier: string;
}

const TransactionsTable = ({ refreshKey, userTier }: TransactionsTableProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
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

  const fetchTransactions = async () => {
    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .order('date', { ascending: false });

      // Apply search filter if query exists
      if (searchQuery.trim()) {
        query = query.or(`description.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;

      setTransactions(data || []);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleExport = () => {
    if (userTier === 'free') {
      toast({
        title: t("upgradeToProExport"),
        description: t("exportFeatureDesc"),
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = ['Date', 'Description', 'Amount', 'Category'];
    const rows = transactions.map(t => [
      t.date,
      `"${t.description.replace(/"/g, '""')}"`,
      t.amount,
      t.category || 'Uncategorized'
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `casher-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: t("exportSuccessful"),
      description: t("exportedTransactions"),
    });
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

  const handleMarkCanceled = async () => {
    if (!cancelModal.transaction) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category: 'Canceled Subscription' })
        .eq('id', cancelModal.transaction.id);

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('markedAsCanceled'),
      });

      setCancelModal({ open: false, transaction: null });
      fetchTransactions();
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failedToUpdate'),
        variant: 'destructive',
      });
    }
  };

  if (transactions.length === 0 && !searchQuery) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('allTransactions')}</CardTitle>
            <CardDescription>
              {t('transactionsDescription')}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={userTier === 'free'}
          >
            <Download className="mr-2 h-4 w-4" />
            {t('export')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Box */}
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
                      <TableCell className="max-w-xs truncate">
                        {transaction.description}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                        £{Math.abs(transaction.amount).toFixed(2)}
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
                        {transaction.category === 'Subscription' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelSubscription(transaction)}
                          >
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Subscription Modal */}
      <Dialog open={cancelModal.open} onOpenChange={(open) => setCancelModal({ open, transaction: cancelModal.transaction })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelTitle', { name: cancelModal.transaction?.description || '' })}</DialogTitle>
            <DialogDescription>{t('cancelInstructions')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {cancelModal.transaction && (
              <>
                {(() => {
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
                          <Button
                            onClick={() => window.open(`https://${instructions.website}`, '_blank')}
                            className="flex-1"
                          >
                            {t('openWebsite')}
                          </Button>
                        )}
                        <Button
                          onClick={handleMarkCanceled}
                          variant="outline"
                          className="flex-1"
                        >
                          {t('markCanceled')}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TransactionsTable;
