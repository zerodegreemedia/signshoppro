import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Send, CreditCard } from "lucide-react";
import { useJob, useUpdateJob, useUpdateJobStatus } from "@/hooks/useJobs";
import { useLineItems } from "@/hooks/useLineItems";
import { useAuth } from "@/hooks/useAuth";
import {
  calculateLineItemTotals,
  DEFAULT_TAX_RATE,
} from "@/features/pricing/estimating-engine";
import type { LineItemForCalc } from "@/features/pricing/estimating-engine";
import { LineItemEditor } from "@/components/estimates/LineItemEditor";
import QuickAddPresets from "@/components/estimates/QuickAddPresets";
import { RoleGate } from "@/components/auth/RoleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function EstimateBuilder() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const { data: job, isLoading: jobLoading, error: jobError } = useJob(jobId);
  const { data: lineItems } = useLineItems(jobId);
  const updateJob = useUpdateJob();
  const updateStatus = useUpdateJobStatus();

  const taxRate = job?.tax_rate ?? DEFAULT_TAX_RATE;
  const currentItemCount = lineItems?.length ?? 0;

  const grandTotal = lineItems
    ? calculateLineItemTotals(
        lineItems.map(
          (li): LineItemForCalc => ({
            quantity: li.quantity,
            unit_price: li.unit_price,
            cost_price: li.cost_price,
            taxable: li.taxable ?? true,
            subtotal: li.subtotal,
          })
        ),
        taxRate
      ).grandTotal
    : 0;

  const handleSaveDraft = () => {
    if (!job || !user) return;

    const updates: Parameters<typeof updateJob.mutate>[0] = {
      id: job.id,
      estimated_total: grandTotal,
    };

    if (job.status === "lead") {
      updateJob.mutate(updates, {
        onSuccess: () => {
          updateStatus.mutate({
            jobId: job.id,
            newStatus: "estimate_draft",
            changedBy: user.id,
          });
        },
      });
    } else {
      updateJob.mutate(updates);
    }
  };

  const handleSendToClient = () => {
    if (!job || !user) return;
    updateStatus.mutate({
      jobId: job.id,
      newStatus: "estimate_sent",
      changedBy: user.id,
    });
  };

  const isSaving = updateJob.isPending || updateStatus.isPending;

  if (jobLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (jobError || !job) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Job not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/jobs")}
        >
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 pb-8">
        {/* Back button + title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/jobs/${job.id}`)}
            className="gap-1 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-lg font-bold">Estimate Builder</h1>
        </div>

        {/* Job info card */}
        <Card>
          <CardContent className="p-4 space-y-1">
            {job.clients && (
              <p className="text-sm text-muted-foreground">
                Client:{" "}
                <span className="font-medium text-foreground">
                  {job.clients.business_name}
                  {job.clients.contact_name
                    ? ` — ${job.clients.contact_name}`
                    : ""}
                </span>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Job:{" "}
              <span className="font-medium text-foreground">{job.title}</span>
            </p>
          </CardContent>
        </Card>

        {/* Quick-add preset buttons */}
        <QuickAddPresets jobId={job.id} currentItemCount={currentItemCount} />

        {/* Line item editor (includes totals footer) */}
        <LineItemEditor
          jobId={job.id}
          taxRate={taxRate}
          isAdmin={isAdmin}
        />

        {/* Action buttons */}
        <div className="space-y-2">
          <Button
            className="w-full gap-2"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Draft
          </Button>

          <Button
            className="w-full gap-2"
            onClick={handleSendToClient}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send to Client
          </Button>

          <RoleGate requiredRole="admin">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full">
                  <Button
                    className="w-full gap-2"
                    variant="secondary"
                    disabled
                  >
                    <CreditCard className="h-4 w-4" />
                    Generate Payment Link
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming in Phase 7</TooltipContent>
            </Tooltip>
          </RoleGate>
        </div>
      </div>
    </TooltipProvider>
  );
}
