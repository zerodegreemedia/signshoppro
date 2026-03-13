# Estimate Builder & Photo Enhancements — Design Spec

**Date:** 2026-03-13
**Status:** Approved

## Overview

Four features that improve the estimating and photo workflows in SignShop Pro:

1. **EstimateSheet** — Slide-over panel for creating/editing estimates with live totals
2. **WrapCalculator** — Visual vehicle zone selector for wrap estimates
3. **MeasurementOverlay** — SVG annotation layer for photo dimension measurements
4. **Photo Gallery Improvements** — Category filter tabs + full-screen swipe viewer

## 1. EstimateSheet

### Component

`src/components/estimates/EstimateSheet.tsx`

Controlled component with `open`/`onOpenChange` props (same pattern as PhotoCapture).

### Responsive behavior

- **Mobile (< 768px):** `side="bottom"`, max-height 90vh
- **Desktop (>= 768px):** `side="right"`, width 480px via className on SheetContent

Detection via Tailwind responsive classes where possible (CSS-only). For JS-side branching (Sheet `side` prop), use `window.matchMedia('(min-width: 768px)')` in a `useMemo` or effect — no new hook needed.

### Content (top to bottom)

1. **SheetHeader:** "Estimate — {jobTitle}" + estimate status badge
2. **WrapCalculator** (conditional): shown when `job.job_type === 'vehicle_wrap'`, collapsed by default via a simple disclosure toggle (details/summary pattern or local state + button — no shadcn Collapsible dependency needed)
3. **QuickAddPresets** (existing component, relocated from Items tab)
4. **LineItemEditor** (existing component, relocated from Items tab)
5. **Sticky bottom bar:** subtotal / tax (8.25%) / total, live-updating via `calculateLineItemTotals()`. "Send to Client" button triggers status transition to `estimate_sent`.

### Loading state

While `useLineItems(jobId)` is loading, show a Skeleton placeholder (3 rows) in the line items area. The sticky bottom bar shows dashes ("—") for totals until data loads.

### Entry points (3 triggers)

| Trigger | Location | Condition |
|---------|----------|-----------|
| Timeline node action | JobTimeline.tsx | Estimate-type nodes → "Edit Estimate" button |
| Primary action | StickyActionBar.tsx | Status is `lead` or `estimate_draft` |
| Summary card button | JobDetail.tsx side panel | Items tab replaced with read-only summary + "Edit Estimate" button |

### Side panel Items tab change

The Items tab in JobDetail's side panel becomes a **read-only estimate summary**:
- Line item count, subtotal, tax, total
- Estimate status badge
- "Edit Estimate" button that opens EstimateSheet

This eliminates duplicate editing surfaces while preserving at-a-glance info.

### Data flow

Uses existing `useLineItems(jobId)` hook. No new queries or mutations needed. The sticky total bar computes from the query cache via `calculateLineItemTotals()`.

### Props

```typescript
interface EstimateSheetProps {
  jobId: string;
  jobTitle: string;
  jobType: string;
  vehicleTotalSqft?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

## 2. WrapCalculator

### Component

`src/components/estimates/WrapCalculator.tsx`

### Zone layout

CSS grid showing a stylized top-down vehicle silhouette with 6 tappable zones:

| Zone | % of total sqft |
|------|----------------|
| Hood | 12% |
| Roof | 10% |
| Left Side | 25% |
| Right Side | 25% |
| Rear | 8% |
| Tailgate | 5% |

Total selectable coverage: 85% (remaining 15% = gaps, bumpers, non-wrappable areas).

### Visual design

- Vehicle silhouette: CSS-drawn rounded rectangle with zone grid overlaid
- Selected zone: `bg-primary/20 border-primary` with fill transition
- Unselected zone: `bg-muted border-border`
- Zone labels show name + sqft contribution (e.g., "Hood — 24 sqft")
- "Full Wrap" toggle button at top: selects/deselects all zones

### Calculation

```
coverageSqft = selectedZones.reduce((sum, zone) => sum + zone.percent, 0) * vehicleTotalSqft
```

### Props

```typescript
interface WrapCalculatorProps {
  vehicleTotalSqft: number;
  onChange: (coverageSqft: number, selectedZones: string[]) => void;
}
```

### Integration

Rendered inside EstimateSheet, gated by `job.job_type === 'vehicle_wrap'`. Wrapped in a disclosure toggle (collapsed by default, expandable via "Vehicle Zones" header button).

Note: "Full Wrap" selects all 6 zones (85% of vehicle sqft). This is the **zone-based** calculator — it supplements the existing coverage dropdown in QuickAddPresets, which uses flat percentages (full=100%, half=50%, etc.). The zone calculator gives more granular control for partial wraps.

## 3. MeasurementOverlay

### Component

`src/components/photos/MeasurementOverlay.tsx`

### Modes

- **View mode** (default): renders SVG lines + labels as non-interactive overlay
- **Edit mode**: activated by "Add Measurement" button on the photo viewer toolbar

### Annotation flow (edit mode)

1. Tap point A → small circle dot appears at tap position
2. Tap point B → SVG line draws A→B, text input appears at midpoint
3. User types dimension (free text, e.g. "12ft 6in") → press Enter or tap away to confirm
4. Line + label saved to state
5. Max 10 measurement lines per photo (show toast when limit reached)

### Technical details

- Absolute-positioned `<svg>` over the `<img>`, matching dimensions via ref
- Coordinates stored as **percentages (0–100)** of image width/height — scales on resize
- Lines: white stroke (2px) with dark outline (4px behind) for visibility on any background
- Labels: white text on dark semi-transparent pill badge at line midpoint
- Tap a label to select → small X delete button appears near label

### Data shape

```typescript
interface MeasurementLine {
  id: string;        // nanoid or uuid
  x1: number;        // 0–100 percentage
  y1: number;
  x2: number;
  y2: number;
  label: string;     // free text, e.g. "12ft 6in"
}
```

### Persistence

Saved to `job_photos.measurements` JSONB field. Current schema stores `{ width, height }` strings — the new format adds a `lines` array:

```json
{
  "width": "12ft",
  "height": "8ft",
  "lines": [
    { "id": "abc", "x1": 10, "y1": 20, "x2": 80, "y2": 20, "label": "12ft 6in" }
  ]
}
```

Backward compatible — existing records without `lines` continue to work.

### Integration

PhotoViewer (now the full-screen swipe view) gets an "Add Measurement" toolbar button. Entering annotation mode renders MeasurementOverlay in edit mode over the current photo.

### Save flow

1. MeasurementOverlay calls `onLinesChange(lines)` on every add/delete
2. PhotoViewer holds local state and shows a "Save" button in the toolbar when lines are dirty
3. "Save" calls `useUpdatePhoto` (new mutation in `usePhotos.ts`) which does `supabase.from('job_photos').update({ measurements }).eq('id', photoId)`
4. On save failure: toast error, lines remain in local state so user can retry
5. Measurement editing is **online-only** — the "Add Measurement" button is hidden when `navigator.onLine === false`

### Gesture conflict

When MeasurementOverlay is in edit mode, **swipe navigation is disabled**. Taps are consumed by the overlay for placing points. User must exit edit mode (tap "Done") to resume swiping between photos.

### Props

```typescript
interface MeasurementOverlayProps {
  photoId: string;
  lines: MeasurementLine[];
  mode: 'view' | 'edit';
  onLinesChange?: (lines: MeasurementLine[]) => void;
}
```

Note: `imageRef` is not needed — the SVG overlay uses `absolute inset-0` positioning to match the parent container dimensions, and uses its own `svgRef` for coordinate conversion.

## 4. Photo Gallery Improvements

### Category tabs

**Modify:** `src/components/photos/PhotoGrid.tsx`

Current implementation already uses Tabs for filtering. Enhancement:

- Replace TabsList with horizontal `ScrollArea` containing filter buttons
- Simplified categories: **All | Before | Survey | Progress | After**
  - "Survey" merges: measurement, reference, site_survey photo types
- Active button: filled primary style. Inactive: ghost variant.
- Sticky at top of photo grid area for easy access while scrolling

### Full-screen swipe view

**Replace** current PhotoViewer Dialog with a custom full-screen overlay.

**Component:** Modify `src/components/photos/PhotoViewer.tsx`

**Layout:**
- `fixed inset-0 z-50 bg-black` — full viewport overlay
- Photo: `object-contain w-full h-full` centered
- Close button (X): top-left, white on semi-transparent dark pill
- Counter: "3 / 12" top-right, same pill style
- Toolbar: bottom center — "Add Measurement" button + photo type label

**Navigation:**
- **Touch:** `onTouchStart` / `onTouchMove` / `onTouchEnd` — swipe threshold 50px horizontal
- **Desktop:** left/right arrow buttons on sides + keyboard arrow key support + `Escape` to close
- **Transition:** CSS transform translateX slide animation between photos

**Photo list:** PhotoViewer receives the full filtered photo array + initial index as props. PhotoGrid passes `photos: JobPhoto[]` and `initialIndex: number` instead of a single photo object. This is a breaking interface change to PhotoViewer's props.

**Integration with MeasurementOverlay:**
- "Add Measurement" button in toolbar toggles MeasurementOverlay edit mode
- View mode lines always render if photo has measurement data
- Save triggers `useUpdatePhoto` mutation to persist lines to JSONB

## File change summary

| Action | File |
|--------|------|
| CREATE | `src/components/estimates/EstimateSheet.tsx` |
| CREATE | `src/components/estimates/WrapCalculator.tsx` |
| CREATE (rewrite) | `src/components/photos/MeasurementOverlay.tsx` |
| MODIFY | `src/components/photos/PhotoGrid.tsx` |
| MODIFY | `src/components/photos/PhotoViewer.tsx` |
| MODIFY | `src/components/jobs/JobTimeline.tsx` |
| MODIFY | `src/components/jobs/StickyActionBar.tsx` |
| MODIFY | `src/pages/JobDetail.tsx` |
| MODIFY | `src/hooks/usePhotos.ts` |
| MODIFY | `src/types/database.ts` |

## Type changes

`JobPhoto.measurements` in `database.ts` is currently `Record<string, string> | null`. Must be widened to support the `lines` array:

```typescript
interface PhotoMeasurements {
  width?: string;
  height?: string;
  lines?: MeasurementLine[];
}
// Then: measurements: PhotoMeasurements | null
```

## New hook

`useUpdatePhoto` added to `src/hooks/usePhotos.ts`:
- Simple `.update()` mutation on `job_photos` table
- Invalidates `['job-photos', jobId]` query key on success
- Toast on success/error

## Non-goals

- No new Supabase migrations (measurements JSONB field already exists, type change is TS-only)
- No external swipe/carousel libraries
- No vector/SVG export from measurement overlay
- No shadcn Collapsible dependency (use simple disclosure toggle instead)
