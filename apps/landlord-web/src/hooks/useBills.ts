import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────

export type BillStatus = "pending" | "paid" | "overdue";
export type BillingUnit = "month" | "day" | "hour" | "stall";

export interface Bill {
  id: string;
  room_id: string;
  room_label?: string;        // joined
  currency: string;
  period_start: string;       // UTC ISO
  period_end: string;         // UTC ISO
  due_at: string;             // UTC ISO
  billing_unit: BillingUnit;
  billing_quantity: number;
  rent_amount: number;
  water_usage: number | null;
  water_unit_price: number | null;
  water_amount: number | null;
  electricity_usage: number | null;
  electricity_unit_price: number | null;
  electricity_amount: number | null;
  other_fees: OtherFee[] | null;
  total_amount: number;
  status: BillStatus;
  share_token_hash: string;
  share_expires_at: string | null;
  created_at: string;
}

export interface OtherFee {
  label: string;
  amount: number;
}

export interface BillInput {
  room_id: string;
  period_start: string;         // UTC ISO
  period_end: string;           // UTC ISO
  due_at: string;               // UTC ISO
  billing_unit: BillingUnit;
  billing_quantity: number;
  rent_amount: number;
  // Water
  water_prev_reading: number | null;
  water_curr_reading: number | null;
  water_unit_price: number | null;
  // Electricity
  electricity_prev_reading: number | null;
  electricity_curr_reading: number | null;
  electricity_unit_price: number | null;
  // Other fees
  other_fees?: OtherFee[];
}

export interface LatestReadings {
  water: number | null;
  electricity: number | null;
}

// ── Utility: generate a share token ───────────────────────────
function generateToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Hook ───────────────────────────────────────────────────────

export function useBills(roomId: string | null) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    if (!supabase || !roomId) { setBills([]); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("bills")
      .select(
        "id, room_id, currency, period_start, period_end, due_at, billing_unit, billing_quantity, " +
        "rent_amount, water_usage, water_unit_price, water_amount, " +
        "electricity_usage, electricity_unit_price, electricity_amount, " +
        "other_fees, total_amount, status, share_token_hash, share_expires_at, created_at"
      )
      .eq("room_id", roomId)
      .order("period_start", { ascending: false });
    if (err) setError(err.message);
    else setBills((data ?? []) as unknown as Bill[]);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, [roomId]);

  // Fetch the latest meter readings for a room (used to pre-fill prev reading)
  async function fetchLatestReadings(rid: string): Promise<LatestReadings> {
    if (!supabase) return { water: null, electricity: null };
    const { data } = await supabase
      .from("utility_readings")
      .select("reading_type, reading_value")
      .eq("room_id", rid)
      .in("reading_type", ["water", "electricity"])
      .order("reading_at", { ascending: false });
    const result: LatestReadings = { water: null, electricity: null };
    if (!data) return result;
    for (const row of data) {
      if (row.reading_type === "water" && result.water === null) result.water = row.reading_value;
      if (row.reading_type === "electricity" && result.electricity === null) result.electricity = row.reading_value;
    }
    return result;
  }

  async function createBill(input: BillInput): Promise<{ id: string | null; shareToken: string | null; error: string | null }> {
    if (!supabase) return { id: null, shareToken: null, error: "Not ready" };

    // ── Calculate water / electricity amounts ─────────────────
    let water_usage: number | null = null;
    let water_amount: number | null = null;
    if (input.water_curr_reading != null && input.water_prev_reading != null) {
      water_usage = Math.max(0, input.water_curr_reading - input.water_prev_reading);
      water_amount = water_usage * (input.water_unit_price ?? 0);
    }

    let electricity_usage: number | null = null;
    let electricity_amount: number | null = null;
    if (input.electricity_curr_reading != null && input.electricity_prev_reading != null) {
      electricity_usage = Math.max(0, input.electricity_curr_reading - input.electricity_prev_reading);
      electricity_amount = electricity_usage * (input.electricity_unit_price ?? 0);
    }

    const other_total = (input.other_fees ?? []).reduce((s, f) => s + f.amount, 0);
    const total_amount =
      input.rent_amount +
      (water_amount ?? 0) +
      (electricity_amount ?? 0) +
      other_total;

    // ── Generate share token ──────────────────────────────────
    const shareToken = generateToken();
    const share_token_hash = await hashToken(shareToken);

    const { data, error: err } = await supabase
      .from("bills")
      .insert({
        room_id: input.room_id,
        currency: "THB",
        period_start: input.period_start,
        period_end: input.period_end,
        due_at: input.due_at,
        billing_unit: input.billing_unit,
        billing_quantity: input.billing_quantity,
        rent_amount: input.rent_amount,
        water_usage,
        water_unit_price: input.water_unit_price ?? null,
        water_amount,
        electricity_usage,
        electricity_unit_price: input.electricity_unit_price ?? null,
        electricity_amount,
        other_fees: input.other_fees?.length ? input.other_fees : null,
        total_amount,
        status: "pending",
        share_token_hash,
      })
      .select("id")
      .single();

    if (err) return { id: null, shareToken: null, error: err.message };

    // ── Append new meter readings as baseline for next bill ───
    const now = new Date().toISOString();
    const readingRows = [];
    if (input.water_curr_reading != null) {
      readingRows.push({ room_id: input.room_id, reading_type: "water", reading_at: now, reading_value: input.water_curr_reading });
    }
    if (input.electricity_curr_reading != null) {
      readingRows.push({ room_id: input.room_id, reading_type: "electricity", reading_at: now, reading_value: input.electricity_curr_reading });
    }
    if (readingRows.length > 0) await supabase.from("utility_readings").insert(readingRows);

    await fetchAll();
    return { id: data.id, shareToken, error: null };
  }

  async function updateBillStatus(id: string, status: BillStatus): Promise<string | null> {
    if (!supabase) return "Not ready";
    const { error: err } = await supabase.from("bills").update({ status }).eq("id", id);
    if (err) return err.message;
    await fetchAll();
    return null;
  }

  async function deleteBill(id: string): Promise<string | null> {
    if (!supabase) return "Not ready";
    const { error: err } = await supabase.from("bills").delete().eq("id", id);
    if (err) return err.message;
    await fetchAll();
    return null;
  }

  return { bills, loading, error, createBill, updateBillStatus, deleteBill, fetchLatestReadings, refetch: fetchAll };
}
