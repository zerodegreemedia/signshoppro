import { useState, useCallback, useEffect, useRef } from "react";
import { Camera, CloudOff, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useJobPhotos, useOfflinePhotos } from "@/hooks/usePhotos";
import { PhotoViewer } from "./PhotoViewer";
import { PHOTO_TYPES } from "@/lib/constants";
import type { JobPhoto } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface GridPhoto {
  id: string;
  file_url: string;
  photo_type: string;
  notes: string | null;
  isOffline: boolean;
}

interface PhotoGridProps {
  jobId: string;
  onAddPhoto?: () => void;
}

export function PhotoGrid({ jobId, onAddPhoto }: PhotoGridProps) {
  const { data: photos, isLoading } = useJobPhotos(jobId);
  const { data: offlinePhotos } = useOfflinePhotos(jobId);
  const [filter, setFilter] = useState<string>("all");
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

  // Merge offline photos (shown first) with server photos
  const offlineItems: GridPhoto[] = (offlinePhotos ?? []).map((op) => ({
    id: op.id,
    file_url: op.blobUrl,
    photo_type: op.photoType,
    notes: op.notes,
    isOffline: true,
  }));

  const serverItems: GridPhoto[] = (photos ?? []).map((p) => ({
    ...p,
    isOffline: false,
  }));

  const allPhotos = [...offlineItems, ...serverItems];

  const filteredPhotos =
    filter === "all"
      ? allPhotos
      : allPhotos.filter((p) => p.photo_type === filter);

  // Server photos matching the current filter (for fullscreen swipe viewer)
  const filteredServerPhotos: JobPhoto[] =
    filter === "all"
      ? (photos ?? [])
      : (photos ?? []).filter((p) => p.photo_type === filter);

  const handlePhotoClick = (photo: JobPhoto, index: number) => {
    setSelectedPhoto(photo);
    setViewerOpen(false);
    setFullscreenIndex(index);
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
            All{allPhotos.length ? ` (${allPhotos.length})` : ""}
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
          {filteredPhotos.map((photo, index) => {
            const typeLabel =
              PHOTO_TYPES.find((t) => t.value === photo.photo_type)?.label ??
              photo.photo_type;
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => {
                  if (!photo.isOffline) {
                    const full = (photos ?? []).find((p) => p.id === photo.id);
                    if (full) handlePhotoClick(full, index);
                  }
                }}
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
                {photo.isOffline && (
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    <CloudOff className="h-3 w-3" />
                    Offline
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Detail viewer dialog (opened from fullscreen info button) */}
      <PhotoViewer
        photo={selectedPhoto}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />

      {/* Fullscreen swipe viewer */}
      {fullscreenIndex !== null && (
        <FullscreenSwipeViewer
          photos={filteredServerPhotos}
          initialIndex={fullscreenIndex}
          onClose={() => setFullscreenIndex(null)}
          onOpenDetail={(photo) => {
            setSelectedPhoto(photo);
            setViewerOpen(true);
          }}
        />
      )}
    </div>
  );
}

/* ─── Fullscreen swipe viewer ─── */

interface FullscreenSwipeViewerProps {
  photos: JobPhoto[];
  initialIndex: number;
  onClose: () => void;
  onOpenDetail: (photo: JobPhoto) => void;
}

function FullscreenSwipeViewer({
  photos,
  initialIndex,
  onClose,
  onOpenDetail,
}: FullscreenSwipeViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  const photo = photos[currentIndex];
  if (!photo) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const goNext = useCallback(() => {
    if (hasNext) setCurrentIndex((i) => i + 1);
  }, [hasNext]);

  const goPrev = useCallback(() => {
    if (hasPrev) setCurrentIndex((i) => i - 1);
  }, [hasPrev]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext]);

  // Touch swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const SWIPE_THRESHOLD = 50;
    if (touchDeltaX.current < -SWIPE_THRESHOLD) goNext();
    else if (touchDeltaX.current > SWIPE_THRESHOLD) goPrev();
    touchStartX.current = null;
    touchDeltaX.current = 0;
  }, [goNext, goPrev]);

  const typeLabel =
    PHOTO_TYPES.find((t) => t.value === photo.photo_type)?.label ??
    photo.photo_type;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 text-white shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-10 w-10"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="text-sm font-medium">
          <Badge variant="secondary" className="bg-white/20 text-white border-0">
            {typeLabel}
          </Badge>
          <span className="ml-2 text-white/70">
            {currentIndex + 1} / {photos.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20 text-xs"
          onClick={() => onOpenDetail(photo)}
        >
          Details
        </Button>
      </div>

      {/* Image area */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 px-2">
        {/* Prev button (desktop) */}
        {hasPrev && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 text-white hover:bg-white/20 h-12 w-12 hidden sm:flex z-10"
            onClick={goPrev}
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>
        )}

        <img
          key={photo.id}
          src={photo.file_url}
          alt={photo.notes || `${typeLabel} photo`}
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />

        {/* Next button (desktop) */}
        {hasNext && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 text-white hover:bg-white/20 h-12 w-12 hidden sm:flex z-10"
            onClick={goNext}
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
        )}
      </div>

      {/* Bottom caption */}
      {photo.notes && (
        <div className="p-3 text-white/80 text-center text-sm shrink-0 truncate">
          {photo.notes}
        </div>
      )}
    </div>
  );
}
