# Phase 9: AI Logo Regeneration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-powered logo cleanup tool that uses Gemini to regenerate low-quality logos into clean, high-resolution versions with multi-turn refinement support.

**Architecture:** Supabase Edge Function calls the Gemini API server-side. A React page at `/ai/logo` handles upload, preview, refinement, download, and save-to-job. TanStack Query `useMutation` manages all server interactions.

**Tech Stack:** Gemini `gemini-2.5-flash-image` via `@google/genai` (esm.sh for Deno), React 19, TanStack Query v5, shadcn/ui, Supabase Storage

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/functions/regenerate-logo/index.ts` | Deno Edge Function: auth check, Gemini API call, return regenerated image |
| Create | `src/features/ai/useLogoRegeneration.ts` | Hook: mutations for regenerate/refine/save, download helper, state |
| Create | `src/pages/LogoRegenerate.tsx` | Page: upload, preview, side-by-side comparison, refine, download, save |
| Modify | `src/App.tsx:49` | Replace PlaceholderPage with LogoRegenerate import |
| Modify | `src/pages/JobDetail.tsx:372-522` | Add "Clean Up Client Logo" button in Overview tab |

---

## Chunk 1: Edge Function

### Task 1: Create the regenerate-logo Edge Function

**Files:**
- Create: `supabase/functions/regenerate-logo/index.ts`

- [ ] **Step 1: Create the Edge Function file**

Follow the exact pattern from `supabase/functions/create-payment-link/index.ts` for CORS headers, auth verification, and error handling structure.

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "https://esm.sh/@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROMPT =
  "Recreate this logo as a clean, high-resolution, professional image. Preserve exact design elements, colors, text, and layout. Remove all compression artifacts, blur, and noise. Output a crisp version with clean edges on a white background.";

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is authenticated and is admin
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile, error: profileError } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { imageBase64, mimeType, prompt } = await req.json();
    if (!imageBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: "Image data and MIME type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt
    const fullPrompt = prompt
      ? `${DEFAULT_PROMPT}\n\nAdditional instructions: ${prompt}`
      : DEFAULT_PROMPT;

    // Call Gemini API
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            { text: fullPrompt },
          ],
        },
      ],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      return new Response(
        JSON.stringify({
          error:
            "The AI couldn't process this image. The content may have been flagged by safety filters. Try a different image.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imagePart = parts.find(
      (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData
    );
    if (!imagePart?.inlineData) {
      return new Response(
        JSON.stringify({
          error:
            "The AI couldn't generate an image. Try a different photo or angle.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("regenerate-logo error:", message);

    // Detect rate limiting
    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      return new Response(
        JSON.stringify({
          error: "AI service temporarily unavailable. Please try again in a moment.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "AI service temporarily unavailable. Please try again in a moment." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

- [ ] **Step 2: Remove the .gitkeep placeholder**

```bash
rm supabase/functions/regenerate-logo/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/regenerate-logo/
git commit -m "feat: add regenerate-logo Edge Function with Gemini API"
```

---

## Chunk 2: React Hook

### Task 2: Create the useLogoRegeneration hook

**Files:**
- Create: `src/features/ai/useLogoRegeneration.ts`
- Remove: `src/features/ai/.gitkeep`

- [ ] **Step 1: Create the hook**

Uses `useMutation` from TanStack Query for all server interactions. Local `useState` for image data. Pattern follows `useCreateJob` in `src/hooks/useJobs.ts`.

Important implementation details:
- `supabase.functions.invoke()` for calling the edge function (imports from `@/lib/supabase`)
- File-to-base64 conversion strips the `data:...;base64,` prefix
- `saveToJob` needs to fetch the job to get `client_id`, then upload blob to `client-logos` bucket
- `downloadImage` creates a temporary `<a>` element with blob URL

```typescript
import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
// Uses crypto.randomUUID() — no uuid import needed (matches codebase pattern)

interface ImageData {
  base64: string;
  mimeType: string;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URI prefix: "data:image/png;base64,..."
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mimeType });
}

async function resizeIfNeeded(file: File): Promise<File> {
  // Only resize if it's an image that can be drawn on canvas
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 4096;
      if (img.width <= MAX_DIM && img.height <= MAX_DIM) {
        resolve(file);
        return;
      }

      const scale = MAX_DIM / Math.max(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: file.type }));
          } else {
            resolve(file);
          }
        },
        file.type,
        0.92
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

export function useLogoRegeneration() {
  const [originalImage, setOriginalImage] = useState<ImageData | null>(null);
  const [regeneratedImage, setRegeneratedImage] = useState<ImageData | null>(null);

  const regenerateMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        throw new Error("Please upload a PNG, JPG, WEBP, or GIF image");
      }
      // Validate size
      if (file.size > MAX_SIZE) {
        throw new Error("File is too large. Please use an image under 10MB.");
      }

      // Resize if needed
      const resized = await resizeIfNeeded(file);
      const base64 = await fileToBase64(resized);

      // Store original for display
      setOriginalImage({ base64, mimeType: file.type });

      // Call edge function
      const { data, error } = await supabase.functions.invoke("regenerate-logo", {
        body: { imageBase64: base64, mimeType: file.type },
      });

      if (error) throw new Error(error.message || "Failed to process image");
      if (data?.error) throw new Error(data.error);

      return { base64: data.imageBase64, mimeType: data.mimeType } as ImageData;
    },
    onSuccess: (data) => {
      setRegeneratedImage(data);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const refineMutation = useMutation({
    mutationFn: async (instruction: string) => {
      if (!regeneratedImage) throw new Error("No image to refine");

      const { data, error } = await supabase.functions.invoke("regenerate-logo", {
        body: {
          imageBase64: regeneratedImage.base64,
          mimeType: regeneratedImage.mimeType,
          prompt: instruction,
        },
      });

      if (error) throw new Error(error.message || "Failed to refine image");
      if (data?.error) throw new Error(data.error);

      return { base64: data.imageBase64, mimeType: data.mimeType } as ImageData;
    },
    onSuccess: (data) => {
      setRegeneratedImage(data);
      toast.success("Logo refined successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (jobId: string) => {
      if (!regeneratedImage) throw new Error("No image to save");

      // Fetch job to get client_id
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("client_id")
        .eq("id", jobId)
        .single();

      if (jobError || !job) throw new Error("Job not found");

      // Convert to blob and upload
      const blob = base64ToBlob(regeneratedImage.base64, regeneratedImage.mimeType);
      const ext = regeneratedImage.mimeType.split("/")[1] || "png";
      const filePath = `${job.client_id}/${jobId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("client-logos")
        .upload(filePath, blob, {
          contentType: regeneratedImage.mimeType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      return filePath;
    },
    onSuccess: () => {
      toast.success("Logo saved to job successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save logo: ${error.message}`);
    },
  });

  const downloadImage = useCallback(() => {
    if (!regeneratedImage) return;

    const blob = base64ToBlob(regeneratedImage.base64, regeneratedImage.mimeType);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dlExt = regeneratedImage.mimeType.split("/")[1] || "png";
    a.download = `logo-regenerated-${Date.now()}.${dlExt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [regeneratedImage]);

  const reset = useCallback(() => {
    setOriginalImage(null);
    setRegeneratedImage(null);
    regenerateMutation.reset();
    refineMutation.reset();
    saveMutation.reset();
  }, [regenerateMutation, refineMutation, saveMutation]);

  return {
    originalImage,
    regeneratedImage,
    regenerateLogo: (file: File) => regenerateMutation.mutate(file),
    refineLogo: (instruction: string) => refineMutation.mutate(instruction),
    downloadImage,
    saveToJob: (jobId: string) => saveMutation.mutate(jobId),
    reset,
    isProcessing: regenerateMutation.isPending || refineMutation.isPending,
    isSaving: saveMutation.isPending,
    error:
      regenerateMutation.error?.message ||
      refineMutation.error?.message ||
      saveMutation.error?.message ||
      null,
  };
}
```

- [ ] **Step 2: Remove .gitkeep and commit**

```bash
rm src/features/ai/.gitkeep
git add src/features/ai/useLogoRegeneration.ts
git rm src/features/ai/.gitkeep
git commit -m "feat: add useLogoRegeneration hook with TanStack Query mutations"
```

---

## Chunk 3: Logo Regeneration Page

### Task 3: Create the LogoRegenerate page

**Files:**
- Create: `src/pages/LogoRegenerate.tsx`
- Modify: `src/App.tsx:49` — replace PlaceholderPage with LogoRegenerate

- [ ] **Step 1: Create the page component**

Key UI elements:
- Drag-and-drop upload zone (desktop) / buttons (mobile)
- Camera capture with `capture="environment"`
- Side-by-side comparison (`md:grid-cols-2`, stacked on mobile)
- Click-to-zoom via Dialog
- Refinement text input toggle
- Save to Job with searchable job selector (filtered to active jobs)
- Pre-select job from `?jobId=xxx` query param

The page is wrapped in `RoleGate` for admin-only access.

```tsx
import { useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
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
```

- [ ] **Step 2: Update App.tsx routing**

In `src/App.tsx`, add the import and replace the placeholder route:

Add import at top:
```typescript
import LogoRegenerate from "@/pages/LogoRegenerate";
```

Replace line 49:
```tsx
<Route path="/ai/logo" element={<LogoRegenerate />} />
```

- [ ] **Step 3: Run `npm run build` to verify no TypeScript errors**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LogoRegenerate.tsx src/App.tsx
git commit -m "feat: add LogoRegenerate page with upload, comparison, refine, save"
```

---

## Chunk 4: Job Detail Integration

### Task 4: Add "Clean Up Client Logo" button to Job Detail

**Files:**
- Modify: `src/pages/JobDetail.tsx:506-522` — add button before Status Timeline card in Overview tab

- [ ] **Step 1: Add the button**

In `src/pages/JobDetail.tsx`, add the `Sparkles` icon to the existing import from `lucide-react` (line 18), and add `Link` to the import from `react-router-dom` (line 2, already has `useParams` and `useNavigate`).

Add a `Link` import if not present:
```typescript
import { useParams, useNavigate, Link } from "react-router-dom";
```

Then in the Overview tab content, after the Vehicle Details card (after line ~506 which closes the `{vehicleDetails && (...)}` block) and before the Status Timeline card, add:

```tsx
{/* AI Logo Tool */}
<RoleGate requiredRole="admin">
  <Button variant="outline" className="w-full" asChild>
    <Link to={`/ai/logo?jobId=${job.id}`}>
      <Sparkles className="h-4 w-4 mr-2" />
      Clean Up Client Logo
    </Link>
  </Button>
</RoleGate>
```

`Sparkles` is already available from `lucide-react` — just add it to the existing import destructure on line ~8-18.

- [ ] **Step 2: Run `npm run build`**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/JobDetail.tsx
git commit -m "feat: add Clean Up Client Logo button in job detail overview"
```

---

## Chunk 5: Verification

### Task 5: Final build verification and cleanup

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any lint errors if they appear.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: lint and build cleanup for Phase 9"
```

- [ ] **Step 4: Test manually (requires GEMINI_API_KEY)**

To test locally:
```bash
npx supabase secrets set GEMINI_API_KEY=your-key
npx supabase functions serve
```

Then navigate to `/ai/logo` in the dev server:
1. Upload a low-quality logo image
2. Click "Regenerate Logo" — wait for result
3. Verify side-by-side comparison appears
4. Test "Download" button
5. Test "Refine" with "make the text bolder"
6. Test "Save to Job" with an existing job
7. Test from Job Detail → "Clean Up Client Logo" button
8. Verify `?jobId=xxx` pre-selects the job
