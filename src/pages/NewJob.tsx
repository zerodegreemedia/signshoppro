import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClients, useCreateClient } from "@/hooks/useClients";
import { useCreateJob } from "@/hooks/useJobs";
import { ClientForm } from "@/components/clients/ClientForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  JOB_TYPES,
  PRIORITY_LEVELS,
  VEHICLE_TYPES,
} from "@/lib/constants";
import type { Client } from "@/types/database";

const WRAP_COVERAGE = [
  { value: "full", label: "Full Wrap" },
  { value: "three_quarter", label: "3/4 Wrap" },
  { value: "half", label: "Half Wrap" },
  { value: "partial", label: "Partial Wrap" },
  { value: "spot_graphics", label: "Spot Graphics" },
  { value: "lettering", label: "Lettering Only" },
] as const;

const jobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  job_type: z.string().min(1, "Job type is required"),
  priority: z.string(),
  due_date: z.string(),
  description: z.string(),
  vehicle_year: z.string(),
  vehicle_make: z.string(),
  vehicle_model: z.string(),
  vehicle_color: z.string(),
  vehicle_type: z.string(),
  wrap_coverage: z.string(),
});

type JobFormValues = z.infer<typeof jobSchema>;

export default function NewJob() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  const { data: clients } = useClients(clientSearch || undefined);
  const createClient = useCreateClient();
  const createJob = useCreateJob();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: "",
      job_type: "",
      priority: "normal",
      due_date: "",
      description: "",
      vehicle_year: "",
      vehicle_make: "",
      vehicle_model: "",
      vehicle_color: "",
      vehicle_type: "",
      wrap_coverage: "",
    },
  });

  const jobType = watch("job_type");
  const vehicleType = watch("vehicle_type");
  const isVehicleWrap = jobType === "vehicle_wrap";

  // Determine step count
  const totalSteps = isVehicleWrap ? 3 : 2;

  const handleCreateClient = (values: {
    business_name: string;
    contact_name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    notes?: string;
  }) => {
    if (!user) return;
    createClient.mutate(
      {
        business_name: values.business_name,
        contact_name: values.contact_name,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        city: values.city || null,
        state: values.state || null,
        zip: values.zip || null,
        notes: values.notes || null,
        created_by: user.id,
      },
      {
        onSuccess: (data) => {
          setSelectedClient(data);
          setClientDialogOpen(false);
          setStep(2);
        },
      }
    );
  };

  const onSubmit = (values: JobFormValues) => {
    if (!user || !selectedClient) return;

    const selectedVehicle = VEHICLE_TYPES.find(
      (v) => v.value === values.vehicle_type
    );
    const coveragePercent =
      values.wrap_coverage === "full"
        ? 100
        : values.wrap_coverage === "three_quarter"
          ? 75
          : values.wrap_coverage === "half"
            ? 50
            : values.wrap_coverage === "partial"
              ? 30
              : values.wrap_coverage === "spot_graphics"
                ? 15
                : values.wrap_coverage === "lettering"
                  ? 10
                  : 100;

    createJob.mutate(
      {
        title: values.title,
        client_id: selectedClient.id,
        job_type: values.job_type,
        status: "lead",
        priority: values.priority,
        due_date: values.due_date || null,
        description: values.description || null,
        created_by: user.id,
        ...(isVehicleWrap
          ? {
              vehicle_details: {
                vehicle_type: values.vehicle_type || "sedan",
                year: values.vehicle_year
                  ? parseInt(values.vehicle_year)
                  : null,
                make: values.vehicle_make || null,
                model: values.vehicle_model || null,
                color: values.vehicle_color || null,
                total_sqft: selectedVehicle?.defaultSqft ?? 200,
                coverage_percentage: coveragePercent,
              },
            }
          : {}),
      },
      {
        onSuccess: (data) => navigate(`/jobs/${data.id}`),
      }
    );
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (step > 1) {
              setStep(step - 1);
            } else {
              navigate("/jobs");
            }
          }}
          className="-ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">New Job</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Select Client */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {clients?.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedClient?.id === client.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedClient(client)}
                  >
                    <p className="font-medium">{client.business_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {client.contact_name}
                    </p>
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setClientDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Client
              </Button>
            </CardContent>
          </Card>

          <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur border-t md:relative md:bottom-auto md:p-0 md:bg-transparent md:border-none z-40">
            <Button
              className="w-full"
              disabled={!selectedClient}
              onClick={() => setStep(2)}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Job Details */}
      {step === 2 && (
        <form
          onSubmit={
            isVehicleWrap
              ? (e) => {
                  e.preventDefault();
                  setStep(3);
                }
              : handleSubmit(onSubmit)
          }
          className="space-y-4"
        >
          {selectedClient && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              Client: <strong>{selectedClient.business_name}</strong>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  {...register("title")}
                  placeholder="e.g., Full Vehicle Wrap - Ford Transit"
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Job Type *</Label>
                <Select
                  value={jobType}
                  onValueChange={(v) => setValue("job_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.job_type && (
                  <p className="text-sm text-destructive">{errors.job_type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={watch("priority")}
                  onValueChange={(v) => setValue("priority", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_LEVELS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input id="due_date" type="date" {...register("due_date")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Any notes about this job..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur border-t md:relative md:bottom-auto md:p-0 md:bg-transparent md:border-none z-40">
            <Button type="submit" className="w-full" disabled={createJob.isPending}>
              {createJob.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isVehicleWrap ? (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Create Job
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Step 3: Vehicle Details (vehicle_wrap only) */}
      {step === 3 && isVehicleWrap && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vehicle Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_year">Year</Label>
                  <Input
                    id="vehicle_year"
                    {...register("vehicle_year")}
                    placeholder="2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicle_make">Make</Label>
                  <Input
                    id="vehicle_make"
                    {...register("vehicle_make")}
                    placeholder="Ford"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_model">Model</Label>
                  <Input
                    id="vehicle_model"
                    {...register("vehicle_model")}
                    placeholder="Transit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicle_color">Color</Label>
                  <Input
                    id="vehicle_color"
                    {...register("vehicle_color")}
                    placeholder="White"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <Select
                  value={vehicleType}
                  onValueChange={(v) => setValue("vehicle_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label} ({v.defaultSqft} sqft)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Wrap Coverage</Label>
                <Select
                  value={watch("wrap_coverage")}
                  onValueChange={(v) => setValue("wrap_coverage", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select coverage" />
                  </SelectTrigger>
                  <SelectContent>
                    {WRAP_COVERAGE.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur border-t md:relative md:bottom-auto md:p-0 md:bg-transparent md:border-none z-40">
            <Button type="submit" className="w-full" disabled={createJob.isPending}>
              {createJob.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Check className="mr-2 h-4 w-4" />
              Create Job
            </Button>
          </div>
        </form>
      )}

      {/* Add Client Dialog */}
      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSubmit={handleCreateClient}
            isLoading={createClient.isPending}
            submitLabel="Add Client"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
