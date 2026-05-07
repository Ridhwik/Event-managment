import { useQuery } from "@tanstack/react-query";
import { useAuthedApi } from "../lib/api";
import "../App.css";

function formatINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₹${n}`;
  }
}

type RecentActivityItem = {
  id: string;
  initials?: string;
  entityName?: string;
  detailLine?: string;
  amount?: number;
  status?: string;
};

type DashboardOverviewResponse = {
  activeEvents?: number;
  totalSpent?: number;
  bills?: { total?: number; pending?: number };
  paymentRequests?: { total?: number; pending?: number };
  recentActivity?: RecentActivityItem[];
};

const statusMeta: Record<string, { cls: string; label: string }> = {
  pending: { cls: "dp-status--pending", label: "Pending" },
  approved: { cls: "dp-status--approved", label: "Approved" },
  rejected: { cls: "dp-status--rejected", label: "Rejected" },
  paid: { cls: "dp-status--paid", label: "Paid" },
};
function getStatus(s?: string) {
  const key = (s ?? "").toLowerCase();
  return statusMeta[key] ?? { cls: "dp-status--default", label: (s ?? "—").toUpperCase() };
}

export function DashboardPage() {
  const api = useAuthedApi();
  const { data, isLoading, error } = useQuery<DashboardOverviewResponse>({
    queryKey: ["admin", "dashboard", "overview"],
    queryFn: async () => (await api.get("/admin/dashboard/overview")).data,
  });

  const stats = [
    {
      key: "events",
      label: "Active Events",
      value: data?.activeEvents ?? 0,
      sub: null,
      icon: "🚀",
      gradient: "linear-gradient(135deg,#7c3aed,#4f46e5)",
      glow: "rgba(124,58,237,0.35)",
      bar: "linear-gradient(90deg,#7c3aed,#4f46e5)",
    },
    {
      key: "bills",
      label: "Total Bills",
      value: data?.bills?.total ?? 0,
      sub: `${data?.bills?.pending ?? 0} pending`,
      icon: "🧾",
      gradient: "linear-gradient(135deg,#d97706,#f59e0b)",
      glow: "rgba(217,119,6,0.35)",
      bar: "linear-gradient(90deg,#d97706,#f59e0b)",
    },
    {
      key: "spent",
      label: "Total Spent",
      value: formatINR(data?.totalSpent ?? 0),
      sub: null,
      icon: "💸",
      gradient: "linear-gradient(135deg,#059669,#10b981)",
      glow: "rgba(5,150,105,0.35)",
      bar: "linear-gradient(90deg,#059669,#10b981)",
    },
    {
      key: "pay",
      label: "Pay Requests",
      value: data?.paymentRequests?.total ?? 0,
      sub: `${data?.paymentRequests?.pending ?? 0} pending`,
      icon: "💰",
      gradient: "linear-gradient(135deg,#2563eb,#06b6d4)",
      glow: "rgba(37,99,235,0.35)",
      bar: "linear-gradient(90deg,#2563eb,#06b6d4)",
    },
  ];

  return (
    <div className="dp-root">

      {/* ── HEADER ── */}
      <div className="dp-header">
        <div>
          <div className="dp-header__tag">📊 Overview</div>
          <h1 className="dp-header__title">Admin Dashboard</h1>
          <p className="dp-header__sub">
            Real-time snapshot of your events, spend, and activity.
          </p>
        </div>
        <div className="dp-header__chip">
          <span className="dp-header__chip-dot" />
          {new Date().toLocaleDateString("en-IN", {
            weekday: "short", day: "2-digit",
            month: "short", year: "numeric",
          })}
        </div>
      </div>

      {/* ── LOADING / ERROR ── */}
      {isLoading && (
        <div className="dp-states">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="dp-stat dp-stat--skeleton" key={i}>
              <div className="dp-skel dp-skel--icon" />
              <div className="dp-skel dp-skel--val" />
              <div className="dp-skel dp-skel--lbl" />
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="dp-error-banner">
          <span>⚠️</span> Failed to load dashboard data. Please try again.
        </div>
      )}

      {data && (
        <>
          {/* ── STATS ── */}
          <div className="dp-stats">
            {stats.map((s) => (
              <div
                className="dp-stat"
                key={s.key}
                style={{ "--glow": s.glow } as React.CSSProperties}
              >
                {/* background radial */}
                <div className="dp-stat__bg" style={{ background: `radial-gradient(circle at 85% 15%, ${s.glow}, transparent 65%)` }} />

                <div className="dp-stat__top">
                  <div className="dp-stat__icon" style={{ background: s.gradient }}>
                    {s.icon}
                  </div>
                  <div className="dp-stat__live">● LIVE</div>
                </div>

                <div className="dp-stat__val">{s.value}</div>
                <div className="dp-stat__lbl">{s.label}</div>
                {s.sub && <div className="dp-stat__sub">{s.sub}</div>}

                <div className="dp-stat__bar" style={{ background: s.bar }} />
              </div>
            ))}
          </div>

          {/* ── CONTENT GRID ── */}
          <div className="dp-grid">

            {/* Recent Activity */}
            <section className="dp-panel dp-panel--activity">
              <div className="dp-panel__head">
                <div className="dp-panel__head-left">
                  <div className="dp-panel__icon">⚡</div>
                  <div>
                    <h2 className="dp-panel__title">Recent Activity</h2>
                    <p className="dp-panel__sub">
                      Latest {data.recentActivity?.length ?? 0} transactions
                    </p>
                  </div>
                </div>
                <span className="dp-panel__chip">
                  {data.recentActivity?.length ?? 0} items
                </span>
              </div>

              <div className="dp-panel__body">
                {(data.recentActivity ?? []).length === 0 ? (
                  <EmptyState label="No activity yet" />
                ) : (
                  (data.recentActivity ?? []).map((a, idx) => {
                    const st = getStatus(a.status);
                    return (
                      <div className="dp-act-row" key={a.id}
                        style={{ animationDelay: `${idx * 0.06}s` }}>
                        <div className="dp-act-row__avatar">
                          {a.initials ?? "?"}
                        </div>
                        <div className="dp-act-row__mid">
                          <div className="dp-act-row__name">{a.entityName}</div>
                          <div className="dp-act-row__detail">{a.detailLine}</div>
                        </div>
                        <div className="dp-act-row__right">
                          <div className="dp-act-row__amount">
                            {formatINR(a.amount ?? 0)}
                          </div>
                          <span className={`dp-status ${st.cls}`}>
                            {st.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Summary cards */}
            <div className="dp-side">

              {/* Bills breakdown */}
              <div className="dp-mini-card">
                <div className="dp-mini-card__head">
                  <span className="dp-mini-card__ico">🧾</span>
                  <span className="dp-mini-card__title">Bills Breakdown</span>
                </div>
                <div className="dp-mini-card__rows">
                  <MiniRow label="Total Bills" value={String(data.bills?.total ?? 0)} color="#f59e0b" />
                  <MiniRow label="Pending" value={String(data.bills?.pending ?? 0)} color="#ef4444" />
                  <MiniRow label="Processed"
                    value={String((data.bills?.total ?? 0) - (data.bills?.pending ?? 0))}
                    color="#10b981"
                  />
                </div>
                {/* mini progress */}
                <div className="dp-progress">
                  <div
                    className="dp-progress__fill"
                    style={{
                      width: data.bills?.total
                        ? `${(((data.bills.total - (data.bills.pending ?? 0)) / data.bills.total) * 100).toFixed(0)}%`
                        : "0%",
                      background: "linear-gradient(90deg,#7c3aed,#10b981)",
                    }}
                  />
                </div>
                <div className="dp-progress__label">
                  {data.bills?.total
                    ? `${(((data.bills.total - (data.bills.pending ?? 0)) / data.bills.total) * 100).toFixed(0)}% processed`
                    : "No data"}
                </div>
              </div>

              {/* Payment breakdown */}
              <div className="dp-mini-card">
                <div className="dp-mini-card__head">
                  <span className="dp-mini-card__ico">💰</span>
                  <span className="dp-mini-card__title">Payments Breakdown</span>
                </div>
                <div className="dp-mini-card__rows">
                  <MiniRow label="Total Requests" value={String(data.paymentRequests?.total ?? 0)} color="#60a5fa" />
                  <MiniRow label="Pending" value={String(data.paymentRequests?.pending ?? 0)} color="#ef4444" />
                  <MiniRow label="Settled"
                    value={String((data.paymentRequests?.total ?? 0) - (data.paymentRequests?.pending ?? 0))}
                    color="#10b981"
                  />
                </div>
                <div className="dp-progress">
                  <div
                    className="dp-progress__fill"
                    style={{
                      width: data.paymentRequests?.total
                        ? `${((((data.paymentRequests.total - (data.paymentRequests.pending ?? 0)) / data.paymentRequests.total) * 100)).toFixed(0)}%`
                        : "0%",
                      background: "linear-gradient(90deg,#2563eb,#06b6d4)",
                    }}
                  />
                </div>
                <div className="dp-progress__label">
                  {data.paymentRequests?.total
                    ? `${((((data.paymentRequests.total - (data.paymentRequests.pending ?? 0)) / data.paymentRequests.total) * 100)).toFixed(0)}% settled`
                    : "No data"}
                </div>
              </div>

              {/* Total spend highlight */}
              <div className="dp-spend-card">
                <div className="dp-spend-card__bg" />
                <div className="dp-spend-card__label">Total Spend</div>
                <div className="dp-spend-card__value">
                  {formatINR(data.totalSpent ?? 0)}
                </div>
                <div className="dp-spend-card__sub">
                  Across {data.activeEvents ?? 0} active event{data.activeEvents !== 1 ? "s" : ""}
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* helpers */
function MiniRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="dp-mini-row">
      <div className="dp-mini-row__left">
        <span className="dp-mini-row__dot" style={{ background: color }} />
        <span className="dp-mini-row__lbl">{label}</span>
      </div>
      <span className="dp-mini-row__val" style={{ color }}>{value}</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="dp-empty">
      <div className="dp-empty__ico">🗂️</div>
      <div className="dp-empty__txt">{label}</div>
    </div>
  );
}