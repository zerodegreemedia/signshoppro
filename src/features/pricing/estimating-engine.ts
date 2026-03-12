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

// --- Helpers ---

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

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
