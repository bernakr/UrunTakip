import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-kicker">Core Commerce</span>
          <h1>E-Commerce Console</h1>
        </div>
        <div className="header-actions">
          {user ? (
            <>
              <div className="user-chip">
                <span>{user.email}</span>
                <strong>{user.role}</strong>
              </div>
              <button type="button" onClick={signOut}>
                Logout
              </button>
            </>
          ) : null}
        </div>
      </header>

      <nav className="app-nav">
        <NavLink to="/products">Products</NavLink>
        <NavLink to="/cart">Cart</NavLink>
        <NavLink to="/orders">Orders</NavLink>
        {user?.role === "ADMIN" ? <NavLink to="/admin">Admin</NavLink> : null}
      </nav>

      <main className="app-content">{children}</main>
    </div>
  );
}

