import { Button, Layout, Space, Typography } from "antd";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";

const { Header, Content, Footer } = Layout;

export default function DashboardPage() {
  const { session } = useSession();

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
        }}
      >
        <Typography.Title level={4} style={{ margin: 0, color: "#fff" }}>
          EZBill Landlord
        </Typography.Title>
        <Space>
          <Typography.Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
            {session?.user?.email}
          </Typography.Text>
          <Button size="small" onClick={handleSignOut}>
            Sign out
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: 24, maxWidth: 1100, width: "100%", margin: "0 auto" }}>
        <Typography.Title level={2} style={{ marginTop: 8 }}>
          Dashboard
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          楼盘、房间、账单管理功能开发中…
        </Typography.Paragraph>
      </Content>

      <Footer style={{ textAlign: "center" }}>
        <Typography.Text type="secondary">EZBill</Typography.Text>
      </Footer>
    </Layout>
  );
}
