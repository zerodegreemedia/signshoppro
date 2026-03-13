import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, FileImage } from "lucide-react";
import { useUploadProof } from "@/hooks/useProofs";
import { useUpdateJobStatus } from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
const MAX_SIZE_MB = 20;

interface ProofUploadProps {
  jobId: string;
  jobStatus: string;
}

export function ProofUpload({ jobId, jobStatus }: ProofUploadProps) {
  const { user } = useAuth();
  const uploadProof = useUploadProof();
  const updateStatus = useUpdateJobStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    uploadProof.mutate(
      {
        file: selectedFile,
        jobId,
        internalNotes: notes || undefined,
      },
      {
        onSuccess: () => {
          clearSelection();
          // Auto-update job status to proof_sent if applicable
          const statusesThatSendProof = [
            "design_in_progress",
            "proof_revision_requested",
          ];
          if (statusesThatSendProof.includes(jobStatus)) {
            updateStatus.mutate({
              jobId,
              newStatus: "proof_sent",
              changedBy: user.id,
              notes: "Proof uploaded and sent to client",
            });
          }
        },
      }
    );
  };

  const isPending = uploadProof.isPending || updateStatus.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          Upload Proof
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedFile ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              Drop a file here or tap to select
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, or PDF (max {MAX_SIZE_MB}MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-lg border overflow-hidden bg-muted/50">
              {preview ? (
                <img
                  src={preview}
                  alt="Proof preview"
                  className="w-full max-h-48 object-contain"
                />
              ) : (
                <div className="flex items-center gap-3 p-4">
                  <FileImage className="h-8 w-8 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-9 w-9 bg-background/80"
                onClick={clearSelection}
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proof-notes">Designer Notes (optional)</Label>
              <Textarea
                id="proof-notes"
                placeholder="What changed in this version..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload & Send to Client
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
