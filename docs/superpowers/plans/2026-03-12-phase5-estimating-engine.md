# Phase 5: Estimating Engine & Line Items — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pricing calculation engine, line item editor, quick-add preset calculators, estimate builder page, and wire real stats into the dashboard.

**Architecture:** Pure TypeScript estimating engine (no React) feeds calculator dialogs that create line items via existing TanStack Query hooks. LineItemEditor renders card-based list with edit Sheet. EstimateBuilder is full-page view; same components also render inline in JobDetail's Line Items tab.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, TanStack Query v5, react-hook-form + zod, Supabase

---

## Chunk 1: Prerequisites & Estimating Engine

### Task 1: Fix TypeScript Types

**Files:**
- Modify: `src/types/database.ts:53-65` (LineItem interface)
- Modify: `src/types/database.ts:30-51` (Job interface — add tax_rate)

- [ ] **Step 1: Add missing fields to LineItem type**

Add `category`, `taxable`, and `notes` fields to the `LineItem` interface to match the DB schema:

```typescript
export interface LineItem {
  id: string;
  job_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  cost_price: number | null;
  unit: string | null;
  category: string;
  taxable: boolean;
  notes: string | null;
  subtotal: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Add tax_rate to Job type**

Add `tax_rate` field to the `Job` interface:

```typescript
// In Job interface, after cost_total:
tax_rate: number | null;
```

- [ ] **Step 3: Update line_items table typing in Database interface**

The `line_items.Insert` type uses `Omit<LineItem, "id" | "created_at" | "updated_at">` which will automatically include the new fields. But `subtotal` is GENERATED ALWAYS — it must also be omitted from Insert:

```typescript
line_items: {
  Row: LineItem;
  Insert: Omit<LineItem, "id" | "subtotal" | "created_at" | "updated_at">;
  Update: Partial<Omit<LineItem, "id" | "subtotal" | "created_at">>;
};
```

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: PASS (type changes are additive, existing code shouldn't break)

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts
git commit -m "fix: add missing LineItem fields and tax_rate to Job type"
```

### Task 2: Fix useLineItems Hook

**Files:**
- Modify: `src/hooks/useLineItems.ts:6-15` (LineItemInsertInput interface)

- [ ] **Step 1: Update LineItemInsertInput to remove subtotal and add new fields**

Replace the `LineItemInsertInput` interface:

```typescript
export interface LineItemInsertInput {
  job_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  cost_price?: number | null;
  unit?: string | null;
  category?: string;
  taxable?: boolean;
  notes?: string | null;
  sort_order: number;
}
```

Key change: removed `subtotal` (it's a GENERATED ALWAYS column in Postgres — inserting it causes an error). Added `category`, `taxable`, `notes`.

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useLineItems.ts
git commit -m "fix: remove subtotal from LineItemInsertInput, add category/taxable/notes"
```

### Task 3: Install Missing shadcn Component

- [ ] **Step 1: Install slider component**

Run: `npx shadcn@latest add slider`

The Vehicle Wrap calculator needs a slider for the complexity factor (1.0–1.5).

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/slider.tsx
git commit -m "chore: add shadcn slider component"
```

### Task 4: Create Estimating Engine

**Files:**
- Create: `src/features/pricing/estimating-engine.ts`

This is a pure TypeScript module with zero React dependencies. All data is passed in as arguments — no DB calls, no side effects.

- [ ] **Step 1: Create the directory and file with types and constants**

```typescript
// src/features/pricing/estimating-engine.ts

// --- Types ---

export type CoverageType =
  | "full"
  | "three_quarter"
  | "half"
  | "partial"
  | "spot_graphics"
  | "lettering";

export interface VehicleWrapInput {
  vehicleType: string;
  baseSquareFeet: number;
  coverage: CoverageType;
  materialCostPerSqft: number;
  materialSellPerSqft: number;
  complexityFactor: number;
  designFee: number;
  installationRate: number;
  wasteFactor?: number;
}

export interface VehicleWrapResult {
  materialSqft: number;
  materialCost: number;
  materialSell: number;
  designFee: number;
  designCost: number;
  installationFee: number;
  installationCost: number;
  totalCost: number;
  totalSell: number;
  margin: number;
  marginPercent: number;
}

export interface QuantityBreak {
  min_qty: number;
  price_per_unit: number;
}

export interface QuantityBreakResult {
  tier: QuantityBreak;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface BannerResult {
  sqft: number;
  total: number;
}

export interface LineItemForCalc {
  quantity: number;
  unit_price: number;
  cost_price: number | null;
  taxable: boolean;
  subtotal: number;
}

export interface LineItemTotals {
  subtotal: number;
  taxableSubtotal: number;
  taxAmount: number;
  grandTotal: number;
  totalCost: number;
  totalMargin: number;
  marginPercent: number;
}

// --- Constants ---

export const COVERAGE_MULTIPLIERS: Record<CoverageType, number> = {
  full: 1.0,
  three_quarter: 0.75,
  half: 0.5,
  partial: 0.3,
  spot_graphics: 0.15,
  lettering: 0.1,
};

export const DEFAULT_WASTE_FACTOR = 0.15;
export const DEFAULT_DESIGN_FEE = 500;
export const DEFAULT_INSTALLATION_RATE = 0.5;
export const DEFAULT_BANNER_RATE = 8;
export const DEFAULT_TAX_RATE = 8.25;

// --- Functions ---

export function calculateVehicleWrap(input: VehicleWrapInput): VehicleWrapResult {
  const wasteFactor = input.wasteFactor ?? DEFAULT_WASTE_FACTOR;
  const coverageMultiplier = COVERAGE_MULTIPLIERS[input.coverage];

  const materialSqft = round2(input.baseSquareFeet * coverageMultiplier * (1 + wasteFactor));
  const materialCost = round2(materialSqft * input.materialCostPerSqft);
  const materialSell = round2(materialSqft * input.materialSellPerSqft * input.complexityFactor);
  const installationFee = round2(materialSell * input.installationRate);
  const designCost = 0;
  const installationCost = round2(installationFee * 0.5);
  const totalCost = round2(materialCost + designCost + installationCost);
  const totalSell = round2(materialSell + input.designFee + installationFee);
  const margin = round2(totalSell - totalCost);
  const marginPercent = totalSell > 0 ? round2((margin / totalSell) * 100) : 0;

  return {
    materialSqft,
    materialCost,
    materialSell,
    designFee: input.designFee,
    designCost,
    installationFee,
    installationCost,
    totalCost,
    totalSell,
    margin,
    marginPercent,
  };
}

export function calculateQuantityBreakPrice(
  quantity: number,
  breaks: QuantityBreak[]
): QuantityBreakResult {
  const sorted = [...breaks].sort((a, b) => b.min_qty - a.min_qty);
  const tier = sorted.find((b) => quantity >= b.min_qty) ?? sorted[sorted.length - 1];

  return {
    tier,
    quantity,
    unitPrice: tier.price_per_unit,
    total: round2(quantity * tier.price_per_unit),
  };
}

export function parseQuantityBreaks(
  breaks: Record<string, number>
): QuantityBreak[] {
  return Object.entries(breaks).map(([k, v]) => ({
    min_qty: Number(k),
    price_per_unit: v,
  }));
}

export function calculateBannerPrice(
  widthFt: number,
  heightFt: number,
  ratePerSqft: number = DEFAULT_BANNER_RATE
): BannerResult {
  const sqft = round2(widthFt * heightFt);
  return { sqft, total: round2(sqft * ratePerSqft) };
}

export function calculateLineItemTotals(
  lineItems: LineItemForCalc[],
  taxRate: number
): LineItemTotals {
  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.subtotal, 0));
  const taxableSubtotal = round2(
    lineItems.filter((li) => li.taxable).reduce((sum, li) => sum + li.subtotal, 0)
  );
  const taxAmount = round2(taxableSubtotal * (taxRate / 100));
  const grandTotal = round2(subtotal + taxAmount);
  const totalCost = round2(
    lineItems.reduce((sum, li) => sum + (li.cost_price ?? 0) * li.quantity, 0)
  );
  const totalMargin = round2(subtotal - totalCost);
  const marginPercent = subtotal > 0 ? round2((totalMargin / subtotal) * 100) : 0;

  return { subtotal, taxableSubtotal, taxAmount, grandTotal, totalCost, totalMargin, marginPercent };
}

// --- Helpers ---

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/pricing/estimating-engine.ts
git commit -m "feat: add estimating engine with vehicle wrap, banner, qty break calculations"
```

### Task 5: Create Pricing Data Hooks

**Files:**
- Create: `src/hooks/usePricingData.ts`

Three TanStack Query hooks to fetch reference data from Supabase: vehicle presets, materials, pricing presets.

- [ ] **Step 1: Create the hooks file**

```typescript
// src/hooks/usePricingData.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { VehiclePreset, Material, PricingPreset } from "@/types/database";

export function useVehiclePresets() {
  return useQuery({
    queryKey: ["vehicle-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_presets")
        .select("*")
        .order("default_sqft");
      if (error) throw error;
      return data as VehiclePreset[];
    },
    staleTime: 1000 * 60 * 30, // 30 min — rarely changes
  });
}

export function useMaterials(category?: string) {
  return useQuery({
    queryKey: ["materials", category],
    queryFn: async () => {
      let query = supabase
        .from("materials")
        .select("*")
        .eq("active", true)
        .order("name");
      if (category) {
        query = query.eq("category", category);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Material[];
    },
    staleTime: 1000 * 60 * 10, // 10 min
  });
}

export function usePricingPresets(jobType?: string) {
  return useQuery({
    queryKey: ["pricing-presets", jobType],
    queryFn: async () => {
      let query = supabase
        .from("pricing_presets")
        .select("*")
        .eq("active", true)
        .order("name");
      if (jobType) {
        query = query.eq("job_type", jobType);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as PricingPreset[];
    },
    staleTime: 1000 * 60 * 10, // 10 min
  });
}
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePricingData.ts
git commit -m "feat: add pricing data hooks for vehicle presets, materials, and pricing presets"
```

## Chunk 2: Line Item Editor Component

### Task 6: Create LineItemEditor Component

**Files:**
- Create: `src/components/estimates/LineItemEditor.tsx`

Card-based line item list with edit Sheet, totals footer, admin cost/margin display.

- [ ] **Step 1: Create the component**

```typescript
// src/components/estimates/LineItemEditor.tsx
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  useLineItems,
  useCreateLineItem,
  useUpdateLineItem,
  useDeleteLineItem,
} from "@/hooks/useLineItems";
import {
  calculateLineItemTotals,
  DEFAULT_TAX_RATE,
} from "@/features/pricing/estimating-engine";
import type { LineItem } from "@/types/database";
import type { LineItemForCalc } from "@/features/pricing/estimating-engine";
import { RoleGate } from "@/components/auth/RoleGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface LineItemEditorProps {
  jobId: string;
  taxRate: number;
  isAdmin: boolean;
}

const CATEGORIES = [
  { value: "material", label: "Material" },
  { value: "labor", label: "Labor" },
  { value: "design", label: "Design" },
  { value: "installation", label: "Installation" },
  { value: "other", label: "Other" },
];

const UNITS = [
  { value: "sqft", label: "sqft" },
  { value: "lnft", label: "lnft" },
  { value: "each", label: "each" },
  { value: "hour", label: "hour" },
  { value: "flat", label: "flat" },
];

const CATEGORY_COLORS: Record<string, string> = {
  material: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  labor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  design: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  installation: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  other: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300",
};

const editSchema = z.object({
  description: z.string().min(1, "Description is required"),
  category: z.string(),
  quantity: z.coerce.number().positive("Must be > 0"),
  unit: z.string(),
  unit_price: z.coerce.number().min(0, "Must be >= 0"),
  cost_price: z.coerce.number().min(0).nullable(),
  taxable: z.boolean(),
  notes: z.string().nullable(),
});

type EditFormValues = z.infer<typeof editSchema>;

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function LineItemEditor({ jobId, taxRate, isAdmin }: LineItemEditorProps) {
  const [editingItem, setEditingItem] = useState<LineItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isNewItem, setIsNewItem] = useState(false);

  const { data: lineItems, isLoading } = useLineItems(jobId);
  const createItem = useCreateLineItem();
  const updateItem = useUpdateLineItem();
  const deleteItem = useDeleteLineItem();

  const effectiveTaxRate = taxRate || DEFAULT_TAX_RATE;

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      description: "",
      category: "other",
      quantity: 1,
      unit: "each",
      unit_price: 0,
      cost_price: null,
      taxable: true,
      notes: null,
    },
  });

  const watchQty = form.watch("quantity");
  const watchPrice = form.watch("unit_price");
  const lineSubtotal = (watchQty || 0) * (watchPrice || 0);

  const totals = lineItems
    ? calculateLineItemTotals(
        lineItems.map(
          (li): LineItemForCalc => ({
            quantity: li.quantity,
            unit_price: li.unit_price,
            cost_price: li.cost_price,
            taxable: li.taxable ?? true,
            subtotal: li.subtotal,
          })
        ),
        effectiveTaxRate
      )
    : null;

  const openNewItem = () => {
    const nextOrder = lineItems ? Math.max(0, ...lineItems.map((li) => li.sort_order)) + 1 : 0;
    form.reset({
      description: "",
      category: "other",
      quantity: 1,
      unit: "each",
      unit_price: 0,
      cost_price: null,
      taxable: true,
      notes: null,
    });
    setEditingItem({ sort_order: nextOrder } as LineItem);
    setIsNewItem(true);
    setSheetOpen(true);
  };

  const openEditItem = (item: LineItem) => {
    form.reset({
      description: item.description,
      category: item.category ?? "other",
      quantity: item.quantity,
      unit: item.unit ?? "each",
      unit_price: item.unit_price,
      cost_price: item.cost_price,
      taxable: item.taxable ?? true,
      notes: item.notes ?? null,
    });
    setEditingItem(item);
    setIsNewItem(false);
    setSheetOpen(true);
  };

  const onSubmit = (values: EditFormValues) => {
    if (!editingItem) return;

    if (isNewItem) {
      createItem.mutate(
        {
          job_id: jobId,
          description: values.description,
          category: values.category,
          quantity: values.quantity,
          unit: values.unit,
          unit_price: values.unit_price,
          cost_price: values.cost_price,
          taxable: values.taxable,
          notes: values.notes,
          sort_order: editingItem.sort_order,
        },
        { onSuccess: () => setSheetOpen(false) }
      );
    } else {
      updateItem.mutate(
        {
          id: editingItem.id,
          job_id: jobId,
          description: values.description,
          category: values.category,
          quantity: values.quantity,
          unit: values.unit,
          unit_price: values.unit_price,
          cost_price: values.cost_price,
          taxable: values.taxable,
          notes: values.notes,
        },
        { onSuccess: () => setSheetOpen(false) }
      );
    }
  };

  const handleReorder = (item: LineItem, direction: "up" | "down") => {
    if (!lineItems) return;
    const idx = lineItems.findIndex((li) => li.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= lineItems.length) return;

    const other = lineItems[swapIdx];
    updateItem.mutate({ id: item.id, job_id: jobId, sort_order: other.sort_order });
    updateItem.mutate({ id: other.id, job_id: jobId, sort_order: item.sort_order });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Line item cards */}
      {lineItems && lineItems.length > 0 ? (
        <div className="space-y-2">
          {lineItems.map((item, idx) => (
            <Card
              key={item.id}
              className="cursor-pointer transition-all hover:shadow-md"
              onClick={() => openEditItem(item)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button
                      type="button"
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(item, "up");
                      }}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                    <button
                      type="button"
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === lineItems.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(item, "down");
                      }}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[item.category ?? "other"] ?? CATEGORY_COLORS.other}`}
                      >
                        {item.category ?? "other"}
                      </Badge>
                      <span className="font-medium text-sm truncate">
                        {item.description}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {item.quantity} {item.unit ?? "each"} &times;{" "}
                      {formatCurrency(item.unit_price)} ={" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </p>
                    {isAdmin && item.cost_price != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Cost: {formatCurrency(item.cost_price)}/ea &bull; Margin:{" "}
                        {item.unit_price > 0
                          ? Math.round(
                              ((item.unit_price - item.cost_price) / item.unit_price) * 100
                            )
                          : 0}
                        %
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <p className="font-medium">No line items yet</p>
              <p className="text-sm mt-1">
                Use the presets above or add a custom item.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add item button */}
      <Button variant="outline" className="w-full gap-2" onClick={openNewItem}>
        <Plus className="h-4 w-4" />
        Add Custom Item
      </Button>

      {/* Totals footer */}
      {totals && lineItems && lineItems.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Tax ({effectiveTaxRate}%)
              </span>
              <span className="font-medium">{formatCurrency(totals.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-1.5">
              <span>Total</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
            <RoleGate requiredRole="admin">
              <div className="border-t pt-1.5 mt-1.5 space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Cost</span>
                  <span>{formatCurrency(totals.totalCost)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Margin</span>
                  <span>
                    {formatCurrency(totals.totalMargin)} ({totals.marginPercent}%)
                  </span>
                </div>
              </div>
            </RoleGate>
          </CardContent>
        </Card>
      )}

      {/* Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isNewItem ? "Add Item" : "Edit Item"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input {...form.register("description")} />
              {form.formState.errors.description && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Controller
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...form.register("quantity")}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("unit_price")}
                />
              </div>
            </div>

            <RoleGate requiredRole="admin">
              <div className="space-y-2">
                <Label>Cost Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("cost_price")}
                  placeholder="Optional"
                />
              </div>
            </RoleGate>

            <div className="flex items-center justify-between">
              <Label>Taxable</Label>
              <Controller
                control={form.control}
                name="taxable"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                {...form.register("notes")}
                rows={2}
                placeholder="Optional notes"
              />
            </div>

            {/* Calculated subtotal */}
            <div className="text-right text-sm text-muted-foreground">
              Line total: <span className="font-bold text-foreground">{formatCurrency(lineSubtotal)}</span>
            </div>

            <div className="flex gap-2">
              {!isNewItem && editingItem && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete line item?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this line item from the estimate.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          deleteItem.mutate(
                            { id: editingItem.id, job_id: jobId },
                            { onSuccess: () => setSheetOpen(false) }
                          );
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                type="submit"
                className="flex-1"
                disabled={createItem.isPending || updateItem.isPending}
              >
                {(createItem.isPending || updateItem.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isNewItem ? "Add Item" : "Save Changes"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/estimates/LineItemEditor.tsx
git commit -m "feat: add LineItemEditor component with card list, edit sheet, and totals"
```

## Chunk 3: Quick Add Presets & Calculator Dialogs

### Task 7: Create QuickAddPresets Component

**Files:**
- Create: `src/components/estimates/QuickAddPresets.tsx`

Horizontal scrollable button row with calculator dialogs for each preset type. Each dialog collects inputs, shows real-time price calculation, and creates line items.

- [ ] **Step 1: Create the component**

This is a large component (~500 lines) containing:

1. **VehicleWrapDialog** — selects vehicle type (fetches via `useVehiclePresets`), coverage, material (fetches via `useMaterials("vinyl")`), complexity slider, design fee, installation rate. Shows real-time breakdown via `calculateVehicleWrap()`. Creates 3 line items (material, design, installation).

2. **BannerDialog** — width/height inputs, shows sqft x rate = total via `calculateBannerPrice()`. Creates 1 line item.

3. **QuantityDialog** (shared for Business Cards, Door Hangers, T-Shirts) — quantity input, fetches pricing_presets by name, shows tier pricing via `calculateQuantityBreakPrice()`. T-Shirts adds color/location upcharges. Creates 1 line item.

4. **Button row** — horizontal scroll of preset buttons.

Each dialog uses `react-hook-form` + `zod` for validation, `Dialog` from shadcn for the modal, and `useBulkCreateLineItems` / `useCreateLineItem` for persistence.

Key implementation details:
- Vehicle Wrap dialog: real-time preview panel updates as user adjusts fields using `form.watch()`
- All dialogs close and reset on successful submission
- Disabled "Add to Estimate" button while data is loading (vehicle presets, materials)
- Preset buttons: `Car` icon for Vehicle Wrap, generic icons for others

```typescript
// src/components/estimates/QuickAddPresets.tsx
// Full implementation with all calculator dialogs
// See spec section 3 for exact formulas and line item creation details
```

The component structure:

```typescript
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { Car, Flag, CreditCard, DoorOpen, Shirt, FileEdit, Loader2 } from "lucide-react";
import { useVehiclePresets, useMaterials, usePricingPresets } from "@/hooks/usePricingData";
import { useCreateLineItem, useBulkCreateLineItems } from "@/hooks/useLineItems";
import {
  calculateVehicleWrap,
  calculateBannerPrice,
  calculateQuantityBreakPrice,
  parseQuantityBreaks,
  COVERAGE_MULTIPLIERS,
  DEFAULT_DESIGN_FEE,
  DEFAULT_INSTALLATION_RATE,
  DEFAULT_BANNER_RATE,
} from "@/features/pricing/estimating-engine";
import type { CoverageType } from "@/features/pricing/estimating-engine";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface QuickAddPresetsProps {
  jobId: string;
  currentItemCount: number; // for sort_order
}

// Props: jobId, currentItemCount
// Contains: VehicleWrapDialog, BannerDialog, QuantityPresetDialog, preset button row
// Each dialog: form -> calculate -> create line items -> close
```

Each calculator dialog follows this pattern:
1. Open dialog, fetch reference data
2. User fills form, sees real-time price
3. "Add to Estimate" creates line item(s)
4. Dialog closes, line items list refreshes

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/estimates/QuickAddPresets.tsx
git commit -m "feat: add QuickAddPresets with vehicle wrap, banner, and qty break calculators"
```

## Chunk 4: Estimate Builder, Integration & Dashboard

### Task 8: Create EstimateBuilder Page

**Files:**
- Create: `src/pages/EstimateBuilder.tsx`

Full-page estimate view at `/estimates/:jobId`. Shows client name + job title header, QuickAddPresets, LineItemEditor, and action buttons.

- [ ] **Step 1: Create the page component**

```typescript
// src/pages/EstimateBuilder.tsx
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Send, CreditCard } from "lucide-react";
import { useJob, useUpdateJob, useUpdateJobStatus } from "@/hooks/useJobs";
import { useLineItems } from "@/hooks/useLineItems";
import { useAuth } from "@/hooks/useAuth";
import { calculateLineItemTotals, DEFAULT_TAX_RATE } from "@/features/pricing/estimating-engine";
import type { LineItemForCalc } from "@/features/pricing/estimating-engine";
import { LineItemEditor } from "@/components/estimates/LineItemEditor";
import { QuickAddPresets } from "@/components/estimates/QuickAddPresets";
import { RoleGate } from "@/components/auth/RoleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Renders:
// - Back button + header (client name, job title)
// - QuickAddPresets row
// - LineItemEditor (card list + totals)
// - Sticky footer on mobile: Save Draft, Send to Client, Generate Payment Link (admin, disabled placeholder)

// "Save Draft": updates job.estimated_total with grand total, sets status to estimate_draft if currently "lead"
// "Send to Client": sets status to estimate_sent
// "Generate Payment Link": admin-only, disabled with tooltip "Coming in Phase 7"
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/pages/EstimateBuilder.tsx
git commit -m "feat: add EstimateBuilder page with save draft and send to client actions"
```

### Task 9: Wire Line Items Tab in JobDetail

**Files:**
- Modify: `src/pages/JobDetail.tsx:431-441`

Replace the placeholder Line Items tab content with the real LineItemEditor + QuickAddPresets.

- [ ] **Step 1: Add imports at top of JobDetail.tsx**

```typescript
import { LineItemEditor } from "@/components/estimates/LineItemEditor";
import { QuickAddPresets } from "@/components/estimates/QuickAddPresets";
import { useLineItems } from "@/hooks/useLineItems";
import { DEFAULT_TAX_RATE } from "@/features/pricing/estimating-engine";
```

- [ ] **Step 2: Add useLineItems query and isAdmin check**

Inside the component, after the existing hooks:

```typescript
const { isAdmin } = useAuth();
const { data: lineItems } = useLineItems(id);
```

Note: `useAuth()` is already imported and called (as `const { user } = useAuth()`). Change to destructure `isAdmin` too: `const { user, isAdmin } = useAuth();`

- [ ] **Step 3: Replace placeholder Line Items tab content**

Replace lines 431-441 (the placeholder TabsContent for "line-items"):

```tsx
<TabsContent value="line-items" className="mt-4 space-y-4">
  <QuickAddPresets
    jobId={job.id}
    currentItemCount={lineItems?.length ?? 0}
  />
  <LineItemEditor
    jobId={job.id}
    taxRate={job.tax_rate ?? 0}
    isAdmin={isAdmin}
  />
</TabsContent>
```

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/JobDetail.tsx
git commit -m "feat: wire LineItemEditor and QuickAddPresets into JobDetail Line Items tab"
```

### Task 10: Update Route in App.tsx

**Files:**
- Modify: `src/App.tsx:45`

- [ ] **Step 1: Import EstimateBuilder and replace placeholder route**

Add import:
```typescript
import EstimateBuilder from "@/pages/EstimateBuilder";
```

Replace line 45:
```typescript
<Route path="/estimates/:jobId" element={<EstimateBuilder />} />
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire EstimateBuilder page into /estimates/:jobId route"
```

### Task 11: Dashboard — Already Wired

The Dashboard (`src/pages/Dashboard.tsx`) already uses `useJobStats()` which returns real data from Supabase. The stat cards display `activeJobs`, `pendingEstimates`, `awaitingApproval`, and `totalRevenue` correctly. No changes needed — the dashboard was completed in Phase 4.

- [ ] **Step 1: Verify dashboard renders real data**

Open `http://localhost:5173/` after running `npm run dev`. Stats should show real numbers from DB.

### Task 12: Final Build Verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: zero errors

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors (warnings acceptable)

- [ ] **Step 3: Manual verification**

1. `npm run dev`
2. Create a job → go to Line Items tab
3. Use Vehicle Wrap calculator → verify math
4. Add a Banner line item
5. Add Business Cards via preset
6. Check admin sees cost/margin columns
7. Resize to mobile — check layout
8. Verify totals calculate correctly with tax
9. Navigate to `/estimates/:jobId` — verify full page view

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "Phase 5: Estimating engine and line items complete"
```
