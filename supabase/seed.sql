-- =============================================================================
-- SignShop Pro — Seed Data
-- =============================================================================

-- ------------------------------------------------
-- Vehicle Presets
-- ------------------------------------------------
INSERT INTO public.vehicle_presets (vehicle_type, label, default_sqft) VALUES
  ('sedan',          'Sedan',          200),
  ('suv',            'SUV',            250),
  ('pickup',         'Pickup',         250),
  ('minivan',        'Minivan',        300),
  ('cargo_van',      'Cargo Van',      400),
  ('box_truck_14ft', 'Box Truck 14ft', 500),
  ('box_truck_26ft', 'Box Truck 26ft', 800),
  ('trailer_53ft',   '53ft Trailer',   1000);

-- ------------------------------------------------
-- Pricing Presets
-- ------------------------------------------------
INSERT INTO public.pricing_presets (name, job_type, category, description, base_price, price_per_unit, quantity_breaks, includes_design, includes_installation) VALUES
  (
    'Business Cards (Glossy Double-Sided)',
    'print',
    'print',
    'Standard glossy double-sided business cards',
    NULL,
    NULL,
    '{"250": 0.08, "500": 0.05, "1000": 0.035, "2500": 0.025}',
    true,
    false
  ),
  (
    'Door Hangers',
    'print',
    'print',
    'Standard door hangers',
    NULL,
    NULL,
    '{"250": 0.12, "500": 0.08, "1000": 0.06}',
    true,
    false
  ),
  (
    'Yard Signs 18x24',
    'sign',
    'sign',
    'Corrugated plastic yard signs 18x24 with H-stake',
    NULL,
    NULL,
    '{"1": 25, "5": 20, "10": 17, "25": 14}',
    true,
    false
  ),
  (
    'Vinyl Banners',
    'banner',
    'banner',
    '13oz vinyl banner with grommets',
    NULL,
    8.00,
    NULL,
    true,
    false
  ),
  (
    'T-Shirts (Gildan 50/50) - 1 Color',
    'apparel',
    'apparel',
    'Gildan 50/50 blend t-shirt with 1 color screen print',
    NULL,
    NULL,
    '{"12": 18, "24": 15, "48": 13, "100": 11}',
    true,
    false
  );

-- ------------------------------------------------
-- Materials Catalog
-- ------------------------------------------------
INSERT INTO public.materials (category, name, brand, sku, unit, cost_per_unit, retail_per_unit, in_stock, active) VALUES
  ('vinyl',    '3M 2080 Cast Vinyl',     '3M',     '2080-GP240',  'sqft', 3.50,  14.00, true, true),
  ('vinyl',    'Oracal 651 Calendered',   'Oracal', '651-070',     'sqft', 1.25,  8.00,  true, true),
  ('laminate', '3M Laminate 8518',        '3M',     '8518-000',    'sqft', 1.50,  4.00,  true, true),
  ('banner',   'Banner Material 13oz',    NULL,     'BAN-13OZ',    'sqft', 0.75,  8.00,  true, true);
