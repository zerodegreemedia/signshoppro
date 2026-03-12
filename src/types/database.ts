export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "client";
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  business_name: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  stripe_customer_id: string | null;
  profile_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  title: string;
  description: string | null;
  client_id: string;
  job_type: string;
  status: string;
  priority: string;
  estimated_total: number | null;
  cost_total: number | null;
  tax_rate: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  payment_status: string | null;
  due_date: string | null;
  install_date: string | null;
  install_address: string | null;
  notes: string | null;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: string;
  job_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  cost_price: number | null;
  unit: string | null;
  category: string;
  subtotal: number;
  taxable: boolean;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface JobVehicleDetails {
  id: string;
  job_id: string;
  vehicle_type: string;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  vin: string | null;
  total_sqft: number;
  coverage_percentage: number;
  material_type: string | null;
  complexity: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Proof {
  id: string;
  job_id: string;
  version: number;
  file_url: string;
  thumbnail_url: string | null;
  status: "pending" | "approved" | "revision_requested";
  client_notes: string | null;
  internal_notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_by: string;
  created_at: string;
}

export interface JobPhoto {
  id: string;
  job_id: string;
  photo_type: string;
  file_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  measurements: Record<string, string> | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  taken_at: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  cost_per_unit: number;
  retail_per_unit: number;
  supplier: string | null;
  sku: string | null;
  in_stock: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PricingPreset {
  id: string;
  name: string;
  job_type: string;
  description: string | null;
  base_price: number | null;
  price_per_sqft: number | null;
  price_per_unit: number | null;
  quantity_breaks: Record<string, number> | null;
  includes_design: boolean;
  includes_installation: boolean;
  created_at: string;
  updated_at: string;
}

export interface VehiclePreset {
  id: string;
  vehicle_type: string;
  label: string;
  default_sqft: number;
  created_at: string;
}

export interface Payment {
  id: string;
  job_id: string;
  client_id: string;
  amount: number;
  payment_type: "deposit" | "progress" | "final" | "refund";
  status: "pending" | "completed" | "failed" | "refunded";
  stripe_payment_id: string | null;
  stripe_payment_link: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface JobStatusHistory {
  id: string;
  job_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string;
  notes: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Client, "id" | "created_at">>;
      };
      jobs: {
        Row: Job;
        Insert: Omit<Job, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Job, "id" | "created_at">>;
      };
      line_items: {
        Row: LineItem;
        Insert: Omit<LineItem, "id" | "subtotal" | "created_at" | "updated_at">;
        Update: Partial<Omit<LineItem, "id" | "subtotal" | "created_at">>;
      };
      job_vehicle_details: {
        Row: JobVehicleDetails;
        Insert: Omit<JobVehicleDetails, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<JobVehicleDetails, "id" | "created_at">>;
      };
      proofs: {
        Row: Proof;
        Insert: Omit<Proof, "id" | "created_at">;
        Update: Partial<Omit<Proof, "id" | "created_at">>;
      };
      job_photos: {
        Row: JobPhoto;
        Insert: Omit<JobPhoto, "id" | "created_at">;
        Update: Partial<Omit<JobPhoto, "id" | "created_at">>;
      };
      materials: {
        Row: Material;
        Insert: Omit<Material, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Material, "id" | "created_at">>;
      };
      pricing_presets: {
        Row: PricingPreset;
        Insert: Omit<PricingPreset, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<PricingPreset, "id" | "created_at">>;
      };
      vehicle_presets: {
        Row: VehiclePreset;
        Insert: Omit<VehiclePreset, "id" | "created_at">;
        Update: Partial<Omit<VehiclePreset, "id" | "created_at">>;
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, "id" | "created_at">;
        Update: Partial<Omit<Payment, "id" | "created_at">>;
      };
      job_status_history: {
        Row: JobStatusHistory;
        Insert: Omit<JobStatusHistory, "id" | "created_at">;
        Update: Partial<Omit<JobStatusHistory, "id" | "created_at">>;
      };
    };
  };
}
