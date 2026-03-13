import { Loader2, MoreVertical, Pencil, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNextActionHint, getTransitions } from "@/lib/job-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StickyActionBarProps {
  status: string;
  onAction: (nextStatus: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isPending?: boolean;
}

export function StickyActionBar({
  status,
  onAction,
  onEdit,
  onDelete,
  isPending,
}: StickyActionBarProps) {
  const hint = getNextActionHint(status);
  const transitions = getTransitions(status);

  if (!hint) return null;

  return (
    <div
      className={cn(
        "border-t bg-background/95 backdrop-blur-sm p-3",
        // Mobile: fixed above bottom nav (64px nav height + safe area)
        "fixed bottom-16 left-0 right-0 z-30",
        // Desktop: sticky at bottom of content
        "md:static md:bottom-auto md:left-auto md:right-auto md:rounded-lg md:border md:mt-4"
      )}
    >
      <div className="flex items-center gap-2 max-w-screen-xl mx-auto">
        {/* Primary action */}
        {transitions.length === 1 ? (
          <Button
            className={cn(
              "flex-1 min-h-[44px] font-semibold text-base",
              hint.isWaiting
                ? "bg-muted text-muted-foreground hover:bg-muted"
                : "bg-gradient-to-r from-primary to-orange-500 text-white hover:opacity-90"
            )}
            onClick={() => onAction(hint.nextStatus)}
            disabled={isPending || hint.isWaiting}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {hint.isWaiting ? `Waiting — ${hint.label}` : hint.label}
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className={cn(
                  "flex-1 min-h-[44px] font-semibold text-base",
                  hint.isWaiting
                    ? "bg-muted text-muted-foreground hover:bg-muted"
                    : "bg-gradient-to-r from-primary to-orange-500 text-white hover:opacity-90"
                )}
                disabled={isPending}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hint.isWaiting ? `Waiting — Update Status` : "Update Status"}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {transitions.map((t) => (
                <DropdownMenuItem
                  key={t.value}
                  onClick={() => onAction(t.value)}
                >
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Overflow menu for secondary actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px] shrink-0">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Job
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Archive Job
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
