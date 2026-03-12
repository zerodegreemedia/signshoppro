# Phase 6: Photo Capture & Management — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a field photo capture system that lets users photograph storefronts/vehicles with measurements on-site, organize by type, and review with measurement overlays.

**Architecture:** Hidden camera `<input>` triggers native capture. Images compress client-side via `browser-image-compression`, upload to Supabase Storage public bucket, and metadata inserts into `job_photos` table. TanStack Query manages cache invalidation. Components use shadcn/ui Sheet (capture form), Dialog (viewer), Tabs (type filtering).

**Tech Stack:** React 19 + TypeScript, Supabase Storage + PostgreSQL, TanStack Query v5, browser-image-compression, shadcn/ui, Tailwind CSS v4

---

## Chunk 1: Foundation (Migration, Types, Hook)

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/002_storage_updates.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Make existing buckets public (they were created as private in 001)
UPDATE storage.buckets SET public = true WHERE id = 'job-photos';
UPDATE storage.buckets SET public = true WHERE id = 'proofs';

-- Create client-logos bucket (not in 001)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for client-logos bucket
CREATE POLICY "Authenticated users can read client logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload client logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'client-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete client logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'client-logos' AND public.is_admin());

-- Allow clients to INSERT their own job photos (001 only has SELECT for clients)
CREATE POLICY "Clients can insert own job photos"
  ON public.job_photos FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.clients c ON c.id = j.client_id
      WHERE c.profile_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Verify migration applies cleanly**

Run: `npx supabase db reset`
Expected: All migrations apply without errors. Buckets `job-photos` and `proofs` are now public. `client-logos` bucket exists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_storage_updates.sql
git commit -m "feat: add storage migration — public buckets, client-logos, client INSERT policy"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/database.ts` (lines 104-117, JobPhoto interface)

The existing `JobPhoto` interface is missing `notes` and `storage_path` fields that exist in the DB schema. Also, `photo_type` should use the `PhotoType` union type from `constants.ts` instead of generic `string`.

- [ ] **Step 1: Update the JobPhoto interface**

Replace the current `JobPhoto` interface (lines 104-117) with:

```typescript
export interface JobPhoto {
  id: string;
  job_id: string;
  uploaded_by: string;
  storage_path: string;
  file_url: string;
  thumbnail_url: string | null;
  photo_type: "before" | "progress" | "after" | "measurement" | "reference" | "site_survey";
  caption: string | null;
  notes: string | null;
  measurements: Record<string, string> | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  taken_at: string | null;
  created_at: string;
}
```

Note: `photo_type` uses the inline union matching `PhotoType` from `src/lib/constants.ts` to avoid a circular import. The `storage_path` and `notes` fields are new additions matching the DB schema.

- [ ] **Step 2: Run build to verify no type errors**

Run: `npm run build`
Expected: Build succeeds. No files currently reference `JobPhoto` in a way that would break (the type is only used in the Database helper types below it, which use `Omit` patterns).

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add notes, storage_path to JobPhoto interface, tighten photo_type"
```

---

### Task 3: Create usePhotos Hook

**Files:**
- Create: `src/hooks/usePhotos.ts`

This hook follows the exact patterns in `src/hooks/useLineItems.ts` and `src/hooks/useJobs.ts`: TanStack Query for reads, mutations with `queryClient.invalidateQueries()` and `toast` for feedback.

- [ ] **Step 1: Create the hook file**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { JobPhoto } from "@/types/database";
import type { PhotoType } from "@/lib/constants";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

export interface UploadPhotoInput {
  file: File;
  jobId: string;
  clientId: string;
  photoType: PhotoType;
  notes?: string;
  measurements?: { width: string; height: string };
  gpsLatitude?: number;
  gpsLongitude?: number;
}

export interface DeletePhotoInput {
  photoId: string;
  storagePath: string;
  jobId: string;
}

export function useJobPhotos(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job-photos", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("Job ID required");
      const { data, error } = await supabase
        .from("job_photos")
        .select("*")
        .eq("job_id", jobId)
        .order("taken_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as JobPhoto[];
    },
    enabled: !!jobId,
  });
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadPhotoInput) => {
      // 1. Compress image
      const compressed = await imageCompression(input.file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      // 2. Generate filename and path
      const uuid = crypto.randomUUID();
      const storagePath = `${input.clientId}/${input.jobId}/${input.photoType}/${uuid}.jpg`;

      // 3. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("job-photos")
        .upload(storagePath, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      // 4. Get public URL
      const { data: urlData } = supabase.storage
        .from("job-photos")
        .getPublicUrl(storagePath);

      // 5. Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error("Not authenticated");

      // 6. Insert DB record
      const { data, error: insertError } = await supabase
        .from("job_photos")
        .insert({
          job_id: input.jobId,
          uploaded_by: user.id,
          storage_path: storagePath,
          file_url: urlData.publicUrl,
          photo_type: input.photoType,
          notes: input.notes ?? null,
          measurements: input.measurements
            ? { width: input.measurements.width, height: input.measurements.height }
            : null,
          gps_latitude: input.gpsLatitude ?? null,
          gps_longitude: input.gpsLongitude ?? null,
          taken_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        // Best-effort cleanup: remove orphaned file from storage
        await supabase.storage.from("job-photos").remove([storagePath]);
        throw insertError;
      }

      return { photo: data as JobPhoto, jobId: input.jobId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-photos", result.jobId] });
      toast.success("Photo uploaded");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload photo: ${error.message}`);
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeletePhotoInput) => {
      // 1. Delete from storage
      const { error: storageError } = await supabase.storage
        .from("job-photos")
        .remove([input.storagePath]);
      if (storageError) throw storageError;

      // 2. Delete from database
      const { error: dbError } = await supabase
        .from("job_photos")
        .delete()
        .eq("id", input.photoId);
      if (dbError) throw dbError;

      return { jobId: input.jobId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-photos", result.jobId] });
      toast.success("Photo deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete photo: ${error.message}`);
    },
  });
}
```

- [ ] **Step 2: Run build to verify no type errors**

Run: `npm run build`
Expected: Build succeeds. The hook compiles cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePhotos.ts
git commit -m "feat: add usePhotos hook — upload with compression, delete, fetch by job"
```

---

## Chunk 2: Photo Capture & Display Components

### Task 4: Create MeasurementOverlay Component

**Files:**
- Create: `src/components/photos/MeasurementOverlay.tsx`

Small, self-contained component. Build this first since PhotoViewer depends on it.

- [ ] **Step 1: Create the component**

```tsx
interface MeasurementOverlayProps {
  measurements: Record<string, string>;
}

export function MeasurementOverlay({ measurements }: MeasurementOverlayProps) {
  const width = measurements.width;
  const height = measurements.height;

  if (!width && !height) return null;

  const label = width && height
    ? `${width} × ${height}`
    : width
      ? `W: ${width}`
      : `H: ${height}`;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-center py-2 px-3">
      <span className="text-sm font-medium tracking-wide">{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/photos/MeasurementOverlay.tsx
git commit -m "feat: add MeasurementOverlay component for photo dimensions"
```

---

### Task 5: Create PhotoCapture Component

**Files:**
- Create: `src/components/photos/PhotoCapture.tsx`

Uses a Sheet (slide-up panel) with hidden file input. After image selection, shows metadata form. On save, captures GPS and calls `useUploadPhoto`.

- [ ] **Step 1: Create the component**

```tsx
import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useUploadPhoto } from "@/hooks/usePhotos";
import { PHOTO_TYPES } from "@/lib/constants";
import type { PhotoType } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PhotoCaptureProps {
  jobId: string;
  clientId: string;
  /** When provided, component operates in controlled mode (no trigger button). */
  open?: boolean;
  /** Called when the sheet wants to close. Required for controlled mode. */
  onOpenChange?: (open: boolean) => void;
}

export function PhotoCapture({ jobId, clientId, open: controlledOpen, onOpenChange: controlledOnOpenChange }: PhotoCaptureProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [photoType, setPhotoType] = useState<PhotoType>("reference");
  const [notes, setNotes] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadPhoto();

  const resetForm = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setPhotoType("reference");
    setNotes("");
    setWidth("");
    setHeight("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleSave = async () => {
    if (!file) return;

    // Attempt GPS (non-blocking)
    let gpsLatitude: number | undefined;
    let gpsLongitude: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 60000,
        });
      });
      gpsLatitude = pos.coords.latitude;
      gpsLongitude = pos.coords.longitude;
    } catch {
      // GPS unavailable or denied — continue without it
    }

    const measurements =
      width || height ? { width: width || "0", height: height || "0" } : undefined;

    uploadPhoto.mutate(
      {
        file,
        jobId,
        clientId,
        photoType,
        notes: notes || undefined,
        measurements,
        gpsLatitude,
        gpsLongitude,
      },
      {
        onSuccess: () => {
          resetForm();
          setOpen(false);
        },
      }
    );
  };

  const sheetContent = (
    <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Capture Photo</SheetTitle>
      </SheetHeader>

      <div className="space-y-4 mt-4">
        {/* Camera input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {!preview ? (
          <Button
            type="button"
            variant="outline"
            className="w-full h-32 border-dashed flex flex-col gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Tap to take photo or choose from gallery
            </span>
          </Button>
        ) : (
          <div className="space-y-2">
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-48 object-contain rounded-lg bg-muted"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
                setPreview(null);
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Retake
            </Button>
          </div>
        )}

        {/* Photo type */}
        <div className="space-y-2">
          <Label>Photo Type</Label>
          <Select value={photoType} onValueChange={(v) => setPhotoType(v as PhotoType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHOTO_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="photo-notes">Notes</Label>
          <Textarea
            id="photo-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this photo..."
            rows={2}
          />
        </div>

        {/* Measurements */}
        <div className="space-y-2">
          <Label>Measurements</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Width"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">×</span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Height"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground font-medium">ft</span>
          </div>
        </div>

        {/* Save button */}
        <Button
          className="w-full min-h-[44px]"
          disabled={!file || uploadPhoto.isPending}
          onClick={handleSave}
        >
          {uploadPhoto.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            "Save Photo"
          )}
        </Button>
      </div>
    </SheetContent>
  );

  // Controlled mode: no trigger button, parent manages open state
  if (isControlled) {
    return (
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        {sheetContent}
      </Sheet>
    );
  }

  // Uncontrolled mode: renders its own trigger button
  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <SheetTrigger asChild>
        <Button className="gap-2 min-h-[44px]">
          <Camera className="h-4 w-4" />
          Add Photo
        </Button>
      </SheetTrigger>
      {sheetContent}
    </Sheet>
  );
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/photos/PhotoCapture.tsx
git commit -m "feat: add PhotoCapture component — camera input, metadata form, GPS"
```

---

### Task 6: Create PhotoViewer Component

**Files:**
- Create: `src/components/photos/PhotoViewer.tsx`

Full-screen dialog showing photo at full resolution, metadata, measurement overlay, and admin-only delete.

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/photos/PhotoViewer.tsx
git commit -m "feat: add PhotoViewer dialog — full-size view, metadata, admin delete"
```

---

### Task 7: Create PhotoGrid Component

**Files:**
- Create: `src/components/photos/PhotoGrid.tsx`

Thumbnail grid with type filter tabs. Depends on PhotoViewer (Task 6) and useJobPhotos hook (Task 3).

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/photos/PhotoGrid.tsx
git commit -m "feat: add PhotoGrid component — thumbnail grid with type filter tabs"
```

---

## Chunk 3: Integration (JobDetail, Dashboard, QuickPhoto)

### Task 8: Integrate Photos into JobDetail

**Files:**
- Modify: `src/pages/JobDetail.tsx` (lines 446-456, Photos tab)

Replace the "Phase 6 coming soon" placeholder with PhotoCapture + PhotoGrid. Also add photo count to the tab trigger.

- [ ] **Step 1: Add imports at the top of JobDetail.tsx**

Add these imports after the existing import block (after line 56):

```typescript
import { PhotoCapture } from "@/components/photos/PhotoCapture";
import { PhotoGrid } from "@/components/photos/PhotoGrid";
import { useJobPhotos } from "@/hooks/usePhotos";
```

- [ ] **Step 2: Add the photo count query**

After line 102 (`const { data: lineItems } = useLineItems(id);`), add:

```typescript
const { data: photos } = useJobPhotos(id);
```

- [ ] **Step 3: Update the Photos tab trigger to show count**

Replace line 269 (the Photos TabsTrigger):
```tsx
          <TabsTrigger value="photos" className="flex-1 text-xs sm:text-sm">
            Photos
          </TabsTrigger>
```

With:
```tsx
          <TabsTrigger value="photos" className="flex-1 text-xs sm:text-sm">
            Photos{photos?.length ? ` (${photos.length})` : ""}
          </TabsTrigger>
```

- [ ] **Step 4: Add a `photoCaptureRef` to control PhotoCapture from PhotoGrid's empty state**

After line 99 (`const [editOpen, setEditOpen] = useState(false);`), add:

```typescript
const [photoCaptureOpen, setPhotoCaptureOpen] = useState(false);
```

- [ ] **Step 5: Replace the Photos tab content**

Replace lines 446-456 (the entire `<TabsContent value="photos">` block):
```tsx
        <TabsContent value="photos" className="mt-4">
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Camera className="mx-auto h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">Photos</p>
                <p className="text-sm mt-1">Photo capture coming in Phase 6.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
```

With:
```tsx
        <TabsContent value="photos" className="mt-4 space-y-4">
          <PhotoCapture jobId={job.id} clientId={job.client_id} />
          <PhotoGrid
            jobId={job.id}
            onAddPhoto={() => setPhotoCaptureOpen(true)}
          />
          {/* Controlled PhotoCapture for empty-state "Add Photo" link */}
          <PhotoCapture
            jobId={job.id}
            clientId={job.client_id}
            open={photoCaptureOpen}
            onOpenChange={setPhotoCaptureOpen}
          />
        </TabsContent>
```

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: Build succeeds. The `Camera` import already exists in this file (line 17), so no new import needed for the icon.

- [ ] **Step 7: Commit**

```bash
git add src/pages/JobDetail.tsx
git commit -m "feat: integrate PhotoCapture and PhotoGrid into JobDetail Photos tab"
```

---

### Task 9: Create QuickPhotoButton & Update Dashboard

**Files:**
- Create: `src/components/photos/QuickPhotoButton.tsx`
- Modify: `src/pages/Dashboard.tsx` (lines 131-138, quick actions)

- [ ] **Step 1: Create QuickPhotoButton component**

This uses `PhotoCapture` in controlled mode (passing `open`/`onOpenChange`), avoiding code duplication.

```tsx
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
```

- [ ] **Step 2: Update Dashboard.tsx — fix Camera icon and add QuickPhotoButton**

In `src/pages/Dashboard.tsx`, make these changes:

**Change 1:** Replace the Camera import with Users (line 8):
Replace:
```tsx
  Camera,
```
With:
```tsx
  Users,
```

**Change 2:** Add QuickPhotoButton import after the existing component imports (after line 13):
```tsx
import { QuickPhotoButton } from "@/components/photos/QuickPhotoButton";
```

**Change 3:** Replace the "View Clients" button and add QuickPhotoButton (lines 131-138):
Replace:
```tsx
        <Button
          variant="outline"
          onClick={() => navigate("/clients")}
          className="gap-2"
        >
          <Camera className="h-4 w-4" />
          View Clients
        </Button>
```
With:
```tsx
        <Button
          variant="outline"
          onClick={() => navigate("/clients")}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          View Clients
        </Button>
        <QuickPhotoButton />
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/photos/QuickPhotoButton.tsx src/pages/Dashboard.tsx
git commit -m "feat: add QuickPhotoButton on Dashboard, fix View Clients icon"
```

---

## Chunk 4: Verification

### Task 10: Full Build Verification & Manual Test

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Zero TypeScript errors, zero warnings.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors introduced.

- [ ] **Step 3: Start dev server and verify**

Run: `npm run dev`
Then manually verify:
1. Navigate to a job → Photos tab → tap "Add Photo"
2. Capture/select a photo via camera or file picker
3. Add notes and measurements, save
4. Photo appears in the grid with type badge
5. Tap photo → full-size view with metadata
6. Filter tabs filter correctly
7. Dashboard → "Take Photo" → select job → capture flow works
8. Photo count shows on the Photos tab trigger

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address verification issues from Phase 6"
```
