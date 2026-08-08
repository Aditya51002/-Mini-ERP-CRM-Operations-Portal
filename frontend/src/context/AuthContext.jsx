import { createContext, useContext, useMemo, useState } from "react";

import apiClient from "../api/client";

const AuthContext = createContext(null);

function readStoredUser() {
  const rawUser = localStorage.getItem("mini_erp_user");

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    localStorage.removeItem("mini_erp_user");
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("mini_erp_token"));
  const [user, setUser] = useState(() => readStoredUser());

  async function login(email, password) {
    const response = await apiClient.post("/auth/login", {
      email,
      password
    });
    const nextToken = response.data.token;
    const nextUser = response.data.user;

    localStorage.setItem("mini_erp_token", nextToken);
    localStorage.setItem("mini_erp_user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);

    return nextUser;
  }

  function logout() {
    localStorage.removeItem("mini_erp_token");
    localStorage.removeItem("mini_erp_user");
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      token,
      role: user?.role || null,
      isAuthenticated: Boolean(token && user),
      login,
      logout
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
