import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const ZONES = [
  { id: "hood", label: "Hood", percent: 0.12 },
  { id: "roof", label: "Roof", percent: 0.10 },
  { id: "left_side", label: "Left Side", percent: 0.25 },
  { id: "right_side", label: "Right Side", percent: 0.25 },
  { id: "rear", label: "Rear", percent: 0.08 },
  { id: "tailgate", label: "Tailgate", percent: 0.05 },
] as const;

const ALL_ZONE_IDS = ZONES.map((z) => z.id);

interface WrapCalculatorProps {
  vehicleTotalSqft: number;
  onChange: (coverageSqft: number, selectedZones: string[]) => void;
}

export function WrapCalculator({ vehicleTotalSqft, onChange }: WrapCalculatorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const updateSelection = useCallback(
    (next: Set<string>) => {
      setSelected(next);
      const total = ZONES.filter((z) => next.has(z.id)).reduce(
        (sum, z) => sum + z.percent,
        0
      );
      onChange(Math.round(total * vehicleTotalSqft), [...next]);
    },
    [vehicleTotalSqft, onChange]
  );

  const toggleZone = (zoneId: string) => {
    const next = new Set(selected);
    if (next.has(zoneId)) next.delete(zoneId);
    else next.add(zoneId);
    updateSelection(next);
  };

  const toggleAll = () => {
    const allSelected = ALL_ZONE_IDS.every((id) => selected.has(id));
    updateSelection(allSelected ? new Set() : new Set(ALL_ZONE_IDS));
  };

  const isAllSelected = ALL_ZONE_IDS.every((id) => selected.has(id));
  const coverageSqft = ZONES.filter((z) => selected.has(z.id)).reduce(
    (sum, z) => sum + z.percent,
    0
  ) * vehicleTotalSqft;

  return (
    <div className="space-y-3">
      {/* Full Wrap toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant={isAllSelected ? "default" : "outline"}
          size="sm"
          onClick={toggleAll}
          className="min-h-[44px]"
        >
          {isAllSelected ? "Full Wrap Selected" : "Select Full Wrap"}
        </Button>
        <span className="text-sm font-medium tabular-nums">
          {Math.round(coverageSqft)} sqft
        </span>
      </div>

      {/* Vehicle zone grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Row 1: Hood - Roof - Rear */}
        {(["hood", "roof", "rear"] as const).map((zoneId) => {
          const zone = ZONES.find((z) => z.id === zoneId)!;
          const isSelected = selected.has(zone.id);
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => toggleZone(zone.id)}
              className={cn(
                "rounded-lg border-2 p-3 text-center transition-colors min-h-[60px]",
                "flex flex-col items-center justify-center gap-0.5",
                isSelected
                  ? "bg-primary/15 border-primary text-primary"
                  : "bg-muted/50 border-border text-muted-foreground hover:border-muted-foreground/50"
              )}
            >
              <span className="text-xs font-medium">{zone.label}</span>
              <span className="text-[10px] tabular-nums">
                {Math.round(zone.percent * vehicleTotalSqft)} sqft
              </span>
            </button>
          );
        })}

        {/* Row 2: Left Side - (spacer) - Right Side */}
        {(() => {
          const leftZone = ZONES.find((z) => z.id === "left_side")!;
          const rightZone = ZONES.find((z) => z.id === "right_side")!;
          const leftSelected = selected.has(leftZone.id);
          const rightSelected = selected.has(rightZone.id);
          return (
            <>
              <button
                key={leftZone.id}
                type="button"
                onClick={() => toggleZone(leftZone.id)}
                className={cn(
                  "rounded-lg border-2 p-3 text-center transition-colors min-h-[60px]",
                  "flex flex-col items-center justify-center gap-0.5",
                  leftSelected
                    ? "bg-primary/15 border-primary text-primary"
                    : "bg-muted/50 border-border text-muted-foreground hover:border-muted-foreground/50"
                )}
              >
                <span className="text-xs font-medium">{leftZone.label}</span>
                <span className="text-[10px] tabular-nums">
                  {Math.round(leftZone.percent * vehicleTotalSqft)} sqft
                </span>
              </button>
              <div
                className="rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center"
              >
                <span className="text-[10px] text-muted-foreground/50">Vehicle</span>
              </div>
              <button
                key={rightZone.id}
                type="button"
                onClick={() => toggleZone(rightZone.id)}
                className={cn(
                  "rounded-lg border-2 p-3 text-center transition-colors min-h-[60px]",
                  "flex flex-col items-center justify-center gap-0.5",
                  rightSelected
                    ? "bg-primary/15 border-primary text-primary"
                    : "bg-muted/50 border-border text-muted-foreground hover:border-muted-foreground/50"
                )}
              >
                <span className="text-xs font-medium">{rightZone.label}</span>
                <span className="text-[10px] tabular-nums">
                  {Math.round(rightZone.percent * vehicleTotalSqft)} sqft
                </span>
              </button>
            </>
          );
        })()}

        {/* Row 3: Tailgate centered */}
        <div /> {/* empty cell */}
        {(() => {
          const zone = ZONES.find((z) => z.id === "tailgate")!;
          const isSelected = selected.has(zone.id);
          return (
            <button
              type="button"
              onClick={() => toggleZone(zone.id)}
              className={cn(
                "rounded-lg border-2 p-3 text-center transition-colors min-h-[60px]",
                "flex flex-col items-center justify-center gap-0.5",
                isSelected
                  ? "bg-primary/15 border-primary text-primary"
                  : "bg-muted/50 border-border text-muted-foreground hover:border-muted-foreground/50"
              )}
            >
              <span className="text-xs font-medium">{zone.label}</span>
              <span className="text-[10px] tabular-nums">
                {Math.round(zone.percent * vehicleTotalSqft)} sqft
              </span>
            </button>
          );
        })()}
        <div /> {/* empty cell */}
      </div>
    </div>
  );
}
