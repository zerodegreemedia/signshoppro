import { useState } from "react";
import { Camera } from "lucide-react";
import { useJobs } from "@/hooks/useJobs";
import { PhotoCapture } from "./PhotoCapture";
import type { JobWithClient } from "@/hooks/useJobs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function QuickPhotoButton() {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithClient | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const { data: jobs } = useJobs();

  const handleJobSelect = (job: JobWithClient) => {
    setSelectedJob(job);
    setSelectorOpen(false);
    // Open the capture sheet after a brief delay to let the selector sheet close
    setTimeout(() => setCaptureOpen(true), 150);
  };

  const handleCaptureClose = (open: boolean) => {
    setCaptureOpen(open);
    if (!open) setSelectedJob(null);
  };

  return (
    <>
      {/* Job selector sheet */}
      <Sheet open={selectorOpen} onOpenChange={setSelectorOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2 min-h-[44px]">
            <Camera className="h-4 w-4" />
            Take Photo
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Select Job</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Command className="rounded-lg border">
              <CommandInput placeholder="Search jobs..." />
              <CommandList className="max-h-[40vh]">
                <CommandEmpty>No jobs found.</CommandEmpty>
                <CommandGroup>
                  {(jobs ?? []).map((job) => (
                    <CommandItem
                      key={job.id}
                      value={`${job.title} ${job.clients?.business_name ?? ""}`}
                      onSelect={() => handleJobSelect(job)}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{job.title}</span>
                        {job.clients && (
                          <span className="text-xs text-muted-foreground">
                            {job.clients.business_name}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </SheetContent>
      </Sheet>

      {/* PhotoCapture in controlled mode — reuses the same component, no duplication */}
      {selectedJob && (
        <PhotoCapture
          jobId={selectedJob.id}
          clientId={selectedJob.client_id}
          open={captureOpen}
          onOpenChange={handleCaptureClose}
        />
      )}
    </>
  );
}
