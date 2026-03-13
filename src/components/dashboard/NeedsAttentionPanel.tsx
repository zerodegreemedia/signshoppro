import { useNavigate } from "react-router-dom";
import { AlertCircle, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { JobWithClient } from "@/hooks/useJobs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NeedsAttentionPanelProps {
  jobs: JobWithClient[];
}

type Priority = "red" | "amber" | "green";

const PRIORITY_STATUSES: Record<Priority, string[]> = {
  red: ["proof_revision_requested", "estimate_rejected", "invoice_sent"],
  amber: [
    "lead",
    "estimate_draft",
    "deposit_requested",
    "install_complete",
  ],
  green: ["design_in_progress", "materials_ordered", "in_production"],
};

const ALL_ATTENTION_STATUSES = [
  ...PRIORITY_STATUSES.red,
  ...PRIORITY_STATUSES.amber,
  ...PRIORITY_STATUSES.green,
];

const STATUS_CTA: Record<string, string> = {
  lead: "Create Estimate",
  estimate_draft: "Finish Estimate",
  proof_revision_requested: "View Proof",
  deposit_requested: "Follow Up",
  materials_ordered: "Track Order",
  install_complete: "Send Invoice",
};

const PRIORITY_DOT: Record<Priority, string> = {
  red: "bg-danger",
  amber: "bg-warning",
  green: "bg-success",
};

const PRIORITY_ORDER: Priority[] = ["red", "amber", "green"];

function getPriority(status: string): Priority {
  for (const p of PRIORITY_ORDER) {
    if (PRIORITY_STATUSES[p].includes(status)) return p;
  }
  return "green";
}

function getContextLine(job: JobWithClient): string {
  const status = job.status.replace(/_/g, " ");
  const ago = formatDistanceToNow(new Date(job.updated_at), {
    addSuffix: true,
  });
  return `${status.charAt(0).toUpperCase() + status.slice(1)} \u2014 ${ago}`;
}

export function NeedsAttentionPanel({ jobs }: NeedsAttentionPanelProps) {
  const navigate = useNavigate();

  const attentionJobs = jobs
    .filter((j) => ALL_ATTENTION_STATUSES.includes(j.status))
    .sort((a, b) => {
      const pa = PRIORITY_ORDER.indexOf(getPriority(a.status));
      const pb = PRIORITY_ORDER.indexOf(getPriority(b.status));
      if (pa !== pb) return pa - pb;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-brand" />
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
          Needs Attention
        </h2>
        {attentionJobs.length > 0 && (
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            {attentionJobs.length} item{attentionJobs.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {attentionJobs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            Nothing needs your attention right now.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {attentionJobs.map((job) => {
            const priority = getPriority(job.status);
            const cta = STATUS_CTA[job.status];

            return (
              <div
                key={job.id}
                className="flex items-start gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                {/* Priority dot */}
                <div
                  className={cn(
                    "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    PRIORITY_DOT[priority]
                  )}
                />

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {job.clients?.business_name ?? job.clients?.contact_name ?? "Unknown client"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    {getContextLine(job)}
                  </p>
                </div>

                {/* CTA */}
                {cta && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    {cta}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { ALL_ATTENTION_STATUSES };
