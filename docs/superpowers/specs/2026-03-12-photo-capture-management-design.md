# Phase 6: Photo Capture & Management — Design Spec

## Overview

Field photo capture system for SignShop Pro. Enables capturing storefront/vehicle photos with measurements on-site, organizing them by type, and reviewing them later with measurement overlays.

## Data Flow

```
Camera input → browser-image-compression (max 1MB, 1920px)
             → Supabase Storage public bucket ("job-photos")
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
| `supabase/migrations/002_storage.sql` | Storage buckets + RLS policies |

## Modified Files

| File | Change |
|------|--------|
| `src/pages/JobDetail.tsx` | Replace Photos tab placeholder with PhotoCapture + PhotoGrid |
| `src/pages/Dashboard.tsx` | Add Quick Photo button to quick actions |
| `src/types/database.ts` | Add `notes` field to `JobPhoto` interface |

## Storage Architecture

- **Bucket:** `job-photos` (public, no signed URLs needed)
- **Path pattern:** `{client_id}/{job_id}/{photo_type}/{uuid}.jpg`
- **URL generation:** `supabase.storage.from('job-photos').getPublicUrl(path)`
- **Additional buckets** (for future phases): `proofs` (public), `client-logos` (public)

## Hook Design: `usePhotos.ts`

### `useJobPhotos(jobId: string)`
- Query key: `["job-photos", jobId]`
- Fetches all photos for a job from `job_photos` table
- Sorted by `taken_at` descending (newest first)
- Returns array of `JobPhoto` with public URLs
- Enabled only when `jobId` is truthy

### `useUploadPhoto()`
- Mutation that accepts: `{ file: File, jobId: string, clientId: string, photoType: PhotoType, notes?: string, measurements?: { width: string, height: string }, gpsLatitude?: number, gpsLongitude?: number }`
- Steps:
  1. Compress image using `browser-image-compression` (maxSizeMB: 1, maxWidthOrHeight: 1920)
  2. Generate UUID filename
  3. Upload to Supabase Storage at `{clientId}/{jobId}/{photoType}/{uuid}.jpg`
  4. Get public URL from storage
  5. Insert record into `job_photos` table with all metadata
  6. Invalidate `["job-photos", jobId]` query
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
  - Date taken (formatted with date-fns or Intl)
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
  - Fetches from existing `useJobs()` hook
- After selecting a job: opens PhotoCapture Sheet with the selected job context
- Provides `jobId` and `clientId` to PhotoCapture

## Database Migration: `002_storage.sql`

### Buckets
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('job-photos', 'job-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('proofs', 'proofs', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('client-logos', 'client-logos', true);
```

### Storage RLS Policies
- **Read (all buckets):** Any authenticated user can read (SELECT) objects
- **Insert (job-photos):** Any authenticated user can upload (INSERT) objects
- **Delete (job-photos):** Only admins can delete objects (check `raw_user_meta_data->>'role' = 'admin'`)
- **Update (job-photos):** Only admins can update objects

## JobDetail Integration

Replace the Photos tab placeholder (lines ~446-456) with:
- PhotoCapture button at top of tab content
- PhotoGrid below, filtered by current job
- Photo count badge on the Photos tab trigger (e.g., "Photos (12)")

## Dashboard Integration

Add to quick actions section (after existing buttons):
- QuickPhotoButton component
- Styled as outline variant to match existing button pattern

## Type Updates

Add `notes` field to `JobPhoto` interface in `database.ts` (it exists in the DB schema but is missing from the TypeScript type).

## Dependencies

All required packages are already installed:
- `browser-image-compression` ^2.0.2
- `@supabase/supabase-js` (storage API)
- shadcn/ui components (Sheet, Dialog, AlertDialog, Select, Badge, Tabs, Command, Skeleton)
- `lucide-react` (Camera, Trash2, MapPin, Ruler, Calendar icons)

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
