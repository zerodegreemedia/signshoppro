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
            aria-label="Dismiss update notification"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            Update
          </Button>
        </div>
      </div>
    </div>
  );
}
