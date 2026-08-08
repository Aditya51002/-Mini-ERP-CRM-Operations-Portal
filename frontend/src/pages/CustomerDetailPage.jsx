import { ArrowLeft, Edit, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import apiClient from "../api/client";
import FormField from "../components/FormField";
import { ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/errors";
import { formatDate, formatDateInput } from "../utils/format";

function canWriteCustomers(role) {
  return ["ADMIN", "SALES"].includes(role);
}

function toForm(customer) {
  return {
    name: customer.name || "",
    mobile: customer.mobile || "",
    email: customer.email || "",
    businessName: customer.businessName || "",
    gstNumber: customer.gstNumber || "",
    customerType: customer.customerType || "RETAIL",
    address: customer.address || "",
    status: customer.status || "LEAD",
    followUpDate: formatDateInput(customer.followUpDate)
  };
}

function cleanPayload(form) {
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

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const canWrite = canWriteCustomers(role);
  const [customer, setCustomer] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  async function loadCustomer() {
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get(`/customers/${id}`);
      setCustomer(response.data);
      setForm(toForm(response.data));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomer();
  }, [id]);

  async function saveCustomer(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");

    try {
      await apiClient.put(`/customers/${id}`, cleanPayload(form));
      setEditing(false);
      await loadCustomer();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");

    try {
      await apiClient.post(`/customers/${id}/notes`, { note });
      setNote("");
      await loadCustomer();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label="Loading customer" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadCustomer} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-workgreen" to="/customers">
            <ArrowLeft size={16} />
            Customers
          </Link>
          <h2 className="mt-2 text-2xl font-bold tracking-normal text-ink">{customer.name}</h2>
        </div>
        {canWrite && (
          <button className="secondary-button" onClick={() => setEditing(!editing)} type="button">
            <Edit size={18} />
            {editing ? "Cancel edit" : "Edit"}
          </button>
        )}
      </div>

      {actionError && <ErrorState message={actionError} />}

      <section className="panel p-5">
        {editing ? (
          <form className="grid gap-4" onSubmit={saveCustomer}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Name">
                <input className="control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </FormField>
              <FormField label="Mobile">
                <input className="control" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} />
              </FormField>
              <FormField label="Email">
                <input className="control" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </FormField>
              <FormField label="Business name">
                <input className="control" value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} />
              </FormField>
              <FormField label="GST number">
                <input className="control" value={form.gstNumber} onChange={(event) => setForm({ ...form, gstNumber: event.target.value })} />
              </FormField>
              <FormField label="Follow-up date">
                <input className="control" type="date" value={form.followUpDate} onChange={(event) => setForm({ ...form, followUpDate: event.target.value })} />
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
            <FormField label="Address">
              <textarea className="control min-h-24 py-2" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </FormField>
            <button className="primary-button justify-self-start" disabled={saving} type="submit">
              <Save size={18} />
              {saving ? "Saving" : "Save changes"}
            </button>
          </form>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Info label="Business" value={customer.businessName} />
            <Info label="Mobile" value={customer.mobile} />
            <Info label="Email" value={customer.email} />
            <Info label="GST number" value={customer.gstNumber} />
            <Info label="Type" value={customer.customerType} />
            <Info label="Status" value={customer.status} />
            <Info label="Follow-up" value={formatDate(customer.followUpDate)} />
            <Info label="Address" value={customer.address} wide />
          </div>
        )}
      </section>

      <section className="panel p-5">
        <h3 className="font-bold text-ink">Follow-up notes</h3>
        {canWrite && (
          <form className="mt-4 grid gap-3" onSubmit={addNote}>
            <textarea className="control min-h-24 py-2" placeholder="Add a note" value={note} onChange={(event) => setNote(event.target.value)} required />
            <button className="primary-button justify-self-start" disabled={saving} type="submit">
              Add note
            </button>
          </form>
        )}
        <div className="mt-5 grid gap-3">
          {customer.notes.length === 0 && <p className="text-sm text-slate-500">No notes yet</p>}
          {customer.notes.map((item) => (
            <article className="border border-slate-200 bg-slate-50 p-3" key={item.id} style={{ borderRadius: 6 }}>
              <p className="text-sm text-slate-800">{item.note}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">
                {item.author.name} · {formatDate(item.createdAt)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="font-bold text-ink">Challan history</h3>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[620px]">
            <thead className="table-head">
              <tr>
                <th className="px-3 py-3">Number</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Quantity</th>
                <th className="px-3 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {customer.challanHistory.length === 0 && (
                <tr><td className="table-cell text-slate-500" colSpan={4}>No challans yet</td></tr>
              )}
              {customer.challanHistory.map((challan) => (
                <tr key={challan.id}>
                  <td className="table-cell font-semibold">{challan.challanNumber}</td>
                  <td className="table-cell">{challan.status}</td>
                  <td className="table-cell">{challan.totalQuantity}</td>
                  <td className="table-cell">{formatDate(challan.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value, wide }) {
  return (
    <div className={wide ? "md:col-span-2 xl:col-span-3" : ""}>
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-ink">{value || "-"}</p>
    </div>
  );
}
