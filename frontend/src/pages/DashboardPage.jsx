import { AlertTriangle, Building2, CheckCircle2, DollarSign, Package, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import apiClient from "../api/client";
import { ErrorState, LoadingState } from "../components/States";
import { getApiErrorMessage } from "../utils/errors";
import { formatMoney } from "../utils/format";

const PIE_COLORS = ["#0d9488", "#2563eb", "#d97706", "#dc2626", "#8b5cf6", "#64748b"];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchDashboard() {
    setLoading(true);
    setError("");

    try {
      const res = await apiClient.get("/reports/dashboard");
      setData(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load dashboard metrics"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) return <LoadingState label="Analyzing ERP operational data..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDashboard} />;
  if (!data) return null;

  const { kpis, salesTrend, topCustomers, inventoryCategoryBreakdown, lowStockProducts } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Executive Operations Dashboard</h1>
        <p className="text-sm text-slate-500">Real-time inventory valuation, revenue performance, and supply chain insights</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Sales Revenue</span>
            <div className="rounded-full bg-teal-50 p-2 text-teal-600">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-ink">{formatMoney(kpis.totalRevenue)}</p>
          <div className="mt-1 flex items-center gap-1 text-xs text-teal-700">
            <TrendingUp size={14} />
            <span>{kpis.confirmedChallansCount} Confirmed Sales Orders</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory Valuation</span>
            <div className="rounded-full bg-blue-50 p-2 text-blue-600">
              <Package size={20} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-ink">{formatMoney(kpis.totalInventoryValuation)}</p>
          <p className="mt-1 text-xs text-slate-500">{kpis.totalProducts} Distinct SKUs in Stock</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inbound Procurement</span>
            <div className="rounded-full bg-amber-50 p-2 text-amber-600">
              <ShoppingBag size={20} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-ink">{kpis.activePOsCount} Active POs</p>
          <p className="mt-1 text-xs text-slate-500">{kpis.totalSuppliers} Registered Vendors</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Low Stock Alerts</span>
            <div className={`rounded-full p-2 ${kpis.lowStockAlertCount > 0 ? "bg-red-50 text-red-600" : "bg-teal-50 text-teal-600"}`}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-ink">{kpis.lowStockAlertCount} SKUs Alerting</p>
          <p className="mt-1 text-xs text-slate-500">Needs Inventory Replenishment</p>
        </div>
      </div>

      {/* Visual Analytics Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 30-Day Sales Trend Chart */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">30-Day Sales Revenue Trend</h2>
            <span className="text-xs text-slate-500">Daily Revenue (₹)</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={salesTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(val) => [formatMoney(val), "Revenue"]}
                  labelStyle={{ fontWeight: "bold" }}
                />
                <Area dataKey="revenue" fill="url(#colorRevenue)" fillOpacity={1} stroke="#0d9488" strokeWidth={2} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Category Breakdown */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-ink">Category Valuation Share</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={inventoryCategoryBreakdown}
                  dataKey="valuation"
                  innerRadius={50}
                  nameKey="category"
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {inventoryCategoryBreakdown.map((entry, index) => (
                    <Cell fill={PIE_COLORS[index % PIE_COLORS.length]} key={`cell-${index}`} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => [formatMoney(val), "Valuation"]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Customers Bar Chart */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-ink">Top Customers by Revenue</h2>
          {topCustomers.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No confirmed customer transactions yet.</p>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={topCustomers} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="customerName" type="category" width={120} />
                  <Tooltip formatter={(val) => [formatMoney(val), "Total Sales"]} />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Low Stock Alert Table */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Low Stock Warning Summary</h2>
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {lowStockProducts.length} Items Below Min Stock
            </span>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <CheckCircle2 className="text-teal-600 mb-2" size={32} />
              <p className="text-sm font-semibold">Inventory levels healthy!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-center">Stock</th>
                    <th className="px-3 py-2 text-center">Min Alert</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockProducts.map((p) => (
                    <tr className="hover:bg-slate-50" key={p.id}>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-ink">{p.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{p.sku}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-red-600">{p.currentStock}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{p.minStockAlert}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatMoney(p.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
