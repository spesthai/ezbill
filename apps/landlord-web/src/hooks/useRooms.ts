import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export interface Room {
  id: string;
  property_id: string;
  label: string;
  floor: string | null;
  rental_type: "monthly" | "daily" | "hourly" | "stall" | null;
  occupancy_status: "occupied" | "vacant";
  base_rent: number | null;
  created_at: string;
}

export interface RoomInput {
  label: string;
  floor?: string;
  rental_type?: Room["rental_type"];
  occupancy_status: Room["occupancy_status"];
  base_rent?: number | null;
}

export function useRooms(propertyId: string | null) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    if (!supabase || !propertyId) { setRooms([]); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("rooms")
      .select("id, property_id, label, floor, rental_type, occupancy_status, base_rent, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });
    if (err) setError(err.message);
    else setRooms(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, [propertyId]);

  async function createRoom(input: RoomInput): Promise<string | null> {
    if (!supabase || !propertyId) return "Not ready";
    const { error: err } = await supabase.from("rooms").insert({
      property_id: propertyId,
      label: input.label.trim(),
      floor: input.floor?.trim() || null,
      rental_type: input.rental_type || null,
      occupancy_status: input.occupancy_status,
      base_rent: input.base_rent ?? null,
    });
    if (err) return err.message;
    await fetchAll();
    return null;
  }

  async function updateRoom(id: string, input: RoomInput): Promise<string | null> {
    if (!supabase) return "Not ready";
    const { error: err } = await supabase.from("rooms").update({
      label: input.label.trim(),
      floor: input.floor?.trim() || null,
      rental_type: input.rental_type || null,
      occupancy_status: input.occupancy_status,
      base_rent: input.base_rent ?? null,
    }).eq("id", id);
    if (err) return err.message;
    await fetchAll();
    return null;
  }

  async function deleteRoom(id: string): Promise<string | null> {
    if (!supabase) return "Not ready";
    const { error: err } = await supabase.from("rooms").delete().eq("id", id);
    if (err) return err.message;
    await fetchAll();
    return null;
  }

  return { rooms, loading, error, createRoom, updateRoom, deleteRoom, refetch: fetchAll };
}
