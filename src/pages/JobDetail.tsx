import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Pencil,
  Building2,
  Mail,
  Phone,
  Car,
  Calendar,
  DollarSign,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useJob, useUpdateJob, useUpdateJobStatus } from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import { useJobStatusHistory } from "@/hooks/useJobStatusHistory";
import { useLineItems } from "@/hooks/useLineItems";
import { useJobPhotos } from "@/hooks/usePhotos";
import { useJobPayments } from "@/hooks/usePayments";
import { useJobProofs } from "@/hooks/useProofs";
import { mergeTimelineNodes } from "@/lib/timeline";
import { JOB_TYPES, PRIORITY_LEVELS, VEHICLE_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

import { StatusBadge } from "@/components/jobs/StatusBadge";
import { ProgressBar } from "@/components/jobs/ProgressBar";
import { JobTimeline } from "@/components/jobs/JobTimeline";
import { StickyActionBar } from "@/components/jobs/StickyActionBar";
import { RoleGate } from "@/components/auth/RoleGate";
import { LineItemEditor } from "@/components/estimates/LineItemEditor";
import QuickAddPresets from "@/components/estimates/QuickAddPresets";
import { PhotoCapture } from "@/components/photos/PhotoCapture";
import { PhotoGrid } from "@/components/photos/PhotoGrid";
import { PaymentLinkButton } from "@/components/payments/PaymentLinkButton";
import { PaymentHistory } from "@/components/payments/PaymentHistory";
import { RecordManualPayment } from "@/components/payments/RecordManualPayment";
import { ProofUpload } from "@/components/proofs/ProofUpload";
import { ProofViewer } from "@/components/proofs/ProofViewer";
import { ProofApproval } from "@/components/proofs/ProofApproval";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

// --- Edit schema ---
const editSchema = z.object({
  title: z.string().min(1, "Title is required"),
  job_type: z.string().min(1, "Job type is required"),
  priority: z.string(),
  due_date: z.string(),
  description: z.string(),
});
type EditFormValues = z.infer<typeof editSchema>;

function formatUSD(amount: number) {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// --- Side panel sections ---

type SidePanelSection = "info" | "client" | "vehicle" | "line-items" | "photos" | "proofs" | "payments";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [photoCaptureOpen, setPhotoCaptureOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SidePanelSection>("info");

  // Data hooks
  const { data: job, isLoading } = useJob(id);
  const { data: statusHistory } = useJobStatusHistory(id);
  const { data: photos } = useJobPhotos(id);
  const { data: lineItems } = useLineItems(id);
  const { data: payments, isLoading: paymentsLoading } = useJobPayments(id);
  const { data: proofs, isLoading: proofsLoading } = useJobProofs(id);
  const updateJob = useUpdateJob();
  const updateStatus = useUpdateJobStatus();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({ resolver: zodResolver(editSchema) });

  // --- Loading / Not found ---
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Job not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/jobs")}>
          Back to Jobs
        </Button>
      </div>
    );
  }

  // --- Derived data ---
  const vehicleDetails = job.job_vehicle_details?.[0];
  const vehiclePreset = VEHICLE_TYPES.find((v) => v.value === vehicleDetails?.vehicle_type);

  const timelineNodes = mergeTimelineNodes({
    statusHistory: statusHistory ?? job.job_status_history ?? [],
    photos: photos ?? [],
    proofs: proofs ?? [],
    payments: payments ?? [],
  });

  // --- Handlers ---
  const handleStatusChange = (newStatus: string) => {
    if (!user) return;
    updateStatus.mutate({ jobId: job.id, newStatus, changedBy: user.id });
  };

  const openEditDialog = () => {
    reset({
      title: job.title,
      job_type: job.job_type,
      priority: job.priority,
      due_date: job.due_date?.split("T")[0] ?? "",
      description: job.description ?? "",
    });
    setEditOpen(true);
  };

  const onEditSubmit = (values: EditFormValues) => {
    updateJob.mutate(
      {
        id: job.id,
        title: values.title,
        job_type: values.job_type,
        priority: values.priority,
        due_date: values.due_date || null,
        description: values.description || null,
      },
      { onSuccess: () => setEditOpen(false) }
    );
  };

  return (
    <div className="pb-24 md:pb-8">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/jobs")} className="gap-1 -ml-2 mb-3">
        <ArrowLeft className="h-4 w-4" />
        Jobs
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={job.status} />
            <span className="text-xs text-muted-foreground">
              {JOB_TYPES.find((t) => t.value === job.job_type)?.label}
            </span>
          </div>
          <h1 className="text-xl font-bold mt-1 truncate">{job.title}</h1>
          {job.clients && (
            <button
              type="button"
              onClick={() => navigate(`/clients/${job.clients!.id}`)}
              className="text-sm text-primary hover:underline mt-0.5"
            >
              {job.clients.business_name}
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={openEditDialog}>
          <Pencil className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress bar */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <ProgressBar status={job.status} />
        </CardContent>
      </Card>

      {/* Desktop: 3+2 grid | Mobile: single column */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Timeline column */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <JobTimeline
                nodes={timelineNodes}
                currentStatus={job.status}
                onNodeClick={(node) => {
                  if (node.type === "photo") setActiveSection("photos");
                  else if (node.type === "proof") setActiveSection("proofs");
                  else if (node.type === "payment") setActiveSection("payments");
                  else setActiveSection("info");
                }}
              />
            </CardContent>
          </Card>

          {/* Desktop sticky action bar */}
          <div className="hidden md:block">
            <StickyActionBar
              status={job.status}
              onAction={handleStatusChange}
              onEdit={openEditDialog}
              onDelete={() => handleStatusChange("archived")}
              isPending={updateStatus.isPending}
            />
          </div>
        </div>

        {/* Side panel (desktop: sticky, mobile: below timeline) */}
        <div className="md:col-span-2 md:sticky md:top-4 md:self-start space-y-4 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
          {/* Section tabs for side panel */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {(
              [
                { key: "info", label: "Info" },
                { key: "line-items", label: "Items" },
                { key: "photos", label: "Photos" },
                { key: "proofs", label: "Proofs" },
                { key: "payments", label: "Pay" },
              ] as { key: SidePanelSection; label: string }[]
            ).map((tab) => (
              <Button
                key={tab.key}
                variant={activeSection === tab.key ? "default" : "ghost"}
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => setActiveSection(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Job Info */}
          {activeSection === "info" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                    Job Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Priority</span>
                    <span className="font-medium capitalize">{job.priority}</span>
                  </div>
                  {job.due_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Due Date
                      </span>
                      <span className="font-medium">{formatDate(job.due_date, "medium")}</span>
                    </div>
                  )}
                  <RoleGate requiredRole="admin">
                    {job.estimated_total != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" /> Estimated Total
                        </span>
                        <span className="font-medium">{formatUSD(job.estimated_total)}</span>
                      </div>
                    )}
                  </RoleGate>
                  {job.description && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground text-xs mb-1">Description</p>
                      <p className="whitespace-pre-wrap">{job.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Client */}
              {job.clients && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                      Client
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{job.clients.business_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-4" />
                      {job.clients.contact_name}
                    </div>
                    {job.clients.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${job.clients.email}`} className="text-primary hover:underline">
                          {job.clients.email}
                        </a>
                      </div>
                    )}
                    {job.clients.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${job.clients.phone}`} className="text-primary hover:underline">
                          {job.clients.phone}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Vehicle Details */}
              {vehicleDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Car className="h-4 w-4" /> Vehicle Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {(vehicleDetails.year || vehicleDetails.make || vehicleDetails.model) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vehicle</span>
                        <span className="font-medium">
                          {[vehicleDetails.year, vehicleDetails.make, vehicleDetails.model].filter(Boolean).join(" ")}
                        </span>
                      </div>
                    )}
                    {vehicleDetails.color && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Color</span>
                        <span className="font-medium">{vehicleDetails.color}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{vehiclePreset?.label ?? vehicleDetails.vehicle_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Sqft</span>
                      <span className="font-medium">{vehicleDetails.total_sqft} sqft</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Coverage</span>
                      <span className="font-medium">{vehicleDetails.coverage_percentage}%</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Logo Tool */}
              <RoleGate requiredRole="admin">
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/ai/logo?jobId=${job.id}`}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Clean Up Client Logo
                  </Link>
                </Button>
              </RoleGate>
            </>
          )}

          {/* Line Items */}
          {activeSection === "line-items" && (
            <div className="space-y-4">
              <QuickAddPresets jobId={job.id} currentItemCount={lineItems?.length ?? 0} />
              <LineItemEditor jobId={job.id} taxRate={job.tax_rate ?? 0} isAdmin={isAdmin} />
            </div>
          )}

          {/* Photos */}
          {activeSection === "photos" && (
            <div className="space-y-4">
              <PhotoCapture
                jobId={job.id}
                clientId={job.client_id}
                open={photoCaptureOpen}
                onOpenChange={setPhotoCaptureOpen}
              />
              <PhotoGrid jobId={job.id} onAddPhoto={() => setPhotoCaptureOpen(true)} />
            </div>
          )}

          {/* Proofs */}
          {activeSection === "proofs" && (
            <div className="space-y-4">
              <RoleGate requiredRole="admin">
                <ProofUpload jobId={job.id} jobStatus={job.status} />
              </RoleGate>
              {proofs && proofs.length > 0 ? (
                <>
                  <ProofViewer proofs={proofs} isLoading={proofsLoading} />
                  <RoleGate requiredRole="client">
                    {proofs[0].status === "pending" && <ProofApproval proof={proofs[0]} jobId={job.id} />}
                    {proofs[0].status === "approved" && <ProofApproval proof={proofs[0]} jobId={job.id} />}
                  </RoleGate>
                </>
              ) : (
                !proofsLoading && (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <p className="font-medium">No Proofs Yet</p>
                      <p className="text-sm mt-1">
                        {isAdmin ? "Upload a proof above." : "No proofs have been uploaded yet."}
                      </p>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          )}

          {/* Payments */}
          {activeSection === "payments" && (
            <div className="space-y-4">
              <RoleGate requiredRole="admin">
                <PaymentSummaryCard
                  estimatedTotal={job.estimated_total}
                  depositAmount={job.deposit_amount}
                  payments={payments}
                  paymentStatus={job.payment_status}
                />
              </RoleGate>
              <PaymentLinkButton jobId={job.id} existingLink={job.stripe_payment_link ?? null} />
              <RecordManualPayment jobId={job.id} clientId={job.client_id} />
              <PaymentHistory payments={payments} isLoading={paymentsLoading} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div className="md:hidden">
        <StickyActionBar
          status={job.status}
          onAction={handleStatusChange}
          onEdit={openEditDialog}
          onDelete={() => handleStatusChange("archived")}
          isPending={updateStatus.isPending}
        />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_title">Title *</Label>
              <Input id="edit_title" {...register("title")} />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Job Type</Label>
              <Select value={watch("job_type")} onValueChange={(v) => setValue("job_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={watch("priority")} onValueChange={(v) => setValue("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_LEVELS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_due_date">Due Date</Label>
              <Input id="edit_due_date" type="date" {...register("due_date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea id="edit_description" {...register("description")} rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={updateJob.isPending}>
              {updateJob.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Payment Summary (kept inline, used only here) ---

function PaymentSummaryCard({
  estimatedTotal,
  depositAmount,
  payments,
  paymentStatus,
}: {
  estimatedTotal: number | null;
  depositAmount: number | null;
  payments: import("@/types/database").Payment[] | undefined;
  paymentStatus: string | null;
}) {
  const total = estimatedTotal ?? 0;
  const deposit = depositAmount ?? 0;
  const amountPaid = (payments ?? [])
    .filter((p) => p.status === "completed" && p.payment_type !== "refund")
    .reduce((sum, p) => sum + p.amount, 0);
  const balance = total - amountPaid;

  const statusColor =
    paymentStatus === "paid"
      ? "text-green-600"
      : amountPaid > 0
        ? "text-amber-600"
        : balance > 0
          ? "text-red-600"
          : "text-muted-foreground";

  const statusLabel =
    paymentStatus === "paid"
      ? "Paid"
      : amountPaid > 0
        ? "Partially Paid"
        : total > 0
          ? "Unpaid"
          : "No Estimate";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Payment Summary
          </CardTitle>
          <span className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Estimate</span>
          <span className="font-medium">{formatUSD(total)}</span>
        </div>
        {deposit > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deposit Required</span>
            <span className="font-medium">{formatUSD(deposit)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount Paid</span>
          <span className="font-medium text-green-600">{formatUSD(amountPaid)}</span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="font-medium">Balance Due</span>
          <span className={`font-bold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
            {formatUSD(Math.max(balance, 0))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
