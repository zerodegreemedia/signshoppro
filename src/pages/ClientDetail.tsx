import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Building2,
  CalendarDays,
  DollarSign,
  Briefcase,
} from "lucide-react";
import { useClient, useUpdateClient } from "@/hooks/useClients";
import { useJobs } from "@/hooks/useJobs";

import { ClientForm } from "@/components/clients/ClientForm";
import { JobCard } from "@/components/jobs/JobCard";
import { RoleGate } from "@/components/auth/RoleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = useState(false);

  const { data: client, isLoading: clientLoading } = useClient(id);
  const { data: jobs, isLoading: jobsLoading } = useJobs({ client_id: id });
  const updateClient = useUpdateClient();

  if (clientLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Client not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/clients")}>
          Back to Clients
        </Button>
      </div>
    );
  }

  const handleUpdate = (values: {
    business_name: string;
    contact_name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    notes?: string;
    tax_exempt?: boolean;
  }) => {
    updateClient.mutate(
      {
        id: client.id,
        business_name: values.business_name,
        contact_name: values.contact_name,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        city: values.city || null,
        state: values.state || null,
        zip: values.zip || null,
        notes: values.notes || null,
        tax_exempt: values.tax_exempt ?? false,
      },
      { onSuccess: () => setEditOpen(false) }
    );
  };

  const totalRevenue =
    jobs
      ?.filter((j) => ["paid", "completed"].includes(j.status))
      .reduce((sum, j) => sum + (j.estimated_total || 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/clients")}
        className="gap-1 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Clients
      </Button>

      {/* Client info card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 h-12 w-12 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">{client.business_name}</CardTitle>
              <p className="text-sm text-muted-foreground">{client.contact_name}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {client.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                {client.email}
              </a>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${client.phone}`} className="text-primary hover:underline">
                {client.phone}
              </a>
            </div>
          )}
          {(client.address || client.city) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {[client.address, client.city, client.state, client.zip]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="jobs">
        <TabsList className="w-full">
          <TabsTrigger value="jobs" className="flex-1">
            Jobs
          </TabsTrigger>
          <TabsTrigger value="details" className="flex-1">
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-3 mt-4">
          {jobsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))
          ) : jobs && jobs.length > 0 ? (
            jobs.map((job, i) => <JobCard key={job.id} job={job} index={i} />)
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  <Briefcase className="mx-auto h-10 w-10 mb-3 opacity-40" />
                  <p className="font-medium">No jobs for this client</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate("/jobs/new")}
                  >
                    Create Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              {client.address && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Full Address
                  </p>
                  <p className="text-sm mt-1">
                    {client.address}
                    <br />
                    {[client.city, client.state, client.zip].filter(Boolean).join(", ")}
                  </p>
                </div>
              )}

              {client.notes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Notes
                  </p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Client since {formatDate(client.created_at, "long")}
                </span>
              </div>

              <RoleGate requiredRole="admin">
                <div className="flex items-center gap-2 pt-2 border-t">
                  <DollarSign className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">
                    Total Revenue:{" "}
                    {totalRevenue.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </span>
                </div>
              </RoleGate>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <ClientForm
            defaultValues={client}
            onSubmit={handleUpdate}
            isLoading={updateClient.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
