import { Building2, Plus, Search, Truck } from "lucide-react";
import { useEffect, useState } from "react";

import apiClient from "../api/client";
import FormField from "../components/FormField";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/errors";

function canWriteSuppliers(role) {
  return ["ADMIN", "WAREHOUSE"].includes(role);
}

function SupplierModal({ supplier, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: supplier?.name || "",
    code: supplier?.code || "",
    contactPerson: supplier?.contactPerson || "",
    email: supplier?.email || "",
    phone: supplier?.phone || "",
    address: supplier?.address || "",
    gstNumber: supplier?.gstNumber || ""
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (supplier) {
        await apiClient.put(`/suppliers/${supplier.id}`, form);
      } else {
        await apiClient.post("/suppliers", form);
      }
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save supplier"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={supplier ? "Edit Supplier" : "Add New Supplier"}>
      {error && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600 border border-red-200">{error}</div>}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Supplier Name *">
            <input
              className="text-input"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Acme Components Ltd"
              required
              type="text"
              value={form.name}
            />
          </FormField>

          <FormField label="Supplier Code *">
            <input
              className="text-input"
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. SUP-001"
              required
              type="text"
              value={form.code}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Contact Person">
            <input
              className="text-input"
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              placeholder="e.g. Rahul Sharma"
              type="text"
              value={form.contactPerson}
            />
          </FormField>

          <FormField label="GST Number">
            <input
              className="text-input"
              onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
              placeholder="e.g. 27AABCU9603R1ZN"
              type="text"
              value={form.gstNumber}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Email Address">
            <input
              className="text-input"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="supplier@company.com"
              type="email"
              value={form.email}
            />
          </FormField>

          <FormField label="Phone Number">
            <input
              className="text-input"
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 98765 43210"
              type="text"
              value={form.phone}
            />
          </FormField>
        </div>

        <FormField label="Address">
          <textarea
            className="text-input"
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Full business address..."
            rows={2}
            value={form.address}
          />
        </FormField>

        <div className="mt-6 flex justify-end gap-3">
          <button className="secondary-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "Saving..." : supplier ? "Update Supplier" : "Create Supplier"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function SuppliersPage() {
  const { role } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showModal, setShowModal] = useState(false);

  async function fetchSuppliers(page = 1, searchQuery = search) {
    setLoading(true);
    setError("");

    try {
      const res = await apiClient.get("/suppliers", {
        params: { page, pageSize: 10, search: searchQuery }
      });
      setSuppliers(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load suppliers"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSuppliers(1);
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchSuppliers(1, search);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Suppliers Module</h1>
          <p className="text-sm text-slate-500">Manage vendor profiles and procurement partners</p>
        </div>

        {canWriteSuppliers(role) && (
          <button
            className="primary-button"
            onClick={() => {
              setSelectedSupplier(null);
              setShowModal(true);
            }}
          >
            <Plus size={18} />
            Add Supplier
          </button>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form className="flex gap-2" onSubmit={handleSearchSubmit}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="text-input pl-10"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, contact person..."
              type="text"
              value={search}
            />
          </div>
          <button className="secondary-button" type="submit">
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <LoadingState label="Loading suppliers..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchSuppliers(pagination.page)} />
      ) : suppliers.length === 0 ? (
        <EmptyState
          actionLabel={canWriteSuppliers(role) ? "Add Supplier" : null}
          description="No suppliers found matching your query."
          onAction={() => setShowModal(true)}
          title="No Suppliers Found"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Code & Name</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Phone & Email</th>
                <th className="px-4 py-3">GST Number</th>
                <th className="px-4 py-3 text-center">Orders</th>
                {canWriteSuppliers(role) && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((s) => (
                <tr className="hover:bg-slate-50" key={s.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{s.name}</div>
                    <div className="text-xs text-teal-600 font-mono">{s.code}</div>
                  </td>
                  <td className="px-4 py-3">{s.contactPerson || "—"}</td>
                  <td className="px-4 py-3">
                    <div>{s.phone || "—"}</div>
                    <div className="text-xs text-slate-500">{s.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.gstNumber || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      <Truck size={12} />
                      {s._count?.purchaseOrders || 0} POs
                    </span>
                  </td>
                  {canWriteSuppliers(role) && (
                    <td className="px-4 py-3 text-right">
                      <button
                        className="text-xs font-semibold text-teal-600 hover:text-teal-800"
                        onClick={() => {
                          setSelectedSupplier(s);
                          setShowModal(true);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            onPageChange={(p) => fetchSuppliers(p)}
            page={pagination.page}
            totalPages={pagination.totalPages}
          />
        </div>
      )}

      {showModal && (
        <SupplierModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            fetchSuppliers(pagination.page);
          }}
          supplier={selectedSupplier}
        />
      )}
    </div>
  );
}
