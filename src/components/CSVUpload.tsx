import { useState, useCallback } from "react";
import { captureApiError } from "@/lib/sentry";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

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
  usage?: {
    uploadsUsed: number;
    uploadLimit: number | null;
    tier: string;
    canUpload: boolean;
  };
}

interface CSVUploadProps {
  onUploadComplete: (result?: UploadResult) => void;
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


const CSVUpload = ({ onUploadComplete }: CSVUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        
        // Call edge function to process CSV
        const { data, error } = await supabase.functions.invoke('process-csv', {
          body: { csv: text }
        });

        if (error) throw error;

        const dupeMsg = data.duplicatesSkipped > 0 
          ? ` (${data.duplicatesSkipped} duplicates skipped)` 
          : '';

        toast({
          title: t("successProcessed", {
            transactions: data.transactionsCount,
            subscriptions: data.subscriptionsCount
          }) + dupeMsg,
        });

        onUploadComplete({
          batchSpending: data.batchSpending,
          batchSubsCount: data.batchSubsCount,
          batchAnnualSavings: data.batchAnnualSavings,
          transactionsCount: data.transactionsCount,
        });
      } catch (error: unknown) {
        captureApiError(error, { operation: 'csvUpload' });
        const message = error instanceof Error ? error.message : t("errorProcessing");
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      toast({
        title: "Error",
        description: t("errorReading"),
        variant: "destructive",
      });
      setLoading(false);
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
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-5 w-5" />
              <span>{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <p className="text-lg mb-2">
                {isDragActive
                  ? t("dropFileHere")
                  : t("dragDropPrompt")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("supportsFormat")}
              </p>
            </>
          )}
        </div>

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
