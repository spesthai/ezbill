import { AutoComplete, Button, Drawer, Form, Input, Modal, message } from "antd";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Property, type PropertyInput, useProperties } from "../hooks/useProperties";

// ── Thai address types ──────────────────────────────────────────
interface TambonEntry {
  id: number;
  zip_code: number;
  name_th: string;
  name_en: string;
  amphure_id: number;
}
interface AmphureEntry {
  id: number;
  name_th: string;
  name_en: string;
  tambon: TambonEntry[];
}
interface ProvinceEntry {
  id: number;
  name_th: string;
  name_en: string;
  amphure: AmphureEntry[];
}

interface AddressRecord {
  tambonTh: string;
  tambonEn: string;
  amphoeTh: string;
  amphoeEn: string;
  provinceTh: string;
  provinceEn: string;
  zipCode: number;
}

let addressIndex: AddressRecord[] | null = null;

async function getAddressIndex(): Promise<AddressRecord[]> {
  if (addressIndex) return addressIndex;
  const mod = await import("../../../json/thai_address.json");
  const provinces: ProvinceEntry[] = mod.default as ProvinceEntry[];
  const records: AddressRecord[] = [];
  for (const prov of provinces) {
    for (const amp of prov.amphure) {
      for (const tam of amp.tambon) {
        records.push({
          tambonTh: tam.name_th,
          tambonEn: tam.name_en,
          amphoeTh: amp.name_th,
          amphoeEn: amp.name_en,
          provinceTh: prov.name_th,
          provinceEn: prov.name_en,
          zipCode: tam.zip_code,
        });
      }
    }
  }
  addressIndex = records;
  return records;
}

export default function PropertiesPage() {
  const { t, i18n } = useTranslation();
  const { properties, loading, createProperty, updateProperty, deleteProperty } = useProperties();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<PropertyInput>();

  // AutoComplete state
  const [tambonOptions, setTambonOptions] = useState<{ value: string; label: string; record: AddressRecord }[]>([]);
  const indexRef = useRef<AddressRecord[] | null>(null);

  const loadIndex = useCallback(async () => {
    if (!indexRef.current) {
      indexRef.current = await getAddressIndex();
    }
  }, []);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setDrawerOpen(true);
    loadIndex();
  }

  function openEdit(p: Property) {
    setEditing(p);
    form.setFieldsValue({
      label: p.label,
      province: p.province ?? "",
      amphoe: p.amphoe ?? "",
      tambon: p.tambon ?? "",
      full_address: p.full_address ?? "",
    });
    setDrawerOpen(true);
    loadIndex();
  }

  async function handleSave() {
    let values: PropertyInput;
    try { values = await form.validateFields(); } catch { return; }
    setSaving(true);
    const err = editing
      ? await updateProperty(editing.id, values)
      : await createProperty(values);
    setSaving(false);
    if (err) { message.error(err); return; }
    message.success(editing ? t("properties.updated") : t("properties.created"));
    setDrawerOpen(false);
  }

  function handleDelete(p: Property) {
    Modal.confirm({
      title: t("properties.deleteConfirm", { label: p.label }),
      okText: t("common.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        const err = await deleteProperty(p.id);
        if (err) message.error(err);
        else message.success(t("properties.deleted"));
      },
    });
  }

  const isEn = i18n.language === "en";

  function handleTambonSearch(text: string) {
    if (!indexRef.current || text.length < 1) {
      setTambonOptions([]);
      return;
    }
    const lower = text.toLowerCase();
    const matched = indexRef.current
      .filter((r) =>
        r.tambonTh.includes(text) ||
        r.tambonEn.toLowerCase().includes(lower)
      )
      .slice(0, 20)
      .map((r) => ({
        value: isEn ? r.tambonEn : r.tambonTh,
        label: `${isEn ? r.tambonEn : r.tambonTh} · ${isEn ? r.amphoeEn : r.amphoeTh} · ${isEn ? r.provinceEn : r.provinceTh}`,
        record: r,
      }));
    setTambonOptions(matched);
  }

  function handleTambonSelect(_value: string, option: { record: AddressRecord }) {
    const r = option.record;
    form.setFieldsValue({
      tambon: isEn ? r.tambonEn : r.tambonTh,
      amphoe: isEn ? r.amphoeEn : r.amphoeTh,
      province: isEn ? r.provinceEn : r.provinceTh,
    });
    setTambonOptions([]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111827" }}>
          {t("nav.properties")}
        </h2>
        <Button
          type="primary"
          onClick={openCreate}
          style={{ borderRadius: 8, fontWeight: 600, height: 36 }}
        >
          + {t("properties.add")}
        </Button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 120, background: "#F3F4F6", borderRadius: 12, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && properties.length === 0 && (
        <div style={{
          background: "#FFFFFF", borderRadius: 12, padding: 60,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 48, height: 48, background: "#EFF6FF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BuildingEmptyIcon />
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>{t("properties.emptyTitle")}</p>
          <p style={{ margin: 0, fontSize: 14, color: "#9CA3AF" }}>{t("properties.emptyDesc")}</p>
          <Button type="primary" onClick={openCreate} style={{ borderRadius: 8, marginTop: 4 }}>
            + {t("properties.add")}
          </Button>
        </div>
      )}

      {/* Property cards */}
      {!loading && properties.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {properties.map((p) => (
            <div key={p.id} style={{
              background: "#FFFFFF", borderRadius: 12, padding: "20px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              {/* Card header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, background: "#EFF6FF", borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <BuildingCardIcon />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>{p.label}</span>
                </div>
              </div>

              {/* Address */}
              {(p.province || p.amphoe || p.full_address) && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <LocationIcon />
                  <span style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
                    {p.full_address
                      ? p.full_address
                      : [p.tambon, p.amphoe, p.province].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => openEdit(p)}
                  style={{
                    flex: 1, height: 32, border: "1px solid #E5E7EB", borderRadius: 8,
                    background: "#FFFFFF", color: "#374151", fontSize: 13, fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {t("common.edit")}
                </button>
                <button
                  onClick={() => handleDelete(p)}
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
          ))}
        </div>
      )}

      {/* Drawer: Create / Edit */}
      <Drawer
        title={editing ? t("properties.editTitle") : t("properties.createTitle")}
        placement="right"
        width={480}
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
            label={t("properties.fieldLabel")}
            rules={[{ required: true, message: t("properties.fieldLabelRequired") }]}
          >
            <Input placeholder={t("properties.fieldLabelPlaceholder")} size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          {/* Tambon with autocomplete — selecting auto-fills amphoe + province */}
          <Form.Item name="tambon" label={t("properties.fieldTambon")}>
            <AutoComplete
              options={tambonOptions}
              onSearch={handleTambonSearch}
              onSelect={handleTambonSelect}
              placeholder={t("properties.fieldTambonPlaceholder")}
              size="large"
              style={{ width: "100%", borderRadius: 8 }}
              filterOption={false}
            />
          </Form.Item>

          <Form.Item name="amphoe" label={t("properties.fieldAmphoe")}>
            <Input placeholder={t("properties.fieldAmphoePlaceholder")} size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item name="province" label={t("properties.fieldProvince")}>
            <Input placeholder={t("properties.fieldProvincePlaceholder")} size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item name="full_address" label={t("properties.fieldAddress")}>
            <Input.TextArea
              placeholder={t("properties.fieldAddressPlaceholder")}
              rows={3}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────
function BuildingEmptyIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E40FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>;
}
function BuildingCardIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E40FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>;
}
function LocationIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>;
}
function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
}
