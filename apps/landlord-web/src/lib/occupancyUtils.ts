import { addDays, addMinutes, addMonths } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const TZ = "Asia/Bangkok";

export type RentalType = "monthly" | "daily" | "stall" | "hourly";

// ── Expiry calculation ─────────────────────────────────────────
// All stored as UTC; display in Asia/Bangkok (UTC+7)

export function calcExpiresAt(
  checkInAt: Date,
  rentalType: RentalType,
  hourlyDuration?: number
): Date {
  switch (rentalType) {
    case "monthly":
      return addMonths(checkInAt, 1);
    case "daily":
    case "stall":
      return addDays(checkInAt, 1);
    case "hourly":
      return addMinutes(checkInAt, Math.round((hourlyDuration ?? 1) * 60));
  }
}

// ── Display formatting ─────────────────────────────────────────
// Returns "DD/MM/YY HH:mm" in Asia/Bangkok time

export function formatBKK(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return formatInTimeZone(d, TZ, "dd/MM/yy HH:mm");
}

// ── Parse local BKK datetime string to UTC Date ────────────────
// Given a JS Date that represents local BKK time from a DatePicker,
// convert it to a proper UTC Date for storage.
// date-fns DatePicker gives a local date; we re-interpret it as BKK.
export function bkkLocalToUtc(localDate: Date): Date {
  // formatInTimeZone gives us the BKK wall-clock equivalent;
  // toZonedTime shifts a UTC date to BKK; the inverse uses the offset.
  // Simplest: manually apply +7h offset in reverse.
  return new Date(localDate.getTime() - 7 * 60 * 60 * 1000);
}

// ── Convert UTC ISO string to BKK local Date for a DatePicker ─
// DatePickers work in local browser time; we offset to BKK.
export function utcToBkkLocal(utcIso: string | null | undefined): Date | null {
  if (!utcIso) return null;
  const d = new Date(utcIso);
  if (isNaN(d.getTime())) return null;
  return toZonedTime(d, TZ);
}

// ── Expiry status ──────────────────────────────────────────────
export type ExpiryStatus = "expired" | "warning" | "normal" | "none";

export function getExpiryStatus(
  expiresAt: string | null | undefined,
  warningDays = 3
): ExpiryStatus {
  if (!expiresAt) return "none";
  const now = new Date();
  const exp = new Date(expiresAt);
  if (isNaN(exp.getTime())) return "none";
  if (exp <= now) return "expired";
  const msWarning = warningDays * 24 * 60 * 60 * 1000;
  if (exp.getTime() - now.getTime() <= msWarning) return "warning";
  return "normal";
}

// Hourly duration preset options (hours)
export const HOURLY_PRESETS = [1, 1.5, 2, 3, 4, 6, 8, 12, 24];
export const HOURLY_MIN = 1;
export const HOURLY_MAX = 24;
