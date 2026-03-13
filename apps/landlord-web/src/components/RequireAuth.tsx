import { Spin } from "antd";
import { Navigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";

/**
 * 路由守卫：未登录跳转 /login，等待初始化时显示 loading。
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
