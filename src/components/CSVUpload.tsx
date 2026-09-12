import { isNativeApp } from '@/lib/mobile-platform';
import { useState, useCallback, useEffect, useRef } from "react";
import { captureApiError } from "@/lib/sentry";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { importRequest, ImportUnconfirmedError } from '@/lib/import-request';
import type { ParseSuccess } from '../../supabase/functions/_shared/csv-parser';
import { money } from '@/lib/analytics';

export interface UploadResult {
  code?: string;
  replay?: boolean;
  batchSpending?: number;
  batchCredits?: number;
  batchSubsCount?: number;
  batchAnnualSavings?: number;
  transactionsCount?: number;
  subscriptionsCount?: number;
  duplicatesSkipped?: number;
  skippedRows?: number;
  usage?: {
    uploadsUsed: number;
    uploadLimit: number | null;
    tier: string;
    canUpload: boolean;
  };
}

interface CSVUploadProps {
  onUploadComplete: (result?: UploadResult) => void;
  onProcessingChange?: (processing: boolean) => void;
  onImportSettled?: () => void;
  quotaReached?: boolean;
}

interface StructuredFunctionError {
  code: string;
  message: string;
  usage?: UploadResult["usage"];
}

/**
 * supabase.functions.invoke() surfaces non-2xx responses as a
 * FunctionsHttpError whose `context` is the raw Response. Read the structured
 * body from it so the user sees the real reason instead of
 * "Edge Function returned a non-2xx status code".
 */
async function readStructuredError(error: unknown): Promise<StructuredFunctionError | null> {
  const context = (error as { context?: unknown })?.context;
  if (!context || typeof (context as Response).json !== "function") return null;
  try {
    const body = await (context as Response).clone().json();
    if (body && typeof body === "object" && (body.message || body.error)) {
      return {
        code: String(body.code ?? "UNKNOWN"),
        message: String(body.message ?? body.error),
        usage: body.usage,
      };
    }
  } catch {
    /* body was not JSON */
  }
  return null;
}


const CSVUpload = ({ onUploadComplete, onProcessingChange, onImportSettled, quotaReached }: CSVUploadProps) => {
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [preview, setPreview] = useState<ParseSuccess | null>(null);
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setFileError('');
      setPreview(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    disabled: loading || checking,
    onDropRejected: (rejections) => {
      setFile(null);
      setPreview(null);
      setFileError(rejections.some(r => r.errors.some(e => e.code === 'file-too-large')) ? 'Choose a CSV smaller than 5 MB.' : 'Choose one CSV file. Other file types are not supported.');
    },
  });

  const reviewFile = async () => {
    if (!file || loading || checking) return;
    setChecking(true); setFileError(''); onProcessingChange?.(true);
    try {
      const [{ parseTransactionsCsv }, csv] = await Promise.all([import('../../supabase/functions/_shared/csv-parser'), file.text()]);
      const result = parseTransactionsCsv(csv);
      if (!active.current) return;
      if (result.ok === false) { setFileError(result.message); return; }
      setPreview(result);
    } catch { if (active.current) setFileError('This file could not be read. Choose the CSV again.'); }
    finally { if (active.current) { setChecking(false); onProcessingChange?.(false); } }
  };

  const handleUpload = async () => {
    if (!file || loading || !preview) return;

    setLoading(true);
    onProcessingChange?.(true);
    setFileError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        
        // Call edge function to process CSV
        const { data, error } = await importRequest(signal => supabase.functions.invoke('process-csv', {
          body: { csv: text }, signal,
        }));
        if (!active.current) return;

        if (error) {
          const structured = await readStructuredError(error);
          if (!active.current) return;
          if (structured) {
            setFileError(structured.message);
            captureApiError(error, { operation: 'csvUpload', code: structured.code });
            toast({
              title: structured.code === 'QUOTA_EXCEEDED'
                ? t("uploadLimitReached")
                : "Upload failed",
              description: structured.message,
              variant: "destructive",
            });
            // Let the dashboard sync its counter with server truth.
            if (structured.usage) onUploadComplete({ code: structured.code, usage: structured.usage });
            return;
          }
          throw new ImportUnconfirmedError();
        }

        if (!data || !['OK', 'REPLAY'].includes(data.code)) throw new ImportUnconfirmedError();

        if (data?.replay) {
          toast({
            title: "Already uploaded",
            description: data.message,
          });
        } else {
          const dupeMsg = data.duplicatesSkipped > 0
            ? ` (${data.duplicatesSkipped} duplicates skipped)`
            : '';

          toast({
            title: t("successProcessed", {
              transactions: data.transactionsCount,
              subscriptions: data.subscriptionsCount
            }) + dupeMsg,
          });
        }

        onUploadComplete(data as UploadResult);
      } catch (error: unknown) {
        if (!active.current) return;
        captureApiError(error, { operation: 'csvUpload' });
        const message = error instanceof ImportUnconfirmedError ? error.message : new ImportUnconfirmedError().message;
        setFileError(message);
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });

      } finally {
        // A request can commit after navigating away. Reconcile the account's
        // caches, but never deliver its result to an unmounted screen.
        onImportSettled?.();
        if (active.current) { setLoading(false); onProcessingChange?.(false); }
      }
    };

    reader.onerror = () => {
      if (!active.current) return;
      setFileError(t('errorReading'));
      toast({
        title: "Error",
        description: t("errorReading"),
        variant: "destructive",
      });
      setLoading(false);
      onProcessingChange?.(false);
    };

    reader.readAsText(file);
  };

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">{preview ? 'Review statement' : 'Choose your file'}</CardTitle>
        <CardDescription>
          {t("uploadBankStatementDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-0">
        <input {...getInputProps({ 'aria-label': 'Bank statement CSV' })} />
        {!preview && <div
          {...getRootProps({ role: 'button', 'aria-label': 'Choose bank statement CSV' })}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg mb-2">
            {isDragActive ? t("dropFileHere") : file ? "Choose a different CSV" : isNativeApp() ? "Choose CSV from Files" : t("dragDropPrompt")}
          </p>
          <p className="text-sm text-muted-foreground">{t("supportsFormat")}</p>
        </div>}
        {file && <div className="flex items-center gap-2 rounded-lg border p-3">
          <FileText aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1 break-all">{file.name}</span>
          <Button variant="ghost" size="icon" aria-label="Remove selected CSV" disabled={loading || checking} onClick={() => { setFile(null); setPreview(null); }}><X className="h-4 w-4" /></Button>
        </div>}

        {preview && <section aria-label="Statement preview" className="space-y-4 rounded-xl bg-card p-4">
          <p className="text-lg font-semibold">{preview.transactions.length} readable transactions</p>
          <p className="text-sm text-muted-foreground">{preview.transactions.map(row => row.date).sort()[0]} to {preview.transactions.map(row => row.date).sort().at(-1)}</p>
          <dl className="summary-pair"><div><dt>Money out in file</dt><dd>{money(preview.transactions.filter(row => row.direction === 'debit').reduce((sum, row) => sum + Math.round(Math.abs(row.amount) * 100), 0) / 100)}</dd></div><div><dt>Money in in file</dt><dd className="text-primary">{money(preview.transactions.filter(row => row.direction === 'credit').reduce((sum, row) => sum + Math.round(Math.abs(row.amount) * 100), 0) / 100)}</dd></div></dl>
          {!!preview.skipped.length && <div role="note" className="space-y-2 text-sm"><p>{preview.skipped.length} rows could not be read. Check them in your statement before continuing.</p><details><summary className="min-h-11 cursor-pointer py-3">Show skipped rows</summary><ul>{preview.skipped.slice(0,20).map(row => <li key={row.rowNumber}>Row {row.rowNumber}: {row.reason}</li>)}</ul>{preview.skipped.length > 20 && <p>Showing the first 20 skipped rows.</p>}</details></div>}
          {!!preview.duplicatesInFile && <p className="text-sm">{preview.duplicatesInFile} duplicate rows in this file.</p>}
          <p className="app-caption">Nothing has been imported yet. Existing duplicates and your upload allowance are checked when you confirm. Final imported totals may differ.</p>
        </section>}

        <p className="text-xs text-muted-foreground">GBP statements only · CSV up to 5 MB · 10,000 rows maximum. Signed amounts: negative for money out, positive for money in; or use separate debit and credit columns.</p>
        <p className="text-xs text-muted-foreground">Use statements from one bank account. Identical transactions across different accounts cannot yet be distinguished.</p>
        {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
        {quotaReached && <p className="text-sm text-muted-foreground">No new uploads remain this month. You can retry the same file to check whether it was already imported.</p>}
        {loading && <p role="status" className="text-sm text-muted-foreground">Importing your statement. Keep this screen open until the result appears.</p>}
        {checking && <p role="status" className="text-sm text-muted-foreground">Checking your statement on this device…</p>}

        {file && (
          <Button onClick={preview ? handleUpload : reviewFile} disabled={loading || checking} className="w-full">
            {loading ? t("processing") : checking ? 'Checking statement…' : preview ? 'Confirm import' : 'Review statement'}
          </Button>
        )}
        <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3 text-primary">How to get a CSV statement</summary><p className="leading-relaxed text-muted-foreground">In your bank’s app or website, open your account’s transactions or statements, choose a date range and look for Export or Download. Choose CSV, save it to Files or Downloads, then select it here. PDF statements and screenshots cannot be imported.</p></details>
      </CardContent>
    </Card>
  );
};

export default CSVUpload;
