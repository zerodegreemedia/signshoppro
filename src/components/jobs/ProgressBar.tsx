import { cn } from "@/lib/utils";

const STAGES = [
  { key: "lead", label: "Lead", statuses: ["lead"] },
  {
    key: "estimate",
    label: "Estimate",
    statuses: ["estimate_draft", "estimate_sent", "estimate_approved", "estimate_rejected"],
  },
  {
    key: "approved",
    label: "Approved",
    statuses: [
      "design_in_progress",
      "proof_sent",
      "proof_approved",
      "proof_revision_requested",
    ],
  },
  {
    key: "production",
    label: "Production",
    statuses: [
      "deposit_requested",
      "deposit_paid",
      "materials_ordered",
      "in_production",
    ],
  },
  {
    key: "install",
    label: "Install",
    statuses: ["install_scheduled", "install_complete"],
  },
  {
    key: "complete",
    label: "Complete",
    statuses: ["invoice_sent", "paid", "completed"],
  },
] as const;

function getCurrentStageIndex(status: string): number {
  const idx = STAGES.findIndex((stage) =>
    stage.statuses.includes(status as never)
  );
  return idx === -1 ? 0 : idx;
}

interface ProgressBarProps {
  status: string;
  onStageClick?: (stageKey: string) => void;
}

export function ProgressBar({ status, onStageClick }: ProgressBarProps) {
  const currentIndex = getCurrentStageIndex(status);
  const isTerminal = status === "cancelled" || status === "archived";

  return (
    <div className="flex items-center w-full gap-1" role="progressbar">
      {STAGES.map((stage, i) => {
        const isCompleted = !isTerminal && i < currentIndex;
        const isCurrent = !isTerminal && i === currentIndex;
        const isFuture = isTerminal || i > currentIndex;

        return (
          <button
            key={stage.key}
            type="button"
            onClick={() => onStageClick?.(stage.key)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 rounded-md transition-colors",
              "min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              onStageClick && "cursor-pointer hover:bg-muted/50",
              !onStageClick && "cursor-default"
            )}
          >
            {/* Dot indicator */}
            <div
              className={cn(
                "h-3 w-3 rounded-full transition-all",
                isCompleted && "bg-green-500",
                isCurrent && "bg-primary animate-pulse-glow",
                isFuture && "bg-muted-foreground/30"
              )}
            />
            {/* Connector line below each stage */}
            <div
              className={cn(
                "h-1 w-full rounded-full",
                isCompleted && "bg-green-500",
                isCurrent && "bg-primary",
                isFuture && "bg-muted-foreground/15"
              )}
            />
            {/* Label */}
            <span
              className={cn(
                "text-[10px] sm:text-xs font-medium leading-tight text-center",
                isCompleted && "text-green-600 dark:text-green-400",
                isCurrent && "text-primary font-semibold",
                isFuture && "text-muted-foreground/50"
              )}
            >
              {stage.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
