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
