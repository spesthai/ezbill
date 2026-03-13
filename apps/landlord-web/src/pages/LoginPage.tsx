import { Alert, Button, Card, Layout, Space, Typography } from "antd";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabaseClient";

const { Content } = Layout;

export default function LoginPage() {
  const { session, loading } = useSession();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");

  // 已登录 → 跳转 Dashboard
  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function handleSendLink() {
    if (!supabase) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email.");
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
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Content
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card style={{ width: "100%", maxWidth: 420 }}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              EZBill
            </Typography.Title>
            <Typography.Text type="secondary">
              Enter your email to receive a login link.
            </Typography.Text>

            {error && (
              <Alert type="error" showIcon message={error} />
            )}

            {otpSent ? (
              <Alert
                type="success"
                showIcon
                message="Check your email"
                description="Click the magic link to sign in. You can close this tab."
              />
            ) : (
              <Space.Compact style={{ width: "100%" }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendLink()}
                  placeholder="you@example.com"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: "1px solid #d9d9d9",
                    borderRadius: "6px 0 0 6px",
                    outline: "none",
                    fontSize: 14,
                  }}
                />
                <Button
                  type="primary"
                  loading={submitting}
                  onClick={handleSendLink}
                >
                  Send link
                </Button>
              </Space.Compact>
            )}
          </Space>
        </Card>
      </Content>
    </Layout>
  );
}
