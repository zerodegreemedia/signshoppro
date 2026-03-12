import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  FileText,
  Clock,
  DollarSign,
  PlusCircle,
  Camera,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { RoleGate } from "@/components/auth/RoleGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const adminCards = [
  {
    title: "Active Jobs",
    value: "12",
    description: "3 due this week",
    icon: Briefcase,
    iconColor: "text-brand",
    iconBg: "bg-brand/10",
  },
  {
    title: "Pending Estimates",
    value: "5",
    description: "2 sent today",
    icon: FileText,
    iconColor: "text-warning",
    iconBg: "bg-warning/10",
  },
  {
    title: "Awaiting Approval",
    value: "3",
    description: "1 proof, 2 estimates",
    icon: Clock,
    iconColor: "text-danger",
    iconBg: "bg-danger/10",
  },
  {
    title: "Revenue This Month",
    value: "$24,500",
    description: "+12% from last month",
    icon: DollarSign,
    iconColor: "text-success",
    iconBg: "bg-success/10",
  },
];

const clientCards = [
  {
    title: "My Active Jobs",
    value: "2",
    description: "1 in production",
    icon: Briefcase,
    iconColor: "text-brand",
    iconBg: "bg-brand/10",
  },
  {
    title: "Awaiting My Approval",
    value: "1",
    description: "1 proof to review",
    icon: Clock,
    iconColor: "text-warning",
    iconBg: "bg-warning/10",
  },
];

export default function Dashboard() {
  const { isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const cards = isAdmin ? adminCards : clientCards;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h2>
        <p className="text-muted-foreground">
          {isAdmin
            ? "Here's what's happening with your shop today."
            : "Here's the status of your projects."}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="transition-all duration-200 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${card.iconBg}`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
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
          onClick={() => navigate("/jobs/new")}
          className="gap-2"
        >
          <Camera className="h-4 w-4" />
          Take Photo
        </Button>
      </div>

      {/* Recent jobs placeholder */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Jobs</h3>
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
      </div>

      {/* Admin-only revenue section */}
      <RoleGate requiredRole="admin">
        <div>
          <h3 className="text-lg font-semibold mb-3">Revenue Overview</h3>
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <DollarSign className="mx-auto h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">Revenue tracking coming soon</p>
                <p className="text-sm mt-1">
                  Charts and analytics will appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </RoleGate>
    </div>
  );
}
