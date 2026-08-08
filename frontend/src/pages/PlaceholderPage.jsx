import { useAuth } from "../context/AuthContext";

const actionCopy = {
  "/customers": {
    title: "Customers",
    body: "Read customer records, notes, and challan history."
  },
  "/customers/new": {
    title: "New Customer",
    body: "Create and update customer records."
  },
  "/products": {
    title: "Products",
    body: "Read product catalog, stock levels, and low-stock status."
  },
  "/products/manage": {
    title: "Product Maintenance",
    body: "Create products and update product details."
  },
  "/stock": {
    title: "Stock Movements",
    body: "Review product movement logs."
  },
  "/stock/adjust": {
    title: "Stock Adjustment",
    body: "Create manual IN and OUT stock movements."
  },
  "/challans": {
    title: "Challans",
    body: "Read sales challans and their item snapshots."
  },
  "/challans/actions": {
    title: "Create / Confirm Challan",
    body: "Create drafts, confirm stock deductions, and cancel challans."
  }
};

export default function PlaceholderPage({ route }) {
  const { role } = useAuth();
  const copy = actionCopy[route] || {
    title: "Workspace",
    body: "Operations workspace"
  };

  return (
    <section className="panel p-5">
      <p className="text-sm font-semibold uppercase tracking-normal text-workgreen">{role}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-normal text-ink">{copy.title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{copy.body}</p>
    </section>
  );
}
