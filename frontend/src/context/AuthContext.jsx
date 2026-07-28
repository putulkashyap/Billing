import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("te_user") || "null"); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("te_token");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me").then((r) => {
      setUser(r.data);
      localStorage.setItem("te_user", JSON.stringify(r.data));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    localStorage.setItem("te_token", r.data.token);
    localStorage.setItem("te_user", JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem("te_token");
    localStorage.removeItem("te_user");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, login, logout, loading, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
