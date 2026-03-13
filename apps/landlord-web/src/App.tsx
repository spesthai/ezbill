import { ConfigProvider } from "antd";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1E40FF",
          colorSuccess: "#10B981",
          colorWarning: "#F59E0B",
          colorError: "#EF4444",
          colorTextBase: "#111827",
          colorTextSecondary: "#6B7280",
          colorBgBase: "#FFFFFF",
          colorBgLayout: "#F9FAFB",
          colorBorder: "#E5E7EB",
          borderRadius: 8,
          borderRadiusLG: 12,
          fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
          fontSize: 14,
        },
        components: {
          Button: { borderRadius: 8, controlHeight: 36 },
          Input: { borderRadius: 8, controlHeight: 36 },
          Select: { borderRadius: 8, controlHeight: 36 },
          Card: { borderRadius: 12 },
          Table: { borderRadius: 12 },
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
