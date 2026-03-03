import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== "ADMIN") {
    return <Navigate to="/products" replace />;
  }
  return <Outlet />;
}

