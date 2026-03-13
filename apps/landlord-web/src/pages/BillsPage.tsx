import {
  Button, DatePicker, Drawer, Form, Input, InputNumber,
  Modal, Select, Spin, Table, Tag, message,
} from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type BillInput, type BillStatus, type OtherFee, useBills } from "../hooks/useBills";
import { useProperties } from "../hooks/useProperties";
import { useRooms } from "../hooks/useRooms";
import { formatBKK } from "../lib/occupancyUtils";

// ── Status config ───────────────────────────────────────────────
const STATUS_CONFIG: Record<BillStatus, { color: string; bg: string; labelKey: string }> = {
  pending:  { color: "#D97706", bg: "#FEF3C7", labelKey: "bills.statusPending" },
  paid:     { color: "#059669", bg: "#D1FAE5", labelKey: "bills.statusPaid" },
  overdue:  { color: "#DC2626", bg: "#FEE2E2", labelKey: "bills.statusOverdue" },
};

// ── Section divider (reused pattern) ───────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 12px" }}>
      <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
    </div>
  );
}

// ── Calc display row ────────────────────────────────────────────
function CalcRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280", marginTop: 4 }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600, color: "#111827" }}>{value}</span>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dayjs.tz(iso, "Asia/Bangkok").format("DD/MM/YY");
}

// ── Main Page ───────────────────────────────────────────────────
export default function BillsPage() {
  const { t } = useTranslation();
  const { properties, loading: propsLoading } = useProperties();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const { rooms, loading: roomsLoading } = useRooms(selectedPropertyId);
  const { bills, loading: billsLoading, createBill, updateBillStatus, deleteBill, fetchLatestReadings } = useBills(selectedRoomId);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // Drawer state
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

  // Share token modal
  const [shareToken, setShareToken] = useState<string | null>(null);

  // ── Recalculate totals from form values ───────────────────────
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

  // ── Open create drawer ────────────────────────────────────────
  async function openCreate() {
    if (!selectedRoomId || !selectedRoom) return;
    form.resetFields();
    setWaterUsage(null); setWaterAmount(null);
    setElecUsage(null); setElecAmount(null);
    setOtherTotal(0); setTotalAmount(0);

    // Default: period = current month, due = last day of month
    const now = dayjs.tz(undefined, "Asia/Bangkok");
    const periodStart = now.startOf("month");
    const periodEnd = now.endOf("month").startOf("day");
    const dueAt = periodEnd;

    // Billing unit from room rental type
    const unitMap: Record<string, string> = {
      monthly: "month", daily: "day", hourly: "hour", stall: "stall",
    };
    const billingUnit = selectedRoom.rental_type ? (unitMap[selectedRoom.rental_type] ?? "month") : "month";

    form.setFieldsValue({
      period_start: periodStart,
      period_end: periodEnd,
      due_at: dueAt,
      billing_unit: billingUnit,
      billing_quantity: 1,
      rent_amount: selectedRoom.base_rent ?? undefined,
    });

    setDrawerOpen(true);

    // Load latest readings
    setReadingsLoading(true);
    const readings = await fetchLatestReadings(selectedRoomId);
    setReadingsLoading(false);
    form.setFieldsValue({
      water_prev_reading: readings.water ?? undefined,
      electricity_prev_reading: readings.electricity ?? undefined,
    });
    recalcTotals(form.getFieldsValue());
  }

  // ── Save bill ────────────────────────────────────────────────
  async function handleSave() {
    let values: Record<string, unknown>;
    try { values = await form.validateFields(); } catch { return; }
    if (!selectedRoomId) return;

    // Validate: curr >= prev
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

    const input: BillInput = {
      room_id: selectedRoomId,
      period_start: (values.period_start as Dayjs).toISOString(),
      period_end: (values.period_end as Dayjs).toISOString(),
      due_at: (values.due_at as Dayjs).toISOString(),
      billing_unit: values.billing_unit as BillInput["billing_unit"],
      billing_quantity: Number(values.billing_quantity ?? 1),
      rent_amount: Number(values.rent_amount ?? 0),
      water_prev_reading: wPrev ?? null,
      water_curr_reading: wCurr ?? null,
      water_unit_price: (values.water_unit_price as number | null) ?? null,
      electricity_prev_reading: ePrev ?? null,
      electricity_curr_reading: eCurr ?? null,
      electricity_unit_price: (values.electricity_unit_price as number | null) ?? null,
      other_fees: (values.other_fees as OtherFee[] | undefined)?.filter((f) => f?.label && f?.amount) ?? [],
    };

    setSaving(true);
    const { shareToken: token, error: err } = await createBill(input);
    setSaving(false);
    if (err) { message.error(err); return; }
    message.success(t("bills.created"));
    setDrawerOpen(false);
    if (token) setShareToken(token);
  }

  // ── Table columns ─────────────────────────────────────────────
  const columns = [
    {
      title: t("bills.colPeriod"),
      dataIndex: "period_start",
      key: "period",
      render: (v: string, r: { period_end: string }) => (
        <span style={{ fontSize: 13 }}>
          {fmtDate(v)} – {fmtDate(r.period_end)}
        </span>
      ),
    },
    {
      title: t("bills.colTotal"),
      dataIndex: "total_amount",
      key: "total",
      render: (v: number) => (
        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
          ฿ {fmt(v)}
        </span>
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
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
            background: cfg.bg, color: cfg.color,
          }}>
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
          {r.status !== "paid" && (
            <Button
              size="small"
              style={{ borderRadius: 6, fontSize: 12 }}
              onClick={async () => {
                const err = await updateBillStatus(r.id, "paid");
                if (err) message.error(err);
                else message.success(t("bills.statusPaid"));
              }}
            >
              {t("bills.markPaid")}
            </Button>
          )}
          {r.status === "paid" && (
            <Button
              size="small"
              style={{ borderRadius: 6, fontSize: 12 }}
              onClick={async () => {
                const err = await updateBillStatus(r.id, "pending");
                if (err) message.error(err);
                else message.success(t("bills.statusPending"));
              }}
            >
              {t("bills.markPending")}
            </Button>
          )}
          <Button
            size="small"
            danger
            style={{ borderRadius: 6, fontSize: 12 }}
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

  const billingUnitOptions = [
    { value: "month", label: t("bills.unitMonth") },
    { value: "day",   label: t("bills.unitDay") },
    { value: "hour",  label: t("bills.unitHour") },
    { value: "stall", label: t("bills.unitStall") },
  ];

  const isReady = !!selectedPropertyId && !!selectedRoomId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111827" }}>
          {t("nav.bills")}
        </h2>
        {isReady && (
          <Button
            type="primary"
            onClick={openCreate}
            style={{ borderRadius: 8, fontWeight: 600, height: 36 }}
          >
            + {t("bills.add")}
          </Button>
        )}
      </div>

      {/* Property + Room selectors */}
      <div style={{
        background: "#FFFFFF", borderRadius: 12, padding: "16px 20px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#374151", whiteSpace: "nowrap" }}>
            {t("bills.selectProperty")}
          </span>
          {propsLoading ? <Spin size="small" /> : (
            <Select
              style={{ minWidth: 200 }}
              placeholder={t("bills.selectPropertyPlaceholder")}
              value={selectedPropertyId}
              onChange={(v) => { setSelectedPropertyId(v); setSelectedRoomId(null); }}
              options={properties.map((p) => ({
                value: p.id,
                label: p.label + (p.province ? ` · ${p.province}` : ""),
              }))}
            />
          )}
        </div>
        {selectedPropertyId && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#374151", whiteSpace: "nowrap" }}>
              {t("bills.selectRoom")}
            </span>
            {roomsLoading ? <Spin size="small" /> : (
              <Select
                style={{ minWidth: 160 }}
                placeholder={t("bills.selectRoomPlaceholder")}
                value={selectedRoomId}
                onChange={setSelectedRoomId}
                options={rooms.map((r) => ({
                  value: r.id,
                  label: r.label + (r.floor ? ` (${r.floor}F)` : ""),
                }))}
              />
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!isReady && (
        <div style={{
          background: "#FFFFFF", borderRadius: 12, padding: 60,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center",
        }}>
          <div style={{ width: 48, height: 48, background: "#EFF6FF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <ReceiptIcon />
          </div>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#111827" }}>{t("bills.selectFirst")}</p>
          <p style={{ margin: 0, fontSize: 14, color: "#9CA3AF" }}>{t("bills.selectFirstDesc")}</p>
        </div>
      )}

      {/* Bills table */}
      {isReady && (
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
      )}

      {/* ── Create Bill Drawer ──────────────────────────────────── */}
      <Drawer
        title={t("bills.createTitle")}
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
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onValuesChange={(_, all) => recalcTotals(all)}
        >
          {/* ── Billing period ─────────────────────────────────── */}
          <SectionLabel label={t("bills.sectionPeriod")} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="period_start" label={t("bills.fieldPeriodStart")} rules={[{ required: true }]}>
              <DatePicker size="large" style={{ width: "100%", borderRadius: 8 }} format="DD/MM/YY" />
            </Form.Item>
            <Form.Item name="period_end" label={t("bills.fieldPeriodEnd")} rules={[{ required: true }]}>
              <DatePicker size="large" style={{ width: "100%", borderRadius: 8 }} format="DD/MM/YY" />
            </Form.Item>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Form.Item name="due_at" label={t("bills.fieldDueAt")} rules={[{ required: true }]}>
              <DatePicker size="large" style={{ width: "100%", borderRadius: 8 }} format="DD/MM/YY" />
            </Form.Item>
            <Form.Item name="billing_unit" label={t("bills.fieldBillingUnit")}>
              <Select size="large" style={{ borderRadius: 8 }} options={billingUnitOptions} />
            </Form.Item>
            <Form.Item name="billing_quantity" label={t("bills.fieldBillingQty")}>
              <InputNumber size="large" min={0.5} step={0.5} precision={1} style={{ width: "100%", borderRadius: 8 }} />
            </Form.Item>
          </div>

          {/* ── Rent ───────────────────────────────────────────── */}
          <SectionLabel label={t("bills.sectionRent")} />

          <Form.Item name="rent_amount" label={t("bills.fieldRentAmount")} rules={[{ required: true }]}>
            <InputNumber size="large" min={0} precision={2} prefix="฿" placeholder="0.00"
              style={{ width: "100%", borderRadius: 8 }} />
          </Form.Item>

          {/* ── Utilities ──────────────────────────────────────── */}
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

          {/* ── Other fees ─────────────────────────────────────── */}
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
                    <Button
                      size="large"
                      danger
                      onClick={() => remove(name)}
                      style={{ borderRadius: 8, marginBottom: 0, flexShrink: 0 }}
                    >
                      {t("bills.removeOtherFee")}
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={() => add({ label: "", amount: 0 })}
                  style={{ borderRadius: 8, width: "100%", marginBottom: 8 }}
                >
                  {t("bills.addOtherFee")}
                </Button>
                {otherTotal > 0 && (
                  <CalcRow label={t("bills.otherFees")} value={`฿ ${fmt(otherTotal)}`} />
                )}
              </>
            )}
          </Form.List>

          {/* ── Summary ────────────────────────────────────────── */}
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
        open={!!shareToken}
        title={t("bills.shareToken")}
        onCancel={() => setShareToken(null)}
        onOk={() => setShareToken(null)}
        okText="OK"
        cancelButtonProps={{ style: { display: "none" } }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <Input
            readOnly
            value={shareToken ? `${window.location.origin}/b/${shareToken}` : ""}
            style={{ borderRadius: 8 }}
          />
          <Button
            style={{ borderRadius: 8, flexShrink: 0 }}
            onClick={() => {
              if (shareToken) {
                navigator.clipboard.writeText(`${window.location.origin}/b/${shareToken}`);
                message.success(t("bills.shareCopied"));
              }
            }}
          >
            <CopyIcon />
          </Button>
        </div>
      </Modal>
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
