import type { JobStatusHistory, JobPhoto, Proof, Payment } from "@/types/database";
import { JOB_STATUSES } from "@/lib/constants";

export type TimelineNodeType = "status" | "photo" | "estimate" | "proof" | "payment";

export interface TimelineNode {
  id: string;
  type: TimelineNodeType;
  timestamp: string;
  title: string;
  description?: string;
  status?: string;
  data?: unknown;
  actionButton?: {
    label: string;
    onClick?: () => void;
  };
}

function statusLabel(status: string): string {
  return JOB_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function mapStatusHistory(history: JobStatusHistory[]): TimelineNode[] {
  return history.map((h) => ({
    id: `status-${h.id}`,
    type: "status" as const,
    timestamp: h.created_at,
    title: `Status: ${statusLabel(h.to_status)}`,
    description: h.from_status
      ? `${statusLabel(h.from_status)} → ${statusLabel(h.to_status)}`
      : `Job created as ${statusLabel(h.to_status)}`,
    status: h.to_status,
    data: h,
  }));
}

function mapPhotos(photos: JobPhoto[]): TimelineNode[] {
  return photos.map((p) => ({
    id: `photo-${p.id}`,
    type: "photo" as const,
    timestamp: p.created_at,
    title: `Photo added — ${p.photo_type.replace("_", " ")}`,
    description: p.caption ?? undefined,
    data: p,
  }));
}

function mapProofs(proofs: Proof[]): TimelineNode[] {
  return proofs.map((p) => ({
    id: `proof-${p.id}`,
    type: "proof" as const,
    timestamp: p.created_at,
    title: `Proof v${p.version} uploaded`,
    description:
      p.status === "approved"
        ? "Approved by client"
        : p.status === "revision_requested"
          ? "Revision requested"
          : "Pending review",
    status: p.status,
    data: p,
  }));
}

function mapPayments(payments: Payment[]): TimelineNode[] {
  return payments.map((p) => ({
    id: `payment-${p.id}`,
    type: "payment" as const,
    timestamp: p.paid_at ?? p.created_at,
    title: `${p.payment_type.charAt(0).toUpperCase() + p.payment_type.slice(1)} payment`,
    description: `$${p.amount.toFixed(2)} — ${p.status}`,
    status: p.status,
    data: p,
  }));
}

/** Merge multiple record types into one chronological timeline, sorted ascending by timestamp. */
export function mergeTimelineNodes({
  statusHistory = [],
  photos = [],
  proofs = [],
  payments = [],
}: {
  statusHistory?: JobStatusHistory[];
  photos?: JobPhoto[];
  proofs?: Proof[];
  payments?: Payment[];
}): TimelineNode[] {
  const nodes: TimelineNode[] = [
    ...mapStatusHistory(statusHistory),
    ...mapPhotos(photos),
    ...mapProofs(proofs),
    ...mapPayments(payments),
  ];

  return nodes.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
