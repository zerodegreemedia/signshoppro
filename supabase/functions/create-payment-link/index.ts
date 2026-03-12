import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@latest";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify auth — must be an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const appUrl = Deno.env.get("APP_URL") || "https://signshop.zerodegree.media";

    // Create a client with the user's JWT to verify identity
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch job with client info
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*, clients(*)")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from("line_items")
      .select("*")
      .eq("job_id", job_id)
      .order("sort_order", { ascending: true });

    if (lineItemsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch line items" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lineItems || lineItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "Job has no line items" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // Fetch or create Stripe customer
    const client = job.clients;
    let stripeCustomerId = client.stripe_customer_id;

    if (!stripeCustomerId && client.email) {
      // Search for existing customer by email
      const existingCustomers = await stripe.customers.list({
        email: client.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
      } else {
        // Create new Stripe customer
        const newCustomer = await stripe.customers.create({
          email: client.email,
          name: client.business_name || client.contact_name,
          phone: client.phone || undefined,
          metadata: {
            signshop_client_id: client.id,
          },
        });
        stripeCustomerId = newCustomer.id;
      }

      // Save Stripe customer ID to our DB
      await supabase
        .from("clients")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", client.id);
    }

    // Build Stripe line items from job line items
    const stripeLineItems = lineItems.map(
      (item: {
        description: string;
        quantity: number;
        unit_price: number;
        taxable: boolean;
      }) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.description,
          },
          unit_amount: Math.round(item.unit_price * 100), // Convert to cents
        },
        quantity: Math.ceil(item.quantity), // Stripe requires integer quantities
        ...(item.taxable ? {} : { tax_rates: [] }), // Non-taxable items get empty tax_rates
      })
    );

    // Create the payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: stripeLineItems,
      metadata: {
        job_id: job.id,
        client_id: client.id,
      },
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${appUrl}/jobs/${job.id}?payment=success`,
        },
      },
      ...(stripeCustomerId
        ? {}
        : {}),
    });

    // Save payment link URL to job
    await supabase
      .from("jobs")
      .update({
        stripe_payment_link: paymentLink.url,
        status: "invoice_sent",
        payment_status: "unpaid",
      })
      .eq("id", job_id);

    // Insert status history
    await supabase.from("job_status_history").insert({
      job_id: job_id,
      from_status: job.status,
      to_status: "invoice_sent",
      changed_by: user.id,
      notes: "Payment link generated",
    });

    return new Response(
      JSON.stringify({
        payment_link_url: paymentLink.url,
        payment_link_id: paymentLink.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
