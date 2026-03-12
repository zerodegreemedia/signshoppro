-- =============================================================================
-- SignShop Pro — Initial Database Schema
-- =============================================================================

-- ------------------------------------------------
-- Custom ENUM types
-- ------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('admin', 'client');
CREATE TYPE public.job_type AS ENUM ('vehicle_wrap', 'sign', 'banner', 'print', 'apparel', 'design_only', 'other');
CREATE TYPE public.job_status AS ENUM (
  'lead', 'estimate_draft', 'estimate_sent', 'estimate_approved', 'estimate_rejected',
  'design_in_progress', 'proof_sent', 'proof_approved', 'proof_revision_requested',
  'deposit_requested', 'deposit_paid', 'materials_ordered', 'in_production',
  'install_scheduled', 'install_complete', 'invoice_sent', 'paid', 'completed',
  'cancelled', 'archived'
);
CREATE TYPE public.priority_level AS ENUM ('low', 'normal', 'high', 'rush');
CREATE TYPE public.photo_type AS ENUM ('before', 'progress', 'after', 'measurement', 'reference', 'site_survey');
CREATE TYPE public.proof_status AS ENUM ('pending', 'approved', 'revision_requested');
CREATE TYPE public.payment_type AS ENUM ('deposit', 'progress', 'final', 'refund');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.line_item_category AS ENUM ('material', 'labor', 'design', 'installation', 'other');
CREATE TYPE public.unit_type AS ENUM ('sqft', 'lnft', 'each', 'hour', 'flat');

-- ------------------------------------------------
-- 1. profiles (extends auth.users)
-- ------------------------------------------------
CREATE TABLE public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  full_name  text,
  avatar_url text,
  role       public.user_role NOT NULL DEFAULT 'client',
  phone      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 2. clients
-- ------------------------------------------------
CREATE TABLE public.clients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name      text NOT NULL,
  contact_name       text NOT NULL,
  email              text,
  phone              text,
  address            text,
  city               text,
  state              text,
  zip                text,
  notes              text,
  stripe_customer_id text,
  tax_exempt         boolean NOT NULL DEFAULT false,
  profile_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by         uuid NOT NULL REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 3. jobs
-- ------------------------------------------------
CREATE TABLE public.jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number      serial UNIQUE,
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  title           text NOT NULL,
  description     text,
  job_type        public.job_type NOT NULL DEFAULT 'other',
  status          public.job_status NOT NULL DEFAULT 'lead',
  priority        public.priority_level NOT NULL DEFAULT 'normal',
  due_date        date,
  install_date    date,
  install_address text,
  estimated_total numeric(10,2),
  cost_total      numeric(10,2),
  tax_rate        numeric(5,4) DEFAULT 0,
  deposit_amount  numeric(10,2),
  deposit_paid    boolean NOT NULL DEFAULT false,
  stripe_payment_id   text,
  stripe_payment_link text,
  payment_status  text,
  assigned_to     uuid REFERENCES auth.users(id),
  notes           text,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 4. line_items
-- ------------------------------------------------
CREATE TABLE public.line_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  category    public.line_item_category NOT NULL DEFAULT 'other',
  description text NOT NULL,
  quantity    numeric(10,2) NOT NULL DEFAULT 1,
  unit        public.unit_type DEFAULT 'each',
  unit_price  numeric(10,2) NOT NULL DEFAULT 0,
  cost_price  numeric(10,2),
  subtotal    numeric(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  taxable     boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 5. job_vehicle_details
-- ------------------------------------------------
CREATE TABLE public.job_vehicle_details (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  vehicle_type        text NOT NULL,
  year                integer,
  make                text,
  model               text,
  color               text,
  vin                 text,
  wrap_coverage       text,
  vinyl_brand         text,
  vinyl_type          text,
  vinyl_finish        text,
  total_sqft          numeric(10,2) NOT NULL DEFAULT 0,
  complexity_factor   numeric(3,2) NOT NULL DEFAULT 1.00,
  coverage_percentage integer DEFAULT 100,
  material_type       text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 6. proofs
-- ------------------------------------------------
CREATE TABLE public.proofs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  version         integer NOT NULL DEFAULT 1,
  storage_path    text NOT NULL,
  file_url        text NOT NULL,
  thumbnail_url   text,
  status          public.proof_status NOT NULL DEFAULT 'pending',
  sent_at         timestamptz,
  approved_at     timestamptz,
  approved_by     uuid REFERENCES auth.users(id),
  client_notes    text,
  internal_notes  text,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 7. job_photos
-- ------------------------------------------------
CREATE TABLE public.job_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  uploaded_by   uuid NOT NULL REFERENCES auth.users(id),
  storage_path  text NOT NULL,
  file_url      text NOT NULL,
  thumbnail_url text,
  photo_type    public.photo_type NOT NULL DEFAULT 'reference',
  caption       text,
  notes         text,
  measurements  jsonb,
  gps_latitude  double precision,
  gps_longitude double precision,
  taken_at      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 8. materials
-- ------------------------------------------------
CREATE TABLE public.materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text NOT NULL,
  name            text NOT NULL,
  brand           text,
  sku             text,
  unit            text NOT NULL DEFAULT 'sqft',
  cost_per_unit   numeric(10,2) NOT NULL DEFAULT 0,
  retail_per_unit numeric(10,2) NOT NULL DEFAULT 0,
  supplier        text,
  in_stock        boolean NOT NULL DEFAULT true,
  in_stock_qty    numeric(10,2),
  notes           text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 9. pricing_presets
-- ------------------------------------------------
CREATE TABLE public.pricing_presets (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL,
  job_type               text NOT NULL,
  category               text,
  description            text,
  base_price             numeric(10,2),
  price_per_sqft         numeric(10,2),
  price_per_unit         numeric(10,2),
  quantity_breaks        jsonb,
  includes_design        boolean NOT NULL DEFAULT false,
  includes_installation  boolean NOT NULL DEFAULT false,
  active                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 10. vehicle_presets
-- ------------------------------------------------
CREATE TABLE public.vehicle_presets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type  text NOT NULL UNIQUE,
  label         text NOT NULL,
  make          text,
  model         text,
  default_sqft  numeric(10,2) NOT NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 11. payments
-- ------------------------------------------------
CREATE TABLE public.payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             uuid NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  client_id          uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  stripe_payment_id  text,
  stripe_payment_link text,
  amount             numeric(10,2) NOT NULL,
  payment_type       public.payment_type NOT NULL DEFAULT 'final',
  payment_method     text,
  status             public.payment_status NOT NULL DEFAULT 'pending',
  notes              text,
  paid_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 12. job_status_history
-- ------------------------------------------------
CREATE TABLE public.job_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  changed_by  uuid NOT NULL REFERENCES auth.users(id),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX idx_jobs_client_id  ON public.jobs(client_id);
CREATE INDEX idx_jobs_status     ON public.jobs(status);
CREATE INDEX idx_jobs_created_by ON public.jobs(created_by);
CREATE INDEX idx_line_items_job_id   ON public.line_items(job_id);
CREATE INDEX idx_job_photos_job_id   ON public.job_photos(job_id);
CREATE INDEX idx_proofs_job_id       ON public.proofs(job_id);
CREATE INDEX idx_payments_job_id     ON public.payments(job_id);
CREATE INDEX idx_payments_client_id  ON public.payments(client_id);
CREATE INDEX idx_job_status_history_job_id ON public.job_status_history(job_id);
CREATE INDEX idx_clients_profile_id  ON public.clients(profile_id);

-- =============================================================================
-- Helper function: is_admin()
-- Returns TRUE if current authenticated user has role = 'admin'
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- =============================================================================
-- View: client_line_items (excludes cost_price for client access)
-- =============================================================================
CREATE VIEW public.client_line_items AS
  SELECT id, job_id, sort_order, category, description, quantity, unit,
         unit_price, subtotal, taxable, notes, created_at, updated_at
  FROM public.line_items;

-- =============================================================================
-- Row Level Security — Enable on ALL tables
-- =============================================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_vehicle_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proofs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_photos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_presets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_presets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_status_history ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies — profiles
-- =============================================================================
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin());

-- Allow the trigger to insert profiles
CREATE POLICY "Service can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- RLS Policies — clients
-- =============================================================================
CREATE POLICY "Admins full access to clients"
  ON public.clients FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can read own client record"
  ON public.clients FOR SELECT
  USING (profile_id = auth.uid());

-- =============================================================================
-- RLS Policies — jobs
-- =============================================================================
CREATE POLICY "Admins full access to jobs"
  ON public.jobs FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can read own jobs"
  ON public.jobs FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE profile_id = auth.uid()
    )
  );

-- =============================================================================
-- RLS Policies — line_items
-- =============================================================================
CREATE POLICY "Admins full access to line_items"
  ON public.line_items FOR ALL
  USING (public.is_admin());

-- Clients should use client_line_items view (no cost_price).
-- But if they query the table directly, block it:
CREATE POLICY "Clients cannot access line_items directly"
  ON public.line_items FOR SELECT
  USING (false);

-- =============================================================================
-- RLS Policies — job_vehicle_details
-- =============================================================================
CREATE POLICY "Admins full access to vehicle details"
  ON public.job_vehicle_details FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can read own job vehicle details"
  ON public.job_vehicle_details FOR SELECT
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.clients c ON c.id = j.client_id
      WHERE c.profile_id = auth.uid()
    )
  );

-- =============================================================================
-- RLS Policies — proofs
-- =============================================================================
CREATE POLICY "Admins full access to proofs"
  ON public.proofs FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can read own proofs"
  ON public.proofs FOR SELECT
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.clients c ON c.id = j.client_id
      WHERE c.profile_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update own proofs (approval)"
  ON public.proofs FOR UPDATE
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.clients c ON c.id = j.client_id
      WHERE c.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.clients c ON c.id = j.client_id
      WHERE c.profile_id = auth.uid()
    )
  );

-- =============================================================================
-- RLS Policies — job_photos
-- =============================================================================
CREATE POLICY "Admins full access to job_photos"
  ON public.job_photos FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can read own job photos"
  ON public.job_photos FOR SELECT
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.clients c ON c.id = j.client_id
      WHERE c.profile_id = auth.uid()
    )
  );

-- =============================================================================
-- RLS Policies — materials (admin-only write, admin read)
-- =============================================================================
CREATE POLICY "Admins full access to materials"
  ON public.materials FOR ALL
  USING (public.is_admin());

-- =============================================================================
-- RLS Policies — pricing_presets (anyone auth can read, admin write)
-- =============================================================================
CREATE POLICY "Authenticated can read pricing_presets"
  ON public.pricing_presets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage pricing_presets"
  ON public.pricing_presets FOR ALL
  USING (public.is_admin());

-- =============================================================================
-- RLS Policies — vehicle_presets (anyone auth can read, admin write)
-- =============================================================================
CREATE POLICY "Authenticated can read vehicle_presets"
  ON public.vehicle_presets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage vehicle_presets"
  ON public.vehicle_presets FOR ALL
  USING (public.is_admin());

-- =============================================================================
-- RLS Policies — payments
-- =============================================================================
CREATE POLICY "Admins full access to payments"
  ON public.payments FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can read own payments"
  ON public.payments FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE profile_id = auth.uid()
    )
  );

-- =============================================================================
-- RLS Policies — job_status_history
-- =============================================================================
CREATE POLICY "Admins full access to status history"
  ON public.job_status_history FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can read own job status history"
  ON public.job_status_history FOR SELECT
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.clients c ON c.id = j.client_id
      WHERE c.profile_id = auth.uid()
    )
  );

-- =============================================================================
-- Trigger: Auto-create profile on user signup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'client'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Trigger: Log job status changes
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_job_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.job_status_history (job_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_job_status_change
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_job_status_change();

-- =============================================================================
-- Trigger: Auto-update updated_at timestamps
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.line_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.job_vehicle_details
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pricing_presets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- Storage buckets
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for job-photos bucket
CREATE POLICY "Authenticated users can upload job photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read job photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete job photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'job-photos' AND public.is_admin());

-- Storage policies for proofs bucket
CREATE POLICY "Authenticated users can upload proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'proofs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'proofs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete proofs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'proofs' AND public.is_admin());
