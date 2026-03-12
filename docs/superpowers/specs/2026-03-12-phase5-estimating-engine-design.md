# Phase 5: Estimating Engine & Line Items — Design Spec

## Overview

Build the pricing and estimating system for SignShop Pro. This is the core business feature — it calculates prices for vehicle wraps, banners, print jobs, and apparel, and provides a line item editor for building estimates.

## Architecture

```
src/features/pricing/estimating-engine.ts    # Pure functions, no React
src/components/estimates/LineItemEditor.tsx   # Card-based line item list + edit Sheet
src/components/estimates/QuickAddPresets.tsx  # Calculator dialog buttons
src/pages/EstimateBuilder.tsx                # Full estimate page (/estimates/:jobId)
src/pages/Dashboard.tsx                      # Wire real stats from useJobStats
```

**Data flow:**
- QuickAddPresets → calculator dialog → estimating-engine functions → useBulkCreateLineItems → DB
- LineItemEditor → useLineItems(jobId) → card list → edit Sheet → useUpdateLineItem → DB
- Totals → calculateLineItemTotals(lineItems, taxRate) → footer display

## 1. Estimating Engine (`src/features/pricing/estimating-engine.ts`)

Pure TypeScript module. No React, no DB calls, no side effects. All data passed in as arguments.

### Types

```typescript
interface VehicleWrapInput {
  vehicleType: string;           // e.g. 'sedan', 'suv'
  baseSquareFeet: number;        // from vehicle_presets lookup (caller provides)
  coverage: CoverageType;        // full, three_quarter, half, partial, spot_graphics, lettering
  materialCostPerSqft: number;   // from materials table (caller provides)
  materialSellPerSqft: number;   // from materials table (caller provides)
  complexityFactor: number;      // 1.0 to 1.5
  designFee: number;             // flat fee, default $500
  installationRate: number;      // multiplier of material sell, default 0.5
  wasteFactor?: number;          // default 0.15 (15%)
}

type CoverageType = 'full' | 'three_quarter' | 'half' | 'partial' | 'spot_graphics' | 'lettering';

interface VehicleWrapResult {
  materialSqft: number;          // base × coverage × (1 + waste)
  materialCost: number;          // materialSqft × costPerSqft
  materialSell: number;          // materialSqft × sellPerSqft × complexityFactor
  designFee: number;
  installationFee: number;       // materialSell × installationRate
  totalCost: number;             // materialCost + designCost + installationCost
  totalSell: number;             // materialSell + designFee + installationFee
  margin: number;                // totalSell - totalCost
  marginPercent: number;         // (margin / totalSell) × 100
  designCost: number;            // typically 0 (internal labor, not tracked per-job)
  installationCost: number;      // estimated at installationFee × 0.5
}

interface QuantityBreak {
  min_qty: number;
  price_per_unit: number;
}

interface QuantityBreakResult {
  tier: QuantityBreak;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface BannerResult {
  sqft: number;
  total: number;
}

interface LineItemForCalc {
  quantity: number;
  unit_price: number;
  cost_price: number | null;
  taxable: boolean;
  subtotal: number;  // quantity × unit_price (from DB generated column)
}

interface LineItemTotals {
  subtotal: number;
  taxableSubtotal: number;
  taxAmount: number;
  grandTotal: number;
  // Admin only (always calculated, UI decides whether to show)
  totalCost: number;
  totalMargin: number;
  marginPercent: number;
}
```

### Functions

**`calculateVehicleWrap(input: VehicleWrapInput): VehicleWrapResult`**

Coverage multipliers: full=1.0, three_quarter=0.75, half=0.5, partial=0.3, spot_graphics=0.15, lettering=0.1.

```
materialSqft = baseSquareFeet × coverageMultiplier × (1 + wasteFactor)
materialCost = materialSqft × materialCostPerSqft
materialSell = materialSqft × materialSellPerSqft × complexityFactor
installationFee = materialSell × installationRate
designCost = 0  (internal labor, not a direct cost)
installationCost = installationFee × 0.5  (estimated labor cost of installation)
totalCost = materialCost + designCost + installationCost
totalSell = materialSell + designFee + installationFee
margin = totalSell - totalCost
marginPercent = (margin / totalSell) × 100
```

**`calculateQuantityBreakPrice(quantity: number, breaks: QuantityBreak[]): QuantityBreakResult`**

The DB stores quantity_breaks as `Record<string, number>` (e.g. `{"250": 0.08, "500": 0.05}`). The caller must transform this to `QuantityBreak[]` before calling: `Object.entries(breaks).map(([k, v]) => ({ min_qty: Number(k), price_per_unit: v }))`. Sort breaks by min_qty descending, find first where min_qty <= quantity. If no tier matches, use the lowest tier.

**`calculateBannerPrice(widthFt: number, heightFt: number, ratePerSqft = 8): BannerResult`**

```
sqft = widthFt × heightFt
total = sqft × ratePerSqft
```

**`calculateLineItemTotals(lineItems: LineItemForCalc[], taxRate: number): LineItemTotals`**

```
subtotal = sum of all lineItem.subtotal
taxableSubtotal = sum of taxable lineItem.subtotal
taxAmount = taxableSubtotal × (taxRate / 100)
grandTotal = subtotal + taxAmount
totalCost = sum of (lineItem.cost_price × lineItem.quantity) for items with cost_price
totalMargin = subtotal - totalCost  (margin excludes tax — tax is pass-through, not profit)
marginPercent = subtotal > 0 ? ((totalMargin / subtotal) × 100) : 0
```

### Coverage multiplier constant

```typescript
const COVERAGE_MULTIPLIERS: Record<CoverageType, number> = {
  full: 1.0,
  three_quarter: 0.75,
  half: 0.5,
  partial: 0.3,
  spot_graphics: 0.15,
  lettering: 0.1,
};
```

## 2. Line Item Editor (`src/components/estimates/LineItemEditor.tsx`)

### Layout (mobile-first)

Card-based list. Each card:
```
┌──────────────────────────────────┐
│ ≡  Vehicle Wrap - 3M Cast Vinyl  │
│    2 sqft × $14.00 = $28.00      │
│    [Admin: Cost $7.00 | M: 75%]  │
└──────────────────────────────────┘
```

- `≡` = drag handle for reordering (deferred — Phase 5 uses manual sort_order via up/down arrows on each card; full drag-and-drop with @dnd-kit deferred to a future polish pass)
- Tap card → Sheet slides up with edit form
- Category badge (material/labor/design/installation/other)

### Edit Sheet

Fields:
- Description (text input)
- Category (select: material, labor, design, installation, other)
- Quantity (number input)
- Unit (select: sqft, lnft, each, hour, flat)
- Unit Price (currency input)
- Cost Price (currency input — admin only via RoleGate)
- Taxable (switch/toggle, default true)
- Notes (textarea, optional)

Footer shows calculated subtotal (quantity × unit_price).
Save button persists via useUpdateLineItem or useCreateLineItem.
Delete button with AlertDialog confirmation.

### Totals Footer

Always visible at bottom of list:
```
Subtotal:     $2,450.00
Tax (8.25%):    $202.13
Total:        $2,652.13
─────────────────────────  (admin only)
Cost:         $1,050.00
Margin:       $1,602.13 (60.4%)
```

Tax rate comes from the job's `tax_rate` field. The DB default is 0, but the UI defaults to 8.25% when displaying/editing if the stored value is 0. This lets users override per-job.

### Props

```typescript
interface LineItemEditorProps {
  jobId: string;
  taxRate: number;
  isAdmin: boolean;
}
```

### Hooks used
- `useLineItems(jobId)` — fetch line items
- `useCreateLineItem()` — add new
- `useUpdateLineItem()` — edit existing
- `useDeleteLineItem()` — remove
- `calculateLineItemTotals()` — from engine

### Empty state
When no line items exist: "No line items yet. Use the presets above or add a custom item."

## 3. Quick Add Presets (`src/components/estimates/QuickAddPresets.tsx`)

Horizontal scrollable button row above the line item editor.

Buttons: Vehicle Wrap, Banner, Business Cards, Door Hangers, T-Shirts, Custom Item.

### Vehicle Wrap Calculator Dialog

Fields:
- Vehicle Type (select from vehicle_presets — fetched via Supabase query)
- Coverage (select: Full, 3/4, Half, Partial, Spot Graphics, Lettering)
- Material (select from materials table, filtered to vinyl category)
- Complexity Factor (slider: 1.0 to 1.5, step 0.05)
- Design Fee (number input, default $500)
- Installation Rate (number input, default 50%, expressed as percentage)

**Real-time preview panel** shows calculated breakdown as user adjusts:
```
Material: 230 sqft × $14.00 = $3,220.00
Design:                         $500.00
Installation (50%):           $1,610.00
────────────────────────────────────────
Total:                        $5,330.00
```

"Add to Estimate" creates 3 line items via useBulkCreateLineItems:
1. `{category: 'material', description: 'Vehicle Wrap - [Material Name]', quantity: materialSqft, unit: 'sqft', unit_price: sellPerSqft × complexity, cost_price: costPerSqft}`
2. `{category: 'design', description: 'Design Fee', quantity: 1, unit: 'flat', unit_price: designFee, cost_price: 0}`
3. `{category: 'installation', description: 'Installation', quantity: 1, unit: 'flat', unit_price: installationFee, cost_price: installationFee * 0.5}`

### Banner Calculator Dialog

Fields: Width (ft), Height (ft). Auto-shows: `sqft × $8.00 = total`.
Creates 1 line item: `{category: 'material', description: 'Banner [W]ft × [H]ft', quantity: sqft, unit: 'sqft', unit_price: 8.00, cost_price: costFromMaterialsTable}`. Cost price sourced from materials table (banner category) rather than hardcoded.

### Business Cards / Door Hangers Dialog

Fields: Quantity input.
Fetches pricing_presets by name, parses quantity_breaks JSONB, finds applicable tier.
Shows: "500 qty → $0.05/ea = $25.00"
Creates 1 line item with the calculated pricing.

### T-Shirts Dialog

Fields: Quantity, Number of Colors (1-6), Number of Locations (1-4).
Base price from pricing_presets. Upcharges: +$1.50/color beyond first, +$3.00/location beyond first.
Creates 1 line item.

### Custom Item

Opens the same edit Sheet as LineItemEditor but blank.

### Data fetching

New hooks needed:
- `useVehiclePresets()` — fetches vehicle_presets table
- `useMaterials(category?)` — fetches materials table, optional category filter
- `usePricingPresets(jobType?)` — fetches pricing_presets table, optional job_type filter

These go in `src/hooks/usePricingData.ts`.

## 4. Estimate Builder Page (`src/pages/EstimateBuilder.tsx`)

Route: `/estimates/:jobId`

### Layout

```
┌─────────────────────────────┐
│ ← Back    Estimate Builder  │
├─────────────────────────────┤
│ Client: ABC Signs           │
│ Job: Fleet Wrap - 3 Vans    │
├─────────────────────────────┤
│ [Wrap] [Banner] [Cards] ... │  ← QuickAddPresets
├─────────────────────────────┤
│                             │
│  Line Item Cards            │  ← LineItemEditor
│  ...                        │
│                             │
├─────────────────────────────┤
│ Subtotal: $5,330.00         │  ← Sticky footer (mobile)
│ Tax:        $439.73         │
│ Total:    $5,769.73         │
│                             │
│ [Save Draft] [Send to Client]│
│ [Generate Payment Link]     │  ← Admin only, placeholder
└─────────────────────────────┘
```

### Behavior

- "Save Draft": saves line items (they auto-save on individual edits already), updates job.estimated_total with grand total, sets status to `estimate_draft` if currently `lead`.
- "Send to Client": sets status to `estimate_sent`. For now just status change — email sending is Phase 8.
- "Generate Payment Link": admin-only, placeholder button, disabled with tooltip "Coming in Phase 7".

### Integration with JobDetail

The Line Items tab in JobDetail.tsx renders the same LineItemEditor + QuickAddPresets components inline (not navigating to a separate page). The EstimateBuilder page is an alternative full-page view accessible via the route.

## 5. Dashboard Updates (`src/pages/Dashboard.tsx`)

Replace hardcoded placeholder values with real data from `useJobStats()` hook.

The hook already exists and returns:
- `activeJobs`: count where status in [design_in_progress..install_complete]
- `pendingEstimates`: count where status in [estimate_draft, estimate_sent]
- `awaitingApproval`: count where status = proof_sent
- `completedJobs`: count where status = completed
- `totalRevenue`: sum of payments.amount where status=completed, this month

Wire these into the stat cards. Revenue card is admin-only via RoleGate.

## Dependencies

### Existing (minor fixes needed)
- `useLineItems`, `useCreateLineItem`, `useUpdateLineItem`, `useDeleteLineItem`, `useBulkCreateLineItems` — all in `src/hooks/useLineItems.ts`
- `useJob` — in `src/hooks/useJobs.ts`
- `useJobStats` — in `src/hooks/useJobs.ts` (uses estimated_total sum for revenue, not payments — acceptable for Phase 5)
- `RoleGate` — in `src/components/auth/RoleGate.tsx`
- Database schema with line_items, pricing_presets, materials, vehicle_presets tables
- Seed data for presets and materials

### New files to create
1. `src/features/pricing/estimating-engine.ts` — pure calculation functions
2. `src/components/estimates/LineItemEditor.tsx` — card list + edit Sheet
3. `src/components/estimates/QuickAddPresets.tsx` — calculator dialogs
4. `src/hooks/usePricingData.ts` — useVehiclePresets, useMaterials, usePricingPresets
5. `src/pages/EstimateBuilder.tsx` — full estimate page

### Files to modify
1. `src/types/database.ts` — add missing fields to `LineItem` (category, taxable, notes) and `Job` (tax_rate)
2. `src/hooks/useLineItems.ts` — remove `subtotal` from `LineItemInsertInput` (it's a GENERATED ALWAYS column in Postgres, cannot be inserted)
3. `src/pages/JobDetail.tsx` — fill Line Items tab placeholder
4. `src/pages/Dashboard.tsx` — wire real stats
5. `src/App.tsx` — add /estimates/:jobId route

### shadcn/ui components needed
Check which are already installed, install missing:
- Sheet (for edit panel)
- Dialog (for calculator dialogs)
- Slider (for complexity factor)
- Switch (for taxable toggle)
- AlertDialog (for delete confirmation)
- Skeleton (for loading states)
- Badge (for category labels)

## Edge Cases

- **No line items**: Show empty state with call-to-action
- **Zero quantity or price**: Validate > 0 before save
- **No matching quantity break**: Fall back to lowest tier
- **Missing cost_price**: Treat as 0 for margin calculation, show "N/A" for margin display
- **Tax rate missing on job**: Default to 8.25%
- **Vehicle presets/materials not loaded**: Show skeleton, disable calculator until loaded
- **Offline**: Line item edits queue via existing offline infrastructure (Phase 9 detail, but mutations should work through TanStack Query's standard retry)

## Scope Notes

- **Storefront signs/vinyl calculator**: Not included in Phase 5 QuickAddPresets. Storefront pricing uses sqft of vinyl (same formula as banners but different rate). Users can use "Custom Item" for now. A dedicated calculator can be added in a follow-up.
- **All form dialogs and edit sheets**: Use react-hook-form + zod validation per CLAUDE.md coding rules.
- **Revenue stat on dashboard**: Uses `useJobStats` as-is (sums estimated_total for paid/completed jobs). Monthly payment-based revenue tracking deferred to Phase 7 (Stripe integration).

## Security

- `cost_price` and margin data never rendered for client role (RoleGate wraps all admin-only UI)
- Line items accessed via RLS — clients only see their own jobs' items
- Pricing presets and materials are read-only for all authenticated users (per existing RLS)
