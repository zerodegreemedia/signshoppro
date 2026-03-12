import { useState } from "react";
import { Trash2, MapPin, Ruler, Calendar } from "lucide-react";
import { useDeletePhoto } from "@/hooks/usePhotos";
import { RoleGate } from "@/components/auth/RoleGate";
import { MeasurementOverlay } from "./MeasurementOverlay";
import { PHOTO_TYPES } from "@/lib/constants";
import type { JobPhoto } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PhotoViewerProps {
  photo: JobPhoto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotoViewer({ photo, open, onOpenChange }: PhotoViewerProps) {
  const deletePhoto = useDeletePhoto();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (!photo) return null;

  const typeLabel = PHOTO_TYPES.find((t) => t.value === photo.photo_type)?.label ?? photo.photo_type;

  const handleDelete = () => {
    deletePhoto.mutate(
      {
        photoId: photo.id,
        storagePath: photo.storage_path,
        jobId: photo.job_id,
      },
      {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          onOpenChange(false);
        },
      }
    );
  };

  const formattedDate = photo.taken_at
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(photo.taken_at))
    : photo.created_at
      ? new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(photo.created_at))
      : null;

  const showMeasurementOverlay =
    photo.photo_type === "measurement" &&
    photo.measurements &&
    (photo.measurements.width || photo.measurements.height);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="secondary">{typeLabel}</Badge>
            <span className="text-sm font-normal text-muted-foreground">Photo</span>
          </DialogTitle>
        </DialogHeader>

        {/* Image with optional measurement overlay */}
        <div className="relative">
          <img
            src={photo.file_url}
            alt={photo.notes || `${typeLabel} photo`}
            className="w-full object-contain max-h-[50vh]"
          />
          {showMeasurementOverlay && photo.measurements && (
            <MeasurementOverlay measurements={photo.measurements} />
          )}
        </div>

        {/* Metadata */}
        <div className="p-4 space-y-3 text-sm">
          {photo.notes && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Notes</p>
              <p className="whitespace-pre-wrap">{photo.notes}</p>
            </div>
          )}

          {photo.measurements && (photo.measurements.width || photo.measurements.height) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Ruler className="h-3.5 w-3.5" />
              <span>
                {photo.measurements.width && photo.measurements.height
                  ? `${photo.measurements.width}ft × ${photo.measurements.height}ft`
                  : photo.measurements.width
                    ? `Width: ${photo.measurements.width}ft`
                    : `Height: ${photo.measurements.height}ft`}
              </span>
            </div>
          )}

          {photo.gps_latitude != null && photo.gps_longitude != null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {photo.gps_latitude.toFixed(6)}, {photo.gps_longitude.toFixed(6)}
              </span>
            </div>
          )}

          {formattedDate && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formattedDate}</span>
            </div>
          )}

          {/* Delete button — admin only */}
          <RoleGate requiredRole="admin">
            <div className="pt-3 border-t">
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Photo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This cannot be undone. The photo will be permanently removed from
                      storage and all associated data will be lost.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deletePhoto.isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </RoleGate>
        </div>
      </DialogContent>
    </Dialog>
  );
}
