import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Users, Phone, Mail, Briefcase } from "lucide-react";
import { useClients, useCreateClient } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ClientForm } from "@/components/clients/ClientForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Clients() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: clients, isLoading } = useClients(search || undefined);
  const createClient = useCreateClient();

  const handleCreateClient = (values: {
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
    if (!user) {
      toast.error("Authentication error. Please refresh and try again.");
      return;
    }
    createClient.mutate(
      {
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
        created_by: user.id,
      },
      {
        onSuccess: () => setDialogOpen(false),
      }
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Clients</h1>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Client list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : clients && clients.length > 0 ? (
        <div className="space-y-3">
          {clients.map((client) => {
            const jobCount = client.jobs?.[0]?.count ?? 0;
            return (
              <Card
                key={client.id}
                className="cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 rounded-full bg-primary/10 h-10 w-10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {client.business_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">
                        {client.business_name}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {client.contact_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                        {client.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </span>
                        )}
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {client.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {jobCount} job{jobCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium text-lg">No clients yet</p>
              <p className="text-sm mt-1">
                Add your first client to start managing jobs.
              </p>
              <Button
                className="mt-4"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Client
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAB + Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            size="icon"
            className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg md:bottom-6 z-40"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSubmit={handleCreateClient}
            isLoading={createClient.isPending}
            submitLabel="Add Client"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
