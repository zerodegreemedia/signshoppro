-- Phase 2 Audit — Warning / Suggestion fixes
-- 1. Add archived column to clients table for soft delete
-- 2. Create server-side RPC for job stats (avoids fetching all jobs client-side)
-- 3. Tighten storage read policies so clients only see their own files

-- Fix #22: Add archived column to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_clients_archived ON public.clients(archived);

-- Fix #8: Server-side job stats RPC
CREATE OR REPLACE FUNCTION public.get_job_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'activeJobs', COALESCE(SUM(CASE WHEN status IN (
      'lead','design_in_progress','deposit_requested','deposit_paid',
      'materials_ordered','in_production','install_scheduled'
    ) THEN 1 ELSE 0 END), 0),
    'pendingEstimates', COALESCE(SUM(CASE WHEN status IN ('estimate_draft','estimate_sent') THEN 1 ELSE 0 END), 0),
    'awaitingApproval', COALESCE(SUM(CASE WHEN status IN ('estimate_sent','proof_sent') THEN 1 ELSE 0 END), 0),
    'completedJobs', COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
    'totalRevenue', COALESCE(SUM(CASE WHEN status IN ('paid','completed') THEN estimated_total ELSE 0 END), 0)
  )
  FROM public.jobs
  WHERE status != 'archived';
$$;

-- Grant execute to authenticated users (RLS on jobs table still applies via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.get_job_stats() TO authenticated;

-- Fix #15: Tighten storage SELECT policies so clients can only see files
-- from jobs that belong to them (via their client record).
-- First drop any overly broad SELECT policies if they exist.

-- For job-photos bucket: clients can only read photos from their own jobs
DO $$
BEGIN
  -- Drop existing broad select policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Authenticated users can read job photos'
  ) THEN
    DROP POLICY "Authenticated users can read job photos" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "Users read own job photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (
      -- Admins can see everything
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      OR
      -- Clients can only see photos from jobs linked to their client record
      EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.clients c ON c.id = j.client_id
        WHERE c.profile_id = auth.uid()
        AND storage.objects.name LIKE '%' || j.id::text || '%'
      )
    )
  );

-- For proofs bucket: same pattern
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Authenticated users can read proofs'
  ) THEN
    DROP POLICY "Authenticated users can read proofs" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "Users read own proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'proofs'
    AND (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      OR
      EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.clients c ON c.id = j.client_id
        WHERE c.profile_id = auth.uid()
        AND storage.objects.name LIKE '%' || j.id::text || '%'
      )
    )
  );
