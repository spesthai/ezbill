import { Button, Drawer, Form, Input, InputNumber, Modal, Select, Spin, message } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProperties } from "../hooks/useProperties";
import { type Room, type RoomInput, useRooms } from "../hooks/useRooms";

// ── Occupancy status config ────────────────────────────────────
const OCCUPANCY_CONFIG = {
  occupied: { bg: "#D1FAE5", color: "#059669", dotColor: "#059669" },
  vacant:   { bg: "#FEF3C7", color: "#D97706", dotColor: "#D97706" },
};

export default function RoomsPage() {
  const { t } = useTranslation();
  const { properties, loading: propertiesLoading } = useProperties();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const { rooms, loading: roomsLoading, createRoom, updateRoom, deleteRoom } = useRooms(selectedPropertyId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<RoomInput>();

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldValue("occupancy_status", "vacant");
    setDrawerOpen(true);
  }

  function openEdit(r: Room) {
    setEditing(r);
    form.setFieldsValue({
      label: r.label,
      floor: r.floor ?? "",
      rental_type: r.rental_type ?? undefined,
      occupancy_status: r.occupancy_status,
      base_rent: r.base_rent ?? undefined,
    });
    setDrawerOpen(true);
  }

  async function handleSave() {
    let values: RoomInput;
    try { values = await form.validateFields(); } catch { return; }
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

  const rentalTypeOptions = [
    { value: "monthly", label: t("rooms.typeMonthly") },
    { value: "daily",   label: t("rooms.typeDaily") },
    { value: "hourly",  label: t("rooms.typeHourly") },
    { value: "stall",   label: t("rooms.typeStall") },
  ];

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
          <Button
            type="primary"
            onClick={openCreate}
            style={{ borderRadius: 8, fontWeight: 600, height: 36 }}
          >
            + {t("rooms.add")}
          </Button>
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

      {/* Stats bar — only when a property is selected and has rooms */}
      {selectedPropertyId && rooms.length > 0 && (
        <div style={{ display: "flex", gap: 12 }}>
          <StatPill color="#059669" bg="#D1FAE5" label={t("rooms.occupied")} value={occupiedCount} />
          <StatPill color="#D97706" bg="#FEF3C7" label={t("rooms.vacant")} value={vacantCount} />
          <StatPill color="#6B7280" bg="#F3F4F6" label={t("rooms.total")} value={rooms.length} />
        </div>
      )}

      {/* No property selected */}
      {!selectedPropertyId && (
        <div style={{
          background: "#FFFFFF", borderRadius: 12, padding: 60,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 48, height: 48, background: "#EFF6FF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DoorEmptyIcon />
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>{t("rooms.selectFirst")}</p>
          <p style={{ margin: 0, fontSize: 14, color: "#9CA3AF" }}>{t("rooms.selectFirstDesc")}</p>
        </div>
      )}

      {/* Loading */}
      {selectedPropertyId && roomsLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Spin />
        </div>
      )}

      {/* Empty state */}
      {selectedPropertyId && !roomsLoading && rooms.length === 0 && (
        <div style={{
          background: "#FFFFFF", borderRadius: 12, padding: 60,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 48, height: 48, background: "#EFF6FF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DoorEmptyIcon />
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>
            {t("rooms.emptyTitle", { property: selectedProperty?.label })}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#9CA3AF" }}>{t("rooms.emptyDesc")}</p>
          <Button type="primary" onClick={openCreate} style={{ borderRadius: 8, marginTop: 4 }}>
            + {t("rooms.add")}
          </Button>
        </div>
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
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                          {t("rooms.floorLabel")} {r.floor}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Occupancy badge */}
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>{t("rooms.baseRent")}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                        ฿ {Number(r.base_rent).toLocaleString("th-TH")}
                      </span>
                    </div>
                  )}
                  {r.rental_type && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>{t("rooms.rentalType")}</span>
                      <span style={{ fontSize: 12, color: "#374151" }}>
                        {t(`rooms.type_${r.rental_type}`)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
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
                      background: "#FFF5F5", color: "#DC2626", fontSize: 13, cursor: "pointer",
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

      {/* Drawer: Create / Edit */}
      <Drawer
        title={editing ? t("rooms.editTitle") : t("rooms.createTitle")}
        placement="right"
        width={440}
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
        <Form form={form} layout="vertical" requiredMark={false}>
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

          <Form.Item
            name="occupancy_status"
            label={t("rooms.fieldOccupancy")}
            rules={[{ required: true }]}
          >
            <Select
              size="large"
              style={{ borderRadius: 8 }}
              options={[
                { value: "occupied", label: t("rooms.status_occupied") },
                { value: "vacant",   label: t("rooms.status_vacant") },
              ]}
            />
          </Form.Item>

          <Form.Item name="rental_type" label={t("rooms.fieldRentalType")}>
            <Select
              size="large"
              allowClear
              placeholder={t("rooms.fieldRentalTypePlaceholder")}
              style={{ borderRadius: 8 }}
              options={rentalTypeOptions}
            />
          </Form.Item>

          <Form.Item name="base_rent" label={t("rooms.fieldBaseRent")}>
            <InputNumber
              size="large"
              min={0}
              precision={2}
              prefix="฿"
              placeholder="0.00"
              style={{ width: "100%", borderRadius: 8 }}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────
function StatPill({ color, bg, label, value }: { color: string; bg: string; label: string; value: number }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 14px", background: bg, borderRadius: 8,
    }}>
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
