import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout";
import { RequireAdmin, RequireAuth } from "./components/guards";
import { HomeRedirect } from "./components/home-redirect";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { AdminPage } from "./pages/AdminPage";
import { CartPage } from "./pages/CartPage";
import { LoginPage } from "./pages/LoginPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ProductsPage } from "./pages/ProductsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth />}>
        <Route
          path="/products"
          element={
            <AppLayout>
              <ProductsPage />
            </AppLayout>
          }
        />
        <Route
          path="/products/:id"
          element={
            <AppLayout>
              <ProductDetailPage />
            </AppLayout>
          }
        />
        <Route
          path="/cart"
          element={
            <AppLayout>
              <CartPage />
            </AppLayout>
          }
        />
        <Route
          path="/orders"
          element={
            <AppLayout>
              <OrdersPage />
            </AppLayout>
          }
        />
      </Route>

      <Route element={<RequireAdmin />}>
        <Route
          path="/admin"
          element={
            <AppLayout>
              <AdminPage />
            </AppLayout>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
