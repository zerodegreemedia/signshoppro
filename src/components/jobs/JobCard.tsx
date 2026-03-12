import { useNavigate } from "react-router-dom";
import {
  Car,
  Signpost,
  Flag,
  Printer,
  Shirt,
  Paintbrush,
  MoreHorizontal,
  Calendar,
  DollarSign,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import { RoleGate } from "@/components/auth/RoleGate";
import type { JobWithClient } from "@/hooks/useJobs";
import { format } from "date-fns";

const JOB_TYPE_ICONS: Record<string, React.ElementType> = {
  vehicle_wrap: Car,
  sign: Signpost,
  banner: Flag,
  print: Printer,
  apparel: Shirt,
  design_only: Paintbrush,
  other: MoreHorizontal,
};

interface JobCardProps {
  job: JobWithClient;
  index: number;
}

export function JobCard({ job, index }: JobCardProps) {
  const navigate = useNavigate();
  const Icon = JOB_TYPE_ICONS[job.job_type] ?? MoreHorizontal;

  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
      onClick={() => navigate(`/jobs/${job.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Job type icon */}
          <div className="shrink-0 rounded-lg bg-muted p-2.5">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Job info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">
                  #{String(index + 1).padStart(3, "0")}
                </p>
                <h3 className="font-semibold truncate">{job.title}</h3>
                {job.clients && (
                  <p className="text-sm text-muted-foreground truncate">
                    {job.clients.business_name}
                  </p>
                )}
              </div>
              <StatusBadge status={job.status} />
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {job.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(job.due_date), "MMM d")}
                </span>
              )}
              <RoleGate requiredRole="admin">
                {job.estimated_total != null && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {job.estimated_total.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </span>
                )}
              </RoleGate>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
