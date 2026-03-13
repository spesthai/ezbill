import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export interface DashboardStats {
  propertyCount: number;
  roomCount: number;
  monthBillCount: number;
  pendingAmount: number;
}

export interface RecentBill {
  id: string;
  roomLabel: string;
  propertyLabel: string;
  periodStart: string;
  totalAmount: number;
  status: "pending" | "paid" | "overdue";
  dueAt: string;
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBills, setRecentBills] = useState<RecentBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    async function load() {
      if (!supabase) return;
      try {
        // 楼盘数 + 房间数
        const [{ count: propCount }, { count: roomCount }] = await Promise.all([
          supabase.from("properties").select("id", { count: "exact", head: true }),
          supabase.from("rooms").select("id", { count: "exact", head: true }),
        ]);

        // 本月账单数 & 待收款金额
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const { data: monthBills } = await supabase
          .from("bills")
          .select("id, total_amount, status")
          .gte("period_start", monthStart)
          .lte("period_start", monthEnd);

        const monthBillCount = monthBills?.length ?? 0;
        const pendingAmount = monthBills
          ?.filter((b) => b.status === "pending" || b.status === "overdue")
          .reduce((sum, b) => sum + Number(b.total_amount), 0) ?? 0;

        // 最近 5 条账单（含房间和楼盘名）
        const { data: billRows } = await supabase
          .from("bills")
          .select("id, period_start, total_amount, status, due_at, room_id, rooms(label, properties(label))")
          .order("created_at", { ascending: false })
          .limit(5);

        if (cancelled) return;

        setStats({
          propertyCount: propCount ?? 0,
          roomCount: roomCount ?? 0,
          monthBillCount,
          pendingAmount,
        });

        setRecentBills(
          (billRows ?? []).map((b: any) => ({
            id: b.id,
            roomLabel: b.rooms?.label ?? "—",
            propertyLabel: b.rooms?.properties?.label ?? "—",
            periodStart: b.period_start,
            totalAmount: Number(b.total_amount),
            status: b.status,
            dueAt: b.due_at,
          }))
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { stats, recentBills, loading, error };
}
