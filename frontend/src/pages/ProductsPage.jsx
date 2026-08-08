import { PackagePlus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import apiClient from "../api/client";
import FormField from "../components/FormField";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/errors";
import { formatMoney } from "../utils/format";

const initialProductForm = {
  name: "",
  sku: "",
  category: "",
  unitPrice: "",
  currentStock: "0",
  minStockAlert: "0",
  location: ""
};

const initialStockForm = {
  quantity: "1",
  movementType: "IN",
  reason: ""
};

function canWriteProducts(role) {
  return ["ADMIN", "WAREHOUSE"].includes(role);
}

function cleanProductPayload(form) {
  return {
    name: form.name,
    sku: form.sku,
    category: form.category || undefined,
    unitPrice: Number(form.unitPrice),
    currentStock: Number(form.currentStock || 0),
    minStockAlert: Number(form.minStockAlert || 0),
    location: form.location || undefined
  };
}

export default function ProductsPage() {
  const { role } = useAuth();
  const canWrite = canWriteProducts(role);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState(null);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [stockForm, setStockForm] = useState(initialStockForm);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadProducts(nextPage = page) {
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get("/products", {
        params: {
          page: nextPage,
          pageSize: 20,
          search: search || undefined
        }
      });
      setProducts(response.data.items);
      setMeta(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts(page);
  }, [page]);

  async function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    await loadProducts(1);
  }

  async function createProduct(event) {
    event.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      await apiClient.post("/products", cleanProductPayload(productForm));
      setProductForm(initialProductForm);
      setProductModalOpen(false);
      setPage(1);
      await loadProducts(1);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function adjustStock(event) {
    event.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      await apiClient.post(`/products/${stockProduct.id}/stock`, {
        quantity: Number(stockForm.quantity),
        movementType: stockForm.movementType,
        reason: stockForm.reason
      });
      setStockForm(initialStockForm);
      setStockProduct(null);
      await loadProducts(page);
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
          <p className="text-sm font-medium text-slate-500">Inventory</p>
          <h2 className="text-2xl font-bold tracking-normal text-ink">Products</h2>
        </div>
        {canWrite && (
          <button className="primary-button" onClick={() => setProductModalOpen(true)} type="button">
            <PackagePlus size={18} />
            Add product
          </button>
        )}
      </div>

      <form className="panel grid gap-3 p-4 md:grid-cols-[1fr_auto]" onSubmit={handleSearch}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input className="control pl-10" placeholder="Search name, SKU, category" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <button className="secondary-button" type="submit">Search</button>
      </form>

      {loading && <LoadingState label="Loading products" />}
      {!loading && error && <ErrorState message={error} onRetry={() => loadProducts(page)} />}
      {!loading && !error && products.length === 0 && <EmptyState label="No products found" />}
      {!loading && !error && products.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full min-w-[980px]">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Price</th>
                  <th className="px-3 py-3">Stock</th>
                  <th className="px-3 py-3">Alert</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr className={product.lowStock ? "bg-amber-50" : ""} key={product.id}>
                    <td className="table-cell font-semibold">{product.sku}</td>
                    <td className="table-cell">{product.name}</td>
                    <td className="table-cell">{product.category || "-"}</td>
                    <td className="table-cell">{formatMoney(product.unitPrice)}</td>
                    <td className="table-cell">{product.currentStock}</td>
                    <td className="table-cell">{product.minStockAlert}</td>
                    <td className="table-cell">{product.location || "-"}</td>
                    <td className="table-cell">
                      {canWrite ? (
                        <button className="secondary-button h-9" onClick={() => setStockProduct(product)} type="button">
                          <SlidersHorizontal size={16} />
                          Adjust stock
                        </button>
                      ) : (
                        <span className="text-sm text-slate-500">Read only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...meta} onPageChange={setPage} />
        </section>
      )}

      {productModalOpen && (
        <Modal title="Add product" onClose={() => setProductModalOpen(false)}>
          {formError && <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-workred" style={{ borderRadius: 6 }}>{formError}</div>}
          <form className="grid gap-4" onSubmit={createProduct}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Name">
                <input className="control" value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} required />
              </FormField>
              <FormField label="SKU">
                <input className="control" value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} required />
              </FormField>
              <FormField label="Category">
                <input className="control" value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} />
              </FormField>
              <FormField label="Unit price">
                <input className="control" min="0" step="0.01" type="number" value={productForm.unitPrice} onChange={(event) => setProductForm({ ...productForm, unitPrice: event.target.value })} required />
              </FormField>
              <FormField label="Current stock">
                <input className="control" min="0" type="number" value={productForm.currentStock} onChange={(event) => setProductForm({ ...productForm, currentStock: event.target.value })} />
              </FormField>
              <FormField label="Min stock alert">
                <input className="control" min="0" type="number" value={productForm.minStockAlert} onChange={(event) => setProductForm({ ...productForm, minStockAlert: event.target.value })} />
              </FormField>
              <FormField label="Location">
                <input className="control" value={productForm.location} onChange={(event) => setProductForm({ ...productForm, location: event.target.value })} />
              </FormField>
            </div>
            <button className="primary-button justify-self-start" disabled={busy} type="submit">
              {busy ? "Saving" : "Save product"}
            </button>
          </form>
        </Modal>
      )}

      {stockProduct && (
        <Modal title={`Adjust stock · ${stockProduct.sku}`} onClose={() => setStockProduct(null)}>
          {formError && <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-workred" style={{ borderRadius: 6 }}>{formError}</div>}
          <form className="grid gap-4" onSubmit={adjustStock}>
            <p className="text-sm text-slate-600">Current stock: <span className="font-semibold text-ink">{stockProduct.currentStock}</span></p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Movement type">
                <select className="control" value={stockForm.movementType} onChange={(event) => setStockForm({ ...stockForm, movementType: event.target.value })}>
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
              </FormField>
              <FormField label="Quantity">
                <input className="control" min="1" type="number" value={stockForm.quantity} onChange={(event) => setStockForm({ ...stockForm, quantity: event.target.value })} required />
              </FormField>
            </div>
            <FormField label="Reason">
              <input className="control" value={stockForm.reason} onChange={(event) => setStockForm({ ...stockForm, reason: event.target.value })} required />
            </FormField>
            <button className="primary-button justify-self-start" disabled={busy} type="submit">
              {busy ? "Saving" : "Save movement"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
