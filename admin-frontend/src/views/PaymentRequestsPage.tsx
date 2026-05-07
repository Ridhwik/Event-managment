import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TASK_CATEGORY_LABELS, type TaskCategory } from "../constants/taskCategories";
import { useAuthedApi } from "../lib/api";

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

const tabs: Array<{ key: string; label: string; status?: string; color: string }> = [
  { key: "all", label: "All", color: "#818cf8" },
  { key: "pending", label: "Pending", status: "pending", color: "#fbbf24" },
  { key: "approved", label: "Approved", status: "approved", color: "#34d399" },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending: { label: "PENDING", color: "#fbbf24", bg: "rgba(251,191,36,0.12)", dot: "#fbbf24" },
  approved: { label: "APPROVED", color: "#34d399", bg: "rgba(52,211,153,0.12)", dot: "#34d399" },
  rejected: { label: "REJECTED", color: "#f87171", bg: "rgba(248,113,113,0.12)", dot: "#f87171" },
};

type PaymentRequestItem = {
  _id: string;
  initials?: string;
  title?: string;
  amount?: number;
  status?: string;
  category?: string;
  submittedBy?: { name?: string };
  event?: { activityName?: string };
};

type PaymentRequestsResponse = {
  paymentRequests?: PaymentRequestItem[];
};

/* ─── tiny CSS-in-JS helper ─────────────────────────────────────────── */
const style = (obj: React.CSSProperties): React.CSSProperties => obj;

export function PaymentRequestsPage() {
  const api = useAuthedApi();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const selected = useMemo(() => tabs.find((t) => t.key === tab), [tab]);

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [popup, setPopup] = useState<{
    kind: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const { data, isLoading } = useQuery<PaymentRequestsResponse>({
    queryKey: ["admin", "paymentRequests", selected?.status ?? "all"],
    queryFn: async () =>
      (
        await api.get("/admin/payment-requests", {
          params: selected?.status ? { status: selected.status } : undefined,
        })
      ).data,
  });

  const items = data?.paymentRequests ?? [];

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      setLoadingId(id);
      await api.patch(`/admin/payment-requests/${id}/review`, { status });
    },
    onSuccess: async (_data, vars) => {
      setLoadingId(null);
      setPopup({
        kind: "success",
        title: vars.status === "approved" ? "✅ Request Approved" : "🚫 Request Rejected",
        message:
          vars.status === "approved"
            ? "The payment request has been approved successfully."
            : "The payment request has been rejected.",
      });
      setTimeout(() => setPopup(null), 3000);
      await qc.invalidateQueries({ queryKey: ["admin", "paymentRequests"] });
      await qc.invalidateQueries({ queryKey: ["admin", "dashboard", "overview"] });
    },
    onError: (e: unknown) => {
      setLoadingId(null);
      const msg =
        typeof e === "object" &&
          e &&
          "response" in e &&
          typeof (e as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (e as { response: { data: { message: string } } }).response.data.message
          : "Could not update payment request";
      setPopup({ kind: "error", title: "⚠️ Action Failed", message: msg });
      setTimeout(() => setPopup(null), 3500);
    },
  });

  /* ── total for current view ── */
  const total = items.reduce((s, p) => s + (p.amount ?? 0), 0);
  const pendingCount = items.filter((p) => p.status === "pending").length;

  return (
    <>
      {/* ── global keyframes injected once ── */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .pr-card {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .pr-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 48px rgba(0,0,0,0.45) !important;
        }
        .pr-tab-btn {
          transition: background 0.15s, color 0.15s, box-shadow 0.15s, transform 0.12s;
        }
        .pr-tab-btn:hover:not(.active) {
          background: rgba(255,255,255,0.07) !important;
          transform: translateY(-1px);
        }
        .pr-action-btn {
          transition: background 0.15s, transform 0.12s, box-shadow 0.15s, opacity 0.15s;
        }
        .pr-action-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .pr-action-btn:active:not(:disabled) {
          transform: scale(0.97);
        }
        .pr-action-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .skeleton-line {
          border-radius: 6px;
          background: linear-gradient(90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.10) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 400px 100%;
          animation: shimmer 1.4s infinite linear;
        }
      `}</style>

      <div style={style({ maxWidth: 780, margin: "0 auto", padding: "0 4px" })}>

        {/* ── Page Header ── */}
        <div style={style({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 28,
        })}>
          <div>
            <h1 style={style({
              margin: 0,
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: "-0.5px",
              background: "linear-gradient(135deg, #fff 30%, #a5b4fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            })}>
              Payment Requests
            </h1>
            <p style={style({ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.45)" })}>
              Review and manage all incoming payment requests
            </p>
          </div>

          {/* summary pill */}
          {!isLoading && items.length > 0 && (
            <div style={style({
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            })}>
              <SummaryPill label="Total" value={String(items.length)} color="#818cf8" />
              {pendingCount > 0 && (
                <SummaryPill label="Pending" value={String(pendingCount)} color="#fbbf24" />
              )}
              <SummaryPill label="Sum" value={formatINR(total)} color="#34d399" />
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={style({
          display: "inline-flex",
          gap: 4,
          marginBottom: 20,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 4,
        })}>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                className="pr-tab-btn"
                onClick={() => setTab(t.key)}
                style={style({
                  padding: "7px 18px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  background: active
                    ? `linear-gradient(135deg, ${t.color}22, ${t.color}11)`
                    : "transparent",
                  color: active ? t.color : "rgba(255,255,255,0.50)",
                  boxShadow: active ? `0 0 0 1px ${t.color}44` : "none",
                })}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Skeleton Loader ── */}
        {isLoading && (
          <div style={style({ display: "grid", gap: 12 })}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={style({
                  borderRadius: 16,
                  padding: 18,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                })}
              >
                <div style={style({ display: "flex", gap: 12, alignItems: "center" })}>
                  <div className="skeleton-line" style={style({ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 })} />
                  <div style={style({ flex: 1, display: "grid", gap: 8 })}>
                    <div className="skeleton-line" style={style({ height: 13, width: "45%" })} />
                    <div className="skeleton-line" style={style({ height: 11, width: "70%" })} />
                  </div>
                  <div style={style({ display: "grid", gap: 8, alignItems: "flex-end" })}>
                    <div className="skeleton-line" style={style({ height: 14, width: 80 })} />
                    <div className="skeleton-line" style={style({ height: 10, width: 60 })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Cards ── */}
        {!isLoading && (
          <div style={style({ display: "grid", gap: 12 })}>
            {items.map((p, idx) => {
              const meta = STATUS_META[p.status ?? ""] ?? {
                label: (p.status ?? "").toUpperCase(),
                color: "rgba(255,255,255,0.4)",
                bg: "rgba(255,255,255,0.05)",
                dot: "rgba(255,255,255,0.4)",
              };
              const isThisLoading = loadingId === p._id;

              return (
                <div
                  key={p._id}
                  className="pr-card"
                  style={style({
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background:
                      p.status === "pending"
                        ? "linear-gradient(135deg, rgba(251,191,36,0.04), rgba(255,255,255,0.02))"
                        : p.status === "approved"
                          ? "linear-gradient(135deg, rgba(52,211,153,0.04), rgba(255,255,255,0.02))"
                          : "rgba(255,255,255,0.025)",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.28)",
                    padding: "16px 18px",
                    animation: `fadeSlideIn 0.28s ease both`,
                    animationDelay: `${idx * 0.05}s`,
                    opacity: isThisLoading ? 0.6 : 1,
                    transition: "opacity 0.2s",
                  })}
                >
                  {/* top row */}
                  <div style={style({
                    display: "grid",
                    gridTemplateColumns: "48px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                  })}>
                    {/* avatar */}
                    <div style={style({
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 16,
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "#fff",
                      letterSpacing: 0.5,
                      boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
                      flexShrink: 0,
                    })}>
                      {p.initials ?? "?"}
                    </div>

                    {/* info */}
                    <div>
                      <div style={style({ fontWeight: 750, fontSize: 15, color: "rgba(255,255,255,0.93)" })}>
                        {p.submittedBy?.name || "—"}
                      </div>
                      <div style={style({
                        fontSize: 12,
                        color: "rgba(255,255,255,0.45)",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "3px 6px",
                      })}>
                        {p.event?.activityName && (
                          <span style={style({
                            background: "rgba(129,140,248,0.15)",
                            color: "#a5b4fc",
                            borderRadius: 5,
                            padding: "1px 7px",
                            fontSize: 11,
                            fontWeight: 600,
                          })}>
                            {p.event.activityName}
                          </span>
                        )}
                        {p.title && <span>{p.title}</span>}
                        {p.category && (
                          <span style={style({
                            background: "rgba(99,102,241,0.12)",
                            color: "#c7d2fe",
                            borderRadius: 5,
                            padding: "1px 7px",
                            fontSize: 11,
                            fontWeight: 600,
                          })}>
                            {TASK_CATEGORY_LABELS[p.category as TaskCategory] ?? p.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* amount + status */}
                    <div style={style({ textAlign: "right" })}>
                      <div style={style({
                        fontWeight: 900,
                        fontSize: 18,
                        color: "rgba(255,255,255,0.95)",
                        letterSpacing: "-0.3px",
                      })}>
                        {formatINR(p.amount ?? 0)}
                      </div>
                      <div style={style({
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 5,
                        padding: "3px 9px",
                        borderRadius: 20,
                        background: meta.bg,
                        border: `1px solid ${meta.color}33`,
                      })}>
                        <span style={style({
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: meta.dot,
                          display: "inline-block",
                        })} />
                        <span style={style({ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: 0.5 })}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* divider + actions for pending */}
                  {p.status === "pending" && (
                    <>
                      <div style={style({
                        height: 1,
                        background: "rgba(255,255,255,0.06)",
                        margin: "14px 0 12px",
                      })} />
                      <div style={style({ display: "flex", gap: 8, justifyContent: "flex-end" })}>
                        <ActionButton
                          label="Reject"
                          variant="reject"
                          loading={isThisLoading}
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ id: p._id, status: "rejected" })}
                        />
                        <ActionButton
                          label="Approve"
                          variant="approve"
                          loading={isThisLoading}
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ id: p._id, status: "approved" })}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {items.length === 0 && (
              <EmptyState tab={tab} />
            )}
          </div>
        )}
      </div>

      {/* ── Toast Popup ── */}
      {popup && (
        <div style={style({
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 50,
          minWidth: 300,
          maxWidth: 440,
          padding: "16px 20px",
          borderRadius: 16,
          border: popup.kind === "success"
            ? "1px solid rgba(52,211,153,0.35)"
            : "1px solid rgba(248,113,113,0.35)",
          background: popup.kind === "success"
            ? "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(59,130,246,0.14))"
            : "linear-gradient(135deg, rgba(239,68,68,0.20), rgba(127,29,29,0.18))",
          boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
          backdropFilter: "blur(12px)",
          animation: "popIn 0.25s ease both",
        })}>
          <div style={style({
            fontWeight: 800,
            fontSize: 14,
            marginBottom: 6,
            color: popup.kind === "success" ? "rgba(110,231,183,0.98)" : "rgba(252,165,165,0.98)",
          })}>
            {popup.title}
          </div>
          <div style={style({ fontSize: 13, color: "rgba(255,255,255,0.80)", lineHeight: 1.5 })}>
            {popup.message}
          </div>

          {/* progress bar */}
          <div style={style({
            marginTop: 12,
            height: 3,
            borderRadius: 99,
            background: "rgba(255,255,255,0.10)",
            overflow: "hidden",
          })}>
            <div style={style({
              height: "100%",
              borderRadius: 99,
              width: "100%",
              background: popup.kind === "success" ? "#34d399" : "#f87171",
              animation: `shrink ${popup.kind === "success" ? 3 : 3.5}s linear forwards`,
            })} />
          </div>
        </div>
      )}

      {/* shrink keyframe for toast timer bar */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%;   }
        }
      `}</style>
    </>
  );
}

/* ─────────────────────────────────────────
   Sub-components
───────────────────────────────────────── */

function SummaryPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 7,
      background: `${color}11`,
      border: `1px solid ${color}33`,
      borderRadius: 10,
      padding: "5px 12px",
    }}>
      <span style={{ fontSize: 11, color: `${color}cc`, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color, fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function ActionButton({
  label,
  variant,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  variant: "approve" | "reject";
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const isApprove = variant === "approve";
  return (
    <button
      className="pr-action-btn"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "8px 20px",
        borderRadius: 9,
        border: isApprove ? "none" : "1px solid rgba(248,113,113,0.35)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        gap: 7,
        background: isApprove
          ? "linear-gradient(135deg, #10b981, #059669)"
          : "rgba(248,113,113,0.10)",
        color: isApprove ? "#fff" : "#f87171",
        boxShadow: isApprove ? "0 4px 14px rgba(16,185,129,0.30)" : "none",
      }}
    >
      {loading ? (
        <span style={{
          width: 13,
          height: 13,
          borderRadius: "50%",
          border: "2px solid currentColor",
          borderTopColor: "transparent",
          display: "inline-block",
          animation: "spin 0.7s linear infinite",
        }} />
      ) : (
        <span>{isApprove ? "✓" : "✕"}</span>
      )}
      {label}
    </button>
  );
}

function EmptyState({ tab }: { tab: string }) {
  return (
    <div style={{
      textAlign: "center",
      padding: "60px 20px",
      borderRadius: 16,
      border: "1px dashed rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.02)",
      animation: "fadeSlideIn 0.3s ease both",
    }}>
      <div style={{ fontSize: 42, marginBottom: 12 }}>
        {tab === "pending" ? "⏳" : tab === "approved" ? "✅" : "📭"}
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.70)", marginBottom: 6 }}>
        No {tab === "all" ? "" : tab} payment requests
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
        {tab === "pending"
          ? "All caught up — no requests need your attention."
          : tab === "approved"
            ? "No approved requests yet."
            : "No payment requests have been submitted yet."}
      </div>
    </div>
  );
}