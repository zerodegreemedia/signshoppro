import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Users } from "lucide-react";
import { useJobs } from "@/hooks/useJobs";
import { useClients } from "@/hooks/useClients";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: jobs } = useJobs();
  const { data: clients } = useClients();

  // Listen for Cmd/Ctrl+K and custom open-command-palette event
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleOpen);
    };
  }, []);

  const query = search.toLowerCase().trim();

  const filteredJobs = useMemo(() => {
    if (!jobs || !query) return jobs?.slice(0, 8) ?? [];
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(query) ||
        job.clients?.business_name?.toLowerCase().includes(query) ||
        job.clients?.contact_name?.toLowerCase().includes(query) ||
        job.status.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [jobs, query]);

  const filteredClients = useMemo(() => {
    if (!clients || !query) return clients?.slice(0, 8) ?? [];
    return clients.filter(
      (client) =>
        client.business_name.toLowerCase().includes(query) ||
        client.contact_name.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.includes(query)
    ).slice(0, 8);
  }, [clients, query]);

  const handleSelect = (type: "job" | "client", id: string) => {
    setOpen(false);
    setSearch("");
    if (type === "job") {
      navigate(`/jobs/${id}`);
    } else {
      navigate(`/clients/${id}`);
    }
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setSearch("");
      }}
      title="Search"
      description="Search jobs and clients"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search jobs, clients..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {filteredJobs.length > 0 && (
            <CommandGroup heading="Jobs">
              {filteredJobs.map((job) => (
                <CommandItem
                  key={job.id}
                  value={`job-${job.id}`}
                  onSelect={() => handleSelect("job", job.id)}
                  className="cursor-pointer"
                >
                  <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{job.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {job.clients?.business_name ?? "No client"} &middot;{" "}
                      {job.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredClients.length > 0 && (
            <CommandGroup heading="Clients">
              {filteredClients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={`client-${client.id}`}
                  onSelect={() => handleSelect("client", client.id)}
                  className="cursor-pointer"
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{client.business_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {client.contact_name}
                      {client.email ? ` \u00b7 ${client.email}` : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
