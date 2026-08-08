import { Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import PlaceholderPage from "./pages/PlaceholderPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="customers" element={<PlaceholderPage route="/customers" />} />
          <Route path="customers/new" element={<PlaceholderPage route="/customers/new" />} />
          <Route path="products" element={<PlaceholderPage route="/products" />} />
          <Route path="products/manage" element={<PlaceholderPage route="/products/manage" />} />
          <Route path="stock" element={<PlaceholderPage route="/stock" />} />
          <Route path="stock/adjust" element={<PlaceholderPage route="/stock/adjust" />} />
          <Route path="challans" element={<PlaceholderPage route="/challans" />} />
          <Route path="challans/actions" element={<PlaceholderPage route="/challans/actions" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
