import { useState } from "react";
import {
  ArrowRightLeft,
  Camera,
  FileImage,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { TimelineNode, TimelineNodeType } from "@/lib/timeline";
import type { JobPhoto } from "@/types/database";
import { Button } from "@/components/ui/button";

const TYPE_CONFIG: Record<
  TimelineNodeType,
  { color: string; dotColor: string; icon: React.ElementType }
> = {
  status: {
    color: "text-blue-600 dark:text-blue-400",
    dotColor: "bg-blue-500",
    icon: ArrowRightLeft,
  },
  photo: {
    color: "text-amber-600 dark:text-amber-400",
    dotColor: "bg-amber-500",
    icon: Camera,
  },
  proof: {
    color: "text-purple-600 dark:text-purple-400",
    dotColor: "bg-purple-500",
    icon: FileImage,
  },
  payment: {
    color: "text-green-600 dark:text-green-400",
    dotColor: "bg-green-500",
    icon: CreditCard,
  },
  estimate: {
    color: "text-cyan-600 dark:text-cyan-400",
    dotColor: "bg-cyan-500",
    icon: CreditCard,
  },
};

interface JobTimelineProps {
  nodes: TimelineNode[];
  currentStatus?: string;
  onNodeClick?: (node: TimelineNode) => void;
  onOpenEstimate?: () => void;
}

export function JobTimeline({ nodes, currentStatus, onNodeClick, onOpenEstimate }: JobTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (nodes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No timeline events yet.
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

      <div className="space-y-1">
        {nodes.map((node) => {
          const config = TYPE_CONFIG[node.type];
          const Icon = config.icon;
          const isExpanded = expandedIds.has(node.id);
          const isCurrentStatus =
            node.type === "status" && node.status === currentStatus;
          const hasExpandableContent =
            node.type === "photo" || node.type === "proof" || node.type === "payment";
          const isEstimateStatus =
            node.type === "status" &&
            node.status &&
            ["estimate_draft", "estimate_sent", "estimate_approved", "estimate_rejected"].includes(node.status);

          return (
            <div key={node.id} className="relative animate-fade-up">
              {/* Dot on the line */}
              <div
                className={cn(
                  "absolute -left-6 top-3 h-[10px] w-[10px] rounded-full border-2 border-background z-10",
                  config.dotColor,
                  isCurrentStatus && "animate-pulse-glow h-3 w-3 -left-[25px] top-[10px]"
                )}
              />

              {/* Card */}
              <button
                type="button"
                onClick={() => {
                  if (hasExpandableContent) toggleExpand(node.id);
                  onNodeClick?.(node);
                }}
                className={cn(
                  "w-full text-left rounded-lg border bg-card p-3 transition-colors",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hasExpandableContent && "cursor-pointer",
                  !hasExpandableContent && onNodeClick && "cursor-pointer",
                  !hasExpandableContent && !onNodeClick && "cursor-default"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{node.title}</p>
                      {node.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {node.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDate(node.timestamp, "short")}
                    </span>
                    {hasExpandableContent && (
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180"
                        )}
                      />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t">
                    <ExpandedContent node={node} />
                  </div>
                )}

                {/* Inline action button */}
                {node.actionButton && (
                  <div className="mt-2">
                    <span
                      className="text-xs text-primary font-medium hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        node.actionButton?.onClick?.();
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {node.actionButton.label}
                    </span>
                  </div>
                )}

                {/* Edit Estimate button */}
                {isEstimateStatus && onOpenEstimate && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEstimate();
                      }}
                    >
                      Edit Estimate
                    </Button>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExpandedContent({ node }: { node: TimelineNode }) {
  if (node.type === "photo") {
    const photo = node.data as JobPhoto;
    return (
      <div className="space-y-2">
        {photo.file_url && (
          <img
            src={photo.file_url}
            alt={photo.caption ?? "Job photo"}
            className="w-full max-w-xs rounded-md object-cover"
            loading="lazy"
          />
        )}
        {photo.measurements && Object.keys(photo.measurements).length > 0 && (
          <div className="text-xs text-muted-foreground">
            {Object.entries(photo.measurements).map(([k, v]) => (
              <span key={k} className="mr-3">
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (node.type === "proof") {
    const proof = node.data as { file_url: string; client_notes?: string | null; internal_notes?: string | null };
    return (
      <div className="space-y-2">
        {proof.file_url && (
          <img
            src={proof.file_url}
            alt="Proof"
            className="w-full max-w-xs rounded-md object-cover"
            loading="lazy"
          />
        )}
        {proof.client_notes && (
          <p className="text-xs text-muted-foreground">
            Client: {proof.client_notes}
          </p>
        )}
      </div>
    );
  }

  if (node.type === "payment") {
    const payment = node.data as {
      amount: number;
      payment_type: string;
      payment_method: string | null;
      status: string;
      paid_at: string | null;
    };
    return (
      <div className="grid grid-cols-2 gap-1 text-xs">
        <span className="text-muted-foreground">Type</span>
        <span className="capitalize">{payment.payment_type}</span>
        <span className="text-muted-foreground">Method</span>
        <span className="capitalize">{payment.payment_method ?? "—"}</span>
        <span className="text-muted-foreground">Status</span>
        <span className="capitalize">{payment.status}</span>
        {payment.paid_at && (
          <>
            <span className="text-muted-foreground">Paid</span>
            <span>{formatDate(payment.paid_at, "datetime")}</span>
          </>
        )}
      </div>
    );
  }

  return null;
}
