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

  const refreshQueueCount = useCallback(async () => {
    try {
      const count = await getQueueCount();
      setQueueLength(count);
    } catch {
      // IndexedDB might not be available
    }
  }, []);

  // Process a single queue item
  const processItem = useCallback(
    async (item: QueueItem): Promise<boolean> => {
      try {
        if (item.table === "photo_upload") {
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
            await supabase.storage
              .from("job-photos")
              .remove([meta.storagePath]);
            throw insertError;
          }

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
    },
    [],
  );

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
        toast.success(
          `Synced ${synced} offline change${synced > 1 ? "s" : ""}`,
        );
      }
    } catch (err) {
      console.error("Sync queue error:", err);
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [processItem, refreshQueueCount]);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
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
  }, [syncQueue, refreshQueueCount]);

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
