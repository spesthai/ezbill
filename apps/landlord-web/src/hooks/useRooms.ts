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
  check_in_at: string | null;   // UTC ISO string
  expires_at: string | null;    // UTC ISO string
  hourly_duration: number | null;
  created_at: string;
}

export interface RoomInput {
  label: string;
  floor?: string;
  rental_type?: Room["rental_type"];
  occupancy_status: Room["occupancy_status"];
  base_rent?: number | null;
  check_in_at?: string | null;
  expires_at?: string | null;
  hourly_duration?: number | null;
  initial_water_reading?: number | null;
  initial_electricity_reading?: number | null;
}

// For bulk creation: template fields + auto-naming config
export interface BulkRoomInput extends Omit<RoomInput, "label"> {
  prefix: string;
  start: number;
  count: number;
  digits: number;
}

// Latest meter readings for a room
export interface MeterReadings {
  water: number | null;
  electricity: number | null;
}

async function upsertMeterReadings(
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
      .select("id, property_id, label, floor, rental_type, occupancy_status, base_rent, check_in_at, expires_at, hourly_duration, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });
    if (err) setError(err.message);
    else setRooms(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, [propertyId]);

  // Fetch the latest meter readings for a specific room
  async function fetchMeterReadings(roomId: string): Promise<MeterReadings> {
    if (!supabase) return { water: null, electricity: null };
    const { data } = await supabase
      .from("utility_readings")
      .select("reading_type, reading_value")
      .eq("room_id", roomId)
      .in("reading_type", ["water", "electricity"])
      .order("reading_at", { ascending: false });

    const readings: MeterReadings = { water: null, electricity: null };
    if (!data) return readings;
    // Take the most recent record per type
    for (const row of data) {
      if (row.reading_type === "water" && readings.water === null) {
        readings.water = row.reading_value;
      }
      if (row.reading_type === "electricity" && readings.electricity === null) {
        readings.electricity = row.reading_value;
      }
    }
    return readings;
  }

  async function createRoom(input: RoomInput): Promise<string | null> {
    if (!supabase || !propertyId) return "Not ready";
    const { data, error: err } = await supabase.from("rooms").insert({
      property_id: propertyId,
      label: input.label.trim(),
      floor: input.floor?.trim() || null,
      rental_type: input.rental_type || null,
      occupancy_status: input.occupancy_status,
      base_rent: input.base_rent ?? null,
      check_in_at: input.check_in_at ?? null,
      expires_at: input.expires_at ?? null,
      hourly_duration: input.hourly_duration ?? null,
    }).select("id").single();
    if (err) return err.message;
    await upsertMeterReadings(data.id, input.initial_water_reading, input.initial_electricity_reading);
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
      check_in_at: input.check_in_at ?? null,
      expires_at: input.expires_at ?? null,
      hourly_duration: input.hourly_duration ?? null,
    }).eq("id", id);
    if (err) return err.message;
    // Always write new meter readings when provided (new record = new baseline)
    await upsertMeterReadings(id, input.initial_water_reading, input.initial_electricity_reading);
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

    const { data, error: bulkErr } = await supabase.from("rooms").insert(rows).select("id");
    if (bulkErr) return { created: 0, error: bulkErr.message };

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

  return { rooms, loading, error, createRoom, updateRoom, bulkCreateRooms, deleteRoom, fetchMeterReadings, refetch: fetchAll };
}
