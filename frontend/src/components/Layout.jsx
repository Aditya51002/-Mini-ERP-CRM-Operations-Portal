import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  PackagePlus,
  UserPlus,
  Users
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const navItems = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    roles: ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"]
  },
  {
    label: "Customers",
    path: "/customers",
    icon: Users,
    roles: ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"]
  },
  {
    label: "New Customer",
    path: "/customers/new",
    icon: UserPlus,
    roles: ["ADMIN", "SALES"]
  },
  {
    label: "Products",
    path: "/products",
    icon: Package,
    roles: ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"]
  },
  {
    label: "Product Maintenance",
    path: "/products/manage",
    icon: PackagePlus,
    roles: ["ADMIN", "WAREHOUSE"]
  },
  {
    label: "Stock Movements",
    path: "/stock",
    icon: Boxes,
    roles: ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"]
  },
  {
    label: "Stock Adjustment",
    path: "/stock/adjust",
    icon: Boxes,
    roles: ["ADMIN", "WAREHOUSE"]
  },
  {
    label: "Challans",
    path: "/challans",
    icon: ClipboardList,
    roles: ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"]
  },
  {
    label: "Create / Confirm Challan",
    path: "/challans/actions",
    icon: ClipboardCheck,
    roles: ["ADMIN", "SALES"]
  }
];

function visibleNavItems(role) {
  return navItems.filter((item) => item.roles.includes(role));
}

export default function Layout() {
  const { user, role, logout } = useAuth();
  const items = visibleNavItems(role);

  return (
    <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="bg-slatepanel text-white lg:min-h-screen">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-sm font-semibold text-teal-200">Mini ERP + CRM</p>
          <h1 className="mt-2 text-xl font-bold tracking-normal">Operations Portal</h1>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:grid">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                className={({ isActive }) =>
                  `flex h-11 min-w-fit items-center gap-3 px-3 text-sm font-semibold transition lg:w-full ${
                    isActive ? "bg-white text-ink" : "text-slate-200 hover:bg-white/10"
                  }`
                }
                key={item.path}
                style={{ borderRadius: 6 }}
                to={item.path}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-sm text-slate-500">Signed in as</p>
            <h2 className="text-xl font-bold tracking-normal text-ink">
              {user?.name || user?.email}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-semibold text-workgreen">
              {role}
            </span>
            <button className="secondary-button" onClick={logout} type="button">
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
