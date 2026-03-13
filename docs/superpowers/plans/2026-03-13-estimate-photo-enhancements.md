# Estimate Builder & Photo Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slide-over estimate builder, wrap calculator visual, photo measurement overlay, and photo gallery improvements to SignShop Pro.

**Architecture:** Four features implemented as new components + modifications to existing ones. EstimateSheet wraps existing LineItemEditor/QuickAddPresets in a responsive Sheet. WrapCalculator is a pure UI component with zone toggle state. MeasurementOverlay uses SVG positioned over photos. PhotoViewer is rewritten from Dialog to full-screen overlay with swipe.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4, shadcn/ui (Sheet, Button, Badge, ScrollArea, Skeleton), TanStack Query v5, Supabase

**Spec:** `docs/superpowers/specs/2026-03-13-estimate-photo-enhancements-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| CREATE | `src/components/estimates/EstimateSheet.tsx` | Slide-over panel: responsive Sheet wrapping QuickAddPresets + LineItemEditor + sticky total bar |
| CREATE | `src/components/estimates/WrapCalculator.tsx` | Vehicle zone grid with toggle buttons + sqft calculation |
| REWRITE | `src/components/photos/MeasurementOverlay.tsx` | SVG overlay for line annotations in view/edit modes |
| REWRITE | `src/components/photos/PhotoViewer.tsx` | Full-screen swipe viewer replacing Dialog-based viewer |
| MODIFY | `src/components/photos/PhotoGrid.tsx` | Simplified category tabs + pass photo array to viewer |
| MODIFY | `src/types/database.ts` | Widen `JobPhoto.measurements` type for `lines` array |
| MODIFY | `src/hooks/usePhotos.ts` | Add `useUpdatePhoto` mutation hook |
| MODIFY | `src/components/jobs/StickyActionBar.tsx` | Add `onOpenEstimate` callback for estimate statuses |
| MODIFY | `src/components/jobs/JobTimeline.tsx` | Wire estimate node action buttons |
| MODIFY | `src/pages/JobDetail.tsx` | EstimateSheet state, Items tab → summary, wire triggers |

---

## Chunk 1: Foundation (Types + Hooks)

### Task 1: Widen JobPhoto.measurements type

**Files:**
- Modify: `src/types/database.ts:113-128`

- [ ] **Step 1: Add MeasurementLine and PhotoMeasurements interfaces**

In `src/types/database.ts`, add above the `JobPhoto` interface:

```typescript
export interface MeasurementLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}

export interface PhotoMeasurements {
  width?: string;
  height?: string;
  lines?: MeasurementLine[];
}
```

Then change the `measurements` field in `JobPhoto` from:
```typescript
measurements: Record<string, string> | null;
```
to:
```typescript
measurements: PhotoMeasurements | null;
```

- [ ] **Step 2: Fix downstream type errors**

Run: `npm run build 2>&1 | head -50`

The type widening may cause errors in `PhotoViewer.tsx` and `MeasurementOverlay.tsx` where `measurements.width` is accessed. These files will be rewritten in later tasks, but if the build breaks now, add optional chaining (`measurements?.width`) to fix temporarily.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: widen JobPhoto.measurements type for line annotations"
```

### Task 2: Add useUpdatePhoto hook

**Files:**
- Modify: `src/hooks/usePhotos.ts` (add after `useDeletePhoto` at line ~250)

- [ ] **Step 1: Add the useUpdatePhoto mutation**

Add at the end of `src/hooks/usePhotos.ts`, before the closing of the file:

```typescript
interface UpdatePhotoInput {
  photoId: string;
  jobId: string;
  updates: Partial<Pick<JobPhoto, "measurements" | "notes" | "caption">>;
}

export function useUpdatePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePhotoInput) => {
      const { error } = await supabase
        .from("job_photos")
        .update(input.updates)
        .eq("id", input.photoId);
      if (error) throw error;
      return { jobId: input.jobId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-photos", result.jobId] });
      toast.success("Photo updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update photo: ${error.message}`);
    },
  });
}
```

Make sure `JobPhoto` is imported from `@/types/database` at the top of the file (it should already be).

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePhotos.ts
git commit -m "feat: add useUpdatePhoto mutation hook"
```

---

## Chunk 2: EstimateSheet + WrapCalculator

### Task 3: Create WrapCalculator component

**Files:**
- Create: `src/components/estimates/WrapCalculator.tsx`

- [ ] **Step 1: Create the WrapCalculator component**

Create `src/components/estimates/WrapCalculator.tsx`:

```typescript
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: no errors (component is standalone, not yet integrated)

- [ ] **Step 3: Commit**

```bash
git add src/components/estimates/WrapCalculator.tsx
git commit -m "feat: wrap calculator with tappable zone grid + auto sqft calculation"
```

### Task 4: Create EstimateSheet component

**Files:**
- Create: `src/components/estimates/EstimateSheet.tsx`

**Dependencies:** WrapCalculator (Task 3), existing LineItemEditor, QuickAddPresets, Sheet UI component

- [ ] **Step 1: Create the EstimateSheet component**

Create `src/components/estimates/EstimateSheet.tsx`:

```typescript
import { useState, useMemo } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLineItems } from "@/hooks/useLineItems";
import { calculateLineItemTotals } from "@/features/pricing/estimating-engine";
import { WrapCalculator } from "./WrapCalculator";
import QuickAddPresets from "./QuickAddPresets";
import { LineItemEditor } from "./LineItemEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface EstimateSheetProps {
  jobId: string;
  jobTitle: string;
  jobType: string;
  jobStatus: string;
  taxRate: number;
  isAdmin: boolean;
  vehicleTotalSqft?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendEstimate?: () => void;
}

export function EstimateSheet({
  jobId,
  jobTitle,
  jobType,
  jobStatus,
  taxRate,
  isAdmin,
  vehicleTotalSqft,
  open,
  onOpenChange,
  onSendEstimate,
}: EstimateSheetProps) {
  const { data: lineItems, isLoading } = useLineItems(jobId);
  const isDesktop = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
    []
  );

  // WrapCalculator disclosure state
  const [wrapOpen, setWrapOpen] = useState(false);

  const totals = useMemo(() => {
    if (!lineItems?.length) return null;
    return calculateLineItemTotals(lineItems, taxRate);
  }, [lineItems, taxRate]);

  const formatUSD = (amount: number) =>
    amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const canSend = jobStatus === "estimate_draft" && (lineItems?.length ?? 0) > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={cn(
          isDesktop ? "w-[480px] sm:max-w-[480px]" : "max-h-[90vh]",
          "flex flex-col p-0"
        )}
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            Estimate — {jobTitle}
            <Badge variant="secondary" className="text-xs capitalize">
              {jobStatus.replace(/_/g, " ")}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Wrap Calculator (vehicle wraps only) */}
          {jobType === "vehicle_wrap" && vehicleTotalSqft && (
            <div className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 text-sm font-medium"
                onClick={() => setWrapOpen(!wrapOpen)}
              >
                Vehicle Zones
                <span className="text-xs text-muted-foreground">
                  {wrapOpen ? "Collapse" : "Expand"}
                </span>
              </button>
              {wrapOpen && (
                <div className="px-3 pb-3">
                  <WrapCalculator
                    vehicleTotalSqft={vehicleTotalSqft}
                    onChange={() => {}}
                  />
                </div>
              )}
            </div>
          )}

          {/* Quick Add Presets */}
          <QuickAddPresets jobId={jobId} currentItemCount={lineItems?.length ?? 0} />

          {/* Line Items */}
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : (
            <LineItemEditor jobId={jobId} taxRate={taxRate} isAdmin={isAdmin} />
          )}
        </div>

        {/* Sticky bottom bar */}
        <div className="border-t bg-background px-4 py-3 shrink-0 space-y-2">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">
                {totals ? formatUSD(totals.subtotal) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({taxRate}%)</span>
              <span className="font-medium tabular-nums">
                {totals ? formatUSD(totals.taxAmount) : "—"}
              </span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {totals ? formatUSD(totals.grandTotal) : "—"}
              </span>
            </div>
          </div>
          <Button
            className="w-full min-h-[44px] gap-2"
            disabled={!canSend}
            onClick={onSendEstimate}
          >
            <Send className="h-4 w-4" />
            Send to Client
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Note:** The `calculateLineItemTotals` function accepts `LineItemForCalc[]` — the `LineItem` type from the query is a superset (has all required fields: `quantity`, `unit_price`, `cost_price`, `taxable`, `subtotal`), so it passes directly without mapping. Returns `LineItemTotals` with fields `subtotal`, `taxAmount`, `grandTotal` (see `src/features/pricing/estimating-engine.ts:64-72`).

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -50`
Fix any import issues. Key things to check:
- `calculateLineItemTotals` return type field names
- `QuickAddPresets` is a default export
- `LineItemEditor` is a named export

- [ ] **Step 3: Commit**

```bash
git add src/components/estimates/EstimateSheet.tsx
git commit -m "feat: slide-over estimate builder with live total bar"
```

### Task 5: Integrate EstimateSheet into JobDetail + StickyActionBar

**Files:**
- Modify: `src/pages/JobDetail.tsx`
- Modify: `src/components/jobs/StickyActionBar.tsx`

- [ ] **Step 1: Add onOpenEstimate to StickyActionBar**

In `src/components/jobs/StickyActionBar.tsx`:

Add `onOpenEstimate?: () => void` to the `StickyActionBarProps` interface (line 13-19).

Then, for the `lead` and `estimate_draft` statuses, the primary action should open the estimate sheet instead of transitioning status. Modify the primary button's `onClick`:

Where the primary button currently does `onClick={() => onAction(hint.nextStatus)}` (line 53), change to:

```typescript
onClick={() => {
  // For estimate-related statuses, open the estimate sheet
  if (onOpenEstimate && (status === "lead" || status === "estimate_draft")) {
    onOpenEstimate();
  } else {
    onAction(hint.nextStatus);
  }
}}
```

**Note:** The `lead` and `estimate_draft` statuses only have a single transition each (see `src/lib/job-actions.ts:3-4`), so they always render the single-button path (line 45-58), not the DropdownMenu. This intercept only needs to be applied to the single-button `onClick` at line 53. The DropdownMenu path (line 59-87) handles multi-transition statuses like `estimate_sent` and `proof_sent`, which don't need this intercept.

- [ ] **Step 2: Wire EstimateSheet into JobDetail**

In `src/pages/JobDetail.tsx`:

Add state and import at the top of the component (after line 89):
```typescript
const [estimateSheetOpen, setEstimateSheetOpen] = useState(false);
```

Import the EstimateSheet component:
```typescript
import { EstimateSheet } from "@/components/estimates/EstimateSheet";
```

Add `onOpenEstimate` prop to both StickyActionBar instances (lines ~240 and ~474):
```typescript
onOpenEstimate={() => setEstimateSheetOpen(true)}
```

Replace the Items tab content (lines 404-410). Change from:
```tsx
{activeSection === "line-items" && (
  <div className="space-y-4">
    <QuickAddPresets jobId={job.id} currentItemCount={lineItems?.length ?? 0} />
    <LineItemEditor jobId={job.id} taxRate={job.tax_rate ?? 0} isAdmin={isAdmin} />
  </div>
)}
```
to a read-only summary card:
```tsx
{activeSection === "line-items" && (
  <Card>
    <CardContent className="pt-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Line Items</span>
        <span className="font-medium">{lineItems?.length ?? 0}</span>
      </div>
      {lineItems?.length ? (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Estimated Total</span>
            <span className="font-semibold">
              {formatUSD(
                calculateLineItemTotals(lineItems, job.tax_rate ?? 0).grandTotal
              )}
            </span>
          </div>
        </>
      ) : null}
      <Button
        className="w-full min-h-[44px] gap-2"
        onClick={() => setEstimateSheetOpen(true)}
      >
        {lineItems?.length ? "Edit Estimate" : "Create Estimate"}
      </Button>
    </CardContent>
  </Card>
)}
```

Add the EstimateSheet component render (before the closing `</>` of the returned JSX, outside the grid):
```tsx
<EstimateSheet
  jobId={job.id}
  jobTitle={job.title}
  jobType={job.job_type}
  jobStatus={job.status}
  taxRate={job.tax_rate ?? 0}
  isAdmin={isAdmin}
  vehicleTotalSqft={job.vehicle_details?.total_sqft}
  open={estimateSheetOpen}
  onOpenChange={setEstimateSheetOpen}
  onSendEstimate={() => {
    handleStatusChange("estimate_sent");
    setEstimateSheetOpen(false);
  }}
/>
```

Import `calculateLineItemTotals` at the top if not already imported.

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | head -50`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/JobDetail.tsx src/components/jobs/StickyActionBar.tsx
git commit -m "feat: integrate EstimateSheet triggers into JobDetail + StickyActionBar"
```

---

## Chunk 3: MeasurementOverlay

### Task 6: Rewrite MeasurementOverlay with SVG annotation

**Files:**
- Rewrite: `src/components/photos/MeasurementOverlay.tsx`

- [ ] **Step 1: Rewrite the MeasurementOverlay component**

Replace the entire contents of `src/components/photos/MeasurementOverlay.tsx`:

```typescript
import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { MeasurementLine } from "@/types/database";

interface MeasurementOverlayProps {
  photoId: string;
  lines: MeasurementLine[];
  mode: "view" | "edit";
  onLinesChange?: (lines: MeasurementLine[]) => void;
}

export function MeasurementOverlay({
  photoId,
  lines,
  mode,
  onLinesChange,
}: MeasurementOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");

  // Convert click coordinates to percentage (0-100) of SVG dimensions
  const toPercent = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100,
      };
    },
    []
  );

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (mode !== "edit" || !onLinesChange) return;
      if (lines.length >= 10 && !pendingPoint) return; // max 10 lines

      const pt = toPercent(e.clientX, e.clientY);
      if (!pt) return;

      if (!pendingPoint) {
        // First tap — set start point
        setPendingPoint(pt);
      } else {
        // Second tap — create line
        const newLine: MeasurementLine = {
          id: crypto.randomUUID(),
          x1: pendingPoint.x,
          y1: pendingPoint.y,
          x2: pt.x,
          y2: pt.y,
          label: "",
        };
        onLinesChange([...lines, newLine]);
        setEditingLineId(newLine.id);
        setLabelInput("");
        setPendingPoint(null);
      }
    },
    [mode, onLinesChange, lines, pendingPoint, toPercent]
  );

  const handleLabelSubmit = useCallback(
    (lineId: string) => {
      if (!onLinesChange) return;
      onLinesChange(
        lines.map((l) => (l.id === lineId ? { ...l, label: labelInput } : l))
      );
      setEditingLineId(null);
      setLabelInput("");
    },
    [onLinesChange, lines, labelInput]
  );

  const handleDeleteLine = useCallback(
    (lineId: string) => {
      if (!onLinesChange) return;
      onLinesChange(lines.filter((l) => l.id !== lineId));
      setSelectedLineId(null);
    },
    [onLinesChange, lines]
  );

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: mode === "edit" ? "none" : "auto" }}
      onClick={handleSvgClick}
    >
      {/* Pending first point */}
      {pendingPoint && mode === "edit" && (
        <circle
          cx={`${pendingPoint.x}%`}
          cy={`${pendingPoint.y}%`}
          r="6"
          fill="white"
          stroke="black"
          strokeWidth="2"
        />
      )}

      {/* Measurement lines */}
      {lines.map((line) => {
        const midX = (line.x1 + line.x2) / 2;
        const midY = (line.y1 + line.y2) / 2;
        const isEditing = editingLineId === line.id;
        const isSelected = selectedLineId === line.id;

        return (
          <g key={line.id}>
            {/* Dark outline for visibility */}
            <line
              x1={`${line.x1}%`}
              y1={`${line.y1}%`}
              x2={`${line.x2}%`}
              y2={`${line.y2}%`}
              stroke="rgba(0,0,0,0.6)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* White line */}
            <line
              x1={`${line.x1}%`}
              y1={`${line.y1}%`}
              x2={`${line.x2}%`}
              y2={`${line.y2}%`}
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* End caps */}
            <circle cx={`${line.x1}%`} cy={`${line.y1}%`} r="3" fill="white" stroke="black" strokeWidth="1" />
            <circle cx={`${line.x2}%`} cy={`${line.y2}%`} r="3" fill="white" stroke="black" strokeWidth="1" />

            {/* Label at midpoint */}
            {isEditing ? (
              <foreignObject
                x={`${midX - 15}%`}
                y={`${midY - 3}%`}
                width="30%"
                height="6%"
              >
                <Input
                  autoFocus
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLabelSubmit(line.id);
                  }}
                  onBlur={() => handleLabelSubmit(line.id)}
                  placeholder="12ft 6in"
                  className="h-6 text-xs text-center bg-black/70 text-white border-primary"
                />
              </foreignObject>
            ) : (
              <g
                onClick={(e) => {
                  if (mode === "edit") {
                    e.stopPropagation();
                    setSelectedLineId(isSelected ? null : line.id);
                  }
                }}
                style={{ cursor: mode === "edit" ? "pointer" : "default" }}
              >
                <rect
                  x={`${midX - 8}%`}
                  y={`${midY - 2}%`}
                  width="16%"
                  height="4%"
                  rx="4"
                  fill="rgba(0,0,0,0.75)"
                />
                <text
                  x={`${midX}%`}
                  y={`${midY + 0.5}%`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="500"
                >
                  {line.label || "—"}
                </text>
              </g>
            )}

            {/* Delete button when selected */}
            {isSelected && mode === "edit" && (
              <g
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteLine(line.id);
                }}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={`${midX + 10}%`}
                  cy={`${midY - 3}%`}
                  r="8"
                  fill="rgba(220,38,38,0.9)"
                />
                <text
                  x={`${midX + 10}%`}
                  y={`${midY - 3}%`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                >
                  ✕
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: The old `MeasurementOverlay` had a different interface (`measurements: Record<string, string>`). The `PhotoViewer` import will break — this is expected and fixed in Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/components/photos/MeasurementOverlay.tsx
git commit -m "feat: photo measurement overlay with SVG line annotations"
```

---

## Chunk 4: Photo Gallery Improvements

### Task 7: Simplify PhotoGrid category tabs

**Files:**
- Modify: `src/components/photos/PhotoGrid.tsx`

- [ ] **Step 1: Replace Tabs with ScrollArea filter buttons and simplified categories**

In `src/components/photos/PhotoGrid.tsx`:

Replace the `Tabs`/`TabsList`/`TabsTrigger` import with:
```typescript
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
```

Remove the `Tabs` import entirely.

Define simplified categories (add above the component function):
```typescript
const GALLERY_CATEGORIES = [
  { value: "all", label: "All" },
  { value: "before", label: "Before" },
  { value: "survey", label: "Survey" },
  { value: "progress", label: "Progress" },
  { value: "after", label: "After" },
] as const;

const SURVEY_TYPES = new Set(["measurement", "reference", "site_survey"]);
```

Update the filtering logic (lines 47-50). Change from:
```typescript
const filteredPhotos =
  filter === "all"
    ? allPhotos
    : allPhotos.filter((p) => p.photo_type === filter);
```
to:
```typescript
const filteredPhotos =
  filter === "all"
    ? allPhotos
    : filter === "survey"
      ? allPhotos.filter((p) => SURVEY_TYPES.has(p.photo_type))
      : allPhotos.filter((p) => p.photo_type === filter);
```

Replace the Tabs JSX (lines 73-91) with:
```tsx
<ScrollArea className="w-full">
  <div className="flex gap-1.5 pb-1">
    {GALLERY_CATEGORIES.map((cat) => {
      const count =
        cat.value === "all"
          ? allPhotos.length
          : cat.value === "survey"
            ? allPhotos.filter((p) => SURVEY_TYPES.has(p.photo_type)).length
            : allPhotos.filter((p) => p.photo_type === cat.value).length;
      return (
        <Button
          key={cat.value}
          variant={filter === cat.value ? "default" : "ghost"}
          size="sm"
          className="shrink-0 text-xs min-h-[36px]"
          onClick={() => setFilter(cat.value)}
        >
          {cat.label}{count > 0 ? ` (${count})` : ""}
        </Button>
      );
    })}
  </div>
  <ScrollBar orientation="horizontal" />
</ScrollArea>
```

Add `Button` to the imports at the top of PhotoGrid.tsx:
```typescript
import { Button } from "@/components/ui/button";
```

- [ ] **Step 2: Change PhotoGrid to pass photo array + index to PhotoViewer**

Replace the state (line 28):
```typescript
const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
```
with:
```typescript
const [selectedIndex, setSelectedIndex] = useState<number>(-1);
```

Replace `viewerOpen` (line 29):
```typescript
const [viewerOpen, setViewerOpen] = useState(false);
```
stays the same.

Update `handlePhotoClick` (lines 52-55):
```typescript
const handlePhotoClick = (index: number) => {
  setSelectedIndex(index);
  setViewerOpen(true);
};
```

In the grid items' `onClick` (line 130-135), change to pass the index within the **server photos** (since only server photos can be viewed):
```typescript
onClick={() => {
  if (!photo.isOffline) {
    const serverIndex = (photos ?? []).findIndex((p) => p.id === photo.id);
    if (serverIndex >= 0) handlePhotoClick(serverIndex);
  }
}}
```

Update the PhotoViewer render (lines 164-168):
```tsx
<PhotoViewer
  photos={filteredServerPhotos}
  initialIndex={selectedIndex}
  open={viewerOpen}
  onOpenChange={setViewerOpen}
/>
```

Where `filteredServerPhotos` is computed (add above the return):
```typescript
const filteredServerPhotos = (photos ?? []).filter((p) =>
  filter === "all"
    ? true
    : filter === "survey"
      ? SURVEY_TYPES.has(p.photo_type)
      : p.photo_type === filter
);
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | head -50`
Expected: errors about PhotoViewer props mismatch — this is expected, fixed in Task 8.

- [ ] **Step 4: Commit**

```bash
git add src/components/photos/PhotoGrid.tsx
git commit -m "feat: photo gallery category tabs + simplified filter categories"
```

### Task 8: Rewrite PhotoViewer as full-screen swipe viewer

**Files:**
- Rewrite: `src/components/photos/PhotoViewer.tsx`

- [ ] **Step 1: Rewrite PhotoViewer component**

Replace the entire contents of `src/components/photos/PhotoViewer.tsx`:

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Ruler, Trash2, MapPin, Calendar, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeletePhoto, useUpdatePhoto } from "@/hooks/usePhotos";
import { RoleGate } from "@/components/auth/RoleGate";
import { MeasurementOverlay } from "./MeasurementOverlay";
import { PHOTO_TYPES } from "@/lib/constants";
import type { JobPhoto, MeasurementLine } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  photos: JobPhoto[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotoViewer({ photos, initialIndex, open, onOpenChange }: PhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [measureMode, setMeasureMode] = useState(false);
  const [localLines, setLocalLines] = useState<MeasurementLine[]>([]);
  const [linesDirty, setLinesDirty] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const deletePhoto = useDeletePhoto();
  const updatePhoto = useUpdatePhoto();

  const photo = photos[currentIndex];

  // Sync index when initialIndex or photos change
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setMeasureMode(false);
      setLinesDirty(false);
    }
  }, [open, initialIndex]);

  // Load measurement lines from photo
  useEffect(() => {
    if (photo) {
      setLocalLines(photo.measurements?.lines ?? []);
      setLinesDirty(false);
    }
  }, [photo?.id]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (measureMode) return; // disable nav in measure mode
      if (e.key === "ArrowLeft") goToPrev();
      else if (e.key === "ArrowRight") goToNext();
      else if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, currentIndex, measureMode]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(photos.length - 1, i + 1));
  }, [photos.length]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (measureMode) return;
      touchStartX.current = e.touches[0].clientX;
      touchDeltaX.current = 0;
    },
    [measureMode]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (measureMode) return;
      touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
    },
    [measureMode]
  );

  const handleTouchEnd = useCallback(() => {
    if (measureMode) return;
    const threshold = 50;
    if (touchDeltaX.current > threshold) goToPrev();
    else if (touchDeltaX.current < -threshold) goToNext();
    touchDeltaX.current = 0;
  }, [measureMode, goToPrev, goToNext]);

  const handleLinesChange = useCallback((newLines: MeasurementLine[]) => {
    setLocalLines(newLines);
    setLinesDirty(true);
  }, []);

  const handleSaveLines = useCallback(() => {
    if (!photo) return;
    updatePhoto.mutate(
      {
        photoId: photo.id,
        jobId: photo.job_id,
        updates: {
          measurements: {
            ...photo.measurements,
            lines: localLines,
          },
        },
      },
      {
        onSuccess: () => setLinesDirty(false),
      }
    );
  }, [photo, localLines, updatePhoto]);

  const handleDelete = useCallback(() => {
    if (!photo) return;
    deletePhoto.mutate(
      { photoId: photo.id, storagePath: photo.storage_path, jobId: photo.job_id },
      {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          if (photos.length <= 1) onOpenChange(false);
          else if (currentIndex >= photos.length - 1) setCurrentIndex(currentIndex - 1);
        },
      }
    );
  }, [photo, deletePhoto, photos.length, currentIndex, onOpenChange]);

  if (!open || !photo) return null;

  const typeLabel = PHOTO_TYPES.find((t) => t.value === photo.photo_type)?.label ?? photo.photo_type;
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const hasExistingLines = (photo.measurements?.lines?.length ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/50 text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm text-white bg-black/50 px-3 py-1 rounded-full tabular-nums">
          {currentIndex + 1} / {photos.length}
        </span>
      </div>

      {/* Photo */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Desktop nav arrows */}
        {currentIndex > 0 && !measureMode && (
          <button
            type="button"
            onClick={goToPrev}
            className="absolute left-3 z-10 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 hidden md:flex"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {currentIndex < photos.length - 1 && !measureMode && (
          <button
            type="button"
            onClick={goToNext}
            className="absolute right-3 z-10 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 hidden md:flex"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <div className="relative w-full h-full flex items-center justify-center">
          <img
            src={photo.file_url}
            alt={photo.notes || `${typeLabel} photo`}
            className="max-w-full max-h-full object-contain"
          />
          {/* Measurement overlay */}
          {(measureMode || hasExistingLines) && (
            <MeasurementOverlay
              photoId={photo.id}
              lines={localLines}
              mode={measureMode ? "edit" : "view"}
              onLinesChange={handleLinesChange}
            />
          )}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-black/50 text-white border-0">
            {typeLabel}
          </Badge>
          {measureMode && (
            <span className="text-xs text-amber-300">Tap two points to measure</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Save measurements button */}
          {linesDirty && measureMode && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 bg-black/50 text-white border-0 hover:bg-black/70"
              onClick={handleSaveLines}
              disabled={updatePhoto.isPending}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          )}

          {/* Measure toggle */}
          {isOnline && (
            <Button
              size="sm"
              variant={measureMode ? "default" : "secondary"}
              className={cn(
                "gap-1.5",
                !measureMode && "bg-black/50 text-white border-0 hover:bg-black/70"
              )}
              onClick={() => setMeasureMode(!measureMode)}
            >
              <Ruler className="h-3.5 w-3.5" />
              {measureMode ? "Done" : "Measure"}
            </Button>
          )}

          {/* Delete button — admin only */}
          <RoleGate requiredRole="admin">
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 bg-black/50 text-white border-0 hover:bg-red-900/70"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This cannot be undone. The photo will be permanently removed.
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
          </RoleGate>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -50`
Expected: clean build (PhotoGrid already passes the new props from Task 7)

- [ ] **Step 3: Verify on dev server**

Run: `npm run dev`
Test: Navigate to a job with photos, verify tabs filter, tap a photo to see full-screen view, swipe between photos, test measurement overlay.

- [ ] **Step 4: Commit**

```bash
git add src/components/photos/PhotoViewer.tsx
git commit -m "feat: photo gallery full-screen swipe view + measurement integration"
```

---

## Chunk 5: Final Integration + Cleanup

### Task 9: Wire estimate actions into JobTimeline

**Files:**
- Modify: `src/components/jobs/JobTimeline.tsx`
- Modify: `src/pages/JobDetail.tsx`

- [ ] **Step 1: Add onOpenEstimate to JobTimeline**

In `src/pages/JobDetail.tsx`, find where `JobTimeline` is rendered and add an `onOpenEstimate` prop:

```tsx
<JobTimeline
  nodes={timelineNodes}
  currentStatus={job.status}
  onOpenEstimate={() => setEstimateSheetOpen(true)}
/>
```

In `src/components/jobs/JobTimeline.tsx`, add `onOpenEstimate?: () => void` to the component props.

Then when rendering estimate-type timeline nodes (where `node.type === "estimate"`), inject an action button:

```tsx
{node.type === "estimate" && onOpenEstimate && (
  <Button
    size="sm"
    variant="outline"
    className="mt-2 gap-1.5 text-xs"
    onClick={(e) => {
      e.stopPropagation();
      onOpenEstimate();
    }}
  >
    Edit Estimate
  </Button>
)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -50`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/jobs/JobTimeline.tsx src/pages/JobDetail.tsx
git commit -m "feat: wire estimate sheet trigger into timeline nodes"
```

### Task 10: Final build verification + cleanup

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: clean build, no TypeScript errors

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Fix any lint errors (unused imports, missing deps in useCallback/useEffect arrays).

- [ ] **Step 3: Manual smoke test checklist**

Run `npm run dev` and test:
1. Open a job → Items tab shows read-only summary with "Edit Estimate" button
2. Tap "Edit Estimate" → EstimateSheet opens (bottom on mobile, right on desktop)
3. Add line items → totals update live in sticky bar
4. For vehicle_wrap jobs → WrapCalculator is visible and toggles zones
5. StickyActionBar on `lead`/`estimate_draft` jobs opens EstimateSheet
6. Photos tab → simplified category tabs (All/Before/Survey/Progress/After)
7. Tap photo → full-screen overlay, swipe left/right works
8. Tap "Measure" → annotation mode, tap two points → line appears
9. Type dimension label → Save button appears → saves to DB
10. Escape key closes full-screen viewer

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address lint errors and build warnings"
```
