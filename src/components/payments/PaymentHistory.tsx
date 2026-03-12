import { format } from "date-fns";
import { Receipt } from "lucide-react";
import type { Payment } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PaymentHistoryProps {
  payments: Payment[] | undefined;
  isLoading: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  progress: "Progress",
  final: "Final",
  refund: "Refund",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  refunded: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function PaymentHistory({ payments, isLoading }: PaymentHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Receipt className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No payments yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPaid = payments
    .filter((p) => p.status === "completed" && p.payment_type !== "refund")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = payments
    .filter((p) => p.payment_type === "refund" && p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Payment History
          </CardTitle>
          <span className="text-sm font-semibold">
            {formatCurrency(totalPaid - totalRefunded)} paid
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {formatCurrency(payment.amount)}
                  </span>
                  <Badge
                    variant="secondary"
                    className={STATUS_COLORS[payment.status] ?? ""}
                  >
                    {payment.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{TYPE_LABELS[payment.payment_type] ?? payment.payment_type}</span>
                  {payment.payment_method && (
                    <>
                      <span>·</span>
                      <span className="capitalize">{payment.payment_method}</span>
                    </>
                  )}
                </div>
                {payment.notes && (
                  <p className="text-xs text-muted-foreground">{payment.notes}</p>
                )}
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {payment.paid_at
                  ? format(new Date(payment.paid_at), "MMM d, yyyy")
                  : format(new Date(payment.created_at), "MMM d, yyyy")}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
