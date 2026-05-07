/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useState } from "react";

export type AdminProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type StaffProfile = {
  id: string;
  name: string;
  email: string;
  role: "director" | "teamLeader" | string;
};

export type AuthKind = "admin" | "staff" | "employee";

type AuthState = {
  token: string | null;
  authKind: AuthKind | null;
  admin: AdminProfile | null;
  user: StaffProfile | null;
  setAuthAdmin: (token: string, admin: AdminProfile) => void;
  setAuthStaff: (token: string, user: StaffProfile) => void;
  setAuthEmployee: (token: string, user: StaffProfile) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY_V2 = "eventco_auth_v2";
const STORAGE_KEY_V1 = "eventco_admin_auth_v1";

function readStored(): {
  token: string | null;
  authKind: AuthKind | null;
  admin: AdminProfile | null;
  user: StaffProfile | null;
} {
  try {
    const raw2 = localStorage.getItem(STORAGE_KEY_V2);
    if (raw2) {
      const parsed = JSON.parse(raw2) as {
        token?: string;
        authKind?: AuthKind;
        admin?: AdminProfile;
        user?: StaffProfile;
      };
      const token = parsed.token ?? null;
      let authKind: AuthKind | null = parsed.authKind ?? null;
      if (token && !authKind) {
        if (parsed.admin) authKind = "admin";
        else if (parsed.user) {
          authKind = parsed.user.role === "employee" ? "employee" : "staff";
        }
      }
      if (token && authKind === "staff" && parsed.user?.role === "employee") {
        authKind = "employee";
      }
      return {
        token,
        authKind,
        admin: parsed.admin ?? null,
        user: parsed.user ?? null
      };
    }
    const raw1 = localStorage.getItem(STORAGE_KEY_V1);
    if (raw1) {
      const parsed = JSON.parse(raw1) as { token?: string; admin?: AdminProfile };
      if (parsed.token && parsed.admin) {
        return {
          token: parsed.token,
          authKind: "admin",
          admin: parsed.admin,
          user: null
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { token: null, authKind: null, admin: null, user: null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const stored = readStored();
  const [token, setToken] = useState<string | null>(stored.token);
  const [authKind, setAuthKind] = useState<AuthKind | null>(stored.authKind);
  const [admin, setAdmin] = useState<AdminProfile | null>(stored.admin);
  const [user, setUser] = useState<StaffProfile | null>(stored.user);

  const persist = (
    nextToken: string | null,
    nextKind: AuthKind | null,
    nextAdmin: AdminProfile | null,
    nextUser: StaffProfile | null
  ) => {
    localStorage.removeItem(STORAGE_KEY_V1);
    if (!nextToken) {
      localStorage.removeItem(STORAGE_KEY_V2);
      return;
    }
    localStorage.setItem(
      STORAGE_KEY_V2,
      JSON.stringify({
        token: nextToken,
        authKind: nextKind,
        admin: nextKind === "admin" ? nextAdmin : null,
        user: nextKind === "staff" || nextKind === "employee" ? nextUser : null
      })
    );
  };

  const value = useMemo<AuthState>(
    () => ({
      token,
      authKind,
      admin,
      user,
      setAuthAdmin(nextToken, nextAdmin) {
        setToken(nextToken);
        setAuthKind("admin");
        setAdmin(nextAdmin);
        setUser(null);
        persist(nextToken, "admin", nextAdmin, null);
      },
      setAuthStaff(nextToken, nextUser) {
        setToken(nextToken);
        setAuthKind("staff");
        setAdmin(null);
        setUser(nextUser);
        persist(nextToken, "staff", null, nextUser);
      },
      setAuthEmployee(nextToken, nextUser) {
        setToken(nextToken);
        setAuthKind("employee");
        setAdmin(null);
        setUser(nextUser);
        persist(nextToken, "employee", null, nextUser);
      },
      logout() {
        setToken(null);
        setAuthKind(null);
        setAdmin(null);
        setUser(null);
        persist(null, null, null, null);
      }
    }),
    [token, authKind, admin, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
