import { AccessibleAmount } from './AccessibleAmount';
import { useMemo, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { saveFile } from '@/lib/save-file';
import { isNativeApp } from '@/lib/mobile-platform';

interface Props { refreshKey: number; userTier: string; userId: string; month: string; onDataChanged?: () => void; }
export default function TransactionsTable({ refreshKey, userTier, userId, month }: Props) {
  const { transactions: query } = useStatementData(userId, refreshKey);
  const mobile = useIsMobile();
  const pageSize = mobile ? 5 : 25;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selected, setSelected] = useState<Tables<'transactions'> | null>(null);
  const { t } = useTranslation();
  const rows = useMemo(() => (query.data || []).filter(row => row.date.startsWith(month) && (!onlyUnreviewed || !row.direction) && `${row.description} ${row.category || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [query.data, month, search, onlyUnreviewed]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const exportRows = async () => {
    if (!isPaidTier(userTier) || exporting) return;
    setExporting(true); setExportError('');
    try { await saveFile(buildTransactionsCsv(rows), exportFileName(), 'text/csv;charset=utf-8;'); }
    catch { setExportError('The export was not saved. Try Export again and choose where to save it.'); }
    finally { setExporting(false); }
  };
  return <Card className="min-w-0">
    <CardHeader className="flex flex-wrap flex-row items-start justify-between gap-3">
      <div><CardTitle>{t('allTransactions')}</CardTitle><CardDescription>{monthLabel(month)} · {rows.length} matching transactions</CardDescription></div>
      {isPaidTier(userTier) ? <Button variant="outline" size="sm" onClick={exportRows} disabled={exporting || query.isPending || query.isError || !rows.length}><Download className="mr-2 h-4 w-4" />{exporting ? 'Preparing export…' : t('export')}</Button> : !isNativeApp() && <Button variant="outline" size="sm" asChild><Link to="/pricing">Export with Pro</Link></Button>}
    </CardHeader>
    <CardContent className="space-y-4">
      {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}
      <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search transactions" placeholder={t('searchTransactions')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" /></div>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input className="h-5 w-5 shrink-0" type="checkbox" checked={onlyUnreviewed} onChange={e => { setOnlyUnreviewed(e.target.checked); setPage(1); }} />Only older transactions with estimated direction</label>
      {query.isPending ? <p role="status">Loading transactions…</p> : query.isError ? <div role="alert"><p>Transactions could not be loaded.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div> : !visible.length ? <p role="status" className="py-6 text-center text-sm text-muted-foreground">{search ? 'No transactions match your search.' : onlyUnreviewed ? 'All transactions in this month have a recorded direction.' : 'No transactions imported for this month.'}</p> : mobile ?
        <ul aria-label="Transactions" className="divide-y">{visible.map(row => <li key={row.id} className="space-y-2 py-3">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1 basis-28 break-words text-sm font-medium">{row.description}</span>
            <span className={`shrink-0 text-right text-sm font-semibold tabular-nums ${isCredit(row) ? 'text-primary' : ''}`}><AccessibleAmount value={formatSignedAmount(row)} label={`${isCredit(row) ? 'Money in' : 'Money out'}: ${formatSignedAmount(row)} for ${row.description}.`} /></span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 text-xs leading-relaxed text-muted-foreground"><time dateTime={row.date}>{new Date(`${row.date}T12:00:00`).toLocaleDateString('en-GB')}</time><p className="break-words">{row.category || t('other')}{!row.direction && ' · Estimated direction'}</p></div>
            <Button size="sm" variant="ghost" onClick={() => setSelected(row)} aria-label={`Edit ${row.description}`}>Edit</Button>
          </div>
        </li>)}</ul> :
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Transactions table, scroll horizontally on small screens">
          <Table className="min-w-[600px]"><TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead>{t('description')}</TableHead><TableHead className="text-right">{t('amount')}</TableHead><TableHead>{t('category')}</TableHead><TableHead><span className="sr-only">Review</span></TableHead></TableRow></TableHeader>
            <TableBody>{visible.map(row => <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{new Date(`${row.date}T12:00:00`).toLocaleDateString('en-GB')}</TableCell>
              <TableCell className="min-w-40 max-w-sm whitespace-normal break-words">{row.description}</TableCell>
              <TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${isCredit(row) ? 'text-primary' : ''}`}><AccessibleAmount value={formatSignedAmount(row)} label={`${isCredit(row) ? 'Money in' : 'Money out'}: ${formatSignedAmount(row)} for ${row.description}.`} /></TableCell>
              <TableCell className="text-muted-foreground">{row.category || t('other')}{!row.direction && <span className="mt-1 block text-xs">Estimated direction</span>}</TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => setSelected(row)} aria-label={`Edit ${row.description}`}>Edit</Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>}
      {totalPages > 1 && <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p><div className="flex gap-2"><Button aria-label="Previous transaction page" variant="outline" size="icon" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}><ChevronLeft className="h-4 w-4" /></Button><Button aria-label="Next transaction page" variant="outline" size="icon" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}><ChevronRight className="h-4 w-4" /></Button></div></div>}
    </CardContent>
    {selected && <TransactionReview key={selected.id} row={selected} onClose={() => setSelected(null)} />}
  </Card>;
}
