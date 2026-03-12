# Phase 6: Photo Capture & Management — Design Spec

## Overview

Field photo capture system for SignShop Pro. Enables capturing storefront/vehicle photos with measurements on-site, organizing them by type, and reviewing them later with measurement overlays.

## Data Flow

```
Camera input → browser-image-compression (max 1MB, 1920px)
             → Supabase Storage bucket "job-photos" (made public via migration)
             → job_photos table insert (metadata, GPS, measurements)
             → TanStack Query invalidation → UI update
```

## New Files

| File | Purpose |
|------|---------|
| `src/hooks/usePhotos.ts` | `useJobPhotos(jobId)`, `useUploadPhoto()`, `useDeletePhoto()` |
| `src/components/photos/PhotoCapture.tsx` | Camera input + metadata form (Sheet) |
| `src/components/photos/PhotoGrid.tsx` | Thumbnail grid with type filter tabs |
| `src/components/photos/PhotoViewer.tsx` | Full-size view dialog with metadata + delete |
| `src/components/photos/MeasurementOverlay.tsx` | Width x height overlay on measurement photos |
| `src/components/photos/QuickPhotoButton.tsx` | Dashboard shortcut: job selector → capture |
| `supabase/migrations/002_storage_updates.sql` | Make buckets public, add client-logos bucket, add client INSERT policy on job_photos |

## Modified Files

| File | Change |
|------|--------|
| `src/pages/JobDetail.tsx` | Replace Photos tab placeholder with PhotoCapture + PhotoGrid |
| `src/pages/Dashboard.tsx` | Add Quick Photo button, fix Camera icon on View Clients button |
| `src/types/database.ts` | Add `notes` and `storage_path` fields to `JobPhoto` interface |

## Storage Architecture

- **Bucket:** `job-photos` — exists in 001 migration as private, 002 migration makes it public
- **Path pattern:** `{client_id}/{job_id}/{photo_type}/{uuid}.jpg`
- **URL generation:** `supabase.storage.from('job-photos').getPublicUrl(path)`
- **Additional bucket:** `client-logos` (public, created in 002 migration for future phases)
- **Existing buckets:** `proofs` also made public in 002 migration

## Database Migration: `002_storage_updates.sql`

This migration only adds what's missing from `001_initial_schema.sql`:

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

## Hook Design: `usePhotos.ts`

### `useJobPhotos(jobId: string)`
- Query key: `["job-photos", jobId]`
- Fetches all photos for a job from `job_photos` table
- Sorted by `taken_at` descending (newest first), falling back to `created_at`
- Returns array of `JobPhoto` with public URLs
- Enabled only when `jobId` is truthy

### `useUploadPhoto()`
- Mutation input interface:
  ```typescript
  interface UploadPhotoInput {
    file: File;
    jobId: string;
    clientId: string;
    photoType: PhotoType;
    notes?: string;
    measurements?: { width: string; height: string };
    gpsLatitude?: number;
    gpsLongitude?: number;
  }
  ```
- Steps:
  1. Compress image using `browser-image-compression` (maxSizeMB: 1, maxWidthOrHeight: 1920)
  2. Generate UUID filename via `crypto.randomUUID()`
  3. Build storage path: `{clientId}/{jobId}/{photoType}/{uuid}.jpg`
  4. Upload to Supabase Storage at that path
  5. Get public URL via `getPublicUrl(storagePath)`
  6. Get current user ID from Supabase auth (`supabase.auth.getUser()`)
  7. Insert record into `job_photos` table with fields:
     - `job_id`, `uploaded_by` (from auth), `storage_path`, `file_url` (public URL)
     - `photo_type`, `notes`, `measurements` (as JSONB)
     - `gps_latitude`, `gps_longitude`
     - `taken_at`: set to `new Date().toISOString()` (capture time)
  8. Invalidate `["job-photos", jobId]` query
- **Partial failure:** If storage upload succeeds but DB insert fails, attempt to delete the orphaned file from storage (best-effort cleanup)
- Success: toast "Photo uploaded"
- Error: toast with error message

### `useDeletePhoto()`
- Mutation that accepts: `{ photoId: string, storagePath: string, jobId: string }`
- Steps:
  1. Delete from Supabase Storage using `storagePath`
  2. Delete record from `job_photos` table by `photoId`
  3. Invalidate `["job-photos", jobId]` query
- Success: toast "Photo deleted"
- Error: toast with error message

## Component Design

### PhotoCapture (Sheet)

- Trigger: "Add Photo" button with Camera icon (44px min tap target)
- Hidden `<input type="file" accept="image/*" capture="environment" />` triggered by styled button
- After image selected, sheet content shows:
  - Image preview thumbnail
  - Photo type selector (Select component, defaults to "reference")
  - Notes textarea (optional)
  - Measurement inputs: width and height fields with "ft" label (shown for all types, optional)
  - "Save Photo" button (full width, prominent)
- `caption` field is intentionally omitted — `notes` serves the same purpose for field use
- On save:
  1. Attempt GPS via `navigator.geolocation.getCurrentPosition()` — if denied or unavailable, proceed without GPS (no error shown to user)
  2. Compress image
  3. Upload to storage + insert to DB via `useUploadPhoto`
  4. Show success toast
  5. Close sheet, reset form
- Loading: spinner overlay on the save button during upload
- Error: toast notification, form stays open for retry

### PhotoGrid

- **Filter tabs** across top: All | Before | Progress | After | Measurement | Reference | Site Survey
- **Grid layout:** 2 columns on mobile, 3 on `md`, 4 on `lg`
- **Each thumbnail:**
  - Image loaded from public URL (`file_url` field)
  - Photo type Badge overlaid in top-right corner
  - Aspect ratio: square crop via `object-cover`
  - Tap opens PhotoViewer dialog
- **Photo count:** Derived from `useJobPhotos` data length (query is shared via TanStack Query cache when Photos tab is active; count shown on tab trigger)
- **Empty state:** Camera icon + "No photos yet — capture your first site photo" + "Add Photo" button
- **Loading state:** Skeleton grid (6 skeleton cards)
- When filtered and no results: "No {type} photos yet"

### PhotoViewer (Dialog)

- Full-resolution image at top
- If photo type is "measurement", render MeasurementOverlay on the image
- Metadata section below image:
  - Photo type badge
  - Notes (if present)
  - Measurements: "12ft x 8ft" (if present)
  - GPS coordinates (if present, formatted to 6 decimal places)
  - Date taken (formatted with `Intl.DateTimeFormat`)
- Delete button: wrapped in `<RoleGate requiredRole="admin">`, red variant
  - Confirmation via AlertDialog: "Delete this photo? This cannot be undone."
  - On confirm: calls `useDeletePhoto`, closes dialog

### MeasurementOverlay

- Renders over the photo image (absolute positioned)
- Shows `{width} x {height}` from measurements JSONB
- Positioned at bottom center of the image
- Semi-transparent dark background strip for readability
- White text, medium font weight
- Only rendered when `measurements` is not null and photo type is "measurement"

### QuickPhotoButton (Dashboard)

- Button labeled "Take Photo" with Camera icon
- On tap: opens a Sheet with job selector
  - Uses Command/Combobox component for searchable job list
  - Shows job title + client name in results
  - Reuses existing `useJobs()` query cache from Dashboard (TanStack Query deduplication)
- After selecting a job: opens PhotoCapture Sheet with the selected job context
- Provides `jobId` and `clientId` to PhotoCapture

## JobDetail Integration

Replace the Photos tab placeholder (lines ~446-456) with:
- PhotoCapture button at top of tab content
- PhotoGrid below, filtered by current job
- Photo count badge on the Photos tab trigger (e.g., "Photos (12)")

## Dashboard Integration

- Add QuickPhotoButton to quick actions section (after existing buttons)
- Fix existing "View Clients" button icon: replace Camera with Users icon (the Camera icon was a mistake)

## Type Updates

Update `JobPhoto` interface in `database.ts`:
- Add `notes: string | null` (exists in DB, missing from interface)
- Add `storage_path: string` (exists in DB, missing from interface)
- Change `photo_type: string` → `photo_type: PhotoType` (use the union type from constants.ts)

## Offline Behavior

Full offline queue integration (IndexedDB blob storage, FIFO upload on reconnect) is deferred to a future phase. For now:
- If offline when saving, the Supabase upload will fail and a toast error will show
- The user can retry when back online
- No data is lost since the form stays open on error

## Dependencies

All required packages are already installed:
- `browser-image-compression` ^2.0.2
- `@supabase/supabase-js` (storage API)
- shadcn/ui components (Sheet, Dialog, AlertDialog, Select, Badge, Tabs, Command, Skeleton)
- `lucide-react` (Camera, Trash2, MapPin, Ruler, Calendar, Users icons)

## Verification Criteria

1. Navigate to job → Photos tab → tap "Add Photo"
2. Capture/select a photo via camera or file picker
3. Add notes and measurements, save
4. Photo appears in grid with type badge
5. Tap photo → full-size view with metadata
6. Admin can delete photo with confirmation
7. Filter tabs work correctly
8. Dashboard "Take Photo" → select job → capture flow works
9. `npm run build` passes with zero errors
