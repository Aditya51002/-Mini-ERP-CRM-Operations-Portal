import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function getErrorMessage(error) {
  return error.response?.data?.error?.message || "Login failed";
}

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const redirectTo = location.state?.from?.pathname || "/dashboard";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
      <section className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-normal text-workgreen">
            Wholesale Operations
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-normal text-ink sm:text-5xl">
            Mini ERP + CRM Operations Portal
          </h1>
          <div className="mt-8 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div className="border-l-4 border-workgreen bg-white p-4">Customers and follow-ups</div>
            <div className="border-l-4 border-slate-500 bg-white p-4">Products and stock</div>
            <div className="border-l-4 border-workamber bg-white p-4">Sales challans</div>
            <div className="border-l-4 border-workred bg-white p-4">Role-aware operations</div>
          </div>
        </div>

        <form className="panel p-6 shadow-sm" onSubmit={handleSubmit}>
          <h2 className="text-xl font-bold tracking-normal text-ink">Login</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              <span>Email</span>
              <input
                className="control"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              <span>Password</span>
              <input
                className="control"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
                required
              />
            </label>
          </div>

          {error && <p className="mt-4 text-sm font-medium text-workred">{error}</p>}

          <button className="primary-button mt-5 w-full" disabled={busy} type="submit">
            {busy ? "Signing in" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
