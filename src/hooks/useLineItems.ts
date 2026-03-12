import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { LineItem } from "@/types/database";
import { toast } from "sonner";

export interface LineItemInsertInput {
  job_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  cost_price?: number | null;
  unit?: string | null;
  category?: string;
  taxable?: boolean;
  notes?: string | null;
  sort_order: number;
}

export function useLineItems(jobId: string | undefined) {
  return useQuery({
    queryKey: ["line-items", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("Job ID required");
      const { data, error } = await supabase
        .from("line_items")
        .select("*")
        .eq("job_id", jobId)
        .order("sort_order");
      if (error) throw error;
      return data as LineItem[];
    },
    enabled: !!jobId,
  });
}

export function useCreateLineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: LineItemInsertInput) => {
      const { data, error } = await supabase
        .from("line_items")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data as LineItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["line-items", data.job_id] });
      toast.success("Line item added");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add line item: ${error.message}`);
    },
  });
}

export function useUpdateLineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      job_id,
      ...updates
    }: { id: string; job_id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("line_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return { ...(data as LineItem), job_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["line-items", data.job_id] });
      toast.success("Line item updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update line item: ${error.message}`);
    },
  });
}

export function useDeleteLineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, job_id }: { id: string; job_id: string }) => {
      const { error } = await supabase.from("line_items").delete().eq("id", id);
      if (error) throw error;
      return { job_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["line-items", data.job_id] });
      toast.success("Line item removed");
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove line item: ${error.message}`);
    },
  });
}

export function useBulkCreateLineItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: LineItemInsertInput[]) => {
      const { data, error } = await supabase
        .from("line_items")
        .insert(items)
        .select();
      if (error) throw error;
      return data as LineItem[];
    },
    onSuccess: (data) => {
      if (data.length > 0) {
        queryClient.invalidateQueries({
          queryKey: ["line-items", data[0].job_id],
        });
      }
      toast.success(`${data.length} line items added`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add line items: ${error.message}`);
    },
  });
}
