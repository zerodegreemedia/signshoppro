import { useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles, Upload, Camera, Download, Save, RotateCcw, Loader2, ZoomIn, Wand2 } from "lucide-react";
import { useLogoRegeneration } from "@/features/ai/useLogoRegeneration";
import { useJobs } from "@/hooks/useJobs";
import { RoleGate } from "@/components/auth/RoleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACTIVE_STATUSES = [
  "lead",
  "estimate_draft",
  "estimate_sent",
  "estimate_approved",
  "design_in_progress",
  "proof_sent",
  "proof_approved",
  "proof_revision_requested",
  "deposit_requested",
  "deposit_paid",
  "materials_ordered",
  "in_production",
  "install_scheduled",
  "install_complete",
  "invoice_sent",
];

export default function LogoRegenerate() {
  const [searchParams] = useSearchParams();
  const preselectedJobId = searchParams.get("jobId") || "";

  const {
    originalImage,
    regeneratedImage,
    regenerateLogo,
    refineLogo,
    downloadImage,
    saveToJob,
    reset,
    isProcessing,
    isSaving,
    error,
  } = useLogoRegeneration();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineText, setRefineText] = useState("");
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);
  const [selectedJobId, setSelectedJobId] = useState(preselectedJobId);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch active jobs for the dropdown
  const { data: jobs } = useJobs();
  const activeJobs = useMemo(
    () => (jobs ?? []).filter((j) => ACTIVE_STATUSES.includes(j.status)),
    [jobs]
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [handleFileSelect]
  );

  const handleRegenerate = () => {
    if (selectedFile) {
      regenerateLogo(selectedFile);
    }
  };

  const handleRefine = () => {
    if (refineText.trim()) {
      refineLogo(refineText.trim());
      setRefineText("");
      setRefineOpen(false);
    }
  };

  const handleStartOver = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setRefineOpen(false);
    setRefineText("");
    reset();
  };

  const handleSaveToJob = () => {
    if (selectedJobId) {
      saveToJob(selectedJobId);
    }
  };

  const makeDataUrl = (img: { base64: string; mimeType: string }) =>
    `data:${img.mimeType};base64,${img.base64}`;

  return (
    <RoleGate
      requiredRole="admin"
      fallback={
        <div className="text-center py-12">
          <p className="text-muted-foreground">Admin access required</p>
        </div>
      }
    >
      <div className="space-y-6 pb-8 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">AI Logo Cleanup</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Upload a low-quality logo and our AI will regenerate a clean, high-resolution version.
          </p>
        </div>

        {/* Upload Area */}
        {!regeneratedImage && (
          <Card>
            <CardContent className="p-6">
              {/* Drag and drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
              >
                {previewUrl ? (
                  <div className="space-y-4">
                    <img
                      src={previewUrl}
                      alt="Selected logo"
                      className="max-h-48 mx-auto object-contain rounded"
                    />
                    <p className="text-sm text-muted-foreground">
                      {selectedFile?.name} ({((selectedFile?.size ?? 0) / 1024).toFixed(0)} KB)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground/50" />
                    <div>
                      <p className="font-medium">Drag & drop a logo image here</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        PNG, JPG, WEBP, or GIF — up to 10MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 mt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Camera
                </Button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Regenerate button */}
              <Button
                className="w-full mt-4"
                size="lg"
                disabled={!selectedFile || isProcessing}
                onClick={handleRegenerate}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Regenerate Logo
                  </>
                )}
              </Button>

              {/* Processing message */}
              {isProcessing && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  AI is cleaning up your logo... This may take 10-20 seconds.
                </p>
              )}

              {/* Error display */}
              {error && (
                <p className="text-sm text-destructive text-center mt-2">{error}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results Area */}
        {regeneratedImage && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Original
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      originalImage &&
                      setZoomImage({
                        src: makeDataUrl(originalImage),
                        alt: "Original logo",
                      })
                    }
                    className="w-full relative group cursor-zoom-in"
                  >
                    {originalImage && (
                      <img
                        src={makeDataUrl(originalImage)}
                        alt="Original logo"
                        className="w-full h-64 object-contain bg-muted/50 rounded"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded">
                      <ZoomIn className="h-6 w-6 text-white drop-shadow" />
                    </div>
                  </button>
                </CardContent>
              </Card>

              {/* Regenerated */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Regenerated
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setZoomImage({
                        src: makeDataUrl(regeneratedImage),
                        alt: "Regenerated logo",
                      })
                    }
                    className="w-full relative group cursor-zoom-in"
                  >
                    <img
                      src={makeDataUrl(regeneratedImage)}
                      alt="Regenerated logo"
                      className="w-full h-64 object-contain bg-muted/50 rounded"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded">
                      <ZoomIn className="h-6 w-6 text-white drop-shadow" />
                    </div>
                  </button>
                </CardContent>
              </Card>
            </div>

            {/* Processing overlay for refinement */}
            {isProcessing && (
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>AI is refining your logo...</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={downloadImage} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>

              <div className="flex gap-2 items-center">
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select a job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJobs.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No active jobs found. Create a job first to save logos.
                      </div>
                    ) : (
                      activeJobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.title}
                          {j.clients?.business_name
                            ? ` — ${j.clients.business_name}`
                            : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleSaveToJob}
                  disabled={!selectedJobId || isSaving}
                  variant="outline"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save to Job
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={() => setRefineOpen(!refineOpen)}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Refine
              </Button>

              <Button variant="ghost" onClick={handleStartOver}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Start Over
              </Button>
            </div>

            {/* Refinement Input */}
            {refineOpen && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-medium mb-2">
                    Tell the AI what to change
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={refineText}
                      onChange={(e) => setRefineText(e.target.value)}
                      placeholder='e.g., "make the text bolder", "change background to transparent"'
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRefine();
                      }}
                      disabled={isProcessing}
                    />
                    <Button
                      onClick={handleRefine}
                      disabled={!refineText.trim() || isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Zoom Dialog */}
        <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
            {zoomImage && (
              <img
                src={zoomImage.src}
                alt={zoomImage.alt}
                className="w-full h-full object-contain"
                style={{ touchAction: "pinch-zoom" }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  );
}
