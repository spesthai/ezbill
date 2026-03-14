import { Spin } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Route, Routes } from "react-router-dom";
import { useDashboard } from "../hooks/useDashboard";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabaseClient";
import BillsPage from "./BillsPage";
import PropertiesPage from "./PropertiesPage";
import RoomsPage from "./RoomsPage";
import SettingsPage from "./SettingsPage";

const NAV_ITEMS = [
  { key: "dashboard",  icon: DashboardIcon, labelKey: "nav.dashboard",   to: "/" },
  { key: "properties", icon: BuildingIcon,  labelKey: "nav.properties",  to: "/properties" },
  { key: "rooms",      icon: DoorIcon,      labelKey: "nav.rooms",       to: "/rooms" },
  { key: "bills",      icon: FileIcon,      labelKey: "nav.bills",       to: "/bills" },
  { key: "settings",   icon: SettingsIcon,  labelKey: "nav.settings",    to: "/settings" },
];

export default function DashboardPage() {
  const { session } = useSession();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  const email = session?.user?.email ?? "";
  const initial = email.charAt(0).toUpperCase();
  const sideW = collapsed ? 64 : 220;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter','Noto Sans Thai',sans-serif" }}>
      <aside style={{
        width: sideW, minHeight: "100vh", background: "#111827",
        display: "flex", flexDirection: "column",
        padding: collapsed ? "24px 8px" : "24px 16px",
        gap: 8, flexShrink: 0,
        transition: "width 0.2s ease, padding 0.2s ease",
        overflow: "hidden",
      }}>
        {/* Logo + collapse button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", padding: "0 4px", marginBottom: 8 }}>
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, background: "#1E40FF", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ZapIcon />
              </div>
              <span style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 600, whiteSpace: "nowrap" }}>EZBill</span>
            </div>
          )}
          {collapsed && (
            <div style={{ width: 32, height: 32, background: "#1E40FF", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ZapIcon />
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "展开" : "收起"}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center",
              padding: 4, borderRadius: 6, flexShrink: 0,
              marginLeft: collapsed ? 0 : 4,
            }}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        <div style={{ height: 1, background: "#374151", margin: "4px 0" }} />

        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {NAV_ITEMS.map(({ key, icon: Icon, labelKey, to }) => (
            <NavLink key={key} to={to} end={to === "/"} title={collapsed ? t(labelKey) : undefined} style={({ isActive }: { isActive: boolean }) => ({
              display: "flex", alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: 10, padding: collapsed ? "0" : "0 12px", height: 40,
              borderRadius: 8, textDecoration: "none",
              background: isActive ? "#1E40FF" : "transparent",
              color: isActive ? "#FFFFFF" : "#9CA3AF",
              fontWeight: isActive ? 600 : 400, fontSize: 14,
            })}>
              <span style={{ flexShrink: 0 }}><Icon /></span>
              {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{t(labelKey)}</span>}
            </NavLink>
          ))}
        </nav>

        <button onClick={handleSignOut} title={collapsed ? email : undefined} style={{
          display: "flex", alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10, padding: collapsed ? "0" : "0 12px", height: 40,
          borderRadius: 8, background: "transparent", border: "none", cursor: "pointer",
          color: "#9CA3AF", fontSize: 13, width: "100%",
        }}>
          <div style={{ width: 28, height: 28, background: "#1E3A8A", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#93C5FD", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{initial}</div>
          {!collapsed && (
            <>
              <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
              <LogoutIcon />
            </>
          )}
        </button>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 56, background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", padding: "0 24px", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{t("nav.dashboard")}</span>
        </header>
        <main style={{ flex: 1, overflow: "auto", padding: 24, background: "#F9FAFB" }}>
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/bills" element={<BillsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; key: string }> = {
  pending:  { bg: "#FEF3C7", color: "#D97706", key: "dashboard.statusPending" },
  paid:     { bg: "#D1FAE5", color: "#059669", key: "dashboard.statusPaid" },
  overdue:  { bg: "#FEE2E2", color: "#DC2626", key: "dashboard.statusOverdue" },
};

function DashboardHome() {
  const { t } = useTranslation();
  const { stats, recentBills, loading, error } = useDashboard();

  const statCards = [
    { icon: BuildingIcon, labelKey: "dashboard.properties", value: stats?.propertyCount },
    { icon: DoorIcon,     labelKey: "dashboard.rooms",      value: stats?.roomCount },
    { icon: FileIcon,     labelKey: "dashboard.monthBills", value: stats?.monthBillCount },
    {
      icon: BanknoteIcon,
      labelKey: "dashboard.pending",
      value: stats ? `฿ ${stats.pendingAmount.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : undefined,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {statCards.map(({ icon: Icon, labelKey, value }) => (
          <div key={labelKey} style={{
            background: "#FFFFFF", borderRadius: 12, padding: "16px 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon />
              <span style={{ fontSize: 13, color: "#6B7280" }}>{t(labelKey)}</span>
            </div>
            {loading ? (
              <Spin size="small" />
            ) : (
              <span style={{ fontSize: value !== undefined && String(value).length > 6 ? 20 : 28, fontWeight: 600, color: "#111827" }}>
                {value ?? 0}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Recent bills */}
      <div style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "0 20px", height: 52, borderBottom: "1px solid #F3F4F6",
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{t("dashboard.recentBills")}</span>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "12px 20px", color: "#EF4444", fontSize: 13 }}>{error}</div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div style={{ padding: 32, display: "flex", justifyContent: "center" }}>
            <Spin />
          </div>
        )}

        {/* Empty */}
        {!loading && !error && recentBills.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
            {t("dashboard.noBills")}
          </div>
        )}

        {/* Table head */}
        {!loading && recentBills.length > 0 && (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 120px 100px",
              padding: "0 20px", height: 36, background: "#F9FAFB",
              alignItems: "center",
            }}>
              {["dashboard.colRoom", "dashboard.colPeriod", "dashboard.colAmount", "dashboard.colStatus"].map((k) => (
                <span key={k} style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>{t(k)}</span>
              ))}
            </div>

            {recentBills.map((bill, i) => {
              const sc = STATUS_CONFIG[bill.status] ?? STATUS_CONFIG.pending;
              const period = new Date(bill.periodStart).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit" });
              const isLast = i === recentBills.length - 1;
              return (
                <div key={bill.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 120px 100px",
                  padding: "0 20px", height: 48, alignItems: "center",
                  borderBottom: isLast ? "none" : "1px solid #F3F4F6",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{bill.roomLabel}</span>
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>{bill.propertyLabel}</span>
                  </div>
                  <span style={{ fontSize: 14, color: "#6B7280" }}>{period}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                    ฿ {Number(bill.totalAmount).toLocaleString("th-TH")}
                  </span>
                  <span style={{
                    display: "inline-flex", padding: "3px 10px", borderRadius: 6,
                    background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 600, width: "fit-content",
                  }}>
                    {t(sc.key)}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}


function ZapIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
}
function DashboardIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>;
}
function BuildingIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>;
}
function FileIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>;
}
function SettingsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function DoorIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/></svg>;
}
function BanknoteIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>;
}
function LogoutIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}
function ChevronLeftIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function ChevronRightIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
