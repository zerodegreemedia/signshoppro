-- =============================================================================
-- Phase 2 Audit: Security Fixes
-- =============================================================================

-- CRITICAL FIX #1: Remove overly permissive profiles INSERT policy
-- The handle_new_user() trigger runs as SECURITY DEFINER and bypasses RLS,
-- so this policy is unnecessary. Worse, it lets any authenticated user insert
-- a profile row with role='admin', granting themselves full admin access.
DROP POLICY IF EXISTS "Service can insert profiles" ON public.profiles;

-- Replace with a safe policy: users can only insert their OWN profile row
-- (as a safety net — the trigger handles this, but defense-in-depth)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- CRITICAL FIX #4a: Add security_barrier to client_line_items view
-- Without this, a malicious client could potentially use leaky-view attacks
-- to infer cost_price values through crafted queries with side-effect functions.
DROP VIEW IF EXISTS public.client_line_items;
CREATE VIEW public.client_line_items WITH (security_barrier = true) AS
  SELECT id, job_id, sort_order, category, description, quantity, unit,
         unit_price, subtotal, taxable, notes, created_at, updated_at
  FROM public.line_items;

-- CRITICAL FIX #4b: Make storage buckets private
-- Public buckets bypass all RLS — anyone with the URL can access files
-- without authentication. Photos and proofs contain client-sensitive data.
UPDATE storage.buckets SET public = false WHERE id = 'job-photos';
UPDATE storage.buckets SET public = false WHERE id = 'proofs';
-- client-logos can stay public since logos are meant to be displayed

-- CRITICAL FIX #3: Make changed_by nullable on job_status_history
-- The Stripe webhook runs with the service role (no auth.uid()) and was using
-- a hardcoded fake UUID "00000000-..." that doesn't exist in auth.users,
-- violating the foreign key constraint and causing the insert to fail.
-- System-initiated changes (webhooks, background jobs) use NULL for changed_by.
ALTER TABLE public.job_status_history
  ALTER COLUMN changed_by DROP NOT NULL;

-- CRITICAL FIX #2: Drop the auto-insert status history trigger
-- The application code (useCreateJob, useUpdateJobStatus) and the Stripe
-- webhook all manually insert status history records with notes and proper
-- changed_by values. The trigger also inserts a record, causing duplicates
-- on every status change. We keep the manual inserts since they support
-- notes and explicit changed_by (the trigger uses auth.uid() which is NULL
-- in webhook/service-role contexts).
DROP TRIGGER IF EXISTS on_job_status_change ON public.jobs;
DROP FUNCTION IF EXISTS public.handle_job_status_change();

-- FIX: handle_updated_at trigger needs SECURITY DEFINER and search_path
-- (flagged as medium severity — hardening while we're here)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
