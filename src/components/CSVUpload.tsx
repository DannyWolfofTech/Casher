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
  const { toast } = useToast();
  const { t } = useTranslation();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setFileError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    disabled: loading,
    onDropRejected: (rejections) => {
      setFile(null);
      setFileError(rejections.some(r => r.errors.some(e => e.code === 'file-too-large')) ? 'Choose a CSV smaller than 5 MB.' : 'Choose one CSV file. Other file types are not supported.');
    },
  });

  const handleUpload = async () => {
    if (!file || loading) return;

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
    <Card>
      <CardHeader>
        <CardTitle>{t("uploadBankStatement")}</CardTitle>
        <CardDescription>
          {t("uploadBankStatementDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input {...getInputProps({ 'aria-label': 'Bank statement CSV' })} />
        <div
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
        </div>
        {file && <div className="flex items-center gap-2 rounded-lg border p-3">
          <FileText aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1 break-all">{file.name}</span>
          <Button variant="ghost" size="icon" aria-label="Remove selected CSV" disabled={loading} onClick={() => setFile(null)}><X className="h-4 w-4" /></Button>
        </div>}

        <p className="text-xs text-muted-foreground">GBP statements only · CSV up to 5 MB · 10,000 rows maximum. Signed amounts: negative for money out, positive for money in; or use separate debit and credit columns.</p>
        <p className="text-xs text-muted-foreground">Use statements from one bank account. Identical transactions across different accounts cannot yet be distinguished.</p>
        {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
        {quotaReached && <p className="text-sm text-muted-foreground">No new uploads remain this month. You can retry the same file to check whether it was already imported.</p>}
        {loading && <p role="status" className="text-sm text-muted-foreground">Importing your statement. Keep this screen open until the result appears.</p>}

        {file && (
          <Button onClick={handleUpload} disabled={loading} className="w-full">
            {loading ? t("processing") : t("analyzeTransactions")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default CSVUpload;
