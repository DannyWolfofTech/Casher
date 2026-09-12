import { AccessibleAmount } from './AccessibleAmount';
import { useMemo, useState } from 'react';
import { useStatementData } from '@/hooks/useStatementData';
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
import { MonthPicker } from './StatementCharts';
import MerchantMark from './MerchantMark';
import { matchesMerchantSearch, resolveMerchant } from '@/lib/merchant-identity';

interface Props { refreshKey: number; userTier: string; userId: string; month: string; onDataChanged?: () => void; onMonthChange?: (value: string) => void; }
export default function TransactionsTable({ refreshKey, userTier, userId, month, onMonthChange }: Props) {
  const { transactions: query } = useStatementData(userId, refreshKey);
  const pageSize = 25;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<'all' | 'out' | 'in'>('all');
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selected, setSelected] = useState<Tables<'transactions'> | null>(null);
  const { t } = useTranslation();
  const hasUnreviewed = (query.data || []).some(row => row.date.startsWith(month) && !row.direction);
  const filterUnreviewed = onlyUnreviewed && hasUnreviewed;
  const rows = useMemo(() => (query.data || []).filter(row => row.date.startsWith(month) && (!filterUnreviewed || !row.direction) && (direction === 'all' || (direction === 'in' ? isCredit(row) : !isCredit(row))) && matchesMerchantSearch(row, search)), [query.data, month, search, filterUnreviewed, direction]);
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
  const groups = [...new Set(visible.map(row => row.date))];
  return <div className="min-w-0 space-y-5">
    <div className="relative"><Search aria-hidden="true" className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" /><Input aria-label="Search transactions" placeholder={t('searchTransactions')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="border-0 bg-muted pl-12" /></div>
    <div className="segmented-control" aria-label="Payment direction filter">{([['all','All'],['out','Money out'],['in','Money in']] as const).map(([value,label]) => <Button key={value} variant={direction === value ? 'secondary' : 'ghost'} className="rounded-full text-sm" aria-pressed={direction === value} onClick={() => {setDirection(value); setPage(1);}}>{label}</Button>)}</div>
    {hasUnreviewed && <label className="flex min-h-11 items-center gap-3 text-sm"><input className="h-5 w-5 shrink-0" type="checkbox" checked={onlyUnreviewed} onChange={e => { setOnlyUnreviewed(e.target.checked); setPage(1); }} />Only older transactions with estimated direction</label>}
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="activity-month">{onMonthChange ? <MonthPicker rows={query.data || []} month={month} onChange={value => {setPage(1); onMonthChange(value);}} /> : <p>{monthLabel(month)}</p>}<p className="app-caption">{rows.length} matching transactions</p></div>{isPaidTier(userTier) ? <Button variant="link" size="sm" onClick={exportRows} disabled={exporting || query.isPending || query.isError || !rows.length}><Download aria-hidden="true" />{exporting ? 'Preparing export…' : t('export')}</Button> : !isNativeApp() && <Button variant="link" size="sm" asChild><Link to="/pricing">Export with Pro</Link></Button>}</div>
    {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}
    {query.isPending ? <p role="status">Loading transactions…</p> : query.isError ? <div role="alert"><p>Transactions could not be loaded.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div> : !visible.length ? <p role="status" className="py-6 text-center text-muted-foreground">{search ? 'No transactions match your search.' : filterUnreviewed ? 'All transactions in this month have a recorded direction.' : direction !== 'all' ? `No money ${direction} recorded for this month.` : 'No transactions imported for this month.'}</p> :
      <div className="space-y-6">{groups.map(date => <section key={date} aria-label={date}><h2 className="mb-1 text-[.9375rem] text-muted-foreground"><time dateTime={date}>{new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {weekday:'long',day:'numeric',month:'long'})}</time></h2><ul aria-label="Transactions" className="divide-y">{visible.filter(row => row.date === date).map(row => <li key={row.id}>
        <button type="button" className="merchant-row rounded focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelected(row)} aria-label={`Review ${row.description}, ${isCredit(row) ? 'money in' : 'money out'} ${formatSignedAmount(row)}`}>
          <MerchantMark merchant={resolveMerchant(row.description, row.merchant)} category={row.category} />
          <span className="merchant-row-label"><span>{resolveMerchant(row.description, row.merchant)?.name || row.description}</span><span className="merchant-row-detail">{row.category || t('other')}{!row.direction && ' · Estimated direction'}</span></span>
          <span className={`merchant-row-amount ${isCredit(row) ? 'text-primary' : ''}`}><AccessibleAmount value={formatSignedAmount(row)} label={`${isCredit(row) ? 'Money in' : 'Money out'}: ${formatSignedAmount(row)} for ${row.description}.`} /></span><ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </li>)}</ul></section>)}</div>}
    {totalPages > 1 && <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p><div className="flex gap-2"><Button aria-label="Previous transaction page" variant="outline" size="icon" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}><ChevronLeft className="h-4 w-4" /></Button><Button aria-label="Next transaction page" variant="outline" size="icon" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}><ChevronRight className="h-4 w-4" /></Button></div></div>}
    {selected && <TransactionReview key={selected.id} row={selected} onClose={() => setSelected(null)} />}
  </div>;
}
