import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
  XCircle
} from "lucide-react";

import { api, getToken, setToken } from "./lib/api";

const emptyData = {
  customers: [],
  products: [],
  stockMovements: [],
  challans: []
};

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "customers", label: "Customers", icon: Users },
  { id: "products", label: "Products", icon: Package },
  { id: "stock", label: "Stock", icon: Boxes },
  { id: "challans", label: "Challans", icon: ClipboardList }
];

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatMoney(value) {
  return `INR ${Number(value || 0).toFixed(2)}`;
}

function statusClass(status) {
  if (status === "CONFIRMED") return "bg-teal-50 text-workgreen border-teal-200";
  if (status === "CANCELLED") return "bg-red-50 text-workred border-red-200";
  return "bg-amber-50 text-workamber border-amber-200";
}

function readableError(error) {
  if (error?.data?.insufficientProducts?.length) {
    const lines = error.data.insufficientProducts.map((item) => {
      const label = item.sku ? `${item.productName} (${item.sku})` : `Product ${item.productId}`;
      return `${label}: requested ${item.requestedQuantity}, available ${item.currentStock}`;
    });
    return `${error.message}. ${lines.join("; ")}`;
  }

  return error?.message || "Something went wrong";
}

function canFor(user) {
  const role = user?.role;
  return {
    customersWrite: ["ADMIN", "SALES"].includes(role),
    productsWrite: ["ADMIN", "WAREHOUSE"].includes(role),
    stockWrite: ["ADMIN", "WAREHOUSE"].includes(role),
    challanAction: ["ADMIN", "SALES"].includes(role)
  };
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyRow({ colSpan, label }) {
  return (
    <tr>
      <td className="table-cell text-slate-500" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex h-7 items-center border px-2 text-xs font-semibold ${statusClass(status)}`}>
      {status}
    </span>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const path = mode === "login" ? "/auth/login" : "/auth/bootstrap";
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password };
      const result = await api(path, { method: "POST", body: payload });
      onAuth(result);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10">
        <section className="grid w-full gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-normal text-workgreen">
              Wholesale Operations
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-normal text-ink sm:text-5xl">
              Mini ERP + CRM Operations Portal
            </h1>
            <div className="mt-8 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div className="border-l-4 border-workgreen bg-white p-4">Customers, products, stock, challans</div>
              <div className="border-l-4 border-workamber bg-white p-4">Role-based access on every API route</div>
              <div className="border-l-4 border-workred bg-white p-4">Transactional challan confirmation</div>
              <div className="border-l-4 border-slate-500 bg-white p-4">Historical item snapshots</div>
            </div>
          </div>

          <form className="panel p-6 shadow-sm" onSubmit={submit}>
            <div className="mb-5 flex gap-2">
              <button
                className={`secondary-button flex-1 ${mode === "login" ? "border-workgreen text-workgreen" : ""}`}
                type="button"
                onClick={() => setMode("login")}
              >
                Login
              </button>
              <button
                className={`secondary-button flex-1 ${mode === "bootstrap" ? "border-workgreen text-workgreen" : ""}`}
                type="button"
                onClick={() => setMode("bootstrap")}
              >
                First admin
              </button>
            </div>

            <div className="grid gap-4">
              {mode === "bootstrap" && (
                <Field label="Name">
                  <input
                    className="control"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </Field>
              )}
              <Field label="Email">
                <input
                  className="control"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
              </Field>
              <Field label="Password">
                <input
                  className="control"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required
                />
              </Field>
            </div>

            {error && <p className="mt-4 text-sm font-medium text-workred">{error}</p>}

            <button className="primary-button mt-5 w-full" disabled={busy} type="submit">
              {busy ? "Working" : mode === "login" ? "Sign in" : "Create admin"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Shell({ user, activeTab, setActiveTab, onLogout, children }) {
  return (
    <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="bg-slatepanel text-white lg:min-h-screen">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 lg:block">
          <div>
            <p className="text-sm font-semibold text-teal-200">Mini ERP + CRM</p>
            <p className="mt-1 text-xs text-slate-300">{user.role}</p>
          </div>
          <button className="icon-button border-white/20 bg-white/5 text-white hover:text-teal-200 lg:hidden" onClick={onLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:grid lg:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`flex h-11 min-w-fit items-center gap-3 px-3 text-sm font-semibold transition lg:w-full ${
                  active ? "bg-white text-ink" : "text-slate-200 hover:bg-white/10"
                }`}
                style={{ borderRadius: 6 }}
                onClick={() => setActiveTab(item.id)}
                type="button"
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-sm text-slate-500">Signed in as</p>
            <h2 className="text-xl font-bold tracking-normal text-ink">{user.name}</h2>
          </div>
          <button className="secondary-button hidden lg:inline-flex" onClick={onLogout} type="button">
            <LogOut size={18} />
            Logout
          </button>
        </header>

        <main className="px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className={`border-l-4 bg-white p-4 shadow-sm ${tone}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{value}</p>
    </div>
  );
}

function Dashboard({ data }) {
  const lowStockCount = data.products.filter((product) => product.lowStock).length;
  const draftCount = data.challans.filter((challan) => challan.status === "DRAFT").length;
  const confirmedCount = data.challans.filter((challan) => challan.status === "CONFIRMED").length;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Customers" value={data.customers.length} tone="border-workgreen" />
        <Metric label="Products" value={data.products.length} tone="border-slate-500" />
        <Metric label="Low stock" value={lowStockCount} tone="border-workamber" />
        <Metric label="Confirmed challans" value={confirmedCount} tone="border-workgreen" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="font-bold text-ink">Draft challans</h3>
            <span className="text-sm font-semibold text-workamber">{draftCount}</span>
          </div>
          <table className="w-full min-w-[520px]">
            <thead className="table-head">
              <tr>
                <th className="px-3 py-3">Number</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Total</th>
                <th className="px-3 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.challans
                .filter((challan) => challan.status === "DRAFT")
                .slice(0, 6)
                .map((challan) => (
                  <tr key={challan.id}>
                    <td className="table-cell font-semibold">{challan.number}</td>
                    <td className="table-cell">{challan.customerName}</td>
                    <td className="table-cell">{formatMoney(challan.total)}</td>
                    <td className="table-cell">{formatDate(challan.createdAt)}</td>
                  </tr>
                ))}
              {draftCount === 0 && <EmptyRow colSpan={4} label="No draft challans" />}
            </tbody>
          </table>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="font-bold text-ink">Low stock products</h3>
          </div>
          <table className="w-full min-w-[480px]">
            <thead className="table-head">
              <tr>
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3">Stock</th>
                <th className="px-3 py-3">Alert</th>
              </tr>
            </thead>
            <tbody>
              {data.products
                .filter((product) => product.lowStock)
                .slice(0, 8)
                .map((product) => (
                  <tr key={product.id}>
                    <td className="table-cell font-semibold">{product.sku}</td>
                    <td className="table-cell">{product.name}</td>
                    <td className="table-cell">{product.currentStock}</td>
                    <td className="table-cell">{product.minStockAlert}</td>
                  </tr>
                ))}
              {lowStockCount === 0 && <EmptyRow colSpan={4} label="No low stock products" />}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function CustomersPanel({ customers, canWrite, refresh, setIssue }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", gstNumber: "" });
  const [busy, setBusy] = useState(false);

  async function createCustomer(event) {
    event.preventDefault();
    setBusy(true);
    setIssue("");
    try {
      await api("/customers", { method: "POST", body: form });
      setForm({ name: "", email: "", phone: "", address: "", gstNumber: "" });
      await refresh();
    } catch (error) {
      setIssue(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCustomer(id) {
    setIssue("");
    try {
      await api(`/customers/${id}`, { method: "DELETE" });
      await refresh();
    } catch (error) {
      setIssue(readableError(error));
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <form className="panel p-4" onSubmit={createCustomer}>
        <h3 className="mb-4 font-bold text-ink">Customer</h3>
        <div className="grid gap-3">
          <Field label="Name">
            <input className="control" disabled={!canWrite} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="Email">
            <input className="control" disabled={!canWrite} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="control" disabled={!canWrite} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Field label="GST number">
            <input className="control" disabled={!canWrite} value={form.gstNumber} onChange={(event) => setForm({ ...form, gstNumber: event.target.value })} />
          </Field>
          <Field label="Address">
            <textarea className="control min-h-24 py-2" disabled={!canWrite} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </Field>
        </div>
        <button className="primary-button mt-4 w-full" disabled={!canWrite || busy} type="submit">
          <Plus size={18} />
          Add customer
        </button>
      </form>

      <section className="panel overflow-auto">
        <table className="w-full min-w-[760px]">
          <thead className="table-head">
            <tr>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">GST</th>
              <th className="px-3 py-3">Created</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="table-cell font-semibold">{customer.name}</td>
                <td className="table-cell">{customer.email || "-"}</td>
                <td className="table-cell">{customer.phone || "-"}</td>
                <td className="table-cell">{customer.gstNumber || "-"}</td>
                <td className="table-cell">{formatDate(customer.createdAt)}</td>
                <td className="table-cell">
                  <button className="icon-button" disabled={!canWrite} onClick={() => deleteCustomer(customer.id)} title="Delete customer" type="button">
                    <Trash2 size={17} />
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && <EmptyRow colSpan={6} label="No customers" />}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ProductsPanel({ products, canWrite, refresh, setIssue }) {
  const [form, setForm] = useState({ name: "", sku: "", unitPrice: "", currentStock: "0", minStockAlert: "0" });
  const [busy, setBusy] = useState(false);

  async function createProduct(event) {
    event.preventDefault();
    setBusy(true);
    setIssue("");
    try {
      await api("/products", { method: "POST", body: form });
      setForm({ name: "", sku: "", unitPrice: "", currentStock: "0", minStockAlert: "0" });
      await refresh();
    } catch (error) {
      setIssue(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(id) {
    setIssue("");
    try {
      await api(`/products/${id}`, { method: "DELETE" });
      await refresh();
    } catch (error) {
      setIssue(readableError(error));
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <form className="panel p-4" onSubmit={createProduct}>
        <h3 className="mb-4 font-bold text-ink">Product</h3>
        <div className="grid gap-3">
          <Field label="Name">
            <input className="control" disabled={!canWrite} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="SKU">
            <input className="control" disabled={!canWrite} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} required />
          </Field>
          <Field label="Unit price">
            <input className="control" disabled={!canWrite} min="0" step="0.01" type="number" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock">
              <input className="control" disabled={!canWrite} min="0" type="number" value={form.currentStock} onChange={(event) => setForm({ ...form, currentStock: event.target.value })} />
            </Field>
            <Field label="Alert">
              <input className="control" disabled={!canWrite} min="0" type="number" value={form.minStockAlert} onChange={(event) => setForm({ ...form, minStockAlert: event.target.value })} />
            </Field>
          </div>
        </div>
        <button className="primary-button mt-4 w-full" disabled={!canWrite || busy} type="submit">
          <Plus size={18} />
          Add product
        </button>
      </form>

      <section className="panel overflow-auto">
        <table className="w-full min-w-[860px]">
          <thead className="table-head">
            <tr>
              <th className="px-3 py-3">SKU</th>
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">Price</th>
              <th className="px-3 py-3">Stock</th>
              <th className="px-3 py-3">Alert</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td className="table-cell font-semibold">{product.sku}</td>
                <td className="table-cell">{product.name}</td>
                <td className="table-cell">{formatMoney(product.unitPrice)}</td>
                <td className="table-cell">{product.currentStock}</td>
                <td className="table-cell">{product.minStockAlert}</td>
                <td className="table-cell">
                  <span className={`inline-flex h-7 items-center border px-2 text-xs font-semibold ${product.lowStock ? "border-amber-200 bg-amber-50 text-workamber" : "border-teal-200 bg-teal-50 text-workgreen"}`}>
                    {product.lowStock ? "LOW" : "OK"}
                  </span>
                </td>
                <td className="table-cell">
                  <button className="icon-button" disabled={!canWrite} onClick={() => deleteProduct(product.id)} title="Delete product" type="button">
                    <Trash2 size={17} />
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && <EmptyRow colSpan={7} label="No products" />}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StockPanel({ products, stockMovements, canWrite, refresh, setIssue }) {
  const [form, setForm] = useState({ productId: "", movementType: "IN", quantity: "1", reason: "" });
  const [busy, setBusy] = useState(false);

  async function createMovement(event) {
    event.preventDefault();
    setBusy(true);
    setIssue("");
    try {
      await api("/stock-movements", { method: "POST", body: form });
      setForm({ productId: "", movementType: "IN", quantity: "1", reason: "" });
      await refresh();
    } catch (error) {
      setIssue(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <form className="panel p-4" onSubmit={createMovement}>
        <h3 className="mb-4 font-bold text-ink">Stock movement</h3>
        <div className="grid gap-3">
          <Field label="Product">
            <select className="control" disabled={!canWrite} value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} required>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} - {product.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select className="control" disabled={!canWrite} value={form.movementType} onChange={(event) => setForm({ ...form, movementType: event.target.value })}>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
          </Field>
          <Field label="Quantity">
            <input className="control" disabled={!canWrite} min="1" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required />
          </Field>
          <Field label="Reason">
            <input className="control" disabled={!canWrite} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
          </Field>
        </div>
        <button className="primary-button mt-4 w-full" disabled={!canWrite || busy} type="submit">
          <Plus size={18} />
          Add movement
        </button>
      </form>

      <section className="panel overflow-auto">
        <table className="w-full min-w-[860px]">
          <thead className="table-head">
            <tr>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Qty</th>
              <th className="px-3 py-3">Reason</th>
              <th className="px-3 py-3">User</th>
            </tr>
          </thead>
          <tbody>
            {stockMovements.map((movement) => (
              <tr key={movement.id}>
                <td className="table-cell">{formatDate(movement.createdAt)}</td>
                <td className="table-cell font-semibold">{movement.product ? `${movement.product.sku} - ${movement.product.name}` : movement.productId}</td>
                <td className="table-cell">
                  <span className={`inline-flex h-7 items-center border px-2 text-xs font-semibold ${movement.movementType === "IN" ? "border-teal-200 bg-teal-50 text-workgreen" : "border-red-200 bg-red-50 text-workred"}`}>
                    {movement.movementType}
                  </span>
                </td>
                <td className="table-cell">{movement.quantity}</td>
                <td className="table-cell">{movement.reason}</td>
                <td className="table-cell">{movement.createdBy?.name || "-"}</td>
              </tr>
            ))}
            {stockMovements.length === 0 && <EmptyRow colSpan={6} label="No stock movements" />}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ChallansPanel({ customers, products, challans, selectedId, setSelectedId, canAction, refresh, setIssue }) {
  const [createForm, setCreateForm] = useState({ customerId: "", notes: "" });
  const [itemForm, setItemForm] = useState({ productId: "", quantity: "1" });
  const [itemQuantities, setItemQuantities] = useState({});
  const [busy, setBusy] = useState(false);

  const selected = challans.find((challan) => challan.id === selectedId) || challans[0] || null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) {
      setSelectedId(selected.id);
    }
  }, [selected, selectedId, setSelectedId]);

  useEffect(() => {
    if (!selected?.items) return;
    const next = {};
    selected.items.forEach((item) => {
      next[item.id] = String(item.quantity);
    });
    setItemQuantities(next);
  }, [selected?.id, selected?.items]);

  async function withBusy(action) {
    setBusy(true);
    setIssue("");
    try {
      await action();
      await refresh();
    } catch (error) {
      setIssue(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function createChallan(event) {
    event.preventDefault();
    await withBusy(async () => {
      const result = await api("/challans", { method: "POST", body: createForm });
      setCreateForm({ customerId: "", notes: "" });
      setSelectedId(result.challan.id);
    });
  }

  async function addItem(event) {
    event.preventDefault();
    if (!selected) return;
    await withBusy(async () => {
      await api(`/challans/${selected.id}/items`, { method: "POST", body: itemForm });
      setItemForm({ productId: "", quantity: "1" });
    });
  }

  async function updateItem(itemId) {
    if (!selected) return;
    await withBusy(async () => {
      await api(`/challans/${selected.id}/items/${itemId}`, {
        method: "PATCH",
        body: { quantity: itemQuantities[itemId] }
      });
    });
  }

  async function removeItem(itemId) {
    if (!selected) return;
    await withBusy(async () => {
      await api(`/challans/${selected.id}/items/${itemId}`, { method: "DELETE" });
    });
  }

  async function confirmSelected() {
    if (!selected) return;
    await withBusy(async () => {
      await api(`/challans/${selected.id}/confirm`, { method: "POST" });
    });
  }

  async function cancelSelected() {
    if (!selected) return;
    await withBusy(async () => {
      await api(`/challans/${selected.id}/cancel`, { method: "POST" });
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <div className="grid content-start gap-5">
        <form className="panel p-4" onSubmit={createChallan}>
          <h3 className="mb-4 font-bold text-ink">Challan</h3>
          <div className="grid gap-3">
            <Field label="Customer">
              <select className="control" disabled={!canAction} value={createForm.customerId} onChange={(event) => setCreateForm({ ...createForm, customerId: event.target.value })} required>
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes">
              <input className="control" disabled={!canAction} value={createForm.notes} onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })} />
            </Field>
          </div>
          <button className="primary-button mt-4 w-full" disabled={!canAction || busy} type="submit">
            <Plus size={18} />
            Create draft
          </button>
        </form>

        <section className="panel overflow-auto">
          <table className="w-full min-w-[420px]">
            <thead className="table-head">
              <tr>
                <th className="px-3 py-3">Number</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {challans.map((challan) => (
                <tr
                  className={`cursor-pointer transition ${selected?.id === challan.id ? "bg-teal-50" : "hover:bg-slate-50"}`}
                  key={challan.id}
                  onClick={() => setSelectedId(challan.id)}
                >
                  <td className="table-cell font-semibold">{challan.number}</td>
                  <td className="table-cell">{challan.customerName}</td>
                  <td className="table-cell">
                    <StatusBadge status={challan.status} />
                  </td>
                </tr>
              ))}
              {challans.length === 0 && <EmptyRow colSpan={3} label="No challans" />}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel overflow-hidden">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-bold tracking-normal text-ink">{selected.number}</h3>
                  <StatusBadge status={selected.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{selected.customerName}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.status === "DRAFT" && (
                  <button className="primary-button" disabled={!canAction || busy || selected.items.length === 0} onClick={confirmSelected} type="button">
                    <CheckCircle2 size={18} />
                    Confirm
                  </button>
                )}
                {selected.status !== "CANCELLED" && (
                  <button className="danger-button" disabled={!canAction || busy} onClick={cancelSelected} type="button">
                    <XCircle size={18} />
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {selected.status === "DRAFT" && (
              <form className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 md:grid-cols-[1fr_120px_auto]" onSubmit={addItem}>
                <Field label="Product">
                  <select className="control" disabled={!canAction} value={itemForm.productId} onChange={(event) => setItemForm({ ...itemForm, productId: event.target.value })} required>
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} - {product.name} ({product.currentStock})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Qty">
                  <input className="control" disabled={!canAction} min="1" type="number" value={itemForm.quantity} onChange={(event) => setItemForm({ ...itemForm, quantity: event.target.value })} required />
                </Field>
                <button className="primary-button self-end" disabled={!canAction || busy} type="submit">
                  <Plus size={18} />
                  Add item
                </button>
              </form>
            )}

            <div className="overflow-auto">
              <table className="w-full min-w-[780px]">
                <thead className="table-head">
                  <tr>
                    <th className="px-3 py-3">SKU</th>
                    <th className="px-3 py-3">Product snapshot</th>
                    <th className="px-3 py-3">Unit price</th>
                    <th className="px-3 py-3">Qty</th>
                    <th className="px-3 py-3">Line total</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={item.id}>
                      <td className="table-cell font-semibold">{item.sku}</td>
                      <td className="table-cell">{item.productName}</td>
                      <td className="table-cell">{formatMoney(item.unitPrice)}</td>
                      <td className="table-cell">
                        {selected.status === "DRAFT" ? (
                          <input
                            className="control h-9 max-w-24"
                            disabled={!canAction}
                            min="1"
                            type="number"
                            value={itemQuantities[item.id] || item.quantity}
                            onChange={(event) => setItemQuantities({ ...itemQuantities, [item.id]: event.target.value })}
                          />
                        ) : (
                          item.quantity
                        )}
                      </td>
                      <td className="table-cell">{formatMoney(item.lineTotal)}</td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button className="icon-button" disabled={!canAction || busy || selected.status !== "DRAFT"} onClick={() => updateItem(item.id)} title="Save quantity" type="button">
                            <Save size={17} />
                          </button>
                          <button className="icon-button" disabled={!canAction || busy || selected.status !== "DRAFT"} onClick={() => removeItem(item.id)} title="Remove item" type="button">
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {selected.items.length === 0 && <EmptyRow colSpan={6} label="No challan items" />}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4">
              <div className="text-sm text-slate-500">Created {formatDate(selected.createdAt)}</div>
              <div className="text-xl font-bold tracking-normal text-ink">{formatMoney(selected.total)}</div>
            </div>
          </>
        ) : (
          <div className="p-6 text-sm text-slate-500">No challan selected</div>
        )}
      </section>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState(emptyData);
  const [selectedChallanId, setSelectedChallanId] = useState(null);
  const [issue, setIssue] = useState("");
  const [loading, setLoading] = useState(false);

  const permissions = useMemo(() => canFor(user), [user]);

  async function refresh() {
    setLoading(true);
    try {
      const [customers, products, stockMovements, challans] = await Promise.all([
        api("/customers"),
        api("/products"),
        api("/stock-movements"),
        api("/challans")
      ]);

      setData({
        customers: customers.customers || [],
        products: products.products || [],
        stockMovements: stockMovements.stockMovements || [],
        challans: challans.challans || []
      });
    } catch (error) {
      setIssue(readableError(error));
      if (error.status === 401) {
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function boot() {
      const token = getToken();
      if (!token) {
        setBooting(false);
        return;
      }

      try {
        const result = await api("/auth/me");
        setUser(result.user);
      } catch (error) {
        setToken(null);
      } finally {
        setBooting(false);
      }
    }

    boot();
  }, []);

  useEffect(() => {
    if (user) {
      refresh();
    }
  }, [user]);

  async function handleAuth(result) {
    setToken(result.token);
    setUser(result.user);
    setIssue("");
  }

  function logout() {
    setToken(null);
    setUser(null);
    setData(emptyData);
    setSelectedChallanId(null);
  }

  if (booting) {
    return <div className="grid min-h-screen place-items-center bg-slate-100 text-sm font-semibold text-slate-600">Loading</div>;
  }

  if (!user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <Shell user={user} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={logout}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{navItems.find((item) => item.id === activeTab)?.label}</p>
          <h1 className="text-2xl font-bold tracking-normal text-ink">Operations workspace</h1>
        </div>
        <button className="secondary-button" disabled={loading} onClick={refresh} type="button">
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {issue && (
        <div className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-workred" style={{ borderRadius: 8 }}>
          {issue}
        </div>
      )}

      {activeTab === "dashboard" && <Dashboard data={data} />}
      {activeTab === "customers" && (
        <CustomersPanel customers={data.customers} canWrite={permissions.customersWrite} refresh={refresh} setIssue={setIssue} />
      )}
      {activeTab === "products" && (
        <ProductsPanel products={data.products} canWrite={permissions.productsWrite} refresh={refresh} setIssue={setIssue} />
      )}
      {activeTab === "stock" && (
        <StockPanel products={data.products} stockMovements={data.stockMovements} canWrite={permissions.stockWrite} refresh={refresh} setIssue={setIssue} />
      )}
      {activeTab === "challans" && (
        <ChallansPanel
          customers={data.customers}
          products={data.products}
          challans={data.challans}
          selectedId={selectedChallanId}
          setSelectedId={setSelectedChallanId}
          canAction={permissions.challanAction}
          refresh={refresh}
          setIssue={setIssue}
        />
      )}
    </Shell>
  );
}
