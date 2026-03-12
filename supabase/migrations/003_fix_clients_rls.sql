-- Fix: Add explicit WITH CHECK to admin clients policy.
-- Some PostgreSQL/Supabase versions require WITH CHECK for INSERT to work
-- with FOR ALL policies.

DROP POLICY IF EXISTS "Admins full access to clients" ON public.clients;

CREATE POLICY "Admins full access to clients"
  ON public.clients FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
