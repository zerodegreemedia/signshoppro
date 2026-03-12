import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import type { Client } from "@/types/database";

const clientSchema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  contact_name: z.string().min(1, "Contact name is required"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  phone: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  notes: z.string(),
  tax_exempt: z.boolean(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormProps {
  defaultValues?: Partial<Client>;
  onSubmit: (values: ClientFormValues) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function ClientForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Save Client",
}: ClientFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      business_name: defaultValues?.business_name ?? "",
      contact_name: defaultValues?.contact_name ?? "",
      email: defaultValues?.email ?? "",
      phone: defaultValues?.phone ?? "",
      address: defaultValues?.address ?? "",
      city: defaultValues?.city ?? "",
      state: defaultValues?.state ?? "",
      zip: defaultValues?.zip ?? "",
      notes: defaultValues?.notes ?? "",
      tax_exempt: defaultValues?.tax_exempt ?? false,
    },
  });

  const taxExempt = watch("tax_exempt");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="business_name">Business Name *</Label>
        <Input
          id="business_name"
          {...register("business_name")}
          placeholder="Acme Corp"
        />
        {errors.business_name && (
          <p className="text-sm text-destructive">{errors.business_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact_name">Contact Name *</Label>
        <Input
          id="contact_name"
          {...register("contact_name")}
          placeholder="John Smith"
        />
        {errors.contact_name && (
          <p className="text-sm text-destructive">{errors.contact_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          placeholder="john@acmecorp.com"
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          {...register("phone")}
          placeholder="(555) 123-4567"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          {...register("address")}
          placeholder="123 Main St"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" {...register("city")} placeholder="Orlando" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" {...register("state")} placeholder="FL" />
        </div>
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="zip">ZIP</Label>
          <Input id="zip" {...register("zip")} placeholder="32801" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder="Any special instructions or notes..."
          rows={3}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor="tax_exempt" className="cursor-pointer">
            Tax Exempt
          </Label>
          <p className="text-xs text-muted-foreground">
            Exclude sales tax from invoices
          </p>
        </div>
        <Switch
          id="tax_exempt"
          checked={taxExempt}
          onCheckedChange={(checked) => setValue("tax_exempt", checked)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
