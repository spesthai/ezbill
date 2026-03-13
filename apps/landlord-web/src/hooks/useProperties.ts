import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export interface Property {
  id: string;
  label: string;
  province: string | null;
  amphoe: string | null;
  tambon: string | null;
  full_address: string | null;
  created_at: string;
}

export interface PropertyInput {
  label: string;
  province?: string;
  amphoe?: string;
  tambon?: string;
  full_address?: string;
}

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    if (!supabase) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("properties")
      .select("id, label, province, amphoe, tambon, full_address, created_at")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setProperties(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function createProperty(input: PropertyInput): Promise<string | null> {
    if (!supabase) return "Supabase not initialized";
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Not authenticated";
    const { error: err } = await supabase.from("properties").insert({
      user_id: user.id,
      label: input.label.trim(),
      province: input.province?.trim() || null,
      amphoe: input.amphoe?.trim() || null,
      tambon: input.tambon?.trim() || null,
      full_address: input.full_address?.trim() || null,
    });
    if (err) return err.message;
    await fetchAll();
    return null;
  }

  async function updateProperty(id: string, input: PropertyInput): Promise<string | null> {
    if (!supabase) return "Supabase not initialized";
    const { error: err } = await supabase.from("properties").update({
      label: input.label.trim(),
      province: input.province?.trim() || null,
      amphoe: input.amphoe?.trim() || null,
      tambon: input.tambon?.trim() || null,
      full_address: input.full_address?.trim() || null,
    }).eq("id", id);
    if (err) return err.message;
    await fetchAll();
    return null;
  }

  async function deleteProperty(id: string): Promise<string | null> {
    if (!supabase) return "Supabase not initialized";
    const { error: err } = await supabase.from("properties").delete().eq("id", id);
    if (err) return err.message;
    await fetchAll();
    return null;
  }

  return { properties, loading, error, createProperty, updateProperty, deleteProperty };
}
