import { Button, DatePicker, Drawer, Form, Input, InputNumber, Modal, Select, Spin, message } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProperties } from "../hooks/useProperties";
import { type BulkRoomInput, type Room, type RoomInput, useRooms } from "../hooks/useRooms";
import type { MeterReadings } from "../hooks/useRooms";
import {
  HOURLY_MAX, HOURLY_MIN, HOURLY_PRESETS,
  calcExpiresAt, formatBKK, getExpiryStatus,
  type RentalType,
} from "../lib/occupancyUtils";

// ── Occupancy status config ────────────────────────────────────
const OCCUPANCY_CONFIG = {
  occupied: { bg: "#EFF6FF", color: "#1E40FF", dotColor: "#1E40FF" },
  vacant:   { bg: "#FEF3C7", color: "#D97706", dotColor: "#D97706" },
};

// ── Section divider ────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 12px" }}>
      <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
    </div>
  );
}

// ── Meter reading fields (reused in both Drawers) ─────────────
function MeterFields({
  t, editing = false, loading = false,
}: { t: (k: string) => string; editing?: boolean; loading?: boolean }) {
  const hintBg    = editing ? "#FFFBEB" : "#F0F7FF";
  const hintBorder = editing ? "#FDE68A" : "#BFDBFE";
  const hintColor  = editing ? "#B45309" : "#3B82F6";
  const hintKey    = editing ? "rooms.meterHintEdit" : "rooms.meterHint";

  return (
    <>
      <SectionLabel label={t("rooms.sectionMeter")} />
      <div style={{ background: hintBg, border: `1px solid ${hintBorder}`, borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: hintColor }}>
        {t(hintKey)}
      </div>
      <Spin spinning={loading}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Form.Item name="initial_water_reading" label={t("rooms.fieldWater")} style={{ marginBottom: 0 }}>
            <InputNumber
              size="large" min={0} precision={2}
              placeholder="0.00"
              suffix="m³"
              style={{ width: "100%", borderRadius: 8 }}
            />
          </Form.Item>
          <Form.Item name="initial_electricity_reading" label={t("rooms.fieldElectricity")} style={{ marginBottom: 0 }}>
            <InputNumber
              size="large" min={0} precision={2}
              placeholder="0.00"
              suffix="kWh"
              style={{ width: "100%", borderRadius: 8 }}
            />
          </Form.Item>
        </div>
      </Spin>
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function RoomsPage() {
  const { t } = useTranslation();
  const { properties, loading: propertiesLoading } = useProperties();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const { rooms, loading: roomsLoading, createRoom, updateRoom, deleteRoom, bulkCreateRooms, fetchMeterReadings } = useRooms(selectedPropertyId);

  // Single room drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [saving, setSaving] = useState(false);
  const [meterLoading, setMeterLoading] = useState(false);
  type RoomFormValues = RoomInput & { check_in_dayjs?: Dayjs | null };
  const [form] = Form.useForm<RoomFormValues>();

  // Computed expires_at display for the Drawer
  const [expiresAtDisplay, setExpiresAtDisplay] = useState<string>("—");

  // Bulk create drawer
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkForm] = Form.useForm<BulkRoomInput>();

  // Preview labels for bulk
  const [bulkPreview, setBulkPreview] = useState<string[]>([]);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  const rentalTypeOptions = [
    { value: "monthly", label: t("rooms.typeMonthly") },
    { value: "daily",   label: t("rooms.typeDaily") },
    { value: "hourly",  label: t("rooms.typeHourly") },
    { value: "stall",   label: t("rooms.typeStall") },
  ];

  // ── Occupancy time helpers ───────────────────────────────────
  function recalcExpires(checkInDayjs: Dayjs | null, rentalType: string | undefined, hourlyDuration: number | undefined): string | null {
    if (!checkInDayjs || !rentalType) { setExpiresAtDisplay("—"); return null; }
    // DatePicker uses dayjs.tz default (Asia/Bangkok) so valueOf() is correct UTC ms
    const checkInUtc = new Date(checkInDayjs.valueOf());
    const exp = calcExpiresAt(checkInUtc, rentalType as RentalType, hourlyDuration);
    setExpiresAtDisplay(formatBKK(exp));
    return exp.toISOString();
  }

  function handleFormValuesChange() {
    const checkIn = form.getFieldValue("check_in_dayjs") as Dayjs | null;
    const rentalType = form.getFieldValue("rental_type") as string | undefined;
    const hourlyDuration = form.getFieldValue("hourly_duration") as number | undefined;
    const expiresIso = recalcExpires(checkIn, rentalType, hourlyDuration);
    form.setFieldValue("expires_at", expiresIso ?? null);
  }

  // ── Single room ──────────────────────────────────────────────
  function openCreate(template?: Room) {
    setEditing(null);
    form.resetFields();
    setExpiresAtDisplay("—");
    if (template) {
      form.setFieldsValue({
        floor: template.floor ?? "",
        rental_type: template.rental_type ?? undefined,
        occupancy_status: template.occupancy_status,
        base_rent: template.base_rent ?? undefined,
        // meter readings reset to blank — user enters new initial values
      });
    } else {
      form.setFieldValue("occupancy_status", "vacant");
    }
    setDrawerOpen(true);
  }

  async function openEdit(r: Room) {
    setEditing(r);
    setExpiresAtDisplay(r.expires_at ? formatBKK(r.expires_at) : "—");
    // Convert UTC ISO to BKK dayjs for DatePicker display
    let checkInDayjs = null;
    if (r.check_in_at) {
      checkInDayjs = dayjs.tz(r.check_in_at, "Asia/Bangkok");
    }
    form.setFieldsValue({
      label: r.label,
      floor: r.floor ?? "",
      rental_type: r.rental_type ?? undefined,
      occupancy_status: r.occupancy_status,
      base_rent: r.base_rent ?? undefined,
      check_in_dayjs: checkInDayjs,
      expires_at: r.expires_at ?? null,
      hourly_duration: r.hourly_duration ?? undefined,
      initial_water_reading: undefined,
      initial_electricity_reading: undefined,
    });
    setDrawerOpen(true);
    // Load current meter readings asynchronously
    setMeterLoading(true);
    const readings: MeterReadings = await fetchMeterReadings(r.id);
    setMeterLoading(false);
    form.setFieldsValue({
      initial_water_reading: readings.water ?? undefined,
      initial_electricity_reading: readings.electricity ?? undefined,
    });
  }

  async function handleSave() {
    let values: RoomFormValues;
    try { values = await form.validateFields(); } catch { return; }
    // Convert Dayjs (BKK local) to UTC ISO for storage
    if (values.check_in_dayjs) {
      // BKK-timezone dayjs — valueOf() gives correct UTC ms
      values.check_in_at = new Date(values.check_in_dayjs.valueOf()).toISOString();
    } else {
      values.check_in_at = null;
      values.expires_at = null;
    }
    setSaving(true);
    const err = editing
      ? await updateRoom(editing.id, values)
      : await createRoom(values);
    setSaving(false);
    if (err) { message.error(err); return; }
    message.success(editing ? t("rooms.updated") : t("rooms.created"));
    setDrawerOpen(false);
  }

  function handleDelete(r: Room) {
    Modal.confirm({
      title: t("rooms.deleteConfirm", { label: r.label }),
      okText: t("common.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        const err = await deleteRoom(r.id);
        if (err) message.error(err);
        else message.success(t("rooms.deleted"));
      },
    });
  }

  // ── Bulk create ──────────────────────────────────────────────
  function openBulk() {
    bulkForm.resetFields();
    bulkForm.setFieldsValue({ start: 1, count: 10, digits: 2, occupancy_status: "vacant" });
    updateBulkPreview();
    setBulkOpen(true);
  }

  function updateBulkPreview() {
    const vals = bulkForm.getFieldsValue();
    const prefix = vals.prefix ?? "";
    const start = Number(vals.start ?? 1);
    const count = Math.min(Number(vals.count ?? 10), 100);
    const digits = Number(vals.digits ?? 2);
    if (!prefix) { setBulkPreview([]); return; }
    const preview = Array.from({ length: Math.min(count, 5) }, (_, i) =>
      `${prefix}${String(start + i).padStart(digits, "0")}`
    );
    if (count > 5) preview.push("...");
    setBulkPreview(preview);
  }

  async function handleBulkSave() {
    let values: BulkRoomInput;
    try { values = await bulkForm.validateFields(); } catch { return; }
    if (values.count > 100) { message.error(t("rooms.bulkMaxError")); return; }
    setBulkSaving(true);
    const { created, error: err } = await bulkCreateRooms(values);
    setBulkSaving(false);
    if (err) { message.error(err); return; }
    message.success(t("rooms.bulkCreated", { count: created }));
    setBulkOpen(false);
  }

  const occupiedCount = rooms.filter((r) => r.occupancy_status === "occupied").length;
  const vacantCount = rooms.filter((r) => r.occupancy_status === "vacant").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111827" }}>
          {t("nav.rooms")}
        </h2>
        {selectedPropertyId && (
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              onClick={openBulk}
              style={{ borderRadius: 8, height: 36, fontWeight: 500 }}
            >
              <GridIcon /> {t("rooms.bulkAdd")}
            </Button>
            <Button
              type="primary"
              onClick={() => openCreate()}
              style={{ borderRadius: 8, fontWeight: 600, height: 36 }}
            >
              + {t("rooms.add")}
            </Button>
          </div>
        )}
      </div>

      {/* Property selector */}
      <div style={{
        background: "#FFFFFF", borderRadius: 12, padding: "16px 20px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#374151", whiteSpace: "nowrap" }}>
          {t("rooms.selectProperty")}
        </span>
        {propertiesLoading ? (
          <Spin size="small" />
        ) : (
          <Select
            style={{ minWidth: 240 }}
            placeholder={t("rooms.selectPropertyPlaceholder")}
            value={selectedPropertyId}
            onChange={setSelectedPropertyId}
            options={properties.map((p) => ({
              value: p.id,
              label: p.label + (p.province ? ` · ${p.province}` : ""),
            }))}
          />
        )}
        {properties.length === 0 && !propertiesLoading && (
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>{t("rooms.noProperties")}</span>
        )}
      </div>

      {/* Stats bar */}
      {selectedPropertyId && rooms.length > 0 && (
        <div style={{ display: "flex", gap: 12 }}>
          <StatPill color="#1E40FF" bg="#EFF6FF" label={t("rooms.occupied")} value={occupiedCount} />
          <StatPill color="#D97706" bg="#FEF3C7" label={t("rooms.vacant")} value={vacantCount} />
          <StatPill color="#6B7280" bg="#F3F4F6" label={t("rooms.total")} value={rooms.length} />
        </div>
      )}

      {/* No property selected */}
      {!selectedPropertyId && (
        <EmptyState icon={<DoorEmptyIcon />} title={t("rooms.selectFirst")} desc={t("rooms.selectFirstDesc")} />
      )}

      {/* Loading */}
      {selectedPropertyId && roomsLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Spin />
        </div>
      )}

      {/* Empty state */}
      {selectedPropertyId && !roomsLoading && rooms.length === 0 && (
        <EmptyState
          icon={<DoorEmptyIcon />}
          title={t("rooms.emptyTitle", { property: selectedProperty?.label })}
          desc={t("rooms.emptyDesc")}
          action={
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <Button onClick={openBulk} style={{ borderRadius: 8 }}>{t("rooms.bulkAdd")}</Button>
              <Button type="primary" onClick={() => openCreate()} style={{ borderRadius: 8 }}>+ {t("rooms.add")}</Button>
            </div>
          }
        />
      )}

      {/* Room grid */}
      {selectedPropertyId && !roomsLoading && rooms.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {rooms.map((r) => {
            const oc = OCCUPANCY_CONFIG[r.occupancy_status];
            return (
              <div key={r.id} style={{
                background: "#FFFFFF", borderRadius: 12, padding: "18px 20px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                display: "flex", flexDirection: "column", gap: 12,
                borderLeft: `3px solid ${oc.dotColor}`,
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 32, height: 32, background: "#EFF6FF", borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <DoorCardIcon />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{r.label}</div>
                      {r.floor && (
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("rooms.floorLabel")} {r.floor}</div>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                    background: oc.bg, color: oc.color,
                  }}>
                    {t(`rooms.status_${r.occupancy_status}`)}
                  </span>
                </div>

                {/* Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {r.base_rent != null && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>{t("rooms.baseRent")}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                        ฿ {Number(r.base_rent).toLocaleString("th-TH")}
                      </span>
                    </div>
                  )}
                  {r.rental_type && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>{t("rooms.rentalType")}</span>
                      <span style={{ fontSize: 12, color: "#374151" }}>{t(`rooms.type_${r.rental_type}`)}</span>
                    </div>
                  )}
                  {r.check_in_at && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>{t("rooms.fieldCheckIn")}</span>
                      <span style={{ fontSize: 12, color: "#374151" }}>{formatBKK(r.check_in_at)}</span>
                    </div>
                  )}
                  {r.expires_at && (
                    <ExpiresRow label={t("rooms.fieldExpiresAt")} expiresAt={r.expires_at} />
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  {/* Use as template */}
                  <button
                    onClick={() => openCreate(r)}
                    title={t("rooms.useTemplate")}
                    style={{
                      width: 32, height: 32, border: "1px solid #E5E7EB", borderRadius: 8,
                      background: "#FFFFFF", color: "#6B7280", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <CopyIcon />
                  </button>
                  <button
                    onClick={() => openEdit(r)}
                    style={{
                      flex: 1, height: 32, border: "1px solid #E5E7EB", borderRadius: 8,
                      background: "#FFFFFF", color: "#374151", fontSize: 13, fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    style={{
                      width: 32, height: 32, border: "1px solid #FEE2E2", borderRadius: 8,
                      background: "#FFF5F5", color: "#DC2626", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Single Room Drawer ─────────────────────────────────── */}
      <Drawer
        title={
          editing
            ? t("rooms.editTitle")
            : form.getFieldValue("floor") !== undefined && form.getFieldValue("rental_type") !== undefined
              ? `📋 ${t("rooms.createFromTemplate")}`
              : t("rooms.createTitle")
        }
        placement="right"
        width={460}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>{t("common.cancel")}</Button>
            <Button type="primary" loading={saving} onClick={handleSave} style={{ fontWeight: 600 }}>
              {t("common.save")}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false} onValuesChange={handleFormValuesChange}>
          {/* Hidden field for computed values */}
          <Form.Item name="expires_at" hidden><Input /></Form.Item>

          <SectionLabel label={t("rooms.sectionBasic")} />
          <Form.Item
            name="label"
            label={t("rooms.fieldLabel")}
            rules={[{ required: true, message: t("rooms.fieldLabelRequired") }]}
          >
            <Input placeholder={t("rooms.fieldLabelPlaceholder")} size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item name="floor" label={t("rooms.fieldFloor")}>
            <Input placeholder={t("rooms.fieldFloorPlaceholder")} size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item name="occupancy_status" label={t("rooms.fieldOccupancy")} rules={[{ required: true }]}>
            <Select size="large" style={{ borderRadius: 8 }} options={[
              { value: "occupied", label: t("rooms.status_occupied") },
              { value: "vacant",   label: t("rooms.status_vacant") },
            ]} />
          </Form.Item>

          <Form.Item name="rental_type" label={t("rooms.fieldRentalType")}>
            <Select size="large" allowClear placeholder={t("rooms.fieldRentalTypePlaceholder")}
              style={{ borderRadius: 8 }} options={rentalTypeOptions} />
          </Form.Item>

          <Form.Item name="base_rent" label={t("rooms.fieldBaseRent")}>
            <InputNumber size="large" min={0} precision={2} prefix="฿" placeholder="0.00"
              style={{ width: "100%", borderRadius: 8 }} />
          </Form.Item>

          {/* ── Occupancy timing ─────────────────────────────── */}
          <Form.Item noStyle shouldUpdate={(p, c) => p.rental_type !== c.rental_type}>
            {({ getFieldValue }) => {
              const rentalType = getFieldValue("rental_type");
              if (!rentalType) return null;
              const isHourly = rentalType === "hourly";
              return (
                <>
                  <SectionLabel label={t("rooms.sectionOccupancy")} />
                  {/* Check-in: date + time picker */}
                  <Form.Item name="check_in_dayjs" label={`${t("rooms.fieldCheckIn")} (${t("rooms.fieldCheckInOptional")})`}>
                    <DatePicker
                      showTime={{ format: "HH:mm", minuteStep: 30 }}
                      format="DD/MM/YY HH:mm"
                      size="large"
                      style={{ width: "100%", borderRadius: 8 }}
                      placeholder={t("rooms.checkInPlaceholder")}
                    />
                  </Form.Item>

                  {/* Hourly duration — only for hourly type */}
                  {isHourly && (
                    <Form.Item
                      name="hourly_duration"
                      label={t("rooms.fieldHourlyDuration")}
                      rules={[{
                        validator: (_, v) =>
                          !v || (v >= HOURLY_MIN && v <= HOURLY_MAX)
                            ? Promise.resolve()
                            : Promise.reject(t("rooms.hourlyDurationRange")),
                      }]}
                    >
                      <Select
                        size="large"
                        allowClear
                        placeholder={t("rooms.hourlyDurationPlaceholder")}
                        style={{ borderRadius: 8 }}
                        options={HOURLY_PRESETS.map((h) => ({
                          value: h,
                          label: `${h} ${t("rooms.hourlyDurationUnit")}`,
                        }))}
                      />
                    </Form.Item>
                  )}

                  {/* Expires at — read-only computed display */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                      {t("rooms.fieldExpiresAt")}
                    </div>
                    <div style={{
                      height: 40, padding: "0 12px", background: "#F9FAFB",
                      border: "1px solid #E5E7EB", borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span style={{
                        fontSize: 14,
                        color: expiresAtDisplay === "—" ? "#9CA3AF" : "#111827",
                        fontWeight: expiresAtDisplay === "—" ? 400 : 500,
                      }}>
                        {expiresAtDisplay}
                      </span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{t("rooms.expiresAtAuto")}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>{t("rooms.expiresAtHint")}</div>
                  </div>
                </>
              );
            }}
          </Form.Item>

          {/* Meter readings — always shown; editing loads current baseline */}
          <MeterFields t={t} editing={!!editing} loading={meterLoading} />
        </Form>
      </Drawer>

      {/* ── Bulk Create Drawer ─────────────────────────────────── */}
      <Drawer
        title={t("rooms.bulkTitle")}
        placement="right"
        width={500}
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => setBulkOpen(false)}>{t("common.cancel")}</Button>
            <Button type="primary" loading={bulkSaving} onClick={handleBulkSave} style={{ fontWeight: 600 }}>
              {t("rooms.bulkConfirm")}
            </Button>
          </div>
        }
      >
        <Form
          form={bulkForm}
          layout="vertical"
          requiredMark={false}
          onValuesChange={updateBulkPreview}
          initialValues={{ start: 1, count: 10, digits: 2, occupancy_status: "vacant" }}
        >
          <SectionLabel label={t("rooms.sectionNaming")} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px", gap: 12 }}>
            <Form.Item
              name="prefix"
              label={t("rooms.bulkPrefix")}
              rules={[{ required: true, message: t("rooms.bulkPrefixRequired") }]}
              style={{ marginBottom: 0 }}
            >
              <Input placeholder={t("rooms.bulkPrefixPlaceholder")} size="large" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="start" label={t("rooms.bulkStart")} style={{ marginBottom: 0 }}>
              <InputNumber size="large" min={0} style={{ width: "100%", borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="count" label={t("rooms.bulkCount")}
              rules={[{ required: true }, { type: "number", max: 100, message: t("rooms.bulkMaxError") }]}
              style={{ marginBottom: 0 }}
            >
              <InputNumber size="large" min={1} max={100} style={{ width: "100%", borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="digits" label={t("rooms.bulkDigits")} style={{ marginBottom: 0 }}>
              <InputNumber size="large" min={1} max={4} style={{ width: "100%", borderRadius: 8 }} />
            </Form.Item>
          </div>

          {/* Preview */}
          {bulkPreview.length > 0 && (
            <div style={{
              marginTop: 12, marginBottom: 16,
              background: "#F9FAFB", borderRadius: 8, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>{t("rooms.bulkPreview")}:</span>
              {bulkPreview.map((label, i) => (
                <span key={i} style={{
                  fontSize: 12, fontWeight: 600, color: "#1E40FF",
                  background: "#EFF6FF", padding: "2px 8px", borderRadius: 4,
                }}>
                  {label}
                </span>
              ))}
            </div>
          )}

          <SectionLabel label={t("rooms.sectionBasic")} />

          <Form.Item name="floor" label={t("rooms.fieldFloor")}>
            <Input placeholder={t("rooms.bulkFloorPlaceholder")} size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item name="occupancy_status" label={t("rooms.fieldOccupancy")} rules={[{ required: true }]}>
            <Select size="large" style={{ borderRadius: 8 }} options={[
              { value: "occupied", label: t("rooms.status_occupied") },
              { value: "vacant",   label: t("rooms.status_vacant") },
            ]} />
          </Form.Item>

          <Form.Item name="rental_type" label={t("rooms.fieldRentalType")}>
            <Select size="large" allowClear placeholder={t("rooms.fieldRentalTypePlaceholder")}
              style={{ borderRadius: 8 }} options={rentalTypeOptions} />
          </Form.Item>

          <Form.Item name="base_rent" label={t("rooms.fieldBaseRent")}>
            <InputNumber size="large" min={0} precision={2} prefix="฿" placeholder="0.00"
              style={{ width: "100%", borderRadius: 8 }} />
          </Form.Item>

          <MeterFields t={t} />
        </Form>
      </Drawer>
    </div>
  );
}

// ── ExpiresRow: colored expiry display for room cards ─────────
function ExpiresRow({ label, expiresAt }: { label: string; expiresAt: string }) {
  const status = getExpiryStatus(expiresAt);
  const color = status === "expired" ? "#DC2626" : status === "warning" ? "#D97706" : "#374151";
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, color: "#6B7280" }}>{label}</span>
      <span style={{ fontSize: 12, color, fontWeight: status !== "normal" ? 600 : 400 }}>
        {formatBKK(expiresAt)}
      </span>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────
function EmptyState({ icon, title, desc, action }: {
  icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 12, padding: 60,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    }}>
      <div style={{ width: 48, height: 48, background: "#EFF6FF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>{title}</p>
      <p style={{ margin: 0, fontSize: 14, color: "#9CA3AF" }}>{desc}</p>
      {action}
    </div>
  );
}

function StatPill({ color, bg, label, value }: { color: string; bg: string; label: string; value: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: bg, borderRadius: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color, fontWeight: 600 }}>{value}</span>
      <span style={{ fontSize: 12, color }}>{label}</span>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────
function DoorEmptyIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E40FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/></svg>;
}
function DoorCardIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E40FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/></svg>;
}
function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
}
function CopyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>;
}
function GridIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>;
}
