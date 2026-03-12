// src/hooks/usePricingData.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { VehiclePreset, Material, PricingPreset } from "@/types/database";

export function useVehiclePresets() {
  return useQuery({
    queryKey: ["vehicle-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_presets")
        .select("*")
        .order("default_sqft");
      if (error) throw error;
      return data as VehiclePreset[];
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useMaterials(category?: string) {
  return useQuery({
    queryKey: ["materials", category],
    queryFn: async () => {
      let query = supabase
        .from("materials")
        .select("*")
        .eq("active", true)
        .order("name");
      if (category) {
        query = query.eq("category", category);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Material[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function usePricingPresets(jobType?: string) {
  return useQuery({
    queryKey: ["pricing-presets", jobType],
    queryFn: async () => {
      let query = supabase
        .from("pricing_presets")
        .select("*")
        .eq("active", true)
        .order("name");
      if (jobType) {
        query = query.eq("job_type", jobType);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as PricingPreset[];
    },
    staleTime: 1000 * 60 * 10,
  });
}
