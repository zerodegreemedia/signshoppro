import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Job, Client, JobStatusHistory, JobVehicleDetails } from "@/types/database";
import { toast } from "sonner";

export interface JobWithClient extends Job {
  clients: Pick<Client, "id" | "business_name" | "contact_name" | "email" | "phone"> | null;
}

export interface JobWithDetails extends JobWithClient {
  job_vehicle_details: JobVehicleDetails[];
  job_status_history: JobStatusHistory[];
}

export interface JobInsertInput {
  title: string;
  client_id: string;
  job_type: string;
  status: string;
  priority: string;
  created_by: string;
  description?: string | null;
  due_date?: string | null;
  estimated_total?: number | null;
  cost_total?: number | null;
  deposit_amount?: number | null;
  deposit_paid?: boolean;
  payment_status?: string | null;
  install_date?: string | null;
  install_address?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
  vehicle_details?: VehicleDetailsInput;
}

export interface VehicleDetailsInput {
  vehicle_type: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  total_sqft: number;
  coverage_percentage: number;
  material_type?: string | null;
  complexity?: string | null;
  notes?: string | null;
}

interface JobFilters {
  status?: string;
  client_id?: string;
  search?: string;
  statusCategory?: "all" | "active" | "estimates" | "production" | "completed";
}

const STATUS_CATEGORIES: Record<string, string[]> = {
  active: [
    "lead",
    "design_in_progress",
    "deposit_requested",
    "deposit_paid",
    "materials_ordered",
    "in_production",
    "install_scheduled",
  ],
  estimates: [
    "estimate_draft",
    "estimate_sent",
    "estimate_approved",
    "estimate_rejected",
  ],
  production: [
    "materials_ordered",
    "in_production",
    "install_scheduled",
    "install_complete",
  ],
  completed: ["completed", "paid", "invoice_sent"],
};

export function useJobs(filters?: JobFilters) {
  return useQuery({
    queryKey: ["jobs", filters],
    queryFn: async () => {
      let query = supabase
        .from("jobs")
        .select("*, clients(id, business_name, contact_name, email, phone)")
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.client_id) {
        query = query.eq("client_id", filters.client_id);
      }

      if (filters?.statusCategory && filters.statusCategory !== "all") {
        const statuses = STATUS_CATEGORIES[filters.statusCategory];
        if (statuses) {
          query = query.in("status", statuses);
        }
      }

      if (filters?.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as JobWithClient[];
    },
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: async () => {
      if (!id) throw new Error("Job ID required");
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "*, clients(id, business_name, contact_name, email, phone), job_vehicle_details(*), job_status_history(*)"
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as JobWithDetails;
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: JobInsertInput) => {
      const { vehicle_details, ...jobData } = input;

      const { data: newJob, error: jobError } = await supabase
        .from("jobs")
        .insert(jobData)
        .select()
        .single();
      if (jobError) throw jobError;

      const createdJob = newJob as Job;

      if (vehicle_details) {
        const { error: vehicleError } = await supabase
          .from("job_vehicle_details")
          .insert({
            ...vehicle_details,
            job_id: createdJob.id,
          });
        if (vehicleError) throw vehicleError;
      }

      const { error: historyError } = await supabase
        .from("job_status_history")
        .insert({
          job_id: createdJob.id,
          from_status: null,
          to_status: jobData.status || "lead",
          changed_by: jobData.created_by,
        });
      if (historyError) throw historyError;

      return createdJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-stats"] });
      toast.success("Job created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create job: ${error.message}`);
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("jobs")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Job;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs", data.id] });
      queryClient.invalidateQueries({ queryKey: ["job-stats"] });
      toast.success("Job updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update job: ${error.message}`);
    },
  });
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      newStatus,
      changedBy,
      notes,
    }: {
      jobId: string;
      newStatus: string;
      changedBy: string;
      notes?: string;
    }) => {
      const { data: currentJob, error: fetchError } = await supabase
        .from("jobs")
        .select("status")
        .eq("id", jobId)
        .single();
      if (fetchError) throw fetchError;

      const { data, error } = await supabase
        .from("jobs")
        .update({ status: newStatus })
        .eq("id", jobId)
        .select()
        .single();
      if (error) throw error;

      const { error: historyError } = await supabase
        .from("job_status_history")
        .insert({
          job_id: jobId,
          from_status: (currentJob as { status: string }).status,
          to_status: newStatus,
          changed_by: changedBy,
          notes: notes ?? null,
        });
      if (historyError) throw historyError;

      return data as Job;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs", data.id] });
      queryClient.invalidateQueries({ queryKey: ["job-stats"] });
      toast.success("Job status updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "archived" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-stats"] });
      toast.success("Job archived successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to archive job: ${error.message}`);
    },
  });
}

export function useJobStats() {
  return useQuery({
    queryKey: ["job-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("status, estimated_total");
      if (error) throw error;

      const jobs = data as Pick<Job, "status" | "estimated_total">[];
      const activeStatuses = STATUS_CATEGORIES.active;
      const estimateStatuses = ["estimate_draft", "estimate_sent"];
      const awaitingApproval = ["estimate_sent", "proof_sent"];

      return {
        activeJobs: jobs.filter((j) => activeStatuses.includes(j.status)).length,
        pendingEstimates: jobs.filter((j) => estimateStatuses.includes(j.status)).length,
        awaitingApproval: jobs.filter((j) => awaitingApproval.includes(j.status)).length,
        completedJobs: jobs.filter((j) => j.status === "completed").length,
        totalRevenue: jobs
          .filter((j) => ["paid", "completed"].includes(j.status))
          .reduce((sum, j) => sum + (j.estimated_total || 0), 0),
      };
    },
  });
}
