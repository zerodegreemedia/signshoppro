import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Briefcase } from "lucide-react";
import { useJobs } from "@/hooks/useJobs";
import { JobCard } from "@/components/jobs/JobCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "estimates", label: "Estimates" },
  { value: "production", label: "Production" },
  { value: "completed", label: "Completed" },
] as const;

type StatusCategory = (typeof STATUS_TABS)[number]["value"];

export default function Jobs() {
  const navigate = useNavigate();
  const [statusCategory, setStatusCategory] = useState<StatusCategory>("all");
  const [search, setSearch] = useState("");

  const { data: jobs, isLoading } = useJobs({
    statusCategory: statusCategory as "all" | "active" | "estimates" | "production" | "completed",
    search: search || undefined,
  });

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Jobs</h1>
      {/* Status filter tabs */}
      <Tabs
        value={statusCategory}
        onValueChange={(v) => setStatusCategory(v as StatusCategory)}
      >
        <TabsList className="w-full overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-1 text-xs sm:text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job, i) => (
            <JobCard key={job.id} job={job} index={i} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Briefcase className="mx-auto h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium text-lg">
                {search
                  ? "No jobs match your search"
                  : "Create Your First Job"}
              </p>
              <p className="text-sm mt-1">
                {search
                  ? "Try a different search term."
                  : "Start by creating a new job for a client."}
              </p>
              {!search && (
                <Button className="mt-4" onClick={() => navigate("/jobs/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Job
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAB */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg active:scale-90 transition-transform md:bottom-6 z-40"
        onClick={() => navigate("/jobs/new")}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
