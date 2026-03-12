import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Proof } from "@/types/database";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

export interface UploadProofInput {
  file: File;
  jobId: string;
  internalNotes?: string;
}

export interface UpdateProofStatusInput {
  proofId: string;
  jobId: string;
  status: "approved" | "revision_requested";
  clientNotes?: string;
}

export function useJobProofs(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job-proofs", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("Job ID required");
      const { data, error } = await supabase
        .from("proofs")
        .select("*")
        .eq("job_id", jobId)
        .order("version", { ascending: false });
      if (error) throw error;
      return data as Proof[];
    },
    enabled: !!jobId,
  });
}

export function useUploadProof() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadProofInput) => {
      // 1. Get current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Not authenticated");

      // 2. Determine next version number
      const { data: existing, error: fetchError } = await supabase
        .from("proofs")
        .select("version")
        .eq("job_id", input.jobId)
        .order("version", { ascending: false })
        .limit(1);
      if (fetchError) throw fetchError;

      const nextVersion = (existing?.length ? (existing[0] as { version: number }).version : 0) + 1;

      // 3. Compress image if applicable (skip PDFs)
      let fileToUpload: File | Blob = input.file;
      const isImage = input.file.type.startsWith("image/");

      if (isImage && input.file.size > 5 * 1024 * 1024) {
        fileToUpload = await imageCompression(input.file, {
          maxSizeMB: 5,
          maxWidthOrHeight: 4096,
          useWebWorker: true,
        });
      }

      // 4. Upload to storage
      const ext = input.file.name.split(".").pop() ?? "jpg";
      const uuid = crypto.randomUUID();
      const storagePath = `${input.jobId}/v${nextVersion}/${uuid}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("proofs")
        .upload(storagePath, fileToUpload, {
          contentType: input.file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      // 5. Get public URL
      const { data: urlData } = supabase.storage
        .from("proofs")
        .getPublicUrl(storagePath);

      // 6. Insert DB record
      const { data, error: insertError } = await supabase
        .from("proofs")
        .insert({
          job_id: input.jobId,
          version: nextVersion,
          storage_path: storagePath,
          file_url: urlData.publicUrl,
          status: "pending" as const,
          internal_notes: input.internalNotes ?? null,
          sent_at: new Date().toISOString(),
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        await supabase.storage.from("proofs").remove([storagePath]);
        throw insertError;
      }

      return { proof: data as Proof, jobId: input.jobId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-proofs", result.jobId] });
      toast.success("Proof sent to client");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload proof: ${error.message}`);
    },
  });
}

export function useUpdateProofStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProofStatusInput) => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Not authenticated");

      const updates: Record<string, unknown> = {
        status: input.status,
      };

      if (input.status === "approved") {
        updates.approved_at = new Date().toISOString();
        updates.approved_by = user.id;
      }

      if (input.clientNotes) {
        updates.client_notes = input.clientNotes;
      }

      const { data, error } = await supabase
        .from("proofs")
        .update(updates)
        .eq("id", input.proofId)
        .select()
        .single();
      if (error) throw error;

      return { proof: data as Proof, jobId: input.jobId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-proofs", result.jobId] });
      const msg =
        result.proof.status === "approved"
          ? "Proof approved!"
          : "Revision requested — designer has been notified";
      toast.success(msg);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update proof: ${error.message}`);
    },
  });
}
