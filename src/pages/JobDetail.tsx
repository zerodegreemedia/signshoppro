import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Pencil,
  ChevronDown,
  Building2,
  Mail,
  Phone,
  Car,
  Calendar,
  CreditCard,
  ClipboardList,
  DollarSign,
  Image,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useJob, useUpdateJob, useUpdateJobStatus } from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import { LineItemEditor } from "@/components/estimates/LineItemEditor";
import QuickAddPresets from "@/components/estimates/QuickAddPresets";
import { useLineItems } from "@/hooks/useLineItems";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import { StatusTimeline } from "@/components/jobs/StatusTimeline";
import { RoleGate } from "@/components/auth/RoleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JOB_TYPES, PRIORITY_LEVELS, VEHICLE_TYPES } from "@/lib/constants";
import { PhotoCapture } from "@/components/photos/PhotoCapture";
import { PhotoGrid } from "@/components/photos/PhotoGrid";
import { PaymentLinkButton } from "@/components/payments/PaymentLinkButton";
import { PaymentHistory } from "@/components/payments/PaymentHistory";
import { RecordManualPayment } from "@/components/payments/RecordManualPayment";
import { ProofUpload } from "@/components/proofs/ProofUpload";
import { ProofViewer } from "@/components/proofs/ProofViewer";
import { ProofApproval } from "@/components/proofs/ProofApproval";
import { useJobPhotos } from "@/hooks/usePhotos";
import { useJobPayments } from "@/hooks/usePayments";
import { useJobProofs } from "@/hooks/useProofs";
import { format } from "date-fns";

// Status transition map: current status → available next statuses
const STATUS_TRANSITIONS: Record<string, { label: string; value: string }[]> = {
  lead: [{ label: "Create Estimate", value: "estimate_draft" }],
  estimate_draft: [{ label: "Send Estimate", value: "estimate_sent" }],
  estimate_sent: [
    { label: "Mark Approved", value: "estimate_approved" },
    { label: "Mark Rejected", value: "estimate_rejected" },
  ],
  estimate_approved: [{ label: "Start Design", value: "design_in_progress" }],
  estimate_rejected: [{ label: "Revise Estimate", value: "estimate_draft" }],
  design_in_progress: [{ label: "Send Proof", value: "proof_sent" }],
  proof_sent: [
    { label: "Mark Approved", value: "proof_approved" },
    { label: "Revision Requested", value: "proof_revision_requested" },
  ],
  proof_revision_requested: [{ label: "Send New Proof", value: "proof_sent" }],
  proof_approved: [{ label: "Request Deposit", value: "deposit_requested" }],
  deposit_requested: [{ label: "Deposit Paid", value: "deposit_paid" }],
  deposit_paid: [{ label: "Order Materials", value: "materials_ordered" }],
  materials_ordered: [{ label: "Start Production", value: "in_production" }],
  in_production: [{ label: "Schedule Install", value: "install_scheduled" }],
  install_scheduled: [{ label: "Install Complete", value: "install_complete" }],
  install_complete: [{ label: "Send Invoice", value: "invoice_sent" }],
  invoice_sent: [{ label: "Mark Paid", value: "paid" }],
  paid: [{ label: "Complete Job", value: "completed" }],
};

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
          <span className={`text-sm font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
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

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [photoCaptureOpen, setPhotoCaptureOpen] = useState(false);

  const { data: job, isLoading } = useJob(id);
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
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
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

  const transitions = STATUS_TRANSITIONS[job.status] ?? [];
  const vehicleDetails = job.job_vehicle_details?.[0];
  const vehiclePreset = VEHICLE_TYPES.find(
    (v) => v.value === vehicleDetails?.vehicle_type
  );

  const handleStatusChange = (newStatus: string) => {
    if (!user) return;
    updateStatus.mutate({
      jobId: job.id,
      newStatus,
      changedBy: user.id,
    });
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
    <div className="space-y-4 pb-8">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/jobs")}
        className="gap-1 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Jobs
      </Button>

      {/* Header card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
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

          {/* Status action */}
          {transitions.length > 0 && (
            <div className="mt-4">
              {transitions.length === 1 ? (
                <Button
                  className="w-full"
                  onClick={() => handleStatusChange(transitions[0].value)}
                  disabled={updateStatus.isPending}
                >
                  {updateStatus.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {transitions[0].label}
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="w-full" disabled={updateStatus.isPending}>
                      {updateStatus.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Update Status
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {transitions.map((t) => (
                      <DropdownMenuItem
                        key={t.value}
                        onClick={() => handleStatusChange(t.value)}
                      >
                        {t.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1 text-xs sm:text-sm gap-1.5">
            <ClipboardList className="h-3.5 w-3.5 sm:hidden" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="line-items" className="flex-1 text-xs sm:text-sm gap-1.5">
            <DollarSign className="h-3.5 w-3.5 sm:hidden" />
            <span className="hidden sm:inline">Line Items</span>
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex-1 text-xs sm:text-sm gap-1.5">
            <Image className="h-3.5 w-3.5 sm:hidden" />
            <span className="hidden sm:inline">Photos{photos?.length ? ` (${photos.length})` : ""}</span>
          </TabsTrigger>
          <TabsTrigger value="proofs" className="flex-1 text-xs sm:text-sm gap-1.5">
            <Sparkles className="h-3.5 w-3.5 sm:hidden" />
            <span className="hidden sm:inline">Proofs{proofs?.length ? ` (${proofs.length})` : ""}</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex-1 text-xs sm:text-sm gap-1.5">
            <CreditCard className="h-3.5 w-3.5 sm:hidden" />
            <span className="hidden sm:inline">Payments</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Job Info */}
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
                    <Calendar className="h-3.5 w-3.5" />
                    Due Date
                  </span>
                  <span className="font-medium">
                    {format(new Date(job.due_date), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              <RoleGate requiredRole="admin">
                {job.estimated_total != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Estimated Total
                    </span>
                    <span className="font-medium">
                      {job.estimated_total.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </span>
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

          {/* Client Info */}
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
                    <a
                      href={`mailto:${job.clients.email}`}
                      className="text-primary hover:underline"
                    >
                      {job.clients.email}
                    </a>
                  </div>
                )}
                {job.clients.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${job.clients.phone}`}
                      className="text-primary hover:underline"
                    >
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
                  <Car className="h-4 w-4" />
                  Vehicle Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {(vehicleDetails.year || vehicleDetails.make || vehicleDetails.model) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle</span>
                    <span className="font-medium">
                      {[vehicleDetails.year, vehicleDetails.make, vehicleDetails.model]
                        .filter(Boolean)
                        .join(" ")}
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
                  <span className="font-medium">
                    {vehiclePreset?.label ?? vehicleDetails.vehicle_type}
                  </span>
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

          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                Status Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline
                currentStatus={job.status}
                history={job.job_status_history ?? []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Line Items Tab */}
        <TabsContent value="line-items" className="mt-4 space-y-4">
          <QuickAddPresets
            jobId={job.id}
            currentItemCount={lineItems?.length ?? 0}
          />
          <LineItemEditor
            jobId={job.id}
            taxRate={job.tax_rate ?? 0}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="photos" className="mt-4 space-y-4">
          {job && (
            <>
              <PhotoCapture
                jobId={job.id}
                clientId={job.client_id}
                open={photoCaptureOpen}
                onOpenChange={setPhotoCaptureOpen}
              />
              <PhotoGrid
                jobId={job.id}
                onAddPhoto={() => setPhotoCaptureOpen(true)}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="proofs" className="mt-4 space-y-4">
          {/* Admin: Upload proof */}
          <RoleGate requiredRole="admin">
            <ProofUpload jobId={job.id} jobStatus={job.status} />
          </RoleGate>

          {/* Proof viewer for all roles */}
          {proofs && proofs.length > 0 ? (
            <>
              <ProofViewer proofs={proofs} isLoading={proofsLoading} />

              {/* Client: Approve / request changes on latest pending proof */}
              <RoleGate requiredRole="client">
                {proofs[0].status === "pending" && (
                  <ProofApproval proof={proofs[0]} jobId={job.id} />
                )}
                {proofs[0].status === "revision_requested" && (
                  <Card>
                    <CardContent className="py-4">
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                        Changes requested — the designer is working on a new version.
                      </p>
                    </CardContent>
                  </Card>
                )}
                {proofs[0].status === "approved" && (
                  <ProofApproval proof={proofs[0]} jobId={job.id} />
                )}
              </RoleGate>

              {/* Admin: Show status timeline for proof iterations */}
              <RoleGate requiredRole="admin">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                      Proof History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {proofs.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">v{p.version}</span>
                            <StatusBadge
                              status={
                                p.status === "pending"
                                  ? "proof_sent"
                                  : p.status === "approved"
                                    ? "proof_approved"
                                    : "proof_revision_requested"
                              }
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(p.created_at), "MMM d, h:mm a")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </RoleGate>
            </>
          ) : (
            !proofsLoading && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Image className="mx-auto h-10 w-10 mb-3 opacity-40" />
                    <p className="font-medium">No Proofs Yet</p>
                    <p className="text-sm mt-1">
                      {isAdmin
                        ? "Upload a proof above to send it to the client."
                        : "No proofs have been uploaded for this job yet."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-4">
          {/* Payment Summary */}
          <RoleGate requiredRole="admin">
            <PaymentSummaryCard
              estimatedTotal={job.estimated_total}
              depositAmount={job.deposit_amount}
              payments={payments}
              paymentStatus={job.payment_status}
            />
          </RoleGate>

          {/* Generate / Show Payment Link */}
          <PaymentLinkButton
            jobId={job.id}
            existingLink={job.stripe_payment_link ?? null}
          />

          {/* Record Manual Payment */}
          <RecordManualPayment jobId={job.id} clientId={job.client_id} />

          {/* Payment History */}
          <PaymentHistory payments={payments} isLoading={paymentsLoading} />
        </TabsContent>
      </Tabs>

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
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Job Type</Label>
              <Select
                value={watch("job_type")}
                onValueChange={(v) => setValue("job_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="edit_due_date">Due Date</Label>
              <Input id="edit_due_date" type="date" {...register("due_date")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea id="edit_description" {...register("description")} rows={3} />
            </div>

            <Button type="submit" className="w-full" disabled={updateJob.isPending}>
              {updateJob.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
