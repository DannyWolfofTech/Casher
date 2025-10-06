import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CSVUploadProps {
  onUploadComplete: () => void;
}

const CSVUpload = ({ onUploadComplete }: CSVUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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

        toast({
          title: "Success!",
          description: `Processed ${data.transactionsCount} transactions and detected ${data.subscriptionsCount} subscriptions.`,
        });

        onUploadComplete();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to process CSV",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to read file",
        variant: "destructive",
      });
      setLoading(false);
    };

    reader.readAsText(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Bank Statement</CardTitle>
        <CardDescription>
          Upload a CSV file from your bank to analyze transactions
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
                  ? "Drop the CSV file here"
                  : "Drag & drop your CSV file here, or click to select"}
              </p>
              <p className="text-sm text-muted-foreground">
                Supports CSV files from HSBC, NatWest, Barclays, and more
              </p>
            </>
          )}
        </div>

        {file && (
          <Button onClick={handleUpload} disabled={loading} className="w-full">
            {loading ? "Processing..." : "Analyze Transactions"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default CSVUpload;