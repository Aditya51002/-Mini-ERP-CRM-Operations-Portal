import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiClient from "../api/client";
import FormField from "../components/FormField";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";

const initialForm = {
  name: "",
  mobile: "",
  email: "",
  businessName: "",
  gstNumber: "",
  customerType: "RETAIL",
  address: "",
  status: "LEAD",
  followUpDate: ""
};

function canWriteCustomers(role) {
  return ["ADMIN", "SALES"].includes(role);
}

function cleanCustomerPayload(form) {
  return {
    name: form.name,
    mobile: form.mobile || undefined,
    email: form.email || undefined,
    businessName: form.businessName || undefined,
    gstNumber: form.gstNumber || undefined,
    customerType: form.customerType,
    address: form.address || undefined,
    status: form.status,
    followUpDate: form.followUpDate || undefined
  };
}

function CustomerForm({ form, setForm, onSubmit, busy }) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <FormField label="Name">
        <input className="control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Mobile">
          <input className="control" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} />
        </FormField>
        <FormField label="Email">
          <input className="control" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </FormField>
      </div>
      <FormField label="Business name">
        <input className="control" value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} />
      </FormField>
      <div className="grid gap-4 md:grid-cols-3">
        <FormField label="GST number">
          <input className="control" value={form.gstNumber} onChange={(event) => setForm({ ...form, gstNumber: event.target.value })} />
        </FormField>
        <FormField label="Type">
          <select className="control" value={form.customerType} onChange={(event) => setForm({ ...form, customerType: event.target.value })}>
            <option value="RETAIL">RETAIL</option>
            <option value="WHOLESALE">WHOLESALE</option>
            <option value="DISTRIBUTOR">DISTRIBUTOR</option>
          </select>
        </FormField>
        <FormField label="Status">
          <select className="control" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="LEAD">LEAD</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </FormField>
      </div>
      <FormField label="Follow-up date">
        <input className="control" type="date" value={form.followUpDate} onChange={(event) => setForm({ ...form, followUpDate: event.target.value })} />
      </FormField>
      <FormField label="Address">
        <textarea className="control min-h-24 py-2" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
      </FormField>
      <button className="primary-button justify-self-start" disabled={busy} type="submit">
        {busy ? "Saving" : "Save customer"}
      </button>
    </form>
  );
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canWrite = canWriteCustomers(role);
  const [customers, setCustomers] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadCustomers(nextPage = page) {
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get("/customers", {
        params: {
          page: nextPage,
          pageSize: 20,
          search: search || undefined,
          status: status || undefined
        }
      });
      setCustomers(response.data.items);
      setMeta(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers(page);
  }, [page, status]);

  async function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    await loadCustomers(1);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      await apiClient.post("/customers", cleanCustomerPayload(form));
      setForm(initialForm);
      setModalOpen(false);
      setPage(1);
      await loadCustomers(1);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">CRM</p>
          <h2 className="text-2xl font-bold tracking-normal text-ink">Customers</h2>
        </div>
        {canWrite && (
          <button className="primary-button" onClick={() => setModalOpen(true)} type="button">
            <Plus size={18} />
            Add customer
          </button>
        )}
      </div>

      <form className="panel grid gap-3 p-4 md:grid-cols-[1fr_180px_auto]" onSubmit={handleSearch}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input className="control pl-10" placeholder="Search name, mobile, business" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select className="control" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="LEAD">LEAD</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
        <button className="secondary-button" type="submit">Search</button>
      </form>

      {loading && <LoadingState label="Loading customers" />}
      {!loading && error && <ErrorState message={error} onRetry={() => loadCustomers(page)} />}
      {!loading && !error && customers.length === 0 && <EmptyState label="No customers found" />}
      {!loading && !error && customers.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full min-w-[900px]">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Business</th>
                  <th className="px-3 py-3">Mobile</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr className="cursor-pointer hover:bg-slate-50" key={customer.id} onClick={() => navigate(`/customers/${customer.id}`)}>
                    <td className="table-cell font-semibold">{customer.name}</td>
                    <td className="table-cell">{customer.businessName || "-"}</td>
                    <td className="table-cell">{customer.mobile || "-"}</td>
                    <td className="table-cell">{customer.customerType}</td>
                    <td className="table-cell">{customer.status}</td>
                    <td className="table-cell">{formatDate(customer.followUpDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...meta} onPageChange={setPage} />
        </section>
      )}

      {modalOpen && (
        <Modal title="Add customer" onClose={() => setModalOpen(false)}>
          {formError && <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-workred" style={{ borderRadius: 6 }}>{formError}</div>}
          <CustomerForm form={form} setForm={setForm} onSubmit={handleCreate} busy={busy} />
        </Modal>
      )}
    </div>
  );
}
