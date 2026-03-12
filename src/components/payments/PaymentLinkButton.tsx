import { useState } from "react";
import {
  Link2,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  Check,
} from "lucide-react";
import { useCreatePaymentLink } from "@/hooks/usePayments";
import { RoleGate } from "@/components/auth/RoleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface PaymentLinkButtonProps {
  jobId: string;
  existingLink: string | null;
}

export function PaymentLinkButton({
  jobId,
  existingLink,
}: PaymentLinkButtonProps) {
  const createLink = useCreatePaymentLink();
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(
    existingLink
  );
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const handleGenerate = () => {
    createLink.mutate(jobId, {
      onSuccess: (data) => {
        setGeneratedUrl(data.payment_link_url);
      },
    });
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const qrUrl = generatedUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generatedUrl)}`
    : null;

  return (
    <RoleGate requiredRole="admin">
      {generatedUrl ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4 text-primary" />
              Payment Link
            </div>

            <p className="text-xs text-muted-foreground break-all font-mono bg-muted p-2 rounded">
              {generatedUrl}
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy Link"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.open(generatedUrl, "_blank")}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQr(!showQr)}
              >
                <QrCode className="h-3.5 w-3.5" />
              </Button>
            </div>

            {showQr && qrUrl && (
              <div className="flex justify-center pt-2">
                <img
                  src={qrUrl}
                  alt="Payment QR Code"
                  className="rounded border"
                  width={200}
                  height={200}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Button
          className="w-full"
          onClick={handleGenerate}
          disabled={createLink.isPending}
        >
          {createLink.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="mr-2 h-4 w-4" />
          )}
          {createLink.isPending ? "Generating Link..." : "Generate Payment Link"}
        </Button>
      )}
    </RoleGate>
  );
}
