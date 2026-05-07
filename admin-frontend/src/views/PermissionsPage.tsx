import { useQuery } from "@tanstack/react-query";
import { useAuthedApi } from "../lib/api";

type Role = {
  key: string;
  label: string;
};

type Permission = {
  key: string;
  label: string;
};

type AccessRule = {
  title: string;
  description: string;
};

type PermissionsMatrixResponse = {
  roles?: Role[];
  permissions?: Permission[];
  matrix?: Record<string, Record<string, boolean>>;
  keyAccessRules?: AccessRule[];
};

export function PermissionsPage() {
  const api = useAuthedApi();
  const { data, isLoading } = useQuery<PermissionsMatrixResponse>({
    queryKey: ["admin", "permissionsMatrix"],
    queryFn: async () => (await api.get("/admin/permissions/matrix")).data
  });

  return (
    <div>
      <div className="pageTitle">
        <h1>Role & Permission Matrix</h1>
      </div>

      {isLoading ? <div className="muted">Loading…</div> : null}

      {data ? (
        <div className="card" style={{ padding: 14 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Role-based access control across the system
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 10px", color: "rgba(255,255,255,0.86)" }}>
                    Permission
                  </th>
                  {(data.roles ?? []).map((r) => (
                    <th
                      key={r.key}
                      style={{
                        textAlign: "center",
                        padding: "10px 10px",
                        color: "rgba(255,255,255,0.86)",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.permissions ?? []).map((p) => (
                  <tr key={p.key}>
                    <td
                      style={{
                        padding: "10px 10px",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.80)"
                      }}
                    >
                      {p.label}
                    </td>
                    {(data.roles ?? []).map((r) => {
                      const allowed = Boolean(data.matrix?.[r.key]?.[p.key]);
                      return (
                        <td
                          key={`${p.key}:${r.key}`}
                          style={{
                            textAlign: "center",
                            padding: "10px 10px",
                            borderTop: "1px solid rgba(255,255,255,0.06)"
                          }}
                        >
                          <span style={{ color: allowed ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.85)" }}>
                            {allowed ? "✓" : "✕"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ height: 14 }} />
          <div style={{ fontWeight: 850, color: "rgba(255,255,255,0.92)", marginBottom: 8 }}>
            Key Access Rules
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {(data.keyAccessRules ?? []).map((r) => (
              <div
                key={r.title}
                style={{
                  padding: "10px 10px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)"
                }}
              >
                <div style={{ fontWeight: 750, color: "rgba(255,255,255,0.90)" }}>{r.title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                  {r.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

