import { CheckCircle2, PackageCheck, Plus, Search, ShoppingBag, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import apiClient from "../api/client";
import FormField from "../components/FormField";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/errors";
import { formatDate, formatMoney } from "../utils/format";

function canWritePOs(role) {
  return ["ADMIN", "WAREHOUSE"].includes(role);
}

function poStatusBadge(status) {
  if (status === "RECEIVED") return "border-teal-200 bg-teal-50 text-workgreen";
  if (status === "ORDERED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "CANCELLED") return "border-red-200 bg-red-50 text-workred";
  return "border-amber-200 bg-amber-50 text-workamber";
}

function NewPoModal({ suppliers, products, onClose, onCreated }) {
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ productId: "", quantity: 1, unitCost: 0 }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function addItemLine() {
    setItems([...items, { productId: "", quantity: 1, unitCost: 0 }]);
  }

  function updateItem(index, field, val) {
    const next = [...items];
    next[index][field] = val;

    if (field === "productId") {
      const prod = products.find((p) => p.id === parseInt(val));
      if (prod) {
        next[index].unitCost = Number(prod.unitPrice) || 0;
      }
    }
    setItems(next);
  }

  function removeItemLine(index) {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
    0
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const payload = {
        supplierId: parseInt(supplierId),
        notes,
        items: items.map((i) => ({
          productId: parseInt(i.productId),
          quantity: parseInt(i.quantity),
          unitCost: parseFloat(i.unitCost)
        }))
      };

      await apiClient.post("/purchase-orders", payload);
      onCreated();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create purchase order"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Create Purchase Order">
      {error && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600 border border-red-200">{error}</div>}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="Select Supplier *">
          <select
            className="text-input"
            onChange={(e) => setSupplierId(e.target.value)}
            required
            value={supplierId}
          >
            <option value="">-- Choose Supplier --</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </FormField>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase text-slate-500">Order Items *</label>
          <div className="space-y-3">
            {items.map((line, idx) => (
              <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2" key={idx}>
                <select
                  className="text-input flex-1 min-w-[180px]"
                  onChange={(e) => updateItem(idx, "productId", e.target.value)}
                  required
                  value={line.productId}
                >
                  <option value="">-- Select Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Stock: {p.currentStock}
                    </option>
                  ))}
                </select>

                <input
                  className="text-input w-20"
                  min="1"
                  onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                  placeholder="Qty"
                  required
                  type="number"
                  value={line.quantity}
                />

                <input
                  className="text-input w-28"
                  min="0"
                  onChange={(e) => updateItem(idx, "unitCost", e.target.value)}
                  placeholder="Unit Cost"
                  required
                  step="0.01"
                  type="number"
                  value={line.unitCost}
                />

                {items.length > 1 && (
                  <button
                    className="p-2 text-slate-400 hover:text-red-600"
                    onClick={() => removeItemLine(idx)}
                    type="button"
                  >
                    <XCircle size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button className="mt-2 text-xs font-semibold text-teal-600 hover:text-teal-800" onClick={addItemLine} type="button">
            + Add Another Line Item
          </button>
        </div>

        <div className="rounded bg-slate-50 p-3 text-right">
          <span className="text-xs text-slate-500">Estimated Total Cost:</span>{" "}
          <span className="text-lg font-bold text-ink">{formatMoney(totalAmount)}</span>
        </div>

        <FormField label="Notes / Delivery Terms">
          <input
            className="text-input"
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Expected delivery in 3 business days"
            type="text"
            value={notes}
          />
        </FormField>

        <div className="mt-6 flex justify-end gap-3">
          <button className="secondary-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "Creating..." : "Save Draft PO"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function PurchaseOrdersPage() {
  const { role } = useAuth();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [busyPoId, setBusyPoId] = useState(null);

  async function fetchOrders(page = 1, searchQuery = search, status = statusFilter) {
    setLoading(true);
    setError("");

    try {
      const res = await apiClient.get("/purchase-orders", {
        params: { page, pageSize: 10, search: searchQuery, status: status || undefined }
      });
      setOrders(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load purchase orders"));
    } finally {
      setLoading(false);
    }
  }

  async function fetchLookupData() {
    try {
      const [supRes, prodRes] = await Promise.all([
        apiClient.get("/suppliers", { params: { pageSize: 100 } }),
        apiClient.get("/products", { params: { pageSize: 100 } })
      ]);
      setSuppliers(supRes.data.data);
      setProducts(prodRes.data.data);
    } catch (err) {
      console.error("Failed to load lookup data", err);
    }
  }

  useEffect(() => {
    fetchOrders(1);
    fetchLookupData();
  }, []);

  async function handleOrderPo(id) {
    setBusyPoId(id);
    try {
      await apiClient.post(`/purchase-orders/${id}/order`);
      fetchOrders(pagination.page);
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to update PO status"));
    } finally {
      setBusyPoId(null);
    }
  }

  async function handleReceivePo(id) {
    if (!confirm("Are you sure you want to receive this PO? This will automatically add items into inventory stock.")) {
      return;
    }
    setBusyPoId(id);
    try {
      await apiClient.post(`/purchase-orders/${id}/receive`);
      fetchOrders(pagination.page);
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to receive PO"));
    } finally {
      setBusyPoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Purchase Orders & Goods Receipt</h1>
          <p className="text-sm text-slate-500">Inbound procurement supply chain and automatic inventory stock updates</p>
        </div>

        {canWritePOs(role) && (
          <button className="primary-button" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            Create Purchase Order
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className="text-input pl-10"
            onChange={(e) => {
              setSearch(e.target.value);
              fetchOrders(1, e.target.value, statusFilter);
            }}
            placeholder="Search PO number, supplier..."
            type="text"
            value={search}
          />
        </div>

        <select
          className="text-input w-48"
          onChange={(e) => {
            setStatusFilter(e.target.value);
            fetchOrders(1, search, e.target.value);
          }}
          value={statusFilter}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="ORDERED">ORDERED</option>
          <option value="RECEIVED">RECEIVED (Stock In)</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      {loading ? (
        <LoadingState label="Loading purchase orders..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchOrders(pagination.page)} />
      ) : orders.length === 0 ? (
        <EmptyState
          actionLabel={canWritePOs(role) ? "Create Purchase Order" : null}
          description="No purchase orders match your criteria."
          onAction={() => setShowCreateModal(true)}
          title="No Purchase Orders Found"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Created Date</th>
                {canWritePOs(role) && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((po) => (
                <tr className="hover:bg-slate-50" key={po.id}>
                  <td className="px-4 py-3 font-semibold text-ink">{po.poNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{po.supplier.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{po.supplier.code}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${poStatusBadge(po.status)}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-ink">{formatMoney(po.totalAmount)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(po.createdAt)}</td>
                  {canWritePOs(role) && (
                    <td className="px-4 py-3 text-right space-x-2">
                      {po.status === "DRAFT" && (
                        <button
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                          disabled={busyPoId === po.id}
                          onClick={() => handleOrderPo(po.id)}
                        >
                          Mark Ordered
                        </button>
                      )}
                      {(po.status === "DRAFT" || po.status === "ORDERED") && (
                        <button
                          className="inline-flex items-center gap-1 rounded bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700"
                          disabled={busyPoId === po.id}
                          onClick={() => handleReceivePo(po.id)}
                        >
                          <PackageCheck size={14} />
                          Receive Stock (GRN)
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            onPageChange={(p) => fetchOrders(p)}
            page={pagination.page}
            totalPages={pagination.totalPages}
          />
        </div>
      )}

      {showCreateModal && (
        <NewPoModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchOrders(1);
          }}
          products={products}
          suppliers={suppliers}
        />
      )}
    </div>
  );
}
