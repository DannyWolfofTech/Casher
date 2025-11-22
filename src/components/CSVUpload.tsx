import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface CSVUploadProps {
  onUploadComplete: () => void;
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

  const parseCSVLocally = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    const transactions = [];
    const subscriptions = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/(\d{2}\/\d{2}\/\d{4}),([^,]+),([-\d.]+)/);
      
      if (match) {
        const [, date, description, amount] = match;
        const cleanAmount = parseFloat(amount);
        
        if (!isNaN(cleanAmount)) {
          transactions.push({
            id: `test-${i}`,
            date,
            description: description.trim(),
            amount: cleanAmount,
            merchant: description.trim().substring(0, 50),
            category: 'Other'
          });

          // Simple subscription detection
          const subKeywords = ['netflix', 'spotify', 'prime', 'subscription', 'monthly'];
          const isSubscription = subKeywords.some(keyword => 
            description.toLowerCase().includes(keyword)
          );

          if (isSubscription && cleanAmount < 0) {
            subscriptions.push({
              id: `sub-${subscriptions.length}`,
              service_name: description.trim().substring(0, 50),
              amount: Math.abs(cleanAmount),
              frequency: 'monthly',
              estimated_annual_cost: Math.abs(cleanAmount) * 12,
              status: 'active'
            });
            
            // Update transaction category
            transactions[transactions.length - 1].category = 'Subscription';
          }
        }
      }
    }

    return { transactions, subscriptions };
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        
        // Check for test mode
        const testMode = localStorage.getItem('test_mode');
        
        if (testMode === 'true') {
          // Parse CSV locally in test mode
          const { transactions, subscriptions } = parseCSVLocally(text);
          
          // Store in localStorage
          localStorage.setItem('test_transactions', JSON.stringify(transactions));
          localStorage.setItem('test_subscriptions', JSON.stringify(subscriptions));

          toast({
            title: t("successProcessed", { 
              transactions: transactions.length, 
              subscriptions: subscriptions.length 
            }),
          });

          onUploadComplete();
        } else {
          // Call edge function to process CSV
          const { data, error } = await supabase.functions.invoke('process-csv', {
            body: { csv: text }
          });

          if (error) throw error;

          toast({
            title: t("successProcessed", { 
              transactions: data.transactionsCount, 
              subscriptions: data.subscriptionsCount 
            }),
          });

          onUploadComplete();
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || t("errorProcessing"),
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