import { useJobStats, useJobs } from "@/hooks/useJobs";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import {
  NeedsAttentionPanel,
  ALL_ATTENTION_STATUSES,
} from "@/components/dashboard/NeedsAttentionPanel";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useJobStats();
  const { data: jobs } = useJobs();

  const allJobs = jobs ?? [];
  const attentionJobs = allJobs.filter((j) =>
    ALL_ATTENTION_STATUSES.includes(j.status)
  );

  return (
    <div className="space-y-6">
      <DashboardHero attentionCount={attentionJobs.length} />

      <StatsGrid stats={stats} isLoading={statsLoading} />

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <NeedsAttentionPanel jobs={allJobs} />
        <ActivityFeed jobs={allJobs} />
      </div>
    </div>
  );
}
