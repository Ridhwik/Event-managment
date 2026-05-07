import { useQuery } from "@tanstack/react-query";
import { useAuthedApi } from "../lib/api";

function formatINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(n);
  } catch {
    return `₹${n}`;
  }
}

type SettlementRow = {
  user?: {
    id?: string;
    initials?: string;
    name?: string;
  };
  balances?: {
    payableToEmployee?: number;
    receivableFromEmployee?: number;
  };
  status?: string;
};

type AccountsOverviewResponse = {
  totals?: {
    payableToEmployees?: number;
    receivableFromEmployees?: number;
    pendingApprovals?: number;
  };
  employeeSettlement?: SettlementRow[];
};

export function AccountsPage() {
  const api = useAuthedApi();
  const { data, isLoading } = useQuery<AccountsOverviewResponse>({
    queryKey: ["admin", "accountsOverview"],
    queryFn: async () => (await api.get("/admin/accounts/overview")).data
  });

  return (
    <div>
      <div className="pageTitle">
        <h1>Accounts & Settlements</h1>
      </div>

      {isLoading ? <div className="muted">Loading…</div> : null}

      {data ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
              marginBottom: 14
            }}
          >
            <div className="card" style={{ padding: 14 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                PAYABLE TO EMPLOYEES
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.92)", marginTop: 6 }}>
                {formatINR(data.totals?.payableToEmployees ?? 0)}
              </div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                RECEIVABLE FROM EMPLOYEES
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.92)", marginTop: 6 }}>
                {formatINR(data.totals?.receivableFromEmployees ?? 0)}
              </div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                PENDING APPROVALS
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.92)", marginTop: 6 }}>
                {data.totals?.pendingApprovals ?? 0}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 850, color: "rgba(255,255,255,0.92)", marginBottom: 10 }}>
              Employee Settlement
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {(data.employeeSettlement ?? []).map((row) => (
                <div
                  key={row.user?.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 10px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 14
                  }}
                >
                  <div className="whoAvatar">{row.user?.initials ?? "?"}</div>
                  <div>
                    <div style={{ fontWeight: 850, color: "rgba(255,255,255,0.92)" }}>
                      {row.user?.name}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Owed: {formatINR(row.balances?.payableToEmployee ?? 0)} • Return:{" "}
                      {formatINR(row.balances?.receivableFromEmployee ?? 0)}
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 12, textAlign: "right" }}>
                    {row.status === "settled" ? "Settled" : "Open"}
                  </div>
                </div>
              ))}
              {(!data.employeeSettlement || data.employeeSettlement.length === 0) && (
                <div className="muted">No team balances.</div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

