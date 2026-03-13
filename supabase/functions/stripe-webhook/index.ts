import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("APP_URL") || "https://signshop.zerodegree.media";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(",");
  const timestamp = parts
    .find((p) => p.startsWith("t="))
    ?.replace("t=", "");
  const signature = parts
    .find((p) => p.startsWith("v1="))
    ?.replace("v1=", "");

  if (!timestamp || !signature) return false;

  // Check timestamp tolerance (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === signature;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const sigHeader = req.headers.get("stripe-signature");
    if (!sigHeader) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();

    // Verify webhook signature
    const isValid = await verifyStripeSignature(body, sigHeader, webhookSecret);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = JSON.parse(body);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const jobId = session.metadata?.job_id;
      const clientId = session.metadata?.client_id;

      if (!jobId) {
        console.error("No job_id in session metadata");
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountPaid = (session.amount_total || 0) / 100; // Convert from cents

      // Insert payment record
      await supabase.from("payments").insert({
        job_id: jobId,
        client_id: clientId,
        stripe_payment_id: session.payment_intent || session.id,
        amount: amountPaid,
        payment_type: "final" as const,
        payment_method: "stripe",
        status: "completed" as const,
        paid_at: new Date().toISOString(),
      });

      // Fetch the job to check deposit info
      const { data: job } = await supabase
        .from("jobs")
        .select("deposit_amount, deposit_paid, status")
        .eq("id", jobId)
        .single();

      const updates: Record<string, unknown> = {
        payment_status: "paid",
        stripe_payment_id: session.payment_intent || session.id,
      };

      // If deposit was specified and not yet paid, mark it paid
      if (job && job.deposit_amount && !job.deposit_paid) {
        updates.deposit_paid = true;
      }

      // Update job status to "paid"
      updates.status = "paid";

      await supabase.from("jobs").update(updates).eq("id", jobId);

      // Insert status history
      if (job) {
        await supabase.from("job_status_history").insert({
          job_id: jobId,
          from_status: job.status,
          to_status: "paid",
          changed_by: null, // System-initiated (Stripe webhook, no user session)
          notes: `Payment received via Stripe: $${amountPaid.toFixed(2)}`,
        });
      }
    }

    // Return 200 for all events (including unhandled ones)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
