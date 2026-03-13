import { useNavigate } from "react-router-dom";
import { Plus, Camera, FileText, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface DashboardHeroProps {
  attentionCount: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardHero({ attentionCount }: DashboardHeroProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-background to-brand-glow p-6 sm:p-8 noise-overlay">
      <div className="relative z-10 space-y-4">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-display)] tracking-tight">
            {getGreeting()}
            {firstName && (
              <>
                ,{" "}
                <span className="text-gradient-brand">{firstName}</span>
              </>
            )}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {attentionCount > 0
              ? `You have ${attentionCount} item${attentionCount === 1 ? "" : "s"} that need${attentionCount === 1 ? "s" : ""} attention`
              : "All caught up \u2014 nice work!"}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => navigate("/jobs/new")}
            className="gap-2"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            New Job
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate("/photos/capture")}
            className="gap-2"
            size="sm"
          >
            <Camera className="h-4 w-4" />
            Quick Photo
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate("/estimates/new")}
            className="gap-2"
            size="sm"
          >
            <FileText className="h-4 w-4" />
            New Estimate
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate("/jobs?search=true")}
            className="gap-2"
            size="sm"
          >
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>
      </div>
    </div>
  );
}
