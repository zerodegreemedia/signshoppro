import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Car,
  Flag,
  CreditCard,
  DoorOpen,
  Shirt,
  FileEdit,
  Loader2,
} from "lucide-react";
import {
  useVehiclePresets,
  useMaterials,
  usePricingPresets,
} from "@/hooks/usePricingData";
import {
  useCreateLineItem,
  useBulkCreateLineItems,
} from "@/hooks/useLineItems";
import type { LineItemInsertInput } from "@/hooks/useLineItems";
import {
  calculateVehicleWrap,
  calculateBannerPrice,
  calculateQuantityBreakPrice,
  parseQuantityBreaks,
  DEFAULT_DESIGN_FEE,
  DEFAULT_INSTALLATION_RATE,
  DEFAULT_BANNER_RATE,
} from "@/features/pricing/estimating-engine";
import type { CoverageType } from "@/features/pricing/estimating-engine";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// --- Helpers ---

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const COVERAGE_OPTIONS: { value: CoverageType; label: string }[] = [
  { value: "full", label: "Full (100%)" },
  { value: "three_quarter", label: "3/4 (75%)" },
  { value: "half", label: "Half (50%)" },
  { value: "partial", label: "Partial (30%)" },
  { value: "spot_graphics", label: "Spot Graphics (15%)" },
  { value: "lettering", label: "Lettering (10%)" },
];

// --- Props ---

interface QuickAddPresetsProps {
  jobId: string;
  currentItemCount: number;
}

// --- Vehicle Wrap Dialog ---

const vehicleWrapSchema = z.object({
  vehiclePresetId: z.string().min(1, "Select a vehicle"),
  coverage: z.enum([
    "full",
    "three_quarter",
    "half",
    "partial",
    "spot_graphics",
    "lettering",
  ]),
  materialId: z.string().min(1, "Select a material"),
  complexityFactor: z.number().min(1).max(1.5),
  designFee: z.number().min(0),
  installationRate: z.number().min(0).max(100),
});

type VehicleWrapFormValues = z.infer<typeof vehicleWrapSchema>;

function VehicleWrapDialog({
  open,
  onOpenChange,
  jobId,
  currentItemCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  currentItemCount: number;
}) {
  const { data: presets, isLoading: presetsLoading } = useVehiclePresets();
  const { data: materials, isLoading: materialsLoading } =
    useMaterials("vinyl");
  const bulkCreate = useBulkCreateLineItems();

  const form = useForm<VehicleWrapFormValues>({
    resolver: zodResolver(vehicleWrapSchema),
    defaultValues: {
      vehiclePresetId: "",
      coverage: "full",
      materialId: "",
      complexityFactor: 1.0,
      designFee: DEFAULT_DESIGN_FEE,
      installationRate: DEFAULT_INSTALLATION_RATE * 100,
    },
  });

  const watched = form.watch();

  const selectedPreset = useMemo(
    () => presets?.find((p) => p.id === watched.vehiclePresetId),
    [presets, watched.vehiclePresetId]
  );
  const selectedMaterial = useMemo(
    () => materials?.find((m) => m.id === watched.materialId),
    [materials, watched.materialId]
  );

  const preview = useMemo(() => {
    if (!selectedPreset || !selectedMaterial) return null;
    return calculateVehicleWrap({
      vehicleType: selectedPreset.vehicle_type,
      baseSquareFeet: selectedPreset.default_sqft,
      coverage: watched.coverage,
      materialCostPerSqft: selectedMaterial.cost_per_unit,
      materialSellPerSqft: selectedMaterial.retail_per_unit,
      complexityFactor: watched.complexityFactor,
      designFee: watched.designFee,
      installationRate: watched.installationRate / 100,
    });
  }, [selectedPreset, selectedMaterial, watched]);

  function handleSubmit(values: VehicleWrapFormValues) {
    if (!selectedPreset || !selectedMaterial || !preview) return;

    const items: LineItemInsertInput[] = [
      {
        job_id: jobId,
        category: "material",
        description: `Vehicle Wrap - ${selectedMaterial.name}`,
        quantity: preview.materialSqft,
        unit: "sqft",
        unit_price:
          selectedMaterial.retail_per_unit * values.complexityFactor,
        cost_price: selectedMaterial.cost_per_unit,
        taxable: true,
        sort_order: currentItemCount,
      },
      {
        job_id: jobId,
        category: "design",
        description: "Design Fee",
        quantity: 1,
        unit: "flat",
        unit_price: values.designFee,
        cost_price: 0,
        taxable: false,
        sort_order: currentItemCount + 1,
      },
      {
        job_id: jobId,
        category: "installation",
        description: "Installation",
        quantity: 1,
        unit: "flat",
        unit_price: preview.installationFee,
        cost_price: preview.installationCost,
        taxable: true,
        sort_order: currentItemCount + 2,
      },
    ];

    bulkCreate.mutate(items, {
      onSuccess: () => {
        form.reset();
        onOpenChange(false);
      },
    });
  }

  const dataLoading = presetsLoading || materialsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vehicle Wrap Calculator</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          {/* Vehicle Type */}
          <div className="space-y-1.5">
            <Label>Vehicle Type</Label>
            <Controller
              control={form.control}
              name="vehiclePresetId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select vehicle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {presets?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label} ({p.default_sqft} sqft)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Coverage */}
          <div className="space-y-1.5">
            <Label>Coverage</Label>
            <Controller
              control={form.control}
              name="coverage"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COVERAGE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Material */}
          <div className="space-y-1.5">
            <Label>Material</Label>
            <Controller
              control={form.control}
              name="materialId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select material..." />
                  </SelectTrigger>
                  <SelectContent>
                    {materials?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({formatCurrency(m.retail_per_unit)}/sqft)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Complexity Factor */}
          <div className="space-y-1.5">
            <Label>
              Complexity Factor: {watched.complexityFactor.toFixed(2)}
            </Label>
            <Controller
              control={form.control}
              name="complexityFactor"
              render={({ field }) => (
                <Slider
                  min={100}
                  max={150}
                  step={5}
                  value={[Math.round(field.value * 100)]}
                  onValueChange={([v]) => field.onChange(v / 100)}
                />
              )}
            />
          </div>

          {/* Design Fee */}
          <div className="space-y-1.5">
            <Label>Design Fee</Label>
            <Input
              type="number"
              {...form.register("designFee", { valueAsNumber: true })}
            />
          </div>

          {/* Installation Rate */}
          <div className="space-y-1.5">
            <Label>Installation Rate (%)</Label>
            <Input
              type="number"
              {...form.register("installationRate", {
                valueAsNumber: true,
              })}
            />
          </div>

          {/* Price Preview */}
          {preview && (
            <div className="rounded-lg bg-muted p-3 text-sm font-mono space-y-1">
              <div className="flex justify-between">
                <span>
                  Material: {preview.materialSqft} sqft ×{" "}
                  {formatCurrency(
                    selectedMaterial!.retail_per_unit *
                      watched.complexityFactor
                  )}
                </span>
                <span>{formatCurrency(preview.materialSell)}</span>
              </div>
              <div className="flex justify-between">
                <span>Design</span>
                <span>{formatCurrency(preview.designFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  Installation ({watched.installationRate}%)
                </span>
                <span>{formatCurrency(preview.installationFee)}</span>
              </div>
              <div className="border-t border-border pt-1 flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCurrency(preview.totalSell)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                bulkCreate.isPending ||
                dataLoading ||
                !preview
              }
              className="w-full sm:w-auto"
            >
              {bulkCreate.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Add to Estimate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Banner Dialog ---

const bannerSchema = z.object({
  width: z.number().min(0.1, "Width required"),
  height: z.number().min(0.1, "Height required"),
});

type BannerFormValues = z.infer<typeof bannerSchema>;

function BannerDialog({
  open,
  onOpenChange,
  jobId,
  currentItemCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  currentItemCount: number;
}) {
  const { data: bannerMaterials } = useMaterials("banner");
  const createItem = useCreateLineItem();

  const form = useForm<BannerFormValues>({
    resolver: zodResolver(bannerSchema),
    defaultValues: { width: 0, height: 0 },
  });

  const watched = form.watch();

  const preview = useMemo(() => {
    if (watched.width <= 0 || watched.height <= 0) return null;
    return calculateBannerPrice(watched.width, watched.height, DEFAULT_BANNER_RATE);
  }, [watched.width, watched.height]);

  const bannerCostPerSqft = bannerMaterials?.[0]?.cost_per_unit ?? 0;

  function handleSubmit(values: BannerFormValues) {
    if (!preview) return;
    const item: LineItemInsertInput = {
      job_id: jobId,
      category: "material",
      description: `Banner ${values.width}ft × ${values.height}ft`,
      quantity: preview.sqft,
      unit: "sqft",
      unit_price: DEFAULT_BANNER_RATE,
      cost_price: bannerCostPerSqft,
      taxable: true,
      sort_order: currentItemCount,
    };
    createItem.mutate(item, {
      onSuccess: () => {
        form.reset();
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Banner Calculator</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Width (ft)</Label>
              <Input
                type="number"
                step="0.1"
                {...form.register("width", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Height (ft)</Label>
              <Input
                type="number"
                step="0.1"
                {...form.register("height", { valueAsNumber: true })}
              />
            </div>
          </div>

          {preview && preview.sqft > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm font-mono">
              <div className="flex justify-between">
                <span>
                  {preview.sqft} sqft × {formatCurrency(DEFAULT_BANNER_RATE)}
                </span>
                <span className="font-semibold">
                  {formatCurrency(preview.total)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={createItem.isPending || !preview}
              className="w-full sm:w-auto"
            >
              {createItem.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Add to Estimate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Quantity Preset Dialog (Business Cards / Door Hangers) ---

const qtyPresetSchema = z.object({
  quantity: z.number().min(1, "Quantity required"),
});

type QtyPresetFormValues = z.infer<typeof qtyPresetSchema>;

function QuantityPresetDialog({
  open,
  onOpenChange,
  jobId,
  currentItemCount,
  presetName,
  dialogTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  currentItemCount: number;
  presetName: string;
  dialogTitle: string;
}) {
  const { data: presets, isLoading: presetsLoading } =
    usePricingPresets("print");
  const createItem = useCreateLineItem();

  const preset = useMemo(
    () => presets?.find((p) => p.name === presetName),
    [presets, presetName]
  );

  const breaks = useMemo(() => {
    if (!preset?.quantity_breaks) return [];
    return parseQuantityBreaks(preset.quantity_breaks);
  }, [preset]);

  const form = useForm<QtyPresetFormValues>({
    resolver: zodResolver(qtyPresetSchema),
    defaultValues: { quantity: 0 },
  });

  const watched = form.watch();

  const preview = useMemo(() => {
    if (watched.quantity <= 0 || breaks.length === 0) return null;
    return calculateQuantityBreakPrice(watched.quantity, breaks);
  }, [watched.quantity, breaks]);

  function handleSubmit(values: QtyPresetFormValues) {
    if (!preview) return;
    const shortName = presetName.split("(")[0].trim();
    const item: LineItemInsertInput = {
      job_id: jobId,
      category: "material",
      description: `${shortName} (${values.quantity})`,
      quantity: values.quantity,
      unit: "each",
      unit_price: preview.unitPrice,
      taxable: true,
      sort_order: currentItemCount,
    };
    createItem.mutate(item, {
      onSuccess: () => {
        form.reset();
        onOpenChange(false);
      },
    });
  }

  // Show tier pricing info
  const sortedBreaks = useMemo(
    () => [...breaks].sort((a, b) => a.min_qty - b.min_qty),
    [breaks]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              {...form.register("quantity", { valueAsNumber: true })}
            />
          </div>

          {/* Tier reference */}
          {sortedBreaks.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              {sortedBreaks.map((b) => (
                <div key={b.min_qty}>
                  {b.min_qty}+ → {formatCurrency(b.price_per_unit)}/ea
                </div>
              ))}
            </div>
          )}

          {preview && (
            <div className="rounded-lg bg-muted p-3 text-sm font-mono">
              <div className="flex justify-between">
                <span>
                  {preview.quantity} qty × {formatCurrency(preview.unitPrice)}
                  /ea
                </span>
                <span className="font-semibold">
                  {formatCurrency(preview.total)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={createItem.isPending || presetsLoading || !preview}
              className="w-full sm:w-auto"
            >
              {createItem.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Add to Estimate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- T-Shirt Dialog ---

const tshirtSchema = z.object({
  quantity: z.number().min(1, "Quantity required"),
  numColors: z.number().min(1).max(6),
  numLocations: z.number().min(1).max(4),
});

type TShirtFormValues = z.infer<typeof tshirtSchema>;

function TShirtDialog({
  open,
  onOpenChange,
  jobId,
  currentItemCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  currentItemCount: number;
}) {
  const { data: presets, isLoading: presetsLoading } =
    usePricingPresets("print");
  const createItem = useCreateLineItem();

  const preset = useMemo(
    () =>
      presets?.find((p) =>
        p.name.toLowerCase().includes("t-shirt")
      ),
    [presets]
  );

  const breaks = useMemo(() => {
    if (!preset?.quantity_breaks) return [];
    return parseQuantityBreaks(preset.quantity_breaks);
  }, [preset]);

  const basePrice = preset?.base_price ?? 0;

  const form = useForm<TShirtFormValues>({
    resolver: zodResolver(tshirtSchema),
    defaultValues: {
      quantity: 0,
      numColors: 1,
      numLocations: 1,
    },
  });

  const watched = form.watch();

  const preview = useMemo(() => {
    if (watched.quantity <= 0) return null;

    // Get base unit price from quantity breaks if available, otherwise use base_price
    let unitBase = basePrice;
    if (breaks.length > 0) {
      const result = calculateQuantityBreakPrice(watched.quantity, breaks);
      unitBase = result.unitPrice;
    }

    const extraColors = Math.max(0, watched.numColors - 1);
    const extraLocations = Math.max(0, watched.numLocations - 1);
    const colorUpcharge = extraColors * 1.5;
    const locationUpcharge = extraLocations * 3.0;
    const unitPrice = unitBase + colorUpcharge + locationUpcharge;
    const total = Math.round(unitPrice * watched.quantity * 100) / 100;

    return {
      unitBase,
      colorUpcharge,
      locationUpcharge,
      unitPrice,
      total,
      extraColors,
      extraLocations,
    };
  }, [watched, basePrice, breaks]);

  function handleSubmit(values: TShirtFormValues) {
    if (!preview) return;
    const item: LineItemInsertInput = {
      job_id: jobId,
      category: "material",
      description: `T-Shirts (${values.quantity}) - ${values.numColors} color${values.numColors > 1 ? "s" : ""}, ${values.numLocations} location${values.numLocations > 1 ? "s" : ""}`,
      quantity: values.quantity,
      unit: "each",
      unit_price: preview.unitPrice,
      taxable: true,
      sort_order: currentItemCount,
    };
    createItem.mutate(item, {
      onSuccess: () => {
        form.reset();
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>T-Shirt Calculator</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              {...form.register("quantity", { valueAsNumber: true })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Colors (1-6)</Label>
              <Input
                type="number"
                min={1}
                max={6}
                {...form.register("numColors", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Locations (1-4)</Label>
              <Input
                type="number"
                min={1}
                max={4}
                {...form.register("numLocations", {
                  valueAsNumber: true,
                })}
              />
            </div>
          </div>

          {preview && (
            <div className="rounded-lg bg-muted p-3 text-sm font-mono space-y-1">
              <div className="flex justify-between">
                <span>Base</span>
                <span>{formatCurrency(preview.unitBase)}</span>
              </div>
              {preview.extraColors > 0 && (
                <div className="flex justify-between">
                  <span>Colors (+{preview.extraColors})</span>
                  <span>{formatCurrency(preview.colorUpcharge)}</span>
                </div>
              )}
              {preview.extraLocations > 0 && (
                <div className="flex justify-between">
                  <span>Locations (+{preview.extraLocations})</span>
                  <span>{formatCurrency(preview.locationUpcharge)}</span>
                </div>
              )}
              <div className="border-t border-border pt-1 flex justify-between font-semibold">
                <span>
                  {formatCurrency(preview.unitPrice)}/ea ×{" "}
                  {watched.quantity}
                </span>
                <span>{formatCurrency(preview.total)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                createItem.isPending || presetsLoading || !preview
              }
              className="w-full sm:w-auto"
            >
              {createItem.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Add to Estimate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Component ---

export default function QuickAddPresets({
  jobId,
  currentItemCount,
}: QuickAddPresetsProps) {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const createItem = useCreateLineItem();

  function openDialog(name: string) {
    setActiveDialog(name);
  }

  function closeDialog() {
    setActiveDialog(null);
  }

  function handleCustomItem() {
    const item: LineItemInsertInput = {
      job_id: jobId,
      description: "Custom Item",
      quantity: 1,
      unit_price: 0,
      unit: "each",
      category: "other",
      taxable: true,
      sort_order: currentItemCount,
    };
    createItem.mutate(item);
  }

  const presetButtons = [
    { key: "vehicle-wrap", label: "Vehicle Wrap", icon: Car },
    { key: "banner", label: "Banner", icon: Flag },
    {
      key: "business-cards",
      label: "Business Cards",
      icon: CreditCard,
    },
    { key: "door-hangers", label: "Door Hangers", icon: DoorOpen },
    { key: "t-shirts", label: "T-Shirts", icon: Shirt },
    { key: "custom", label: "Custom Item", icon: FileEdit },
  ];

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {presetButtons.map((btn) => {
            const Icon = btn.icon;
            const isCustom = btn.key === "custom";
            return (
              <Button
                key={btn.key}
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={isCustom && createItem.isPending}
                onClick={() =>
                  isCustom ? handleCustomItem() : openDialog(btn.key)
                }
              >
                {isCustom && createItem.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-4" />
                )}
                {btn.label}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Dialogs */}
      <VehicleWrapDialog
        open={activeDialog === "vehicle-wrap"}
        onOpenChange={(open) => !open && closeDialog()}
        jobId={jobId}
        currentItemCount={currentItemCount}
      />

      <BannerDialog
        open={activeDialog === "banner"}
        onOpenChange={(open) => !open && closeDialog()}
        jobId={jobId}
        currentItemCount={currentItemCount}
      />

      <QuantityPresetDialog
        open={activeDialog === "business-cards"}
        onOpenChange={(open) => !open && closeDialog()}
        jobId={jobId}
        currentItemCount={currentItemCount}
        presetName="Business Cards (Glossy Double-Sided)"
        dialogTitle="Business Cards"
      />

      <QuantityPresetDialog
        open={activeDialog === "door-hangers"}
        onOpenChange={(open) => !open && closeDialog()}
        jobId={jobId}
        currentItemCount={currentItemCount}
        presetName="Door Hangers"
        dialogTitle="Door Hangers"
      />

      <TShirtDialog
        open={activeDialog === "t-shirts"}
        onOpenChange={(open) => !open && closeDialog()}
        jobId={jobId}
        currentItemCount={currentItemCount}
      />
    </>
  );
}
