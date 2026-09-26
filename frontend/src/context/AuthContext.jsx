import { createContext, useContext, useMemo, useState } from "react";

import apiClient from "../api/client";
import { API_PATHS, STORAGE_KEYS } from "../constants/app";

const AuthContext = createContext(null);

function readStoredUser() {
  const rawUser = localStorage.getItem(STORAGE_KEYS.USER);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    localStorage.removeItem(STORAGE_KEYS.USER);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEYS.TOKEN));
  const [user, setUser] = useState(() => readStoredUser());

  async function login(email, password) {
    const response = await apiClient.post(API_PATHS.AUTH_LOGIN, {
      email,
      password
    });
    const nextToken = response.data.token;
    const nextUser = response.data.user;

    localStorage.setItem(STORAGE_KEYS.TOKEN, nextToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);

    return nextUser;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
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
