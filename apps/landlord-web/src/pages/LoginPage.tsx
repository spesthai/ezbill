import { Alert, Button, Form, Input } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabaseClient";

const LANGS = [
  { code: "zh", label: "中文" },
  { code: "en", label: "EN" },
  { code: "th", label: "ไทย" },
];

export default function LoginPage() {
  const { session, loading } = useSession();
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  function switchLang(code: string) {
    i18n.changeLanguage(code);
    localStorage.setItem("ezbill_lang", code);
  }

  async function handleSendLink() {
    if (!supabase) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t("login.errorEmpty"));
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: window.location.origin },
      });
      if (authError) throw authError;
      setOtpSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F9FAFB",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
    }}>
      {/* 语言切换 */}
      <div style={{
        position: "fixed",
        top: 16,
        right: 20,
        display: "flex",
        gap: 4,
      }}>
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => switchLang(l.code)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid",
              borderColor: i18n.language === l.code ? "#1E40FF" : "#E5E7EB",
              background: i18n.language === l.code ? "#EFF6FF" : "#FFFFFF",
              color: i18n.language === l.code ? "#1E40FF" : "#6B7280",
              fontSize: 13,
              fontWeight: i18n.language === l.code ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* 登录卡片 */}
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#FFFFFF",
        borderRadius: 12,
        padding: 40,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            background: "#1E40FF",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span style={{ fontSize: 20, fontWeight: 600, color: "#111827" }}>EZBill</span>
        </div>

        {/* 标题 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#111827" }}>
            {t("login.title")}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#6B7280" }}>
            {t("login.subtitle")}
          </p>
        </div>

        {/* 表单 */}
        {otpSent ? (
          <Alert
            type="success"
            showIcon
            message={t("login.successTitle")}
            description={t("login.successDesc")}
          />
        ) : (
          <Form layout="vertical" onFinish={handleSendLink}>
            {error && (
              <Alert
                type="error"
                showIcon
                message={error}
                style={{ marginBottom: 16 }}
              />
            )}
            <Form.Item
              label={<span style={{ fontWeight: 500, color: "#374151" }}>{t("login.emailLabel")}</span>}
              style={{ marginBottom: 16 }}
            >
              <Input
                type="email"
                size="large"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onPressEnter={handleSendLink}
                placeholder={t("login.emailPlaceholder")}
                prefix={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                }
                style={{ borderRadius: 8, height: 44 }}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              block
              size="large"
              style={{
                height: 44,
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                background: "#1E40FF",
              }}
            >
              {submitting ? t("login.sending") : t("login.sendBtn")}
            </Button>
          </Form>
        )}

        {/* Footer */}
        <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>
          {t("login.footer")}
        </p>
      </div>
    </div>
  );
}
