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
  initial_water_reading?: number | null;
  initial_electricity_reading?: number | null;
}

// For bulk creation: template fields + auto-naming config
export interface BulkRoomInput extends Omit<RoomInput, "label"> {
  prefix: string;          // e.g. "A", "摊位", "Room"
  start: number;           // starting number
  count: number;           // how many rooms to create
  digits: number;          // zero-pad digits, e.g. 2 → "01","02"
}

async function insertInitialReadings(
  roomId: string,
  water: number | null | undefined,
  electricity: number | null | undefined
) {
  if (!supabase) return;
  const now = new Date().toISOString();
  const rows = [];
  if (water != null) rows.push({ room_id: roomId, reading_type: "water", reading_at: now, reading_value: water });
  if (electricity != null) rows.push({ room_id: roomId, reading_type: "electricity", reading_at: now, reading_value: electricity });
  if (rows.length > 0) await supabase.from("utility_readings").insert(rows);
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
    const { data, error: err } = await supabase.from("rooms").insert({
      property_id: propertyId,
      label: input.label.trim(),
      floor: input.floor?.trim() || null,
      rental_type: input.rental_type || null,
      occupancy_status: input.occupancy_status,
      base_rent: input.base_rent ?? null,
    }).select("id").single();
    if (err) return err.message;
    await insertInitialReadings(data.id, input.initial_water_reading, input.initial_electricity_reading);
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
    // Initial readings are only set on create, not updated here
    await fetchAll();
    return null;
  }

  async function bulkCreateRooms(input: BulkRoomInput): Promise<{ created: number; error: string | null }> {
    if (!supabase || !propertyId) return { created: 0, error: "Not ready" };

    const rows = Array.from({ length: input.count }, (_, i) => {
      const num = input.start + i;
      const label = `${input.prefix}${String(num).padStart(input.digits, "0")}`;
      return {
        property_id: propertyId,
        label,
        floor: input.floor?.trim() || null,
        rental_type: input.rental_type || null,
        occupancy_status: input.occupancy_status,
        base_rent: input.base_rent ?? null,
      };
    });

    const { data, error: err } = await supabase.from("rooms").insert(rows).select("id");
    if (err) return { created: 0, error: err.message };

    // Insert initial readings for each created room
    const now = new Date().toISOString();
    const readingRows: { room_id: string; reading_type: string; reading_at: string; reading_value: number }[] = [];
    for (const row of data ?? []) {
      if (input.initial_water_reading != null) {
        readingRows.push({ room_id: row.id, reading_type: "water", reading_at: now, reading_value: input.initial_water_reading });
      }
      if (input.initial_electricity_reading != null) {
        readingRows.push({ room_id: row.id, reading_type: "electricity", reading_at: now, reading_value: input.initial_electricity_reading });
      }
    }
    if (readingRows.length > 0) await supabase.from("utility_readings").insert(readingRows);

    await fetchAll();
    return { created: data?.length ?? 0, error: null };
  }

  async function deleteRoom(id: string): Promise<string | null> {
    if (!supabase) return "Not ready";
    const { error: err } = await supabase.from("rooms").delete().eq("id", id);
    if (err) return err.message;
    await fetchAll();
    return null;
  }

  return { rooms, loading, error, createRoom, updateRoom, bulkCreateRooms, deleteRoom, refetch: fetchAll };
}
