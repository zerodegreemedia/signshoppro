import { useState } from "react";
import { Camera } from "lucide-react";
import { useJobPhotos } from "@/hooks/usePhotos";
import { PhotoViewer } from "./PhotoViewer";
import { PHOTO_TYPES } from "@/lib/constants";
import type { JobPhoto } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PhotoGridProps {
  jobId: string;
  onAddPhoto?: () => void;
}

export function PhotoGrid({ jobId, onAddPhoto }: PhotoGridProps) {
  const { data: photos, isLoading } = useJobPhotos(jobId);
  const [filter, setFilter] = useState<string>("all");
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const filteredPhotos = filter === "all"
    ? photos ?? []
    : (photos ?? []).filter((p) => p.photo_type === filter);

  const handlePhotoClick = (photo: JobPhoto) => {
    setSelectedPhoto(photo);
    setViewerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="w-full overflow-x-auto flex-nowrap">
          <TabsTrigger value="all" className="text-xs flex-shrink-0">
            All{photos?.length ? ` (${photos.length})` : ""}
          </TabsTrigger>
          {PHOTO_TYPES.map((type) => {
            const count = (photos ?? []).filter((p) => p.photo_type === type.value).length;
            return (
              <TabsTrigger
                key={type.value}
                value={type.value}
                className="text-xs flex-shrink-0"
              >
                {type.label}{count > 0 ? ` (${count})` : ""}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Grid or empty state */}
      {filteredPhotos.length === 0 ? (
        <div className="text-center py-12">
          <Camera className="mx-auto h-10 w-10 mb-3 opacity-40 text-muted-foreground" />
          <p className="font-medium text-muted-foreground">
            {filter === "all"
              ? "No photos yet"
              : `No ${PHOTO_TYPES.find((t) => t.value === filter)?.label.toLowerCase()} photos yet`}
          </p>
          {filter === "all" && (
            <>
              <p className="text-sm text-muted-foreground mt-1">
                Capture your first site photo
              </p>
              {onAddPhoto && (
                <button
                  type="button"
                  onClick={onAddPhoto}
                  className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Camera className="h-4 w-4" />
                  Add Photo
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filteredPhotos.map((photo) => {
            const typeLabel =
              PHOTO_TYPES.find((t) => t.value === photo.photo_type)?.label ??
              photo.photo_type;
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => handlePhotoClick(photo)}
                className="relative aspect-square rounded-lg overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img
                  src={photo.file_url}
                  alt={photo.notes || `${typeLabel} photo`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <Badge
                  variant="secondary"
                  className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 bg-black/60 text-white border-0"
                >
                  {typeLabel}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* Photo viewer dialog */}
      <PhotoViewer
        photo={selectedPhoto}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </div>
  );
}
