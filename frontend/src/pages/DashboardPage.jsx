import { useEffect, useState } from "react";

import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";

const emptyCounts = {
  customers: 0,
  products: 0,
  challans: 0
};

function Metric({ label, value, tone }) {
  return (
    <div className={`border-l-4 bg-white p-4 shadow-sm ${tone}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { role } = useAuth();
  const [counts, setCounts] = useState(emptyCounts);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadCounts() {
      setLoading(true);
      const [customers, products, challans] = await Promise.all([
        apiClient.get("/customers?page=1&pageSize=1"),
        apiClient.get("/products?page=1&pageSize=1"),
        apiClient.get("/challans?page=1&pageSize=1")
      ]);

      if (alive) {
        setCounts({
          customers: customers.data.total || 0,
          products: products.data.total || 0,
          challans: challans.data.total || 0
        });
        setLoading(false);
      }
    }

    loadCounts().catch(() => {
      if (alive) {
        setLoading(false);
      }
    });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-medium text-slate-500">{role}</p>
        <h2 className="text-2xl font-bold tracking-normal text-ink">Dashboard</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Customers" value={loading ? "..." : counts.customers} tone="border-workgreen" />
        <Metric label="Products" value={loading ? "..." : counts.products} tone="border-slate-500" />
        <Metric label="Challans" value={loading ? "..." : counts.challans} tone="border-workamber" />
      </div>
    </div>
  );
}
