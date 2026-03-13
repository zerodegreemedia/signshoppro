/** Status transition map: current status → available next statuses */
export const STATUS_TRANSITIONS: Record<string, { label: string; value: string }[]> = {
  lead: [{ label: "Create Estimate", value: "estimate_draft" }],
  estimate_draft: [{ label: "Send Estimate", value: "estimate_sent" }],
  estimate_sent: [
    { label: "Mark Approved", value: "estimate_approved" },
    { label: "Mark Rejected", value: "estimate_rejected" },
  ],
  estimate_approved: [{ label: "Start Design", value: "design_in_progress" }],
  estimate_rejected: [{ label: "Revise Estimate", value: "estimate_draft" }],
  design_in_progress: [{ label: "Send Proof", value: "proof_sent" }],
  proof_sent: [
    { label: "Mark Approved", value: "proof_approved" },
    { label: "Revision Requested", value: "proof_revision_requested" },
  ],
  proof_revision_requested: [{ label: "Send New Proof", value: "proof_sent" }],
  proof_approved: [{ label: "Request Deposit", value: "deposit_requested" }],
  deposit_requested: [{ label: "Deposit Paid", value: "deposit_paid" }],
  deposit_paid: [{ label: "Order Materials", value: "materials_ordered" }],
  materials_ordered: [{ label: "Start Production", value: "in_production" }],
  in_production: [{ label: "Schedule Install", value: "install_scheduled" }],
  install_scheduled: [{ label: "Install Complete", value: "install_complete" }],
  install_complete: [{ label: "Send Invoice", value: "invoice_sent" }],
  invoice_sent: [{ label: "Mark Paid", value: "paid" }],
  paid: [{ label: "Complete Job", value: "completed" }],
};

/** Waiting statuses where the primary action should be disabled/muted */
const WAITING_STATUSES = new Set([
  "estimate_sent",
  "proof_sent",
  "deposit_requested",
  "invoice_sent",
]);

export interface ActionHint {
  label: string;
  nextStatus: string;
  isWaiting: boolean;
  hasMultipleActions: boolean;
}

/** Get the next action hint for a given job status */
export function getNextActionHint(status: string): ActionHint | null {
  const transitions = STATUS_TRANSITIONS[status];
  if (!transitions || transitions.length === 0) return null;

  const primary = transitions[0];
  return {
    label: primary.label,
    nextStatus: primary.value,
    isWaiting: WAITING_STATUSES.has(status),
    hasMultipleActions: transitions.length > 1,
  };
}

/** Get all available transitions for a status */
export function getTransitions(status: string) {
  return STATUS_TRANSITIONS[status] ?? [];
}
