import { Alert, Button, Layout, Space, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { ENV } from "./lib/env";
import { supabase } from "./lib/supabaseClient";

const { Header, Content, Footer } = Layout;

export default function App() {
  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const supabaseConfigured = useMemo(() => {
    try {
      return Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY);
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        const email = data.session?.user?.email ?? "";
        if (!cancelled) setSessionEmail(email);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    const subscription = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return;
          setSessionEmail(session?.user?.email ?? "");
        }).data.subscription
      : null;

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ display: "flex", alignItems: "center" }}>
        <Typography.Title level={4} style={{ margin: 0, color: "#fff" }}>
          EZBill Landlord
        </Typography.Title>
      </Header>
      <Content style={{ padding: 24, maxWidth: 1100, width: "100%", margin: "0 auto" }}>
        <Typography.Title level={2} style={{ marginTop: 8 }}>
          Dashboard (MVP)
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          React + TypeScript + Vite + Ant Design. PWA is enabled (offline cache for static assets).
        </Typography.Paragraph>

        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {!supabaseConfigured ? (
            <Alert
              type="warning"
              showIcon
              message="Supabase is not configured"
              description="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example) to connect this app to your Supabase project."
            />
          ) : (
            <Alert
              type="success"
              showIcon
              message="Supabase env vars are configured"
              description={
                sessionEmail
                  ? `Signed in as: ${sessionEmail}`
                  : "No active session yet. Use the login form below."
              }
            />
          )}

          {error ? <Alert type="error" showIcon message="Supabase error" description={error} /> : null}

          {supabaseConfigured && !sessionEmail ? (
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <Typography.Title level={4} style={{ marginBottom: 0 }}>
                Login (Magic Link)
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                Enter your email and we will send you a login link. Make sure Supabase Auth Redirect URLs include{" "}
                <Typography.Text code>{window.location.origin}</Typography.Text>.
              </Typography.Paragraph>
              <Space.Compact style={{ width: "100%" }}>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: "1px solid #d9d9d9",
                    borderRadius: 6
                  }}
                />
                <Button
                  type="primary"
                  loading={loading}
                  onClick={async () => {
                    setError("");
                    if (!supabase) return;
                    const trimmed = email.trim();
                    if (!trimmed) {
                      setError("Please enter an email.");
                      return;
                    }
                    setLoading(true);
                    try {
                      const { error } = await supabase.auth.signInWithOtp({
                        email: trimmed,
                        options: { emailRedirectTo: window.location.origin }
                      });
                      if (error) throw error;
                      setOtpSent(true);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Send link
                </Button>
              </Space.Compact>
              {otpSent ? (
                <Alert
                  type="info"
                  showIcon
                  message="Check your email"
                  description="Open the magic link to complete sign-in. After redirect back, the session should appear here."
                />
              ) : null}
            </Space>
          ) : null}

          <Space>
            <Button
              onClick={async () => {
                setError("");
                if (!supabase) return;
                const { error: signOutError } = await supabase.auth.signOut();
                if (signOutError) setError(signOutError.message);
                setSessionEmail("");
                setOtpSent(false);
              }}
            >
              Sign out (if any)
            </Button>
          </Space>
        </Space>
      </Content>
      <Footer style={{ textAlign: "center" }}>
        <Typography.Text type="secondary">EZBill</Typography.Text>
      </Footer>
    </Layout>
  );
}
