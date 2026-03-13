import { Briefcase, FileText, DollarSign, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatsGridProps {
  stats:
    | {
        activeJobs: number;
        pendingEstimates: number;
        awaitingApproval: number;
        totalRevenue: number;
      }
    | undefined;
  isLoading: boolean;
}

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  const { isAdmin } = useAuth();

  const cards: StatCard[] = [
    {
      label: "Active Jobs",
      value: stats?.activeJobs ?? 0,
      icon: Briefcase,
      iconColor: "text-brand",
      iconBg: "bg-brand/10",
    },
    {
      label: "Pending Estimates",
      value: stats?.pendingEstimates ?? 0,
      icon: FileText,
      iconColor: "text-warning",
      iconBg: "bg-warning/10",
    },
    ...(isAdmin
      ? [
          {
            label: "This Month Revenue",
            value: (stats?.totalRevenue ?? 0).toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }),
            icon: DollarSign,
            iconColor: "text-success",
            iconBg: "bg-success/10",
          },
        ]
      : []),
    {
      label: "Awaiting Approval",
      value: stats?.awaitingApproval ?? 0,
      icon: Clock,
      iconColor: "text-danger",
      iconBg: "bg-danger/10",
    },
  ];

  return (
    <div
      className={cn(
        "grid gap-4 grid-cols-2",
        isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"
      )}
    >
      {cards.map((card) => (
        <Card
          key={card.label}
          className="hover-lift active-press cursor-default"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </span>
              <div className={cn("rounded-full p-2", card.iconBg)}>
                <card.icon className={cn("h-4 w-4", card.iconColor)} />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="text-3xl font-bold font-[family-name:var(--font-display)]">
                {card.value}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
