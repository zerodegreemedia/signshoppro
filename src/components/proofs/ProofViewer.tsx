import { useState } from "react";
import { format } from "date-fns";
import {
  ZoomIn,
  ZoomOut,
  FileImage,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import type { Proof } from "@/types/database";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface ProofViewerProps {
  proofs: Proof[];
  isLoading?: boolean;
}

const PROOF_STATUS_MAP: Record<string, string> = {
  pending: "proof_sent",
  approved: "proof_approved",
  revision_requested: "proof_revision_requested",
};

export function ProofViewer({ proofs, isLoading }: ProofViewerProps) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [zoom, setZoom] = useState(1);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!proofs.length) {
    return null;
  }

  const currentProof =
    proofs.find((p) => p.version === selectedVersion) ?? proofs[0];
  const previousProof = proofs.find(
    (p) => p.version === currentProof.version - 1
  );

  const isPdf = currentProof.file_url.toLowerCase().endsWith(".pdf");

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Proof Versions
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={String(currentProof.version)}
              onValueChange={(v) => {
                setSelectedVersion(Number(v));
                setZoom(1);
              }}
            >
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {proofs.map((p) => (
                  <SelectItem key={p.id} value={String(p.version)}>
                    v{p.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {previousProof && (
              <Button
                variant={compareMode ? "default" : "outline"}
                size="sm"
                className="hidden md:inline-flex h-8 text-xs"
                onClick={() => setCompareMode(!compareMode)}
              >
                Compare
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image viewer */}
        <div
          className={
            compareMode && previousProof
              ? "grid grid-cols-2 gap-3"
              : ""
          }
        >
          {/* Previous version (compare mode) */}
          {compareMode && previousProof && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground text-center font-medium">
                v{previousProof.version}
              </p>
              <div className="rounded-lg border overflow-hidden bg-muted/30">
                <ProofImage
                  url={previousProof.file_url}
                  isPdf={previousProof.file_url.toLowerCase().endsWith(".pdf")}
                  zoom={1}
                />
              </div>
            </div>
          )}

          {/* Current version */}
          <div className="space-y-1">
            {compareMode && (
              <p className="text-xs text-muted-foreground text-center font-medium">
                v{currentProof.version} (current)
              </p>
            )}
            <div className="rounded-lg border overflow-hidden bg-muted/30">
              <ProofImage
                url={currentProof.file_url}
                isPdf={isPdf}
                zoom={zoom}
              />
            </div>
          </div>
        </div>

        {/* Zoom controls */}
        {!isPdf && (
          <div className="flex items-center justify-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={handleResetZoom}>
              {Math.round(zoom * 100)}%
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Proof details */}
        <div className="space-y-3 text-sm border-t pt-3">
          <div className="flex items-center justify-between">
            <StatusBadge status={PROOF_STATUS_MAP[currentProof.status] ?? currentProof.status} />
            <span className="text-xs text-muted-foreground">
              {format(new Date(currentProof.created_at), "MMM d, yyyy h:mm a")}
            </span>
          </div>

          {currentProof.internal_notes && (
            <div className="flex gap-2 text-sm">
              <StickyNote className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">
                  Designer Notes
                </p>
                <p className="whitespace-pre-wrap">{currentProof.internal_notes}</p>
              </div>
            </div>
          )}

          {currentProof.client_notes && (
            <div className="flex gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">
                  Client Feedback
                </p>
                <p className="whitespace-pre-wrap">{currentProof.client_notes}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProofImage({
  url,
  isPdf,
  zoom,
}: {
  url: string;
  isPdf: boolean;
  zoom: number;
}) {
  if (isPdf) {
    return (
      <div className="flex flex-col items-center gap-3 p-8">
        <FileImage className="h-12 w-12 text-muted-foreground" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          Open PDF in new tab
        </a>
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[60vh]">
      <img
        src={url}
        alt="Design proof"
        className="w-full transition-transform origin-top-left"
        style={{ transform: `scale(${zoom})` }}
        draggable={false}
      />
    </div>
  );
}
