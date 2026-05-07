import axios from "axios";
import { useMemo } from "react";
import { useAuth } from "../state/auth";

export function useAuthedApi() {
  const { token, logout } = useAuth();
  return useMemo(() => {
    const client = axios.create({
      baseURL: "/api",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });

    client.interceptors.response.use(
      (r) => r,
      (err) => {
        if (err?.response?.status === 401) {
          logout();
        }
        return Promise.reject(err);
      }
    );

    return client;
  }, [token, logout]);
}

