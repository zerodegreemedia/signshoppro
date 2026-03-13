import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Payment } from "@/types/database";
import { toast } from "sonner";

export function useJobPayments(jobId: string | undefined) {
  return useQuery({
    queryKey: ["payments", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("Job ID required");
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!jobId,
  });
}

export function useCreatePaymentLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke(
        "create-payment-link",
        {
          body: { job_id: jobId },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { payment_link_url: string; payment_link_id: string };
    },
    onSuccess: (_data, jobId) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["payments", jobId] });
      toast.success("Payment link created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create payment link: ${error.message}`);
    },
  });
}

export function useRecordManualPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      job_id: string;
      client_id: string;
      amount: number;
      payment_type: "deposit" | "progress" | "final";
      payment_method: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("payments")
        .insert({
          job_id: input.job_id,
          client_id: input.client_id,
          amount: input.amount,
          payment_type: input.payment_type,
          payment_method: input.payment_method,
          status: "completed" as const,
          notes: input.notes || null,
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as Payment;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["payments", variables.job_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["jobs", variables.job_id],
      });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Payment recorded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
}
