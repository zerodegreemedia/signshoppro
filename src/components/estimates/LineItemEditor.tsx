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
  installation: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  other: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300",
};

const editSchema = z.object({
  description: z.string().min(1, "Description is required"),
  category: z.string(),
  quantity: z.number().positive("Must be > 0"),
  unit: z.string(),
  unit_price: z.number().min(0, "Must be >= 0"),
  cost_price: z.number().min(0).nullable(),
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
                      className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(item, "up");
                      }}
                      aria-label="Move item up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden="true" />
                    <button
                      type="button"
                      className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === lineItems.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(item, "down");
                      }}
                      aria-label="Move item down"
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
                  {...form.register("quantity", { valueAsNumber: true })}
                />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Unit Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("unit_price", { valueAsNumber: true })}
                />
                {form.formState.errors.unit_price && (
                  <p className="text-sm text-destructive">{form.formState.errors.unit_price.message}</p>
                )}
              </div>
            </div>

            <RoleGate requiredRole="admin">
              <div className="space-y-2">
                <Label>Cost Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("cost_price", {
                    setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                  })}
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
                    <Button type="button" variant="destructive" size="icon" aria-label="Delete line item">
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
