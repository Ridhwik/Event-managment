import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuthedApi } from "../lib/api";
import { EditableBillSheet, type EditableBillData } from "./EditableBillSheet";
import { buildDefaultEditableBillData } from "./EditableBillSheetDefaults";
import { useNavigate } from "react-router-dom";

/* ══════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════ */
type ClosingSheetItem = {
  event?: {
    id?: string;
    activityName?: string;
    accountNumber?: string;
    startDate?: string | null;
    closingDate?: string | null;
    status?: string;
    lifecycleStatus?: string;
  };
};
type ClosingSheetsResponse = {
  items?: ClosingSheetItem[];
  googleSheetUrl?: string;
  sheetsWarning?: string;
};
type ClosingSheetDetails = {
  success?: boolean;
  googleSheetUrl?: string;
  sheetUrl?: string;
  event?: {
    id?: string; activityName?: string; date?: string | null;
    accountNumber?: string; startDate?: string | null;
    closingDate?: string | null; endDate?: string | null;
    budget?: number; status?: string;
    director?: { name?: string; email?: string } | null;
    teamLeader?: { name?: string; email?: string } | null;
  };
  totals?: { totalSpent?: number; companyOwesEmployees?: number; employeesReturn?: number };
  rows?: Array<{
    user?: { name?: string; email?: string };
    metrics?: { bills?: number; spent?: number; own?: number; company?: number; advance?: number; used?: number; return?: number; owed?: number };
  }>;
  bills?: Array<{
    id?: string; entityName?: string; amount?: number; paidBy?: string;
    paymentType?: string; status?: string;
    contactPerson?: { name?: string; email?: string } | null;
  }>;
};
type BillDetailItem = {
  srNo?: number; section?: string; particular?: string;
  quantity?: number; size?: string; rate?: number; amount?: number; remarks?: string;
};
type BillDetailResponse = {
  eventId?: string; billId?: string; eventName?: string; eventDate?: string | null;
  venue?: string; vendorName?: string; vendorSignature?: string; billNumber?: string;
  employee?: { id?: string; name?: string; email?: string };
  category?: string; approvalStatus?: string; paidBy?: string; paymentType?: string;
  remarks?: string; voucherUrl?: string; googleSheetUrl?: string;
  sectionTitle?: string; closingNumber?: string;
  sections?: Array<{ key?: string; title?: string; items?: BillDetailItem[] }>;
  totals?: { subtotal?: number; tax?: number; finalTotal?: number; advance?: number; remaining?: number };
};

/* ══════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════ */
function formatDate(d?: string | null) {
  if (!d) return "—";
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return d;
  return p.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  } catch { return `₹${n}`; }
}

const STATUS_MAP: Record<string, { gradient: string; glow: string; text: string; dot: string; badge: string; badgeText: string }> = {
  approved: { gradient: "linear-gradient(135deg,#064e3b,#065f46)", glow: "rgba(52,211,153,0.4)", text: "#34d399", dot: "#34d399", badge: "rgba(52,211,153,0.15)", badgeText: "#6ee7b7" },
  pending: { gradient: "linear-gradient(135deg,#78350f,#92400e)", glow: "rgba(251,191,36,0.4)", text: "#fbbf24", dot: "#fbbf24", badge: "rgba(251,191,36,0.15)", badgeText: "#fde68a" },
  rejected: { gradient: "linear-gradient(135deg,#7f1d1d,#991b1b)", glow: "rgba(248,113,113,0.4)", text: "#f87171", dot: "#f87171", badge: "rgba(248,113,113,0.15)", badgeText: "#fca5a5" },
  active: { gradient: "linear-gradient(135deg,#1e1b4b,#312e81)", glow: "rgba(129,140,248,0.4)", text: "#818cf8", dot: "#818cf8", badge: "rgba(129,140,248,0.15)", badgeText: "#c7d2fe" },
  closed: { gradient: "linear-gradient(135deg,#0f172a,#1e293b)", glow: "rgba(100,116,139,0.3)", text: "#94a3b8", dot: "#94a3b8", badge: "rgba(100,116,139,0.15)", badgeText: "#cbd5e1" },
  open: { gradient: "linear-gradient(135deg,#0c4a6e,#0369a1)", glow: "rgba(56,189,248,0.4)", text: "#38bdf8", dot: "#38bdf8", badge: "rgba(56,189,248,0.15)", badgeText: "#bae6fd" },
};
function getStatus(s: string) {
  return STATUS_MAP[s.toLowerCase()] ?? STATUS_MAP.closed;
}

/* ══════════════════════════════════════════════
   GLOBAL CSS
   ══════════════════════════════════════════════ */
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  @keyframes fadeUp    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes scaleIn   { from{opacity:0;transform:scale(0.93) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes shimmer   { 0%{background-position:-800px 0} 100%{background-position:800px 0} }
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes pulse     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
  @keyframes float     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes glow-ring { 0%,100%{box-shadow:0 0 0 0 currentColor} 50%{box-shadow:0 0 0 6px transparent} }
  @keyframes gradient-shift {
    0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%}
  }
  @keyframes count-up  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slide-bar { from{width:0%} to{width:var(--w,100%)} }

  /* scrollbar */
  .g-scroll::-webkit-scrollbar { width:4px; height:4px }
  .g-scroll::-webkit-scrollbar-track { background:transparent }
  .g-scroll::-webkit-scrollbar-thumb { background:rgba(148,163,184,0.18); border-radius:99px }

  /* card */
  .ev-card {
    position:relative; overflow:hidden;
    transition: transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s ease;
    cursor:pointer;
  }
  .ev-card::before {
    content:''; position:absolute; inset:0;
    background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 60%);
    pointer-events:none; z-index:1;
  }
  .ev-card:hover { transform:translateY(-5px) scale(1.008); }

  /* shimmer skeleton */
  .skel {
    background: linear-gradient(90deg,
      rgba(255,255,255,0.03) 25%,
      rgba(255,255,255,0.08) 50%,
      rgba(255,255,255,0.03) 75%
    );
    background-size:800px 100%;
    animation:shimmer 1.6s infinite linear;
    border-radius:8px;
  }

  /* buttons */
  .g-btn {
    transition: transform 0.14s cubic-bezier(.34,1.56,.64,1), box-shadow 0.14s ease, opacity 0.14s;
    cursor:pointer; user-select:none;
  }
  .g-btn:hover:not(:disabled)  { transform:translateY(-2px) }
  .g-btn:active:not(:disabled) { transform:scale(0.96) }
  .g-btn:disabled              { opacity:0.4; cursor:not-allowed }

  /* table row */
  .g-tr { transition:background 0.12s }
  .g-tr:hover td { background:rgba(99,102,241,0.07) !important }

  /* stat card */
  .stat-card {
    transition:transform 0.18s ease, box-shadow 0.18s ease;
  }
  .stat-card:hover { transform:translateY(-2px) }

  /* noise texture overlay */
  .noise::after {
    content:''; position:absolute; inset:0; pointer-events:none; z-index:0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    border-radius:inherit;
  }
`;

/* ══════════════════════════════════════════════
   MICRO COMPONENTS
   ══════════════════════════════════════════════ */
function Spinner({ size = 14, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size, flexShrink: 0,
      borderRadius: "50%", border: `2px solid ${color}30`,
      borderTopColor: color, animation: "spin 0.6s linear infinite",
    }} />
  );
}

function StatusBadge({ status }: { status: string }) {
  const st = getStatus(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 11px", borderRadius: 99,
      background: st.badge, border: `1px solid ${st.text}30`,
      fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
      color: st.badgeText, textTransform: "uppercase",
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%", background: st.dot, flexShrink: 0,
        animation: status.toLowerCase() === "pending" ? "pulse 1.5s ease-in-out infinite" : "none",
      }} />
      {status || "—"}
    </span>
  );
}

function GlowCard({ children, style: extraStyle, className = "" }: {
  children: React.ReactNode; style?: React.CSSProperties; className?: string;
}) {
  return (
    <div className={`noise ${className}`} style={{
      position: "relative", borderRadius: 20,
      background: "linear-gradient(160deg,rgba(15,23,42,0.9),rgba(9,14,26,0.95))",
      border: "1px solid rgba(148,163,184,0.1)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
      ...extraStyle,
    }}>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function SectionHeading({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 32, marginBottom: 14 }}>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span style={{
        fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "#64748b",
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(148,163,184,0.12),transparent)" }} />
    </div>
  );
}

function InfoTile({ label, value, accent, icon }: {
  label: string; value: React.ReactNode; accent?: string; icon?: string;
}) {
  return (
    <div className="stat-card" style={{
      background: "rgba(15,23,42,0.7)",
      borderRadius: 14, padding: "14px 16px",
      border: `1px solid ${accent ? `${accent}20` : "rgba(148,163,184,0.08)"}`,
      borderLeft: accent ? `3px solid ${accent}` : "1px solid rgba(148,163,184,0.08)",
      boxShadow: accent ? `0 4px 20px ${accent}10` : "none",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#475569",
        textTransform: "uppercase", letterSpacing: "0.07em",
        marginBottom: 6, display: "flex", alignItems: "center", gap: 5,
      }}>
        {icon && <span>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: accent ?? "#e2e8f0" }}>
        {value}
      </div>
    </div>
  );
}

function FinancialCard({ label, value, color, icon, percent }: {
  label: string; value: string; color: string; icon: string; percent?: number;
}) {
  return (
    <div className="stat-card" style={{
      borderRadius: 16, padding: "18px 20px",
      background: `linear-gradient(135deg,${color}18,${color}08)`,
      border: `1px solid ${color}25`,
      boxShadow: `0 8px 32px ${color}10`,
      position: "relative", overflow: "hidden",
    }}>
      {/* bg icon */}
      <div style={{
        position: "absolute", right: 14, top: 10,
        fontSize: 36, opacity: 0.08, pointerEvents: "none",
        animation: "float 3s ease-in-out infinite",
      }}>{icon}</div>

      <div style={{ fontSize: 11, fontWeight: 700, color: `${color}88`, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: "-0.5px", animation: "count-up 0.5s ease both" }}>
        {value}
      </div>

      {typeof percent === "number" && (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 3, borderRadius: 99, background: `${color}20`, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 99, background: color,
              "--w": `${percent}%` as string,
              animation: "slide-bar 1s cubic-bezier(.34,1.56,.64,1) both 0.3s",
              width: `${percent}%`,
            } as React.CSSProperties} />
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 20, padding: 22,
      background: "rgba(15,23,42,0.5)",
      border: "1px solid rgba(148,163,184,0.06)",
    }}>
      <div className="skel" style={{ height: 3, width: "100%", marginBottom: 18, borderRadius: 99 }} />
      <div className="skel" style={{ height: 15, width: "65%", marginBottom: 10 }} />
      <div className="skel" style={{ height: 22, width: 90, borderRadius: 99, marginBottom: 14 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
        <div className="skel" style={{ height: 48, borderRadius: 12 }} />
        <div className="skel" style={{ height: 48, borderRadius: 12 }} />
      </div>
      <div className="skel" style={{ height: 40, borderRadius: 12 }} />
    </div>
  );
}

/* ══════════════════════════════════════════════
   TABLE ATOMS
   ══════════════════════════════════════════════ */
function TH({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th style={{
      padding: "11px 14px", textAlign: right ? "right" : "left",
      fontWeight: 700, fontSize: 10, textTransform: "uppercase",
      letterSpacing: "0.06em", color: "#475569", whiteSpace: "nowrap",
      background: "rgba(9,14,26,0.8)",
      borderBottom: "1px solid rgba(148,163,184,0.07)",
    }}>
      {children}
    </th>
  );
}
function TD({ children, right, bold, accent, mono }: {
  children?: React.ReactNode; right?: boolean; bold?: boolean; accent?: string; mono?: boolean;
}) {
  return (
    <td style={{
      padding: "11px 14px", textAlign: right ? "right" : "left",
      fontWeight: bold ? 700 : 400, color: accent ?? "#94a3b8",
      borderBottom: "1px solid rgba(148,163,184,0.04)", fontSize: 13,
      fontVariantNumeric: mono ? "tabular-nums" : undefined,
    }}>
      {children}
    </td>
  );
}

/* ══════════════════════════════════════════════
   HEADER STAT CHIP
   ══════════════════════════════════════════════ */
function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
      borderRadius: 12, background: `${color}12`, border: `1px solid ${color}28`,
    }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: `${color}88`, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 900, color, lineHeight: 1.2 }}>{value}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════ */
export function ClosingSheetsPage() {
  const api = useAuthedApi();
  const navigate = useNavigate();
  const [syncingEventId, setSyncingEventId] = useState("");

  const { data, isLoading } = useQuery<ClosingSheetsResponse>({
    queryKey: ["admin", "closingSheets"],
    queryFn: async () => (await api.get("/admin/closing-sheets")).data,
  });

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedDetails, setSelectedDetails] = useState<ClosingSheetDetails | null>(null);
  const [billViewer, setBillViewer] = useState<BillDetailResponse | null>(null);
  const [loadingBillId, setLoadingBillId] = useState("");
  const [editableBill, setEditableBill] = useState<EditableBillData | null>(null);
  const [savingBill, setSavingBill] = useState(false);

  const items = data?.items ?? [];

  /* ── handlers ── */
  const handleViewDetails = (eventId: string) => {
    if (!eventId || syncingEventId) return;
    const ev = items.find((i) => String(i.event?.id ?? "") === String(eventId));
    navigate(`/view-bill/${eventId}`, {
      state: { eventId, eventName: String(ev?.event?.activityName ?? ""), eventDate: String(ev?.event?.startDate ?? ""), venue: "" },
    });
  };

  const handleViewBill = async (eventId: string, billId: string) => {
    if (!eventId || !billId) return;
    setLoadingBillId(billId);
    try {
      const { data } = await api.get<BillDetailResponse>(`/admin/events/${eventId}/bills/${billId}`);
      setBillViewer(data);
      setEditableBill(buildDefaultEditableBillData({
        eventName: String(data.eventName ?? ""), eventDate: String(data.eventDate ?? ""),
        venue: String(data.venue ?? ""), activityName: String(data.eventName ?? ""),
        sectionTitle: String(data.sectionTitle ?? ""), vendorName: String(data.vendorName ?? ""),
        vendorSignature: String(data.vendorSignature ?? ""), paymentRemarks: String(data.remarks ?? ""),
        billRemarks: String(data.remarks ?? ""), category: String(data.category ?? ""),
        paidBy: String(data.paidBy ?? ""), paymentType: String(data.paymentType ?? ""),
        approvedBy: String(data.approvalStatus ?? ""), closingNumber: String(data.closingNumber ?? ""),
        sections: Array.isArray(data.sections)
          ? data.sections.map((sec, idx) => ({
            key: String(sec.key ?? String.fromCharCode(65 + idx)),
            title: String(sec.title ?? "Section"),
            items: Array.isArray(sec.items)
              ? sec.items.map((it, iidx) => ({
                srNo: Number(it.srNo ?? iidx + 1), particular: String(it.particular ?? ""),
                quantity: Number(it.quantity ?? 0), size: String(it.size ?? "-"),
                rate: Number(it.rate ?? 0), amount: Number(it.amount ?? 0), remarks: String(it.remarks ?? ""),
              }))
              : [],
          }))
          : [],
        totals: {
          total: Number(data.totals?.finalTotal ?? data.totals?.subtotal ?? 0),
          subtotal: Number(data.totals?.subtotal ?? 0), tax: Number(data.totals?.tax ?? 0),
          finalTotal: Number(data.totals?.finalTotal ?? 0), advance: Number(data.totals?.advance ?? 0),
          cashPaid: Number(data.totals?.advance ?? 0), balance: Number(data.totals?.remaining ?? 0),
          remaining: Number(data.totals?.remaining ?? 0),
          signature: "", customerSignatory: "", authorizedSignatory: "",
        },
      }));
    } catch (err) { console.error("Failed to load bill", err); }
    finally { setLoadingBillId(""); }
  };

  const saveBillSheet = async () => {
    if (!billViewer?.billId || !editableBill) return;
    setSavingBill(true);
    try {
      const computedSubtotal = editableBill.sections.reduce(
        (acc, sec) => acc + sec.items.reduce((r, row) => r + Number(row.amount ?? 0), 0), 0
      );
      const payload = {
        description: editableBill.paymentRemarks ?? "", category: editableBill.category ?? "",
        entityName: editableBill.vendorName ?? "",
        amount: Number(editableBill.totals.finalTotal ?? computedSubtotal ?? 0),
        billSheet: {
          eventName: editableBill.eventName, eventDate: editableBill.eventDate,
          venue: editableBill.venue, sectionTitle: editableBill.sectionTitle,
          vendorName: editableBill.vendorName, vendorSignature: editableBill.vendorSignature,
          remarks: editableBill.paymentRemarks, category: editableBill.category,
          sections: editableBill.sections,
          totals: {
            subtotal: Number(editableBill.totals.subtotal ?? computedSubtotal),
            tax: Number(editableBill.totals.tax ?? 0),
            finalTotal: Number(editableBill.totals.finalTotal ?? (Number(editableBill.totals.subtotal ?? computedSubtotal) + Number(editableBill.totals.tax ?? 0))),
            advance: Number(editableBill.totals.advance ?? 0),
            remaining: Number(editableBill.totals.remaining ?? 0),
          },
        },
      };
      await api.put(`/admin/bills/${billViewer.billId}`, payload);
      if (billViewer.eventId) await api.post(`/admin/events/${billViewer.eventId}/sync-sheet`);
      const { data } = await api.get<BillDetailResponse>(`/admin/events/${billViewer.eventId}/bills/${billViewer.billId}`);
      setBillViewer(data);
    } catch (err) { console.error("Save failed", err); }
    finally { setSavingBill(false); }
  };

  /* ── totals for header chips ── */
  const totalEvents = items.length;
  const activeEvents = items.filter((i) => ["active", "open"].includes((i.event?.lifecycleStatus ?? i.event?.status ?? "").toLowerCase())).length;
  const closedEvents = items.filter((i) => ["closed"].includes((i.event?.lifecycleStatus ?? i.event?.status ?? "").toLowerCase())).length;

  /* ══════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════ */
  return (
    <>
      <style>{G}</style>

      <div style={{
        padding: "32px 28px", maxWidth: 1280, margin: "0 auto",
        fontFamily: "'Inter',system-ui,sans-serif",
        minHeight: "100vh",
      }}>

        {/* ── HERO HEADER ── */}
        <div style={{
          position: "relative", overflow: "hidden",
          borderRadius: 24, padding: "32px 36px",
          marginBottom: 32,
          background: "linear-gradient(135deg,rgba(99,102,241,0.18) 0%,rgba(139,92,246,0.12) 40%,rgba(59,130,246,0.10) 100%)",
          border: "1px solid rgba(99,102,241,0.2)",
          boxShadow: "0 20px 60px rgba(99,102,241,0.12)",
        }}>
          {/* animated bg orbs */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.2),transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -40, left: 100, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle,rgba(59,130,246,0.15),transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, boxShadow: "0 8px 24px rgba(99,102,241,0.4)",
                }}>📋</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(165,180,252,0.7)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
                    Finance Management
                  </div>
                  <h1 style={{
                    margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.6px",
                    background: "linear-gradient(135deg,#fff 30%,#a5b4fc 70%,#818cf8)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    backgroundSize: "200% auto", animation: "gradient-shift 4s ease infinite",
                  }}>
                    Event Closing Sheets
                  </h1>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(148,163,184,0.7)", maxWidth: 420, lineHeight: 1.6 }}>
                Manage financial records, review employee expenses, and track budget closures across all events.
              </p>
            </div>

            {/* stat chips */}
            {!isLoading && totalEvents > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <StatChip label="Total Events" value={String(totalEvents)} color="#818cf8" />
                <StatChip label="Active" value={String(activeEvents)} color="#34d399" />
                <StatChip label="Closed" value={String(closedEvents)} color="#94a3b8" />
              </div>
            )}
          </div>
        </div>

        {/* ── SKELETON ── */}
        {isLoading && (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))" }}>
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── EVENT CARDS ── */}
        {!isLoading && (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))" }}>
            {items.map((item, idx) => {
              const ev = item.event;
              const id = String(ev?.id ?? "");
              const rawSt = ev?.lifecycleStatus ?? ev?.status ?? "";
              const st = getStatus(rawSt);

              return (
                <div
                  key={id}
                  className="ev-card noise"
                  style={{
                    borderRadius: 20, padding: "22px",
                    background: "linear-gradient(160deg,rgba(15,23,42,0.92),rgba(9,14,26,0.95))",
                    border: "1px solid rgba(148,163,184,0.09)",
                    boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset`,
                    animation: `fadeUp 0.35s cubic-bezier(.34,1.56,.64,1) both`,
                    animationDelay: `${idx * 0.045}s`,
                  }}
                  onClick={() => handleViewDetails(id)}
                >
                  {/* top color bar */}
                  <div style={{
                    height: 3, borderRadius: 99, marginBottom: 18,
                    background: `linear-gradient(90deg,${st.text},${st.text}40,transparent)`,
                    boxShadow: `0 0 12px ${st.glow}`,
                  }} />

                  {/* header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ flex: 1, paddingRight: 10 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9", lineHeight: 1.35, marginBottom: 8 }}>
                        {ev?.activityName ?? "Untitled Event"}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <StatusBadge status={rawSt} />
                        {ev?.accountNumber && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: "#64748b",
                            background: "rgba(100,116,139,0.1)", borderRadius: 6,
                            padding: "3px 8px", letterSpacing: "0.05em",
                            border: "1px solid rgba(100,116,139,0.15)",
                          }}>
                            CLO-{ev.accountNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* icon circle */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                      background: st.badge,
                      border: `1px solid ${st.text}25`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17, boxShadow: `0 4px 14px ${st.glow}30`,
                    }}>
                      {rawSt.toLowerCase() === "approved" ? "✅" :
                        rawSt.toLowerCase() === "pending" ? "⏳" :
                          rawSt.toLowerCase() === "active" ? "🟢" :
                            rawSt.toLowerCase() === "closed" ? "🔒" : "📁"}
                    </div>
                  </div>

                  {/* date tiles */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                    {[
                      { label: "📅 Start", value: formatDate(ev?.startDate) },
                      { label: "🔚 Closing", value: formatDate(ev?.closingDate) },
                    ].map((d) => (
                      <div key={d.label} style={{
                        borderRadius: 11, padding: "9px 11px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(148,163,184,0.06)",
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", marginBottom: 4, letterSpacing: "0.04em" }}>
                          {d.label}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{d.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    className="g-btn"
                    disabled={!!syncingEventId}
                    onClick={(e) => { e.stopPropagation(); handleViewDetails(id); }}
                    style={{
                      width: "100%", padding: "11px 0", borderRadius: 12,
                      border: "none", fontWeight: 700, fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      background: `linear-gradient(135deg,${st.text}CC,${st.text}88)`,
                      color: "#fff",
                      boxShadow: `0 6px 20px ${st.glow}50`,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {syncingEventId === id
                      ? <><Spinner size={13} /> Loading…</>
                      : <><span>View Details</span><span style={{ opacity: 0.75 }}>→</span></>
                    }
                  </button>
                </div>
              );
            })}

            {/* empty state */}
            {items.length === 0 && (
              <div style={{
                gridColumn: "1/-1", textAlign: "center", padding: "100px 20px",
                animation: "fadeUp 0.4s ease both",
              }}>
                <div style={{ fontSize: 64, marginBottom: 20, animation: "float 3s ease-in-out infinite" }}>📭</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
                  No Closing Sheets Found
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", maxWidth: 320, margin: "0 auto", lineHeight: 1.6 }}>
                  Closing sheets will appear here once events complete their financial cycle.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
         DETAILS MODAL
         ══════════════════════════════════════ */}
      {selectedEventId && (
        <div
          role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) { setSelectedEventId(""); setSelectedDetails(null); } }}
          style={{
            position: "fixed", inset: 0, zIndex: 60,
            background: "rgba(2,6,23,0.78)",
            backdropFilter: "blur(10px)",
            display: "grid", placeItems: "center",
            padding: 16, animation: "fadeIn 0.2s ease both",
          }}
        >
          <GlowCard className="g-scroll" style={{
            width: "min(1120px,100%)", maxHeight: "92vh",
            overflow: "auto", animation: "scaleIn 0.28s cubic-bezier(.34,1.56,.64,1) both",
          }}>
            {/* sticky modal header */}
            <div style={{
              position: "sticky", top: 0, zIndex: 3,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
              padding: "16px 24px",
              borderBottom: "1px solid rgba(148,163,184,0.08)",
              background: "rgba(9,14,26,0.97)", backdropFilter: "blur(12px)",
              borderRadius: "20px 20px 0 0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
                }}>📋</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>
                    {selectedDetails?.event?.activityName ?? "Closing Sheet"}
                  </div>
                  {selectedDetails?.event?.accountNumber && (
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>
                      Account #{selectedDetails.event.accountNumber}
                    </div>
                  )}
                </div>
              </div>
              <button
                className="g-btn"
                onClick={() => { setSelectedEventId(""); setSelectedDetails(null); }}
                style={{
                  padding: "8px 16px", borderRadius: 10,
                  border: "1px solid rgba(148,163,184,0.12)",
                  background: "rgba(148,163,184,0.06)",
                  color: "#64748b", cursor: "pointer", fontWeight: 700, fontSize: 12,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ padding: "24px 24px 28px" }}>
              {syncingEventId === selectedEventId && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#64748b", fontSize: 13, marginBottom: 20 }}>
                  <Spinner color="#64748b" /> Loading event details…
                </div>
              )}

              {selectedDetails?.event && (
                <>
                  {/* info tiles */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 8 }}>
                    <InfoTile icon="📅" label="Date" value={formatDate(selectedDetails.event.date)} />
                    <InfoTile icon="📆" label="Start → Closing" value={`${formatDate(selectedDetails.event.startDate)} → ${formatDate(selectedDetails.event.closingDate)}`} />
                    <InfoTile icon="💰" label="Budget" value={formatINR(Number(selectedDetails.event.budget ?? 0))} accent="#34d399" />
                    <InfoTile icon="🔖" label="Status" value={<StatusBadge status={selectedDetails.event.status ?? ""} />} />
                    <InfoTile icon="👤" label="Director" value={selectedDetails.event.director?.name ?? "—"} />
                    <InfoTile icon="🎯" label="Team Leader" value={selectedDetails.event.teamLeader?.name ?? "—"} />
                  </div>

                  {/* financial summary */}
                  <SectionHeading icon="📊">Financial Summary</SectionHeading>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 4 }}>
                    <FinancialCard icon="💸" label="Total Spent" color="#f87171" value={formatINR(Number(selectedDetails.totals?.totalSpent ?? 0))} />
                    <FinancialCard icon="🏦" label="Company Owes" color="#fbbf24" value={formatINR(Number(selectedDetails.totals?.companyOwesEmployees ?? 0))} />
                    <FinancialCard icon="↩️" label="Employees Return" color="#34d399" value={formatINR(Number(selectedDetails.totals?.employeesReturn ?? 0))} />
                  </div>

                  {/* employee summary table */}
                  {!!selectedDetails.rows?.length && (
                    <>
                      <SectionHeading icon="👥">Employee Summary</SectionHeading>
                      <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid rgba(148,163,184,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr>
                              <TH>Employee</TH>
                              <TH right>Bills</TH><TH right>Spent</TH><TH right>Own</TH>
                              <TH right>Company</TH><TH right>Advance</TH><TH right>Return</TH><TH right>Owed</TH>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDetails.rows.map((row, idx) => (
                              <tr key={idx} className="g-tr" style={{ background: idx % 2 ? "rgba(15,23,42,0.4)" : "transparent" }}>
                                <TD bold accent="#e2e8f0">{row.user?.name ?? row.user?.email ?? "—"}</TD>
                                <TD right mono>{Number(row.metrics?.bills ?? 0)}</TD>
                                <TD right mono>{formatINR(Number(row.metrics?.spent ?? 0))}</TD>
                                <TD right mono>{formatINR(Number(row.metrics?.own ?? 0))}</TD>
                                <TD right mono>{formatINR(Number(row.metrics?.company ?? 0))}</TD>
                                <TD right mono>{formatINR(Number(row.metrics?.advance ?? 0))}</TD>
                                <TD right mono>{formatINR(Number(row.metrics?.return ?? 0))}</TD>
                                <TD right mono accent="#34d399">{formatINR(Number(row.metrics?.owed ?? 0))}</TD>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* bills table */}
                  {!!selectedDetails.bills?.length && (
                    <>
                      <SectionHeading icon="🧾">Bills</SectionHeading>
                      <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid rgba(148,163,184,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr>
                              <TH>Vendor</TH><TH>Employee</TH><TH right>Amount</TH>
                              <TH>Paid By</TH><TH>Payment</TH><TH>Status</TH>
                              <TH>Action</TH>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDetails.bills.map((bill, idx) => {
                              const bid = String(bill.id ?? "");
                              const isLoadingThis = loadingBillId === bid;
                              return (
                                <tr key={idx} className="g-tr" style={{ background: idx % 2 ? "rgba(15,23,42,0.4)" : "transparent" }}>
                                  <TD bold accent="#e2e8f0">{bill.entityName ?? "—"}</TD>
                                  <TD>{bill.contactPerson?.name ?? bill.contactPerson?.email ?? "—"}</TD>
                                  <TD right mono accent="#34d399">{formatINR(Number(bill.amount ?? 0))}</TD>
                                  <TD>{String(bill.paidBy ?? "—").toUpperCase()}</TD>
                                  <TD>{bill.paymentType ?? "—"}</TD>
                                  <TD><StatusBadge status={bill.status ?? ""} /></TD>
                                  <td style={{ padding: "8px 14px", borderBottom: "1px solid rgba(148,163,184,0.04)" }}>
                                    <button
                                      className="g-btn"
                                      disabled={isLoadingThis}
                                      onClick={() => handleViewBill(selectedEventId, bid)}
                                      style={{
                                        padding: "6px 14px", borderRadius: 8, border: "none",
                                        fontWeight: 700, fontSize: 11, cursor: isLoadingThis ? "not-allowed" : "pointer",
                                        display: "inline-flex", alignItems: "center", gap: 6,
                                        background: "linear-gradient(135deg,#3b82f6,#2563eb)",
                                        color: "#fff",
                                        boxShadow: "0 4px 14px rgba(59,130,246,0.3)",
                                      }}
                                    >
                                      {isLoadingThis ? <><Spinner size={10} />Loading…</> : "View Bill"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </GlowCard>
        </div>
      )}

      {/* ══════════════════════════════════════
         BILL VIEWER MODAL
         ══════════════════════════════════════ */}
      {billViewer && (
        <div
          role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setBillViewer(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 80,
            background: "rgba(2,6,23,0.80)",
            backdropFilter: "blur(10px)",
            display: "grid", placeItems: "center",
            padding: 14, animation: "fadeIn 0.2s ease both",
          }}
        >
          <div
            className="g-scroll"
            style={{
              width: "min(1180px,100%)", maxHeight: "94vh", overflow: "auto",
              borderRadius: 22, background: "#fff", color: "#0f172a",
              border: "1px solid #e2e8f0",
              boxShadow: "0 40px 120px rgba(2,6,23,0.55)",
              animation: "scaleIn 0.28s cubic-bezier(.34,1.56,.64,1) both",
            }}
          >
            {/* bill header */}
            <div style={{
              position: "sticky", top: 0, zIndex: 2,
              display: "flex", justifyContent: "space-between",
              alignItems: "center", flexWrap: "wrap", gap: 10,
              padding: "14px 22px",
              borderBottom: "1px solid #f1f5f9",
              background: "rgba(248,250,252,0.97)",
              backdropFilter: "blur(12px)",
              borderRadius: "22px 22px 0 0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: "linear-gradient(135deg,#3b82f6,#2563eb)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, boxShadow: "0 4px 12px rgba(59,130,246,0.35)",
                }}>🧾</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                    Bill Sheet
                    {billViewer.vendorName && (
                      <span style={{ color: "#64748b", fontWeight: 500, marginLeft: 8 }}>
                        — {billViewer.vendorName}
                      </span>
                    )}
                  </div>
                  {billViewer.billNumber && (
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                      Bill #{billViewer.billNumber}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* Print */}
                <button className="g-btn" onClick={() => window.print()} style={{
                  padding: "8px 14px", borderRadius: 9,
                  border: "1px solid #e2e8f0", background: "#f8fafc",
                  color: "#475569", cursor: "pointer", fontWeight: 700, fontSize: 12,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  🖨 Print
                </button>
                {/* Save */}
                <button className="g-btn" onClick={saveBillSheet} disabled={savingBill} style={{
                  padding: "8px 18px", borderRadius: 9, border: "none",
                  background: "linear-gradient(135deg,#16a34a,#15803d)",
                  color: "#fff", cursor: savingBill ? "not-allowed" : "pointer",
                  fontWeight: 700, fontSize: 12,
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: "0 4px 16px rgba(22,163,74,0.35)",
                }}>
                  {savingBill ? <><Spinner color="#fff" />Saving…</> : <>💾 Save Bill</>}
                </button>
                {/* Download */}
                {billViewer.voucherUrl && (
                  <a href={billViewer.voucherUrl} target="_blank" rel="noreferrer" style={{
                    padding: "8px 14px", borderRadius: 9,
                    border: "1px solid #e2e8f0", background: "#f8fafc",
                    color: "#475569", fontWeight: 700, fontSize: 12,
                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
                    ↓ Download
                  </a>
                )}
                {/* Close */}
                <button className="g-btn" onClick={() => setBillViewer(null)} style={{
                  padding: "8px 14px", borderRadius: 9,
                  border: "1px solid rgba(239,68,68,0.2)",
                  background: "rgba(239,68,68,0.06)",
                  color: "#ef4444", cursor: "pointer", fontWeight: 700, fontSize: 12,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  ✕ Close
                </button>
              </div>
            </div>

            <div style={{ padding: 22 }}>
              {editableBill && (
                <EditableBillSheet value={editableBill} onChange={setEditableBill} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}