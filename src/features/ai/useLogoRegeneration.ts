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

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Not authenticated");

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
      const clientId = (job as { client_id: string }).client_id;
      const filePath = `${clientId}/${jobId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("client-logos")
        .upload(filePath, blob, {
          contentType: regeneratedImage.mimeType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from("client-logos")
        .getPublicUrl(filePath);

      // Persist logo-job relationship as a job_photo record
      const { error: insertError } = await supabase
        .from("job_photos")
        .insert({
          job_id: jobId,
          uploaded_by: user.id,
          storage_path: filePath,
          file_url: urlData.publicUrl,
          photo_type: "reference" as const,
          caption: "AI-regenerated logo",
          taken_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

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
