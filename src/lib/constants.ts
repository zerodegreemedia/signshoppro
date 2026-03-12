export const JOB_STATUSES = [
  { value: "lead", label: "Lead", color: "blue" },
  { value: "estimate_draft", label: "Estimate Draft", color: "blue" },
  { value: "estimate_sent", label: "Estimate Sent", color: "amber" },
  { value: "estimate_approved", label: "Estimate Approved", color: "green" },
  { value: "estimate_rejected", label: "Estimate Rejected", color: "red" },
  { value: "design_in_progress", label: "Design In Progress", color: "blue" },
  { value: "proof_sent", label: "Proof Sent", color: "amber" },
  { value: "proof_approved", label: "Proof Approved", color: "green" },
  {
    value: "proof_revision_requested",
    label: "Proof Revision Requested",
    color: "amber",
  },
  {
    value: "deposit_requested",
    label: "Deposit Requested",
    color: "amber",
  },
  { value: "deposit_paid", label: "Deposit Paid", color: "green" },
  { value: "materials_ordered", label: "Materials Ordered", color: "blue" },
  { value: "in_production", label: "In Production", color: "blue" },
  {
    value: "install_scheduled",
    label: "Install Scheduled",
    color: "blue",
  },
  {
    value: "install_complete",
    label: "Install Complete",
    color: "green",
  },
  { value: "invoice_sent", label: "Invoice Sent", color: "amber" },
  { value: "paid", label: "Paid", color: "green" },
  { value: "completed", label: "Completed", color: "green" },
  { value: "cancelled", label: "Cancelled", color: "red" },
  { value: "archived", label: "Archived", color: "red" },
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number]["value"];

export const JOB_TYPES = [
  { value: "vehicle_wrap", label: "Vehicle Wrap" },
  { value: "sign", label: "Sign" },
  { value: "banner", label: "Banner" },
  { value: "print", label: "Print" },
  { value: "apparel", label: "Apparel" },
  { value: "design_only", label: "Design Only" },
  { value: "other", label: "Other" },
] as const;

export type JobType = (typeof JOB_TYPES)[number]["value"];

export const PHOTO_TYPES = [
  { value: "before", label: "Before" },
  { value: "progress", label: "Progress" },
  { value: "after", label: "After" },
  { value: "measurement", label: "Measurement" },
  { value: "reference", label: "Reference" },
  { value: "site_survey", label: "Site Survey" },
] as const;

export type PhotoType = (typeof PHOTO_TYPES)[number]["value"];

export const PRIORITY_LEVELS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "rush", label: "Rush" },
] as const;

export type PriorityLevel = (typeof PRIORITY_LEVELS)[number]["value"];

export const VEHICLE_TYPES = [
  { value: "sedan", label: "Sedan", defaultSqft: 200 },
  { value: "suv", label: "SUV", defaultSqft: 250 },
  { value: "pickup", label: "Pickup", defaultSqft: 250 },
  { value: "minivan", label: "Minivan", defaultSqft: 300 },
  { value: "cargo_van", label: "Cargo Van", defaultSqft: 400 },
  { value: "box_truck_14ft", label: "Box Truck 14ft", defaultSqft: 500 },
  { value: "box_truck_26ft", label: "Box Truck 26ft", defaultSqft: 800 },
  { value: "trailer_53ft", label: "53ft Trailer", defaultSqft: 1000 },
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number]["value"];
