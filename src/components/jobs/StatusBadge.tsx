import { Badge } from "@/components/ui/badge";
import { JOB_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const colorMap: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  blue: "bg-blue-500/15 text-blue-700 border-blue-500/20 dark:text-blue-400",
  amber: "bg-amber-500/15 text-amber-700 border-amber-500/20 dark:text-amber-400",
  red: "bg-red-500/15 text-red-700 border-red-500/20 dark:text-red-400",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = JOB_STATUSES.find((s) => s.value === status);
  const label = statusConfig?.label ?? status;
  const color = statusConfig?.color ?? "blue";

  return (
    <Badge
      variant="outline"
      className={cn(colorMap[color], "text-xs font-medium", className)}
    >
      {label}
    </Badge>
  );
}
