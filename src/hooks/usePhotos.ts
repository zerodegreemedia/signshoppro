import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { JobPhoto } from "@/types/database";
import type { PhotoType } from "@/lib/constants";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

export interface UploadPhotoInput {
  file: File;
  jobId: string;
  clientId: string;
  photoType: PhotoType;
  notes?: string;
  measurements?: { width: string; height: string };
  gpsLatitude?: number;
  gpsLongitude?: number;
}

export interface DeletePhotoInput {
  photoId: string;
  storagePath: string;
  jobId: string;
}

export function useJobPhotos(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job-photos", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("Job ID required");
      const { data, error } = await supabase
        .from("job_photos")
        .select("*")
        .eq("job_id", jobId)
        .order("taken_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as JobPhoto[];
    },
    enabled: !!jobId,
  });
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadPhotoInput) => {
      // 1. Compress image
      const compressed = await imageCompression(input.file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      // 2. Generate filename and path
      const uuid = crypto.randomUUID();
      const storagePath = `${input.clientId}/${input.jobId}/${input.photoType}/${uuid}.jpg`;

      // 3. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("job-photos")
        .upload(storagePath, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      // 4. Get public URL
      const { data: urlData } = supabase.storage
        .from("job-photos")
        .getPublicUrl(storagePath);

      // 5. Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Not authenticated");

      // 6. Insert DB record
      const { data, error: insertError } = await supabase
        .from("job_photos")
        .insert({
          job_id: input.jobId,
          uploaded_by: user.id,
          storage_path: storagePath,
          file_url: urlData.publicUrl,
          photo_type: input.photoType,
          notes: input.notes ?? null,
          measurements: input.measurements
            ? { width: input.measurements.width, height: input.measurements.height }
            : null,
          gps_latitude: input.gpsLatitude ?? null,
          gps_longitude: input.gpsLongitude ?? null,
          taken_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        // Best-effort cleanup: remove orphaned file from storage
        await supabase.storage.from("job-photos").remove([storagePath]);
        throw insertError;
      }

      return { photo: data as JobPhoto, jobId: input.jobId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-photos", result.jobId] });
      toast.success("Photo uploaded");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload photo: ${error.message}`);
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeletePhotoInput) => {
      // 1. Delete from storage
      const { error: storageError } = await supabase.storage
        .from("job-photos")
        .remove([input.storagePath]);
      if (storageError) throw storageError;

      // 2. Delete from database
      const { error: dbError } = await supabase
        .from("job_photos")
        .delete()
        .eq("id", input.photoId);
      if (dbError) throw dbError;

      return { jobId: input.jobId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-photos", result.jobId] });
      toast.success("Photo deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete photo: ${error.message}`);
    },
  });
}
