import { CheckCircle2, ClipboardPlus, Download, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import apiClient from "../api/client";
import FormField from "../components/FormField";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/errors";
import { formatDate, formatMoney } from "../utils/format";

function canWriteChallans(role) {
  return ["ADMIN", "SALES"].includes(role);
}

function statusBadge(status) {
  if (status === "CONFIRMED") return "border-teal-200 bg-teal-50 text-workgreen";
  if (status === "CANCELLED") return "border-red-200 bg-red-50 text-workred";
  return "border-amber-200 bg-amber-50 text-workamber";
}

function emptyLine() {
  return {
    productId: "",
    quantity: "1"
  };
}

function NewChallanModal({ customers, products, onClose, onCreated }) {
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function updateLine(index, patch) {
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line))
    );
  }

  function removeLine(index) {
    setLines((current) => current.filter((line, lineIndex) => lineIndex !== index));
  }

  function payload() {
    return {
      customerId: Number(customerId),
      items: lines.map((line) => ({
        productId: Number(line.productId),
        quantity: Number(line.quantity)
      }))
    };
  }

  async function submit(mode) {
    setBusy(true);
    setError("");

    try {
      const draft = await apiClient.post("/challans", payload());
      let challan = draft.data;

      if (mode === "confirm") {
        const confirmed = await apiClient.post(`/challans/${challan.id}/confirm`);
        challan = confirmed.data;
      }

      onCreated(challan);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New challan" onClose={onClose}>
      {error && <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-workred" style={{ borderRadius: 6 }}>{error}</div>}
      <div className="grid gap-4">
        <FormField label="Customer">
          <select className="control" value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.businessName ? `· ${customer.businessName}` : ""}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid gap-3">
          {lines.map((line, index) => (
            <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]" key={index}>
              <FormField label={`Product ${index + 1}`}>
                <select className="control" value={line.productId} onChange={(event) => updateLine(index, { productId: event.target.value })} required>
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} · {product.name} · stock {product.currentStock}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Qty">
                <input className="control" min="1" type="number" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} required />
              </FormField>
              <button className="secondary-button self-end" disabled={lines.length === 1} onClick={() => removeLine(index)} type="button">
                Remove
              </button>
            </div>
          ))}
        </div>

        <button className="secondary-button justify-self-start" onClick={() => setLines([...lines, emptyLine()])} type="button">
          Add line
        </button>

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          <button className="secondary-button" disabled={busy || !customerId} onClick={() => submit("draft")} type="button">
            {busy ? "Saving" : "Save draft"}
          </button>
          <button className="primary-button" disabled={busy || !customerId} onClick={() => submit("confirm")} type="button">
            <CheckCircle2 size={18} />
            {busy ? "Confirming" : "Save and confirm"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function ChallansPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canWrite = canWriteChallans(role);
  const [challans, setChallans] = useState([]);
  const [detail, setDetail] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const selectedId = id ? Number(id) : null;

  const selectedFromList = useMemo(
    () => challans.find((challan) => challan.id === selectedId),
    [challans, selectedId]
  );

  async function loadList(nextPage = page) {
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get("/challans", {
        params: {
          page: nextPage,
          pageSize: 20,
          status: status || undefined
        }
      });
      setChallans(response.data.items);
      setMeta(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadLookups() {
    const [customersResponse, productsResponse] = await Promise.all([
      apiClient.get("/customers?page=1&pageSize=100"),
      apiClient.get("/products?page=1&pageSize=100")
    ]);
    setCustomers(customersResponse.data.items);
    setProducts(productsResponse.data.items);
  }

  async function loadDetail(challanId) {
    if (!challanId) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    setActionError("");

    try {
      const response = await apiClient.get(`/challans/${challanId}`);
      setDetail(response.data);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadList(page);
  }, [page, status]);

  useEffect(() => {
    loadLookups().catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  useEffect(() => {
    loadDetail(selectedId);
  }, [selectedId]);

  async function refreshAfterAction(challanId = selectedId) {
    await Promise.all([loadList(page), loadDetail(challanId), loadLookups()]);
  }

  async function confirmChallan(challanId) {
    if (!window.confirm("Confirm this challan and deduct stock?")) {
      return;
    }

    setActionError("");

    try {
      await apiClient.post(`/challans/${challanId}/confirm`);
      await refreshAfterAction(challanId);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  }

  async function cancelChallan(challanId) {
    if (!window.confirm("Cancel this challan? Confirmed challans will restore stock.")) {
      return;
    }

    setActionError("");

    try {
      await apiClient.post(`/challans/${challanId}/cancel`);
      await refreshAfterAction(challanId);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  }

  async function downloadInvoice(challanId, challanNumber) {
    setDownloadingInvoice(true);
    setActionError("");

    try {
      const response = await apiClient.get(`/challans/${challanId}/invoice`, {
        responseType: "blob"
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoice-${challanNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setDownloadingInvoice(false);
    }
  }

  function handleCreated(challan) {
    setNewModalOpen(false);
    navigate(`/challans/${challan.id}`);
    refreshAfterAction(challan.id);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Sales</p>
          <h2 className="text-2xl font-bold tracking-normal text-ink">Challans</h2>
        </div>
        {canWrite && (
          <button className="primary-button" onClick={() => setNewModalOpen(true)} type="button">
            <ClipboardPlus size={18} />
            New challan
          </button>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="grid content-start gap-4">
          <form className="panel grid gap-3 p-4 md:grid-cols-[220px_auto]" onSubmit={(event) => event.preventDefault()}>
            <select className="control" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            <button className="secondary-button justify-self-start" onClick={() => loadList(1)} type="button">
              <Search size={18} />
              Refresh
            </button>
          </form>

          {loading && <LoadingState label="Loading challans" />}
          {!loading && error && <ErrorState message={error} onRetry={() => loadList(page)} />}
          {!loading && !error && challans.length === 0 && <EmptyState label="No challans found" />}
          {!loading && !error && challans.length > 0 && (
            <section className="panel overflow-hidden">
              <div className="overflow-auto">
                <table className="w-full min-w-[780px]">
                  <thead className="table-head">
                    <tr>
                      <th className="px-3 py-3">Number</th>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Qty</th>
                      <th className="px-3 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challans.map((challan) => (
                      <tr className={`cursor-pointer hover:bg-slate-50 ${selectedId === challan.id ? "bg-teal-50" : ""}`} key={challan.id} onClick={() => navigate(`/challans/${challan.id}`)}>
                        <td className="table-cell font-semibold">{challan.challanNumber}</td>
                        <td className="table-cell">{challan.customer?.name || challan.customerId}</td>
                        <td className="table-cell">
                          <span className={`inline-flex h-7 items-center border px-2 text-xs font-semibold ${statusBadge(challan.status)}`}>
                            {challan.status}
                          </span>
                        </td>
                        <td className="table-cell">{challan.totalQuantity}</td>
                        <td className="table-cell">{formatDate(challan.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...meta} onPageChange={setPage} />
            </section>
          )}
        </section>

        <aside className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="font-bold text-ink">Detail</h3>
          </div>
          {!selectedId && <div className="p-5 text-sm text-slate-500">Select a challan</div>}
          {selectedId && detailLoading && <div className="p-5"><LoadingState label="Loading detail" /></div>}
          {selectedId && actionError && <div className="p-4"><ErrorState message={actionError} /></div>}
          {selectedId && !detailLoading && detail && (
            <div className="grid gap-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold tracking-normal text-ink">{detail.challanNumber}</p>
                  <p className="mt-1 text-sm text-slate-500">{detail.customer?.name || detail.customerId}</p>
                </div>
                <span className={`inline-flex h-7 items-center border px-2 text-xs font-semibold ${statusBadge(detail.status)}`}>
                  {detail.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Total quantity" value={detail.totalQuantity} />
                <Info label="Created" value={formatDate(detail.createdAt)} />
              </div>

              <div className="overflow-auto">
                <table className="w-full min-w-[420px]">
                  <thead className="table-head">
                    <tr>
                      <th className="px-3 py-3">SKU</th>
                      <th className="px-3 py-3">Product</th>
                      <th className="px-3 py-3">Qty</th>
                      <th className="px-3 py-3">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td className="table-cell font-semibold">{item.skuSnapshot}</td>
                        <td className="table-cell">{item.productNameSnapshot}</td>
                        <td className="table-cell">{item.quantity}</td>
                        <td className="table-cell">{formatMoney(item.unitPriceSnapshot)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canWrite && detail.status === "DRAFT" && (
                <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                  <button className="primary-button" onClick={() => confirmChallan(detail.id)} type="button">
                    <CheckCircle2 size={18} />
                    Confirm
                  </button>
                  <button className="danger-button" onClick={() => cancelChallan(detail.id)} type="button">
                    <XCircle size={18} />
                    Cancel
                  </button>
                </div>
              )}
              {detail.status === "CONFIRMED" && (
                <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                  <button
                    className="secondary-button"
                    disabled={downloadingInvoice}
                    onClick={() => downloadInvoice(detail.id, detail.challanNumber)}
                    type="button"
                  >
                    <Download size={18} />
                    {downloadingInvoice ? "Downloading..." : "Download Invoice"}
                  </button>
                  {canWrite && (
                    <button className="danger-button" onClick={() => cancelChallan(detail.id)} type="button">
                      <XCircle size={18} />
                      Cancel and restore stock
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {newModalOpen && (
        <NewChallanModal
          customers={customers}
          products={products}
          onClose={() => setNewModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-ink">{value || "-"}</p>
    </div>
  );
}
