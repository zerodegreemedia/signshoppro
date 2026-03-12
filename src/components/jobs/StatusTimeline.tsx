import { CheckCircle2, Circle, Clock } from "lucide-react";
import { JOB_STATUSES } from "@/lib/constants";
import type { JobStatusHistory } from "@/types/database";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface StatusTimelineProps {
  currentStatus: string;
  history: JobStatusHistory[];
}

// Main workflow path (excluding branches like rejected/cancelled)
const MAIN_WORKFLOW = [
  "lead",
  "estimate_draft",
  "estimate_sent",
  "estimate_approved",
  "design_in_progress",
  "proof_sent",
  "proof_approved",
  "deposit_requested",
  "deposit_paid",
  "materials_ordered",
  "in_production",
  "install_scheduled",
  "install_complete",
  "invoice_sent",
  "paid",
  "completed",
] as const;

export function StatusTimeline({ currentStatus, history }: StatusTimelineProps) {
  const currentIndex = MAIN_WORKFLOW.indexOf(
    currentStatus as (typeof MAIN_WORKFLOW)[number]
  );

  // Build a map of status → timestamp from history
  const statusTimestamps = new Map<string, string>();
  for (const entry of history) {
    if (!statusTimestamps.has(entry.to_status)) {
      statusTimestamps.set(entry.to_status, entry.created_at);
    }
  }

  // If the status is a branch status, show it separately
  const isBranchStatus = currentIndex === -1;

  return (
    <div className="space-y-1">
      {isBranchStatus && (
        <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-3 mb-4">
          <Clock className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-medium">
              {JOB_STATUSES.find((s) => s.value === currentStatus)?.label ?? currentStatus}
            </p>
            {statusTimestamps.has(currentStatus) && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(statusTimestamps.get(currentStatus)!), "MMM d, yyyy h:mm a")}
              </p>
            )}
          </div>
        </div>
      )}

      {MAIN_WORKFLOW.map((status, index) => {
        const statusConfig = JOB_STATUSES.find((s) => s.value === status);
        const label = statusConfig?.label ?? status;
        const isCompleted = !isBranchStatus && index < currentIndex;
        const isCurrent = !isBranchStatus && index === currentIndex;
        const timestamp = statusTimestamps.get(status);

        return (
          <div key={status} className="flex items-start gap-3 relative">
            {/* Vertical connector line */}
            {index < MAIN_WORKFLOW.length - 1 && (
              <div
                className={cn(
                  "absolute left-[11px] top-[24px] w-0.5 h-[calc(100%)]",
                  isCompleted ? "bg-emerald-500" : "bg-border"
                )}
              />
            )}

            {/* Status icon */}
            <div className="shrink-0 z-10 bg-background">
              {isCompleted ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              ) : isCurrent ? (
                <Circle className="h-6 w-6 text-blue-500 fill-blue-500/20" />
              ) : (
                <Circle className="h-6 w-6 text-muted-foreground/30" />
              )}
            </div>

            {/* Status label + timestamp */}
            <div className="pb-4 min-w-0">
              <p
                className={cn(
                  "text-sm leading-6",
                  isCurrent && "font-semibold text-foreground",
                  isCompleted && "text-muted-foreground",
                  !isCompleted && !isCurrent && "text-muted-foreground/50"
                )}
              >
                {label}
              </p>
              {timestamp && (isCompleted || isCurrent) && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(timestamp), "MMM d, yyyy h:mm a")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
