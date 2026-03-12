-- Make existing buckets public (they were created as private in 001)
UPDATE storage.buckets SET public = true WHERE id = 'job-photos';
UPDATE storage.buckets SET public = true WHERE id = 'proofs';

-- Create client-logos bucket (not in 001)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for client-logos bucket
CREATE POLICY "Authenticated users can read client logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload client logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'client-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete client logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'client-logos' AND public.is_admin());

-- Allow clients to INSERT their own job photos (001 only has SELECT for clients)
CREATE POLICY "Clients can insert own job photos"
  ON public.job_photos FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.clients c ON c.id = j.client_id
      WHERE c.profile_id = auth.uid()
    )
  );
