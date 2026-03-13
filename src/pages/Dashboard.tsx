import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  FileText,
  Clock,
  DollarSign,
  PlusCircle,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useJobStats, useJobs } from "@/hooks/useJobs";
import { JobCard } from "@/components/jobs/JobCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickPhotoButton } from "@/components/photos/QuickPhotoButton";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useJobStats();
  const { data: recentJobs, isLoading: jobsLoading } = useJobs();

  const adminCards = [
    {
      title: "Active Jobs",
      value: stats?.activeJobs ?? 0,
      description: "Currently in progress",
      icon: Briefcase,
      iconColor: "text-brand",
      iconBg: "bg-brand/10",
      featured: true,
    },
    {
      title: "Pending Estimates",
      value: stats?.pendingEstimates ?? 0,
      description: "Drafts & sent",
      icon: FileText,
      iconColor: "text-warning",
      iconBg: "bg-warning/10",
    },
    {
      title: "Awaiting Approval",
      value: stats?.awaitingApproval ?? 0,
      description: "Proofs & estimates",
      icon: Clock,
      iconColor: "text-danger",
      iconBg: "bg-danger/10",
    },
    {
      title: "Revenue",
      value: (stats?.totalRevenue ?? 0).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
      description: "Completed & paid jobs",
      icon: DollarSign,
      iconColor: "text-success",
      iconBg: "bg-success/10",
    },
  ];

  const clientCards = [
    {
      title: "My Active Jobs",
      value: stats?.activeJobs ?? 0,
      description: "Currently in progress",
      icon: Briefcase,
      iconColor: "text-brand",
      iconBg: "bg-brand/10",
    },
    {
      title: "Awaiting My Approval",
      value: stats?.awaitingApproval ?? 0,
      description: "Proofs & estimates",
      icon: Clock,
      iconColor: "text-warning",
      iconBg: "bg-warning/10",
    },
  ];

  const cards = isAdmin ? adminCards : clientCards;
  const displayJobs = recentJobs?.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <Card className="bg-gradient-to-r from-brand/10 via-brand/5 to-transparent border-none shadow-none">
        <CardContent className="flex items-center gap-4 py-5">
          <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground font-bold text-lg">
            {profile?.full_name?.[0] ?? "S"}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Here's what's happening with your shop today."
                : "Here's the status of your projects."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className={cn("transition-all duration-200 hover:shadow-md", (card as { featured?: boolean }).featured && "border-brand/30 shadow-md")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${card.iconBg}`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{card.value}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate("/jobs/new")} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          New Job
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/clients")}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          View Clients
        </Button>
        <QuickPhotoButton />
      </div>

      {/* Recent jobs */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Jobs</h2>
        {jobsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : displayJobs.length > 0 ? (
          <div className="space-y-3">
            {displayJobs.map((job, i) => (
              <JobCard key={job.id} job={job} index={i} />
            ))}
            {(recentJobs?.length ?? 0) > 5 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/jobs")}
              >
                View All Jobs
              </Button>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Briefcase className="mx-auto h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">No jobs yet</p>
                <p className="text-sm mt-1">
                  Create your first job to get started.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate("/jobs/new")}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Job
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
}
