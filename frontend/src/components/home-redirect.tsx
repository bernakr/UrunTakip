import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

export function HomeRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? "/products" : "/login"} replace />;
}

