import {
  Button, DatePicker, Drawer, Form, Input, InputNumber,
  Modal, Select, Spin, Table, message,
} from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type BillInput, type BillStatus, type OtherFee, useBills } from "../hooks/useBills";
import { useProperties } from "../hooks/useProperties";
import { type Room, useRooms } from "../hooks/useRooms";
import { formatBKK, getExpiryStatus } from "../lib/occupancyUtils";

// ── Status config ───────────────────────────────────────────────
const STATUS_CONFIG: Record<BillStatus, { color: string; bg: string; labelKey: string }> = {
  pending:  { color: "#D97706", bg: "#FEF3C7", labelKey: "bills.statusPending" },
  paid:     { color: "#059669", bg: "#D1FAE5", labelKey: "bills.statusPaid" },
  overdue:  { color: "#DC2626", bg: "#FEE2E2", labelKey: "bills.statusOverdue" },
};

const ROOM_OCCUPANCY_CONFIG = {
  occupied: { bg: "#EFF6FF", color: "#1E40FF", dotColor: "#1E40FF" },
  vacant:   { bg: "#FEF3C7", color: "#D97706", dotColor: "#D97706" },
};

// ── Helpers ─────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dayjs.tz(iso, "Asia/Bangkok").format("DD/MM/YY");
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 12px" }}>
      <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
    </div>
  );
}

function CalcRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280", marginTop: 4 }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600, color: "#111827" }}>{value}</span>
    </div>
  );
}

// ── View states ─────────────────────────────────────────────────
// "rooms"  → show room card list for selected property
// "bills"  → show bill list for selected room
type ViewState = "rooms" | "bills";

// ── Main Page ───────────────────────────────────────────────────
export default function BillsPage() {
  const { t } = useTranslation();
  const { properties, loading: propsLoading } = useProperties();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [view, setView] = useState<ViewState>("rooms");

  const { rooms, loading: roomsLoading } = useRooms(selectedPropertyId);
  const { bills, loading: billsLoading, createBill, updateBillStatus, deleteBill, fetchLatestReadings } =
    useBills(view === "bills" ? selectedRoom?.id ?? null : null);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  // ── Navigate to room's bill list ──────────────────────────────
  function enterRoom(room: Room) {
    setSelectedRoom(room);
    setView("bills");
  }

  function backToRooms() {
    setSelectedRoom(null);
    setView("rooms");
  }

  // ── Drawer state ──────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [form] = Form.useForm();

  // Real-time calc state
  const [waterUsage, setWaterUsage] = useState<number | null>(null);
  const [waterAmount, setWaterAmount] = useState<number | null>(null);
  const [elecUsage, setElecUsage] = useState<number | null>(null);
  const [elecAmount, setElecAmount] = useState<number | null>(null);
  const [otherTotal, setOtherTotal] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);

  // Share token modal (stores array for batch)
  const [shareTokens, setShareTokens] = useState<string[]>([]);

  // ── Recalculate totals ────────────────────────────────────────
  function recalcTotals(values: Record<string, unknown>) {
    const rent = Number(values.rent_amount ?? 0) || 0;
    const wPrev = values.water_prev_reading != null ? Number(values.water_prev_reading) : null;
    const wCurr = values.water_curr_reading != null ? Number(values.water_curr_reading) : null;
    const wPrice = Number(values.water_unit_price ?? 0) || 0;
    const ePrev = values.electricity_prev_reading != null ? Number(values.electricity_prev_reading) : null;
    const eCurr = values.electricity_curr_reading != null ? Number(values.electricity_curr_reading) : null;
    const ePrice = Number(values.electricity_unit_price ?? 0) || 0;
    const others: OtherFee[] = (values.other_fees as OtherFee[] | undefined) ?? [];

    let wu: number | null = null; let wa: number | null = null;
    if (wPrev != null && wCurr != null) { wu = Math.max(0, wCurr - wPrev); wa = wu * wPrice; }
    let eu: number | null = null; let ea: number | null = null;
    if (ePrev != null && eCurr != null) { eu = Math.max(0, eCurr - ePrev); ea = eu * ePrice; }
    const ot = others.reduce((s, f) => s + (Number(f?.amount) || 0), 0);
    const total = rent + (wa ?? 0) + (ea ?? 0) + ot;

    setWaterUsage(wu); setWaterAmount(wa);
    setElecUsage(eu); setElecAmount(ea);
    setOtherTotal(ot); setTotalAmount(total);
  }

  // ── Auto-calculate period_end from period_start + unit + qty ─
  function calcPeriodEnd(start: Dayjs, unit: string, qty: number): Dayjs {
    const q = qty || 1;
    switch (unit) {
      case "month": return start.add(q, "month").subtract(1, "day");
      case "day":   return start.add(q - 1, "day");
      case "hour":  return start.add(q, "hour");
      case "stall": return start.add(q, "month").subtract(1, "day");
      default:      return start.add(q, "month").subtract(1, "day");
    }
  }

  function handlePeriodFieldChange(_: unknown, all: Record<string, unknown>) {
    const start = all.period_start as Dayjs | undefined;
    const unit  = all.billing_unit as string | undefined;
    // period_end = end of the FIRST bill (1 period unit)
    if (start?.isValid() && unit) {
      form.setFieldValue("period_end", calcPeriodEnd(start, unit, 1));
    }
    recalcTotals(form.getFieldsValue());
  }

  // Next bill start = day after current bill ends (or next hour for hourly)
  function nextPeriodStart(end: Dayjs, unit: string): Dayjs {
    if (unit === "hour") return end.add(1, "second");
    return end.add(1, "day");
  }

  // ── Open create drawer ────────────────────────────────────────
  async function openCreate() {
    if (!selectedRoom) return;
    form.resetFields();
    setWaterUsage(null); setWaterAmount(null);
    setElecUsage(null); setElecAmount(null);
    setOtherTotal(0); setTotalAmount(0);

    const unitMap: Record<string, string> = {
      monthly: "month", daily: "day", hourly: "hour", stall: "stall",
    };
    const billingUnit = selectedRoom.rental_type
      ? (unitMap[selectedRoom.rental_type] ?? "month") : "month";

    // period_start: use check_in_at if available, else first day of current month
    const periodStart = selectedRoom.check_in_at
      ? dayjs.tz(selectedRoom.check_in_at, "Asia/Bangkok").startOf("day")
      : dayjs.tz(undefined, "Asia/Bangkok").startOf("month");

    const periodEnd = calcPeriodEnd(periodStart, billingUnit, 1);

    form.setFieldsValue({
      period_start: periodStart,
      period_end: periodEnd,
      billing_unit: billingUnit,
      bill_count: 1,
      rent_amount: selectedRoom.base_rent ?? undefined,
    });

    setDrawerOpen(true);

    setReadingsLoading(true);
    const readings = await fetchLatestReadings(selectedRoom.id);
    setReadingsLoading(false);
    form.setFieldsValue({
      water_prev_reading: readings.water ?? undefined,
      electricity_prev_reading: readings.electricity ?? undefined,
    });
    recalcTotals(form.getFieldsValue());
  }

  // ── Save bill(s) ──────────────────────────────────────────────
  async function handleSave() {
    let values: Record<string, unknown>;
    try { values = await form.validateFields(); } catch { return; }
    if (!selectedRoom) return;

    const wPrev = values.water_prev_reading as number | null;
    const wCurr = values.water_curr_reading as number | null;
    const ePrev = values.electricity_prev_reading as number | null;
    const eCurr = values.electricity_curr_reading as number | null;
    if (wPrev != null && wCurr != null && wCurr < wPrev) {
      message.error(t("bills.negativeUsageError")); return;
    }
    if (ePrev != null && eCurr != null && eCurr < ePrev) {
      message.error(t("bills.negativeUsageError")); return;
    }

    const billingUnit = values.billing_unit as BillInput["billing_unit"];
    const billCount   = Math.max(1, Math.round(Number(values.bill_count ?? 1)));
    const rent        = Number(values.rent_amount ?? 0);
    const otherFees   = (values.other_fees as OtherFee[] | undefined)?.filter((f) => f?.label && f?.amount) ?? [];
    const wPrice      = (values.water_unit_price as number | null) ?? null;
    const ePrice      = (values.electricity_unit_price as number | null) ?? null;

    setSaving(true);
    const tokens: string[] = [];
    let curStart = values.period_start as Dayjs;

    for (let i = 0; i < billCount; i++) {
      const curEnd = calcPeriodEnd(curStart, billingUnit, 1);
      const input: BillInput = {
        room_id: selectedRoom.id,
        period_start: curStart.toISOString(),
        period_end: curEnd.toISOString(),
        due_at: curEnd.toISOString(),
        billing_unit: billingUnit,
        billing_quantity: 1,
        rent_amount: rent,
        // Only first bill has meter readings
        water_prev_reading: i === 0 ? (wPrev ?? null) : null,
        water_curr_reading: i === 0 ? (wCurr ?? null) : null,
        water_unit_price: wPrice,
        electricity_prev_reading: i === 0 ? (ePrev ?? null) : null,
        electricity_curr_reading: i === 0 ? (eCurr ?? null) : null,
        electricity_unit_price: ePrice,
        other_fees: otherFees,
      };
      const { shareToken: token, error: err } = await createBill(input);
      if (err) { message.error(err); setSaving(false); return; }
      if (token) tokens.push(token);
      curStart = nextPeriodStart(curEnd, billingUnit);
    }

    setSaving(false);
    message.success(billCount > 1 ? t("bills.createdBatch", { count: billCount }) : t("bills.created"));
    setDrawerOpen(false);
    if (tokens.length > 0) setShareTokens(tokens);
  }

  const billingUnitOptions = [
    { value: "month", label: t("bills.unitMonth") },
    { value: "day",   label: t("bills.unitDay") },
    { value: "hour",  label: t("bills.unitHour") },
    { value: "stall", label: t("bills.unitStall") },
  ];

  // ── Table columns ─────────────────────────────────────────────
  const columns = [
    {
      title: t("bills.colPeriod"),
      dataIndex: "period_start",
      key: "period",
      render: (v: string, r: { period_end: string }) => (
        <span style={{ fontSize: 13 }}>{fmtDate(v)} – {fmtDate(r.period_end)}</span>
      ),
    },
    {
      title: t("bills.colTotal"),
      dataIndex: "total_amount",
      key: "total",
      render: (v: number) => (
        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>฿ {fmt(v)}</span>
      ),
    },
    {
      title: t("bills.colDue"),
      dataIndex: "due_at",
      key: "due",
      render: (v: string) => <span style={{ fontSize: 13, color: "#6B7280" }}>{fmtDate(v)}</span>,
    },
    {
      title: t("bills.colStatus"),
      dataIndex: "status",
      key: "status",
      render: (v: BillStatus) => {
        const cfg = STATUS_CONFIG[v];
        return (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: cfg.bg, color: cfg.color }}>
            {t(cfg.labelKey)}
          </span>
        );
      },
    },
    {
      title: t("bills.colActions"),
      key: "actions",
      render: (_: unknown, r: { id: string; status: BillStatus }) => (
        <div style={{ display: "flex", gap: 6 }}>
          {r.status !== "paid" ? (
            <Button size="small" style={{ borderRadius: 6, fontSize: 12 }}
              onClick={async () => {
                const err = await updateBillStatus(r.id, "paid");
                if (err) message.error(err);
                else message.success(t("bills.statusPaid"));
              }}
            >
              {t("bills.markPaid")}
            </Button>
          ) : (
            <Button size="small" style={{ borderRadius: 6, fontSize: 12 }}
              onClick={async () => {
                const err = await updateBillStatus(r.id, "pending");
                if (err) message.error(err);
                else message.success(t("bills.statusPending"));
              }}
            >
              {t("bills.markPending")}
            </Button>
          )}
          <Button size="small" danger style={{ borderRadius: 6, fontSize: 12 }}
            onClick={() => {
              Modal.confirm({
                title: t("bills.deleteConfirm"),
                okText: t("common.delete"),
                okButtonProps: { danger: true },
                cancelText: t("common.cancel"),
                onOk: async () => {
                  const err = await deleteBill(r.id);
                  if (err) message.error(err);
                  else message.success(t("bills.deleted"));
                },
              });
            }}
          >
            {t("common.delete")}
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header + breadcrumb ──────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {view === "bills" && (
            <button
              onClick={backToRooms}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer",
                fontSize: 14, color: "#6B7280", padding: "4px 0",
              }}
            >
              <ChevronLeftIcon />
              {selectedProperty?.label ?? t("bills.selectProperty")}
            </button>
          )}
          {view === "bills" && (
            <span style={{ fontSize: 14, color: "#D1D5DB" }}>/</span>
          )}
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111827" }}>
            {view === "bills" && selectedRoom
              ? selectedRoom.label
              : t("nav.bills")}
          </h2>
        </div>
        {view === "bills" && (
          <Button
            type="primary"
            onClick={openCreate}
            style={{ borderRadius: 8, fontWeight: 600, height: 36 }}
          >
            + {t("bills.add")}
          </Button>
        )}
      </div>

      {/* ── Property selector ────────────────────────────────── */}
      <div style={{
        background: "#FFFFFF", borderRadius: 12, padding: "14px 20px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#374151", whiteSpace: "nowrap" }}>
          {t("bills.selectProperty")}
        </span>
        {propsLoading ? <Spin size="small" /> : (
          <Select
            style={{ minWidth: 220 }}
            placeholder={t("bills.selectPropertyPlaceholder")}
            value={selectedPropertyId}
            onChange={(v) => {
              setSelectedPropertyId(v);
              setSelectedRoom(null);
              setView("rooms");
            }}
            options={properties.map((p) => ({
              value: p.id,
              label: p.label + (p.province ? ` · ${p.province}` : ""),
            }))}
          />
        )}
        {!selectedPropertyId && !propsLoading && (
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>
            {properties.length === 0 ? t("rooms.noProperties") : t("bills.selectPropertyPlaceholder")}
          </span>
        )}
      </div>

      {/* ── No property selected ─────────────────────────────── */}
      {!selectedPropertyId && (
        <EmptyState icon={<ReceiptIcon />} title={t("bills.selectFirst")} desc={t("bills.selectFirstDesc")} />
      )}

      {/* ── Room card list ───────────────────────────────────── */}
      {selectedPropertyId && view === "rooms" && (
        <>
          {roomsLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spin /></div>
          ) : rooms.length === 0 ? (
            <EmptyState icon={<ReceiptIcon />} title={t("rooms.emptyTitle", { property: selectedProperty?.label })} desc={t("rooms.emptyDesc")} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
              {rooms.map((room) => {
                const oc = ROOM_OCCUPANCY_CONFIG[room.occupancy_status];
                const expStatus = getExpiryStatus(room.expires_at);
                const expColor = expStatus === "expired" ? "#DC2626" : expStatus === "warning" ? "#D97706" : "#6B7280";
                return (
                  <button
                    key={room.id}
                    onClick={() => enterRoom(room)}
                    style={{
                      background: "#FFFFFF", borderRadius: 12, padding: "16px 18px",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      borderLeft: `3px solid ${oc.dotColor}`,
                      border: "none", cursor: "pointer", textAlign: "left",
                      display: "flex", flexDirection: "column", gap: 10,
                      transition: "box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(30,64,255,0.12)")}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)")}
                  >
                    {/* Room header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{room.label}</div>
                        {room.floor && (
                          <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("rooms.floorLabel")} {room.floor}</div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: oc.bg, color: oc.color, whiteSpace: "nowrap" }}>
                        {t(`rooms.status_${room.occupancy_status}`)}
                      </span>
                    </div>
                    {/* Room details */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {room.base_rent != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#6B7280" }}>{t("rooms.baseRent")}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>฿ {Number(room.base_rent).toLocaleString("th-TH")}</span>
                        </div>
                      )}
                      {room.rental_type && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#6B7280" }}>{t("rooms.rentalType")}</span>
                          <span style={{ fontSize: 12, color: "#374151" }}>{t(`rooms.type_${room.rental_type}`)}</span>
                        </div>
                      )}
                      {room.expires_at && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#6B7280" }}>{t("rooms.fieldExpiresAt")}</span>
                          <span style={{ fontSize: 12, color: expColor, fontWeight: expStatus !== "normal" ? 600 : 400 }}>
                            {formatBKK(room.expires_at)}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Enter hint */}
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 12, color: "#1E40FF", fontWeight: 500 }}>{t("bills.viewBills")}</span>
                      <ChevronRightIcon />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Bill list ─────────────────────────────────────────── */}
      {selectedPropertyId && view === "bills" && selectedRoom && (
        <>
          {/* Room info bar */}
          <div style={{
            background: "#FFFFFF", borderRadius: 12, padding: "12px 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: ROOM_OCCUPANCY_CONFIG[selectedRoom.occupancy_status].dotColor }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{selectedRoom.label}</span>
              {selectedRoom.floor && <span style={{ fontSize: 12, color: "#9CA3AF" }}>· {t("rooms.floorLabel")} {selectedRoom.floor}</span>}
            </div>
            {selectedRoom.rental_type && (
              <span style={{ fontSize: 12, color: "#6B7280" }}>{t(`rooms.type_${selectedRoom.rental_type}`)}</span>
            )}
            {selectedRoom.base_rent != null && (
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>฿ {Number(selectedRoom.base_rent).toLocaleString("th-TH")}</span>
            )}
          </div>

          {/* Bills table */}
          <div style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {billsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spin /></div>
            ) : bills.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div style={{ width: 48, height: 48, background: "#EFF6FF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <ReceiptIcon />
                </div>
                <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#111827" }}>{t("bills.emptyTitle")}</p>
                <p style={{ margin: "0 0 16px", fontSize: 14, color: "#9CA3AF" }}>{t("bills.emptyDesc")}</p>
                <Button type="primary" onClick={openCreate} style={{ borderRadius: 8 }}>+ {t("bills.add")}</Button>
              </div>
            ) : (
              <Table
                dataSource={bills}
                columns={columns}
                rowKey="id"
                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                style={{ padding: "0 4px" }}
              />
            )}
          </div>
        </>
      )}

      {/* ── Create Bill Drawer ────────────────────────────────── */}
      <Drawer
        title={`${t("bills.createTitle")} · ${selectedRoom?.label ?? ""}`}
        placement="right"
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
              {t("bills.totalAmount")}: <span style={{ color: "#1E40FF" }}>฿ {fmt(totalAmount)}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={() => setDrawerOpen(false)}>{t("common.cancel")}</Button>
              <Button type="primary" loading={saving} onClick={handleSave} style={{ fontWeight: 600 }}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false} onValuesChange={handlePeriodFieldChange}>

          {/* ── Billing period ──────────────────────────────── */}
          <SectionLabel label={t("bills.sectionPeriod")} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="billing_unit" label={t("bills.fieldBillingUnit")}>
              <Select size="large" style={{ borderRadius: 8 }} options={billingUnitOptions} />
            </Form.Item>
            <Form.Item name="bill_count" label={t("bills.fieldBillCount")}>
              <InputNumber size="large" min={1} max={24} step={1} precision={0} style={{ width: "100%", borderRadius: 8 }} />
            </Form.Item>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="period_start" label={t("bills.fieldPeriodStart")} rules={[{ required: true }]}>
              <DatePicker size="large" style={{ width: "100%", borderRadius: 8 }} format="DD/MM/YY" />
            </Form.Item>
            <Form.Item name="period_end" label={t("bills.fieldPeriodEnd")} rules={[{ required: true }]}>
              <DatePicker size="large" style={{ width: "100%", borderRadius: 8 }} format="DD/MM/YY" />
            </Form.Item>
          </div>

          {/* Due date + batch preview (read-only) */}
          <Form.Item
            shouldUpdate={(prev, cur) =>
              prev.period_start !== cur.period_start ||
              prev.period_end !== cur.period_end ||
              prev.billing_unit !== cur.billing_unit ||
              prev.bill_count !== cur.bill_count
            }
            noStyle
          >
            {() => {
              const start = form.getFieldValue("period_start") as Dayjs | undefined;
              const end   = form.getFieldValue("period_end") as Dayjs | undefined;
              const unit  = form.getFieldValue("billing_unit") as string | undefined;
              const count = Math.max(1, Number(form.getFieldValue("bill_count") ?? 1));
              // last bill's end date
              let lastEnd = end;
              if (start?.isValid() && unit && count > 1) {
                let s = nextPeriodStart(end ?? start, unit);
                for (let i = 1; i < count; i++) {
                  lastEnd = calcPeriodEnd(s, unit, 1);
                  if (i < count - 1) s = nextPeriodStart(lastEnd, unit);
                }
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8,
                    padding: "8px 12px", fontSize: 13,
                  }}>
                    <span style={{ color: "#6B7280" }}>{t("bills.fieldDueAt")}</span>
                    <span style={{ fontWeight: 600, color: "#374151" }}>
                      {end?.isValid() ? end.format("DD/MM/YY") : "—"}
                    </span>
                  </div>
                  {count > 1 && start?.isValid() && lastEnd?.isValid() && (
                    <div style={{
                      background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8,
                      padding: "8px 12px", fontSize: 12, color: "#1E40FF", fontWeight: 500,
                    }}>
                      {t("bills.batchPreview", {
                        count,
                        start: start.format("DD/MM/YY"),
                        end: lastEnd.format("DD/MM/YY"),
                      })}
                    </div>
                  )}
                </div>
              );
            }}
          </Form.Item>

          {/* ── Rent ─────────────────────────────────────────── */}
          <SectionLabel label={t("bills.sectionRent")} />

          <Form.Item name="rent_amount" label={t("bills.fieldRentAmount")} rules={[{ required: true }]}>
            <InputNumber size="large" min={0} precision={2} prefix="฿" placeholder="0.00"
              style={{ width: "100%", borderRadius: 8 }} />
          </Form.Item>

          {/* ── Utilities ─────────────────────────────────────── */}
          <SectionLabel label={t("bills.sectionUtility")} />

          <Spin spinning={readingsLoading}>
            {/* Water */}
            <div style={{ background: "#F0F9FF", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0369A1", marginBottom: 10 }}>
                💧 {t("bills.water")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Form.Item name="water_prev_reading" label={t("bills.fieldWaterPrev")} style={{ marginBottom: 0 }}>
                  <InputNumber size="large" min={0} precision={2} placeholder="0.00"
                    suffix="m³" style={{ width: "100%", borderRadius: 8 }} />
                </Form.Item>
                <Form.Item name="water_curr_reading" label={t("bills.fieldWaterCurr")} style={{ marginBottom: 0 }}>
                  <InputNumber size="large" min={0} precision={2} placeholder="0.00"
                    suffix="m³" style={{ width: "100%", borderRadius: 8 }} />
                </Form.Item>
                <Form.Item name="water_unit_price" label={t("bills.fieldWaterPrice")} style={{ marginBottom: 0 }}>
                  <InputNumber size="large" min={0} precision={2} prefix="฿" placeholder="0.00"
                    style={{ width: "100%", borderRadius: 8 }} />
                </Form.Item>
              </div>
              {waterUsage != null && (
                <CalcRow
                  label={t("bills.fieldWaterUsage")}
                  value={t("bills.usageCalc", {
                    usage: waterUsage.toFixed(2),
                    price: (form.getFieldValue("water_unit_price") ?? 0).toFixed(2),
                    amount: fmt(waterAmount),
                  })}
                />
              )}
            </div>

            {/* Electricity */}
            <div style={{ background: "#FFFBEB", borderRadius: 10, padding: "14px 16px", marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#D97706", marginBottom: 10 }}>
                ⚡ {t("bills.electricity")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Form.Item name="electricity_prev_reading" label={t("bills.fieldElecPrev")} style={{ marginBottom: 0 }}>
                  <InputNumber size="large" min={0} precision={2} placeholder="0.00"
                    suffix="kWh" style={{ width: "100%", borderRadius: 8 }} />
                </Form.Item>
                <Form.Item name="electricity_curr_reading" label={t("bills.fieldElecCurr")} style={{ marginBottom: 0 }}>
                  <InputNumber size="large" min={0} precision={2} placeholder="0.00"
                    suffix="kWh" style={{ width: "100%", borderRadius: 8 }} />
                </Form.Item>
                <Form.Item name="electricity_unit_price" label={t("bills.fieldElecPrice")} style={{ marginBottom: 0 }}>
                  <InputNumber size="large" min={0} precision={2} prefix="฿" placeholder="0.00"
                    style={{ width: "100%", borderRadius: 8 }} />
                </Form.Item>
              </div>
              {elecUsage != null && (
                <CalcRow
                  label={t("bills.fieldElecUsage")}
                  value={t("bills.usageCalc", {
                    usage: elecUsage.toFixed(2),
                    price: (form.getFieldValue("electricity_unit_price") ?? 0).toFixed(2),
                    amount: fmt(elecAmount),
                  })}
                />
              )}
            </div>
          </Spin>

          {/* ── Other fees ────────────────────────────────────── */}
          <SectionLabel label={t("bills.sectionOther")} />

          <Form.List name="other_fees">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <div key={key} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end" }}>
                    <Form.Item name={[name, "label"]} label={key === 0 ? t("bills.fieldOtherLabel") : undefined} style={{ flex: 2, marginBottom: 0 }}>
                      <Input placeholder={t("bills.fieldOtherLabel")} size="large" style={{ borderRadius: 8 }} />
                    </Form.Item>
                    <Form.Item name={[name, "amount"]} label={key === 0 ? t("bills.fieldOtherAmount") : undefined} style={{ flex: 1, marginBottom: 0 }}>
                      <InputNumber min={0} precision={2} prefix="฿" placeholder="0.00"
                        size="large" style={{ width: "100%", borderRadius: 8 }} />
                    </Form.Item>
                    <Button size="large" danger onClick={() => remove(name)} style={{ borderRadius: 8, flexShrink: 0 }}>
                      {t("bills.removeOtherFee")}
                    </Button>
                  </div>
                ))}
                <Button onClick={() => add({ label: "", amount: 0 })}
                  style={{ borderRadius: 8, width: "100%", marginBottom: 8 }}>
                  {t("bills.addOtherFee")}
                </Button>
                {otherTotal > 0 && (
                  <CalcRow label={t("bills.otherFees")} value={`฿ ${fmt(otherTotal)}`} />
                )}
              </>
            )}
          </Form.List>

          {/* ── Summary ───────────────────────────────────────── */}
          <div style={{
            marginTop: 16, background: "#EFF6FF", borderRadius: 10, padding: "14px 16px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1E40FF" }}>{t("bills.totalAmount")}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#1E40FF" }}>฿ {fmt(totalAmount)}</span>
          </div>
        </Form>
      </Drawer>

      {/* ── Share token modal ─────────────────────────────────── */}
      <Modal
        open={shareTokens.length > 0}
        title={t("bills.shareToken")}
        onCancel={() => setShareTokens([])}
        onOk={() => setShareTokens([])}
        okText="OK"
        cancelButtonProps={{ style: { display: "none" } }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {shareTokens.map((token, idx) => (
            <div key={token} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {shareTokens.length > 1 && (
                <span style={{ fontSize: 12, color: "#6B7280", minWidth: 20 }}>#{idx + 1}</span>
              )}
              <Input readOnly value={`${window.location.origin}/b/${token}`} style={{ borderRadius: 8 }} />
              <Button style={{ borderRadius: 8, flexShrink: 0 }}
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/b/${token}`);
                  message.success(t("bills.shareCopied"));
                }}
              >
                <CopyIcon />
              </Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────
function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 12, padding: 60,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    }}>
      <div style={{ width: 48, height: 48, background: "#EFF6FF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>{title}</p>
      <p style={{ margin: 0, fontSize: 14, color: "#9CA3AF" }}>{desc}</p>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────────
function ReceiptIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E40FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M12 16H8"/></svg>;
}
function CopyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>;
}
function ChevronLeftIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
}
function ChevronRightIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E40FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}
