import { useMemo, useState } from 'react';
import { useStatementData } from '@/hooks/useStatementData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatSignedAmount, isCredit } from '@/lib/transactions';
import { buildTransactionsCsv, exportFileName } from '@/lib/csv-export';
import { isPaidTier } from '@/lib/upload-allowance';
import { monthLabel } from '@/lib/analytics';
import { Link } from 'react-router-dom';
import TransactionReview from './TransactionReview';
import type { Tables } from '@/integrations/supabase/types';

interface Props { refreshKey: number; userTier: string; userId: string; month: string; onDataChanged?: () => void; }
export default function TransactionsTable({ refreshKey, userTier, userId, month }: Props) {
  const { transactions: query } = useStatementData(userId, refreshKey);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [selected, setSelected] = useState<Tables<'transactions'> | null>(null);
  const { t } = useTranslation();
  const rows = useMemo(() => (query.data || []).filter(row => row.date.startsWith(month) && (!onlyUnreviewed || !row.direction) && `${row.description} ${row.category || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [query.data, month, search, onlyUnreviewed]);
  const totalPages = Math.max(1, Math.ceil(rows.length / 25));
  const currentPage = Math.min(page, totalPages);
  const visible = rows.slice((currentPage - 1) * 25, currentPage * 25);
  const exportRows = () => {
    if (!isPaidTier(userTier)) return;
    const blob = new Blob([buildTransactionsCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = exportFileName(); link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <Card className="min-w-0">
    <CardHeader className="flex flex-wrap flex-row items-start justify-between gap-3">
      <div><CardTitle>{t('allTransactions')}</CardTitle><CardDescription>{monthLabel(month)} · {rows.length} matching transactions</CardDescription></div>
      {isPaidTier(userTier) ? <Button variant="outline" size="sm" onClick={exportRows} disabled={query.isPending || query.isError || !rows.length}><Download className="mr-2 h-4 w-4" />{t('export')}</Button> : <Button variant="outline" size="sm" asChild><Link to="/pricing">Export with Pro</Link></Button>}
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search transactions" placeholder={t('searchTransactions')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyUnreviewed} onChange={e => { setOnlyUnreviewed(e.target.checked); setPage(1); }} />Only transactions needing a direction review</label>
      {query.isPending ? <p role="status">Loading transactions…</p> : query.isError ? <div role="alert"><p>Transactions could not be loaded.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div> :
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Transactions table, scroll horizontally on small screens">
          <Table className="min-w-[600px]"><TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead>{t('description')}</TableHead><TableHead className="text-right">{t('amount')}</TableHead><TableHead>{t('category')}</TableHead><TableHead><span className="sr-only">Review</span></TableHead></TableRow></TableHeader>
            <TableBody>{!visible.length ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{search ? 'No transactions match your search.' : onlyUnreviewed ? 'All transactions in this month have a recorded direction.' : 'No transactions imported for this month.'}</TableCell></TableRow> : visible.map(row => <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{new Date(`${row.date}T12:00:00`).toLocaleDateString('en-GB')}</TableCell>
              <TableCell className="min-w-40 max-w-sm whitespace-normal break-words">{row.description}</TableCell>
              <TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${isCredit(row) ? 'text-primary' : ''}`}>{formatSignedAmount(row)}</TableCell>
              <TableCell className="text-muted-foreground">{row.category || t('other')}{!row.direction && <span className="mt-1 block text-xs">Direction needs review</span>}</TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => setSelected(row)} aria-label={`Correct ${row.description}`}>Correct</Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>}
      {totalPages > 1 && <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p><div className="flex gap-2"><Button aria-label="Previous transaction page" variant="outline" size="icon" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}><ChevronLeft className="h-4 w-4" /></Button><Button aria-label="Next transaction page" variant="outline" size="icon" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}><ChevronRight className="h-4 w-4" /></Button></div></div>}
    </CardContent>
    {selected && <TransactionReview key={selected.id} row={selected} onClose={() => setSelected(null)} />}
  </Card>;
}
