import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2 } from "lucide-react";
import { useRecordManualPayment } from "@/hooks/usePayments";
import { RoleGate } from "@/components/auth/RoleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  payment_type: z.enum(["deposit", "progress", "final"]),
  payment_method: z.string().min(1, "Payment method is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface RecordManualPaymentProps {
  jobId: string;
  clientId: string;
}

export function RecordManualPayment({
  jobId,
  clientId,
}: RecordManualPaymentProps) {
  const [open, setOpen] = useState(false);
  const recordPayment = useRecordManualPayment();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      payment_type: "final",
      payment_method: "cash",
      notes: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    recordPayment.mutate(
      {
        job_id: jobId,
        client_id: clientId,
        amount: values.amount,
        payment_type: values.payment_type,
        payment_method: values.payment_method,
        notes: values.notes,
      },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      }
    );
  };

  return (
    <RoleGate requiredRole="admin">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Record Manual Payment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Manual Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment_amount">Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  id="payment_amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  {...register("amount", { valueAsNumber: true })}
                />
              </div>
              {errors.amount && (
                <p className="text-sm text-destructive">
                  {errors.amount.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Controller
                name="payment_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="progress">Progress Payment</SelectItem>
                      <SelectItem value="final">Final Payment</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Controller
                name="payment_method"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="zelle">Zelle</SelectItem>
                      <SelectItem value="venmo">Venmo</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.payment_method && (
                <p className="text-sm text-destructive">
                  {errors.payment_method.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_notes">Notes</Label>
              <Textarea
                id="payment_notes"
                placeholder="Check #, reference, etc."
                rows={2}
                {...register("notes")}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={recordPayment.isPending}
            >
              {recordPayment.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Record Payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </RoleGate>
  );
}
