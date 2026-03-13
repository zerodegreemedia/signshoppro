import {
  DollarSign,
  FileCheck,
  Camera,
  Briefcase,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { JobWithClient } from "@/hooks/useJobs";
import { cn } from "@/lib/utils";

interface ActivityFeedProps {
  jobs: JobWithClient[];
}

interface ActivityItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  description: string;
  timestamp: Date;
}

const PAYMENT_STATUSES = ["paid", "deposit_paid"];
const PROOF_STATUSES = [
  "proof_sent",
  "proof_approved",
  "proof_revision_requested",
];
const PHOTO_STATUSES = ["design_in_progress"];

function categorizeJob(job: JobWithClient): ActivityItem {
  const status = job.status;
  const client = job.clients?.business_name ?? "a client";
  const label = status.replace(/_/g, " ");

  let icon: React.ComponentType<{ className?: string }> = Briefcase;
  let iconColor = "text-muted-foreground";

  if (PAYMENT_STATUSES.includes(status)) {
    icon = DollarSign;
    iconColor = "text-success";
  } else if (PROOF_STATUSES.includes(status)) {
    icon = FileCheck;
    iconColor = "text-blue-500";
  } else if (PHOTO_STATUSES.includes(status)) {
    icon = Camera;
    iconColor = "text-brand";
  }

  return {
    id: job.id,
    icon,
    iconColor,
    description: `${job.title} \u2014 ${label} (${client})`,
    timestamp: new Date(job.updated_at),
  };
}

export function ActivityFeed({ jobs }: ActivityFeedProps) {
  const items = jobs
    .map(categorizeJob)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-brand" />
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
          Recent Activity
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No recent activity yet.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 py-2.5 first:pt-0"
            >
              <item.icon
                className={cn("mt-0.5 h-4 w-4 shrink-0", item.iconColor)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug truncate">
                  {item.description}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
