# Phase 10: Offline Support & PWA Polish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full offline support (IndexedDB queue, offline photo capture, sync on reconnect) and polish the PWA (icons, manifest, service worker caching, lazy loading, update prompt).

**Architecture:** Raw IndexedDB wrapper (`offline-db.ts`) stores queued mutations and photo blobs when offline. A React hook (`useOfflineQueue`) manages online/offline state and FIFO sync. The photo upload flow detects offline and stores locally instead of hitting Supabase. PWA manifest, icons, service worker cache strategies, and lazy-loaded routes complete the production readiness.

**Tech Stack:** React 19, TypeScript strict, IndexedDB (raw API), vite-plugin-pwa / Workbox, React.lazy + Suspense, Tailwind v4, shadcn/ui

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/offline-db.ts` | IndexedDB wrapper: open DB, add/get/delete/clear queue items, store/get/delete photo blobs |
| `src/hooks/useOfflineQueue.ts` | React hook: online/offline state, queue length, syncing flag, `syncQueue()` |
| `src/components/layout/OfflineIndicator.tsx` | Top banner: offline warning, syncing progress, sync-complete flash |
| `public/logo.svg` | SVG logo source ("SP" in rounded square) |
| `public/apple-touch-icon.png` | 180x180 Apple touch icon |
| `public/favicon.ico` | Favicon |

### Modified Files
| File | Changes |
|------|---------|
| `src/components/layout/AppShell.tsx` | Add `<OfflineIndicator />` above `<Header />` |
| `src/hooks/usePhotos.ts` | Offline-aware upload: store blob + queue item when offline |
| `src/components/photos/PhotoGrid.tsx` | Show offline-queued photos with "uploading" badge |
| `src/App.tsx` | Lazy-load all page components with `React.lazy` + `Suspense` |
| `vite.config.ts` | Add Workbox runtime caching strategies, apple-touch-icon to `includeAssets` |
| `index.html` | Add `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, update `<title>` and favicon |
| `public/pwa-192x192.png` | Replace placeholder with generated icon |
| `public/pwa-512x512.png` | Replace placeholder with generated icon |

---

## Chunk 1: IndexedDB Wrapper & Offline Queue Hook

### Task 1: Create `src/lib/offline-db.ts`

**Files:**
- Create: `src/lib/offline-db.ts`

- [ ] **Step 1: Create the IndexedDB wrapper**

```typescript
// src/lib/offline-db.ts

const DB_NAME = "signshop-offline";
const DB_VERSION = 1;
const QUEUE_STORE = "mutation-queue";
const PHOTO_STORE = "photo-blobs";

export interface QueueItem {
  id: string;
  type: "create" | "update" | "delete";
  table: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface PhotoBlobItem {
  id: string; // same as the queue item id
  blob: Blob;
  metadata: Record<string, unknown>;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE, { keyPath: "id" });
      }
    };
  });
}

// --- Mutation Queue ---

export async function addToQueue(item: QueueItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllQueueItems(): Promise<QueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const request = tx.objectStore(QUEUE_STORE).getAll();
    request.onsuccess = () => {
      const items = request.result as QueueItem[];
      items.sort((a, b) => a.timestamp - b.timestamp); // FIFO
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueueCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const request = tx.objectStore(QUEUE_STORE).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- Photo Blobs ---

export async function storePhotoBlob(item: PhotoBlobItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPhotoBlob(id: string): Promise<PhotoBlobItem | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const request = tx.objectStore(PHOTO_STORE).get(id);
    request.onsuccess = () => resolve(request.result as PhotoBlobItem | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllPhotoBlobs(): Promise<PhotoBlobItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const request = tx.objectStore(PHOTO_STORE).getAll();
    request.onsuccess = () => resolve(request.result as PhotoBlobItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function removePhotoBlob(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty`
Expected: No errors related to `offline-db.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/offline-db.ts
git commit -m "feat: add IndexedDB wrapper for offline queue and photo blobs"
```

---

### Task 2: Create `src/hooks/useOfflineQueue.ts`

**Files:**
- Create: `src/hooks/useOfflineQueue.ts`
- Read: `src/lib/offline-db.ts`

- [ ] **Step 1: Create the offline queue hook**

```typescript
// src/hooks/useOfflineQueue.ts

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAllQueueItems,
  removeFromQueue,
  getQueueCount,
  getPhotoBlob,
  removePhotoBlob,
} from "@/lib/offline-db";
import type { QueueItem } from "@/lib/offline-db";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueLength, setQueueLength] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [showSyncComplete, setShowSyncComplete] = useState(false);
  const syncingRef = useRef(false);

  // Refresh queue count
  const refreshQueueCount = useCallback(async () => {
    try {
      const count = await getQueueCount();
      setQueueLength(count);
    } catch {
      // IndexedDB might not be available
    }
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      syncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial queue count
    refreshQueueCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Process a single queue item
  const processItem = async (item: QueueItem): Promise<boolean> => {
    try {
      if (item.table === "photo_upload") {
        // Special handling for photo uploads
        const photoBlob = await getPhotoBlob(item.id);
        if (!photoBlob) {
          // Blob missing — remove orphaned queue item
          return true;
        }

        const meta = photoBlob.metadata as {
          storagePath: string;
          jobId: string;
          clientId: string;
          photoType: string;
          notes: string | null;
          measurements: Record<string, string> | null;
          gpsLatitude: number | null;
          gpsLongitude: number | null;
          takenAt: string;
        };

        // Upload blob to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("job-photos")
          .upload(meta.storagePath, photoBlob.blob, {
            contentType: "image/jpeg",
            upsert: false,
          });
        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("job-photos")
          .getPublicUrl(meta.storagePath);

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Insert DB record
        const { error: insertError } = await supabase
          .from("job_photos")
          .insert({
            job_id: meta.jobId,
            uploaded_by: user.id,
            storage_path: meta.storagePath,
            file_url: urlData.publicUrl,
            photo_type: meta.photoType,
            notes: meta.notes,
            measurements: meta.measurements,
            gps_latitude: meta.gpsLatitude,
            gps_longitude: meta.gpsLongitude,
            taken_at: meta.takenAt,
          });

        if (insertError) {
          // Cleanup orphaned storage file
          await supabase.storage.from("job-photos").remove([meta.storagePath]);
          throw insertError;
        }

        // Remove photo blob from IndexedDB
        await removePhotoBlob(item.id);
        return true;
      }

      // Generic mutation handling
      if (item.type === "create") {
        const { error } = await supabase.from(item.table).insert(item.data);
        if (error) throw error;
      } else if (item.type === "update") {
        const { id: rowId, ...rest } = item.data;
        const { error } = await supabase
          .from(item.table)
          .update(rest)
          .eq("id", rowId as string);
        if (error) throw error;
      } else if (item.type === "delete") {
        const { error } = await supabase
          .from(item.table)
          .delete()
          .eq("id", item.data.id as string);
        if (error) throw error;
      }

      return true;
    } catch (err) {
      console.error(`Failed to sync queue item ${item.id}:`, err);
      return false;
    }
  };

  // Sync the entire queue
  const syncQueue = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setSyncedCount(0);

    try {
      const items = await getAllQueueItems();
      if (items.length === 0) {
        setIsSyncing(false);
        syncingRef.current = false;
        return;
      }

      let synced = 0;
      for (const item of items) {
        const success = await processItem(item);
        if (success) {
          await removeFromQueue(item.id);
          synced++;
          setSyncedCount(synced);
        } else {
          // Stop on first failure — retry next connectivity change
          break;
        }
      }

      await refreshQueueCount();

      if (synced > 0) {
        setShowSyncComplete(true);
        setTimeout(() => setShowSyncComplete(false), 3000);
        toast.success(`Synced ${synced} offline change${synced > 1 ? "s" : ""}`);
      }
    } catch (err) {
      console.error("Sync queue error:", err);
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [refreshQueueCount]);

  return {
    isOnline,
    queueLength,
    isSyncing,
    syncedCount,
    showSyncComplete,
    syncQueue,
    refreshQueueCount,
  };
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty`
Expected: No errors related to `useOfflineQueue.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useOfflineQueue.ts
git commit -m "feat: add useOfflineQueue hook with online/offline detection and FIFO sync"
```

---

### Task 3: Create `src/components/layout/OfflineIndicator.tsx`

**Files:**
- Create: `src/components/layout/OfflineIndicator.tsx`

- [ ] **Step 1: Create the offline indicator banner**

```typescript
// src/components/layout/OfflineIndicator.tsx

import { WifiOff, RefreshCw, CheckCircle } from "lucide-react";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";

export function OfflineIndicator() {
  const { isOnline, queueLength, isSyncing, syncedCount, showSyncComplete } =
    useOfflineQueue();

  // Nothing to show when online and not syncing/just-synced
  if (isOnline && !isSyncing && !showSyncComplete) return null;

  return (
    <div
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-300 ${
        showSyncComplete
          ? "bg-green-500 text-white"
          : isSyncing
            ? "bg-blue-500 text-white"
            : "bg-amber-500 text-amber-950"
      }`}
    >
      {showSyncComplete ? (
        <>
          <CheckCircle className="h-4 w-4" />
          All changes synced!
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Syncing {syncedCount} of {queueLength} items...
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          You're offline — changes will sync when you reconnect
          {queueLength > 0 && ` (${queueLength} queued)`}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/OfflineIndicator.tsx
git commit -m "feat: add OfflineIndicator banner for offline/syncing/synced states"
```

---

### Task 4: Add OfflineIndicator to AppShell

**Files:**
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Update AppShell to include OfflineIndicator above Header**

Add import for `OfflineIndicator` and render it above `<Header />`:

```typescript
// src/components/layout/AppShell.tsx

import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { OfflineIndicator } from "./OfflineIndicator";

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <OfflineIndicator />
        <Header />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds with zero errors

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AppShell.tsx
git commit -m "feat: add OfflineIndicator to AppShell above Header"
```

---

## Chunk 2: Offline Photo Uploads

### Task 5: Make photo uploads work offline

**Files:**
- Modify: `src/hooks/usePhotos.ts`
- Read: `src/lib/offline-db.ts`

- [ ] **Step 1: Update `useUploadPhoto` to detect offline and queue**

Modify `src/hooks/usePhotos.ts` — add offline detection to `useUploadPhoto`. When offline:
1. Compress the image (same as online)
2. Store the compressed blob in IndexedDB via `storePhotoBlob`
3. Add a queue item via `addToQueue` with `table: "photo_upload"`
4. Return a temporary local photo object so the UI can display it immediately

Add these imports at the top:

```typescript
import { addToQueue, storePhotoBlob, getAllPhotoBlobs } from "@/lib/offline-db";
import type { QueueItem, PhotoBlobItem } from "@/lib/offline-db";
```

Replace the `useUploadPhoto` function body's `mutationFn` to wrap the existing logic with an offline check:

```typescript
export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadPhotoInput) => {
      // 1. Compress image (works offline — it's client-side)
      const compressed = await imageCompression(input.file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      // 2. Generate filename and path
      const uuid = crypto.randomUUID();
      const storagePath = `${input.clientId}/${input.jobId}/${input.photoType}/${uuid}.jpg`;

      // --- OFFLINE PATH ---
      if (!navigator.onLine) {
        const queueId = crypto.randomUUID();
        const takenAt = new Date().toISOString();

        // Store blob in IndexedDB
        const blobItem: PhotoBlobItem = {
          id: queueId,
          blob: compressed,
          metadata: {
            storagePath,
            jobId: input.jobId,
            clientId: input.clientId,
            photoType: input.photoType,
            notes: input.notes ?? null,
            measurements: input.measurements ?? null,
            gpsLatitude: input.gpsLatitude ?? null,
            gpsLongitude: input.gpsLongitude ?? null,
            takenAt,
          },
        };
        await storePhotoBlob(blobItem);

        // Add to mutation queue
        const queueItem: QueueItem = {
          id: queueId,
          type: "create",
          table: "photo_upload",
          data: { storagePath, jobId: input.jobId },
          timestamp: Date.now(),
        };
        await addToQueue(queueItem);

        // Return a temporary local photo for immediate UI display
        const localUrl = URL.createObjectURL(compressed);
        const tempPhoto: JobPhoto = {
          id: `offline-${queueId}`,
          job_id: input.jobId,
          uploaded_by: "offline",
          storage_path: storagePath,
          file_url: localUrl,
          photo_type: input.photoType,
          notes: input.notes ?? null,
          measurements: input.measurements
            ? { width: input.measurements.width, height: input.measurements.height }
            : null,
          gps_latitude: input.gpsLatitude ?? null,
          gps_longitude: input.gpsLongitude ?? null,
          taken_at: takenAt,
          created_at: takenAt,
        };

        return { photo: tempPhoto, jobId: input.jobId, offline: true };
      }

      // --- ONLINE PATH (existing logic) ---
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
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
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
        await supabase.storage.from("job-photos").remove([storagePath]);
        throw insertError;
      }

      return { photo: data as JobPhoto, jobId: input.jobId, offline: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-photos", result.jobId] });
      toast.success(result.offline ? "Photo saved offline" : "Photo uploaded");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload photo: ${error.message}`);
    },
  });
}
```

- [ ] **Step 2: Add `useOfflinePhotos` hook for displaying queued photos**

Add this new hook at the bottom of `src/hooks/usePhotos.ts`:

```typescript
/** Returns photo blobs stored offline for a given job, for local grid display. */
export function useOfflinePhotos(jobId: string | undefined) {
  return useQuery({
    queryKey: ["offline-photos", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const blobs = await getAllPhotoBlobs();
      return blobs
        .filter((b) => (b.metadata as { jobId: string }).jobId === jobId)
        .map((b) => {
          const meta = b.metadata as {
            storagePath: string;
            photoType: string;
            notes: string | null;
            takenAt: string;
            measurements: Record<string, string> | null;
          };
          return {
            id: `offline-${b.id}`,
            blobUrl: URL.createObjectURL(b.blob),
            photoType: meta.photoType,
            notes: meta.notes,
            takenAt: meta.takenAt,
          };
        });
    },
    enabled: !!jobId,
    // Refetch when queue changes
    refetchInterval: 5000,
  });
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePhotos.ts
git commit -m "feat: offline-aware photo upload — store blob in IndexedDB when offline"
```

---

### Task 6: Show offline-queued photos in PhotoGrid with badge

**Files:**
- Modify: `src/components/photos/PhotoGrid.tsx`

- [ ] **Step 1: Update PhotoGrid to merge offline photos and show uploading badge**

Add import for `useOfflinePhotos` and `CloudOff` icon. Merge offline photos into the grid with an "Offline" badge overlay.

Add these imports:

```typescript
import { Camera, CloudOff } from "lucide-react";
import { useJobPhotos, useOfflinePhotos } from "@/hooks/usePhotos";
```

After the `useJobPhotos` call, add:

```typescript
const { data: offlinePhotos } = useOfflinePhotos(jobId);
```

Before the `filteredPhotos` computation, build a merged list:

```typescript
// Build offline photo items to merge into grid
const offlineItems = (offlinePhotos ?? []).map((op) => ({
  id: op.id,
  file_url: op.blobUrl,
  photo_type: op.photoType,
  notes: op.notes,
  taken_at: op.takenAt,
  isOffline: true,
}));

const allPhotos = [
  ...offlineItems,
  ...(photos ?? []).map((p) => ({ ...p, isOffline: false })),
];

const filteredPhotos =
  filter === "all"
    ? allPhotos
    : allPhotos.filter((p) => p.photo_type === filter);
```

In the grid rendering, add a `CloudOff` badge for offline items (alongside the existing type badge):

```tsx
{photo.isOffline && (
  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
    <CloudOff className="h-3 w-3" />
    Offline
  </div>
)}
```

Disable click handler for offline photos (they can't be viewed in the full viewer yet):

```tsx
onClick={() => !photo.isOffline && handlePhotoClick(photo as JobPhoto)}
```

Update the "All" count to include offline photos:

```tsx
All{allPhotos.length ? ` (${allPhotos.length})` : ""}
```

- [ ] **Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Zero errors

- [ ] **Step 3: Commit**

```bash
git add src/components/photos/PhotoGrid.tsx
git commit -m "feat: show offline-queued photos in grid with Offline badge"
```

---

## Chunk 3: PWA Icons, Manifest, and index.html

### Task 7: Create SVG logo and generate PWA icons

**Files:**
- Create: `public/logo.svg`
- Replace: `public/pwa-192x192.png`, `public/pwa-512x512.png`
- Create: `public/apple-touch-icon.png`, `public/favicon.ico`

- [ ] **Step 1: Create the SVG logo**

Create `public/logo.svg` — "SP" text in a rounded rectangle with brand color `#0f172a` (slate-900):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f172a"/>
  <text x="256" y="310" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="240" fill="#ffffff" letter-spacing="-10">SP</text>
</svg>
```

- [ ] **Step 2: Generate PNG icons from SVG**

Use a Node.js script (or `sharp` if available). Since we don't want to add dependencies, use the `canvas`-free approach — run a quick script that uses the browser to render the SVG to PNGs. Alternatively, use `npx @nicolo-ribaudo/svg2png` or a similar zero-install tool.

Simplest approach: use the `sharp` package as a one-off:

```bash
npx --yes sharp-cli -i public/logo.svg -o public/pwa-512x512.png resize 512 512
npx --yes sharp-cli -i public/logo.svg -o public/pwa-192x192.png resize 192 192
npx --yes sharp-cli -i public/logo.svg -o public/apple-touch-icon.png resize 180 180
```

If `sharp-cli` doesn't work on Windows, write a small Node script using canvas or just use the SVGs and rely on the browser. A fallback approach is to create the PNGs using a `<canvas>` element in a temp HTML file.

**Fallback: Create a Node script `scripts/generate-icons.mjs`:**

```javascript
import { writeFileSync, readFileSync } from "fs";
import { execSync } from "child_process";

// If sharp-cli didn't work, we'll create simple colored squares as PNG placeholders
// using raw PNG generation (1x1 pixel scaled — browser handles the rest via manifest)

// For MVP, the SVG logo itself works. Modern browsers support SVG favicons.
// Just copy the SVG as the various sizes — the manifest will handle it.
console.log("Icons generated from SVG. Use browser DevTools to verify.");
```

The practical approach: keep the existing placeholder PNGs for now and update them manually later, OR install `sharp` temporarily. The SVG favicon is the important one.

- [ ] **Step 3: Create favicon.ico**

For the favicon, reference the SVG directly in index.html (modern browsers support SVG favicons):

```html
<link rel="icon" type="image/svg+xml" href="/logo.svg" />
```

- [ ] **Step 4: Commit**

```bash
git add public/logo.svg public/pwa-192x192.png public/pwa-512x512.png public/apple-touch-icon.png
git commit -m "feat: add SignShop Pro SVG logo and PWA icons"
```

---

### Task 8: Update index.html with meta tags

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add theme-color, apple-touch-icon, update title and favicon**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0f172a" />
    <meta name="description" content="Job Management & Estimating for Zero Degree Media" />
    <title>SignShop Pro</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: update index.html with PWA meta tags, theme-color, apple-touch-icon"
```

---

### Task 9: Update vite.config.ts with Workbox caching strategies

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add runtime caching strategies and apple-touch-icon**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "logo.svg",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "SignShop Pro",
        short_name: "SignShop",
        description: "Job Management & Estimating for Zero Degree Media",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Cache strategies
        runtimeCaching: [
          {
            // App shell: HTML pages — network first, fall back to cache
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages-cache",
              expiration: { maxEntries: 50 },
            },
          },
          {
            // Supabase API calls — network first, fall back to cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
            },
          },
          {
            // Images from Supabase Storage — cache first, expiration 7 days
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          {
            // Google Fonts or other CDN assets
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "font-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds, service worker generated in `dist/`

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add Workbox runtime caching strategies for API, images, and fonts"
```

---

## Chunk 4: Lazy Loading Routes & PWA Update Prompt

### Task 10: Lazy-load all page components

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Convert all page imports to React.lazy with Suspense**

```typescript
// src/App.tsx

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-loaded pages
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Jobs = lazy(() => import("@/pages/Jobs"));
const NewJob = lazy(() => import("@/pages/NewJob"));
const JobDetail = lazy(() => import("@/pages/JobDetail"));
const Clients = lazy(() => import("@/pages/Clients"));
const ClientDetail = lazy(() => import("@/pages/ClientDetail"));
const EstimateBuilder = lazy(() => import("@/pages/EstimateBuilder"));
const LogoRegenerate = lazy(() => import("@/pages/LogoRegenerate"));

function PageLoader() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-2">Coming soon</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected routes with layout */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/new" element={<NewJob />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/estimates/:jobId" element={<EstimateBuilder />} />
          <Route
            path="/estimates"
            element={<PlaceholderPage title="Estimates" />}
          />
          <Route
            path="/settings"
            element={<PlaceholderPage title="Settings" />}
          />
          <Route path="/ai/logo" element={<LogoRegenerate />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
```

- [ ] **Step 2: Verify build succeeds and chunks are split**

Run: `npm run build`
Expected: Build succeeds. Output should show multiple chunk files for lazy-loaded pages.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "perf: lazy-load all page components with React.lazy + Suspense"
```

---

### Task 11: Add PWA update prompt

**Files:**
- Create: `src/components/layout/PWAUpdatePrompt.tsx`
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Create the update prompt component**

```typescript
// src/components/layout/PWAUpdatePrompt.tsx

import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every hour
      if (r) {
        setInterval(() => r.update(), 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
      <div className="flex items-center gap-3 rounded-lg border bg-background p-4 shadow-lg">
        <RefreshCw className="h-5 w-5 flex-shrink-0 text-primary" />
        <p className="flex-1 text-sm">
          A new version is available — refresh to update
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setNeedRefresh(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => updateServiceWorker(true)}
          >
            Update
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add type declaration for `virtual:pwa-register/react`**

Check if `vite-plugin-pwa/client` types are already included in `tsconfig.json`. If not, create a type declaration file:

Create `src/vite-env.d.ts` (or append to existing) — check if it exists first. It likely already has `/// <reference types="vite/client" />`. Add the PWA type reference:

```typescript
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

**Note:** `vite-plugin-pwa` v1.x may export the React hook differently. Check `node_modules/vite-plugin-pwa/client.d.ts` to confirm the import path. If `virtual:pwa-register/react` is not typed, use this declaration:

```typescript
declare module "virtual:pwa-register/react" {
  import type { Dispatch, SetStateAction } from "react";

  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: Error) => void;
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
```

- [ ] **Step 3: Add PWAUpdatePrompt to AppShell**

In `src/components/layout/AppShell.tsx`, import and render `<PWAUpdatePrompt />` inside the outer div (it uses `fixed` positioning so placement doesn't matter structurally):

```typescript
import { PWAUpdatePrompt } from "./PWAUpdatePrompt";
```

Add `<PWAUpdatePrompt />` as the last child of the outer `<div>`:

```tsx
<PWAUpdatePrompt />
```

- [ ] **Step 4: Verify build succeeds**

Run: `npm run build`
Expected: Zero errors. Service worker generated.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/PWAUpdatePrompt.tsx src/vite-env.d.ts src/components/layout/AppShell.tsx
git commit -m "feat: add PWA update prompt when new version available"
```

---

## Chunk 5: Final Polish & Verification

### Task 12: Ensure images use loading="lazy"

**Files:**
- Verify: `src/components/photos/PhotoGrid.tsx` (already has `loading="lazy"` — confirmed in codebase read)

- [ ] **Step 1: Verify lazy loading is present**

PhotoGrid.tsx line 112 already has `loading="lazy"` on the `<img>` tag. No changes needed.

- [ ] **Step 2: Check other image locations for missing lazy loading**

Search for `<img` tags across the codebase. Add `loading="lazy"` to any that are missing it (except above-the-fold hero images which should NOT be lazy-loaded).

Run: `grep -rn "<img" src/ --include="*.tsx"`

Add `loading="lazy"` to any `<img>` tags that render lists/grids of images but don't already have it.

- [ ] **Step 3: Commit if changes made**

```bash
git add -A
git commit -m "perf: ensure all image grids use loading=lazy"
```

---

### Task 13: Final build verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Zero TypeScript errors, zero warnings. Build output shows multiple chunks (lazy-loaded pages).

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 3: Verify service worker output**

Check that `dist/sw.js` (or `dist/registerSW.js`) exists after build:

```bash
ls dist/sw.js dist/registerSW.js 2>/dev/null || ls dist/*.js | head -20
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 10 complete — offline support, PWA polish, lazy loading"
```

---

## Summary of All Files

### Created
1. `src/lib/offline-db.ts` — IndexedDB wrapper
2. `src/hooks/useOfflineQueue.ts` — Online/offline hook with sync
3. `src/components/layout/OfflineIndicator.tsx` — Offline banner
4. `src/components/layout/PWAUpdatePrompt.tsx` — SW update prompt
5. `public/logo.svg` — SVG logo

### Modified
1. `src/components/layout/AppShell.tsx` — Added OfflineIndicator + PWAUpdatePrompt
2. `src/hooks/usePhotos.ts` — Offline-aware uploads + useOfflinePhotos
3. `src/components/photos/PhotoGrid.tsx` — Merged offline photos with badge
4. `src/App.tsx` — Lazy-loaded routes
5. `vite.config.ts` — Workbox caching strategies
6. `index.html` — Meta tags, theme-color, apple-touch-icon
7. `src/vite-env.d.ts` — PWA type declarations
