import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { JobStatusHistory } from "@/types/database";

export function useJobStatusHistory(jobId: string | undefined) {
  return useQuery<JobStatusHistory[]>({
    queryKey: ["job-status-history", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_status_history")
        .select("*")
        .eq("job_id", jobId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as JobStatusHistory[];
    },
    enabled: !!jobId,
  });
}
