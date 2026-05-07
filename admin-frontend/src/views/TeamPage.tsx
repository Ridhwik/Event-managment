import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Search,
  X,
  Power,
  Mail,
  Phone,
  Building2,
  CalendarDays,
  ChevronRight,
  Users,
  ShieldCheck,
  Crown,
  UserCheck,
  Filter,
  RotateCcw,
  Eye,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthedApi } from "../lib/api";

/* ------------------------------------------------------------------ */
/*  Design Tokens                                                      */
/* ------------------------------------------------------------------ */

const T = {
  bg: "#060918",
  surface: "rgba(15,20,40,0.75)",
  glass: "rgba(255,255,255,0.04)",
  glassBorder: "rgba(255,255,255,0.08)",
  glassHover: "rgba(255,255,255,0.07)",
  accent: "#7c3aed",
  accentLight: "#a78bfa",
  accentSoft: "rgba(124,58,237,0.12)",
  accentGlow: "rgba(124,58,237,0.35)",
  blue: "#3b82f6",
  blueGlow: "rgba(59,130,246,0.3)",
  cyan: "#06b6d4",
  cyanGlow: "rgba(6,182,212,0.3)",
  green: "#10b981",
  greenGlow: "rgba(16,185,129,0.3)",
  amber: "#f59e0b",
  amberGlow: "rgba(245,158,11,0.3)",
  rose: "#f43f5e",
  roseGlow: "rgba(244,63,94,0.3)",
  muted: "rgba(148,163,184,0.6)",
  text: "rgba(226,232,240,0.9)",
  bright: "#f8fafc",
  gradient1: "linear-gradient(135deg,#7c3aed,#3b82f6)",
  gradient2: "linear-gradient(135deg,#06b6d4,#3b82f6)",
  gradient3: "linear-gradient(135deg,#10b981,#06b6d4)",
  gradient4: "linear-gradient(135deg,#f59e0b,#f43f5e)",
  gradient5: "linear-gradient(135deg,#ec4899,#7c3aed)",
  heroGradient: "linear-gradient(135deg,rgba(124,58,237,0.15),rgba(59,130,246,0.1),rgba(6,182,212,0.08))",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(date?: string) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return "—"; }
}

function getInitials(name?: string) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getRoleIcon(role?: string) {
  switch (role) {
    case "director": return <Crown size={14} />;
    case "teamleader": return <ShieldCheck size={14} />;
    default: return <UserCheck size={14} />;
  }
}

function getRoleGradient(role?: string) {
  switch (role) {
    case "director": return T.gradient4;
    case "teamleader": return T.gradient5;
    default: return T.gradient2;
  }
}

function getRoleColor(role?: string) {
  switch (role) {
    case "director": return T.amber;
    case "teamleader": return T.rose;
    default: return T.cyan;
  }
}

/* ------------------------------------------------------------------ */
/*  Micro Components                                                   */
/* ------------------------------------------------------------------ */

function GlassCard({ children, style, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{
      background: T.glass, border: `1px solid ${T.glassBorder}`,
      borderRadius: 20, backdropFilter: "blur(16px)", ...style,
    }} {...rest}>
      {children}
    </div>
  );
}

function AvatarCircle({ name, size = 40, gradient }: { name?: string; size?: number; gradient?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.35,
      background: gradient || T.gradient1,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: size * 0.35, color: "#fff",
      boxShadow: `0 4px 16px ${T.accentGlow}`, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function TeamPage() {
  const api = useAuthedApi();
  const navigate = useNavigate();

  const { data, refetch } = useQuery({
    queryKey: ["admin", "team"],
    queryFn: async () => (await api.get("/admin/team")).data,
  });

  const members: any[] = data?.members || [];

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const departments = useMemo(() => {
    return [...new Set(members.map((m: any) => m.department || "General"))];
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((m: any) => {
      const q = search.toLowerCase();
      return (
        (!q || [m.name, m.email, m.phone, m.role, m.department].join(" ").toLowerCase().includes(q)) &&
        (roleFilter === "all" || m.role === roleFilter) &&
        (departmentFilter === "all" || (m.department || "General") === departmentFilter)
      );
    });
  }, [members, search, roleFilter, departmentFilter]);

  const kpis = useMemo(() => ({
    total: members.length,
    active: members.filter((m: any) => m.active !== false).length,
    directors: members.filter((m: any) => m.role === "director").length,
    leaders: members.filter((m: any) => m.role === "teamleader").length,
    employees: members.filter((m: any) => m.role === "employee").length,
  }), [members]);

  const toggleEmployeeStatus = async (id: string) => {
    setTogglingId(id);
    try {
      await api.patch(`/admin/team/${id}/toggle-status`);
      refetch();
    } finally {
      setTogglingId(null);
    }
  };

  const hasActiveFilters = search || roleFilter !== "all" || departmentFilter !== "all";

  const kpiConfig = [
    { label: "Total Members", value: kpis.total, icon: <Users size={20} />, gradient: T.gradient1, glow: T.accentGlow, color: T.accentLight },
    { label: "Active Now", value: kpis.active, icon: <Zap size={20} />, gradient: T.gradient3, glow: T.greenGlow, color: T.green },
    { label: "Directors", value: kpis.directors, icon: <Crown size={20} />, gradient: T.gradient4, glow: T.amberGlow, color: T.amber },
    { label: "Team Leaders", value: kpis.leaders, icon: <ShieldCheck size={20} />, gradient: T.gradient5, glow: T.roseGlow, color: T.rose },
    { label: "Employees", value: kpis.employees, icon: <TrendingUp size={20} />, gradient: T.gradient2, glow: T.blueGlow, color: T.blue },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: "28px 24px 60px", color: T.text }}>

      {/* ============ BACKGROUND ORBS ============ */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{
          position: "absolute", top: "-10%", right: "-5%", width: 500, height: 500,
          borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,0.08),transparent 70%)",
          filter: "blur(60px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", left: "-5%", width: 600, height: 600,
          borderRadius: "50%", background: "radial-gradient(circle,rgba(59,130,246,0.06),transparent 70%)",
          filter: "blur(80px)",
        }} />
        <div style={{
          position: "absolute", top: "40%", left: "50%", width: 400, height: 400,
          borderRadius: "50%", background: "radial-gradient(circle,rgba(6,182,212,0.04),transparent 70%)",
          filter: "blur(60px)", transform: "translateX(-50%)",
        }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>

        {/* ============ HERO ============ */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            padding: "36px 32px", borderRadius: 24,
            background: T.heroGradient,
            border: `1px solid ${T.glassBorder}`,
            backdropFilter: "blur(20px)",
            marginBottom: 28,
            position: "relative", overflow: "hidden",
          }}
        >
          {/* Decorative lines */}
          <div style={{
            position: "absolute", top: 0, right: 0, width: 300, height: "100%",
            background: "linear-gradient(135deg,transparent 30%,rgba(124,58,237,0.05) 50%,transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >
              <Sparkles size={28} style={{ color: T.accentLight }} />
            </motion.div>
            <h1 style={{
              margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em",
              background: T.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Workforce Command Center
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 15, color: T.muted, fontWeight: 500 }}>
            Smart workforce analytics with real-time insights and intelligent management 🚀
          </p>
        </motion.div>

        {/* ============ KPI CARDS ============ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 28 }}>
          {kpiConfig.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              whileHover={{ y: -6, scale: 1.02 }}
              style={{
                padding: "22px 20px", borderRadius: 20,
                background: T.glass, border: `1px solid ${T.glassBorder}`,
                backdropFilter: "blur(16px)", cursor: "default",
                position: "relative", overflow: "hidden",
              }}
            >
              {/* Glow dot */}
              <div style={{
                position: "absolute", top: -20, right: -20, width: 80, height: 80,
                borderRadius: "50%", background: kpi.glow, filter: "blur(30px)",
                opacity: 0.5, pointerEvents: "none",
              }} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, position: "relative" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted }}>
                  {kpi.label}
                </span>
                <div style={{
                  width: 36, height: 36, borderRadius: 11,
                  background: `${kpi.color}18`, display: "flex",
                  alignItems: "center", justifyContent: "center", color: kpi.color,
                }}>
                  {kpi.icon}
                </div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: kpi.color, position: "relative", lineHeight: 1 }}>
                {kpi.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ============ FILTERS ============ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <GlassCard style={{ padding: "18px 20px", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Filter size={15} style={{ color: T.accentLight }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.accentLight }}>
                Filters
              </span>
              {hasActiveFilters && (
                <span style={{
                  padding: "2px 8px", borderRadius: 10, background: T.accentSoft,
                  color: T.accentLight, fontSize: 10, fontWeight: 700,
                }}>
                  Active
                </span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employee..."
                  style={{
                    width: "100%", padding: "11px 14px 11px 40px", borderRadius: 12,
                    border: `1px solid ${T.glassBorder}`, background: "rgba(255,255,255,0.03)",
                    color: T.bright, fontSize: 13, fontWeight: 500, outline: "none",
                    transition: "border-color .2s,background .2s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = "rgba(124,58,237,0.05)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = T.glassBorder; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                />
              </div>

              {/* Role select */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 12,
                  border: `1px solid ${T.glassBorder}`, background: "rgba(255,255,255,0.03)",
                  color: T.bright, fontSize: 13, fontWeight: 500, outline: "none",
                  cursor: "pointer", appearance: "none",
                }}
              >
                <option value="all" style={{ background: "#1e1b4b" }}>All Roles</option>
                <option value="director" style={{ background: "#1e1b4b" }}>Director</option>
                <option value="teamleader" style={{ background: "#1e1b4b" }}>Team Leader</option>
                <option value="employee" style={{ background: "#1e1b4b" }}>Employee</option>
              </select>

              {/* Department select */}
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 12,
                  border: `1px solid ${T.glassBorder}`, background: "rgba(255,255,255,0.03)",
                  color: T.bright, fontSize: 13, fontWeight: 500, outline: "none",
                  cursor: "pointer", appearance: "none",
                }}
              >
                <option value="all" style={{ background: "#1e1b4b" }}>All Departments</option>
                {departments.map((d: any) => (
                  <option key={d} value={d} style={{ background: "#1e1b4b" }}>{d}</option>
                ))}
              </select>

              {/* Reset */}
              <button
                onClick={() => { setSearch(""); setRoleFilter("all"); setDepartmentFilter("all"); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "11px 14px", borderRadius: 12,
                  border: `1px solid ${hasActiveFilters ? "rgba(124,58,237,0.3)" : T.glassBorder}`,
                  background: hasActiveFilters ? T.accentSoft : "rgba(255,255,255,0.03)",
                  color: hasActiveFilters ? T.accentLight : T.muted,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all .2s",
                }}
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </GlassCard>
        </motion.div>

        {/* ============ RESULTS COUNT ============ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "0 4px" }}>
          <span style={{ fontSize: 13, color: T.muted }}>
            Showing <span style={{ fontWeight: 700, color: T.bright }}>{filteredMembers.length}</span> of{" "}
            <span style={{ fontWeight: 700, color: T.bright }}>{members.length}</span> members
          </span>
        </div>

        {/* ============ MEMBER TABLE ============ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <GlassCard style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Employee", "Role", "Department", "Contact", "Status", "Actions"].map((h) => (
                      <th key={h} style={{
                        textAlign: "left", padding: "16px 18px", fontSize: 11,
                        fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                        color: T.accentLight, background: "rgba(124,58,237,0.06)",
                        borderBottom: `1px solid ${T.glassBorder}`,
                        whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 48, textAlign: "center", color: T.muted, fontSize: 14 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <Search size={32} style={{ opacity: 0.3 }} />
                          <span>No members found matching your filters</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m: any, idx: number) => {
                      const isHovered = hoveredRow === m.id;
                      const isToggling = togglingId === m.id;
                      return (
                        <motion.tr
                          key={m.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          onMouseEnter={() => setHoveredRow(m.id)}
                          onMouseLeave={() => setHoveredRow(null)}
                          onClick={() => setSelected(m)}
                          style={{
                            background: isHovered ? T.glassHover : idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                            cursor: "pointer", transition: "background .15s",
                            borderBottom: `1px solid ${T.glassBorder}`,
                          }}
                        >
                          {/* Employee */}
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <AvatarCircle name={m.name} size={38} gradient={getRoleGradient(m.role)} />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: T.bright }}>{m.name}</div>
                                <div style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>{m.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td style={{ padding: "14px 18px" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                              letterSpacing: "0.03em", textTransform: "capitalize",
                              background: `${getRoleColor(m.role)}14`,
                              color: getRoleColor(m.role),
                              border: `1px solid ${getRoleColor(m.role)}30`,
                            }}>
                              {getRoleIcon(m.role)} {m.role}
                            </span>
                          </td>

                          {/* Department */}
                          <td style={{ padding: "14px 18px" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "4px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                              background: "rgba(255,255,255,0.04)", color: T.text,
                              border: `1px solid ${T.glassBorder}`,
                            }}>
                              <Building2 size={13} style={{ color: T.muted }} />
                              {m.department || "General"}
                            </span>
                          </td>

                          {/* Contact */}
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ fontSize: 12, color: T.muted }}>
                              {m.phone || "No phone"}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: "14px 18px" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                              background: m.active !== false ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                              color: m.active !== false ? T.green : T.rose,
                              border: `1px solid ${m.active !== false ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                            }}>
                              <span style={{
                                width: 6, height: 6, borderRadius: "50%",
                                background: m.active !== false ? T.green : T.rose,
                                boxShadow: `0 0 8px ${m.active !== false ? T.greenGlow : T.roseGlow}`,
                              }} />
                              {m.active !== false ? "Active" : "Inactive"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                              {/* Toggle Status */}
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                disabled={isToggling}
                                onClick={() => toggleEmployeeStatus(m.id)}
                                style={{
                                  width: 34, height: 34, borderRadius: 10,
                                  border: `1px solid ${m.active !== false ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
                                  background: m.active !== false ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                                  color: m.active !== false ? T.rose : T.green,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  cursor: isToggling ? "wait" : "pointer", opacity: isToggling ? 0.5 : 1,
                                  transition: "opacity .15s",
                                }}
                                title={m.active !== false ? "Deactivate" : "Activate"}
                              >
                                <Power size={15} />
                              </motion.button>

                              {/* View Details */}
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setSelected(m)}
                                style={{
                                  width: 34, height: 34, borderRadius: 10,
                                  border: `1px solid rgba(124,58,237,0.2)`,
                                  background: T.accentSoft,
                                  color: T.accentLight,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  cursor: "pointer",
                                }}
                                title="View Details"
                              >
                                <Eye size={15} />
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* ============ DRAWER ============ */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setSelected(null)}
              style={{
                position: "fixed", inset: 0, zIndex: 90,
                background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
              }}
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 200 }}
              style={{
                position: "fixed", top: 0, right: 0, bottom: 0,
                width: "min(520px, 92vw)", zIndex: 100,
                background: "linear-gradient(180deg,#0f0d2e 0%,#0a0918 100%)",
                borderLeft: `1px solid ${T.glassBorder}`,
                boxShadow: "-20px 0 80px rgba(0,0,0,0.5)",
                display: "flex", flexDirection: "column", overflow: "hidden",
              }}
            >
              {/* Drawer Header */}
              <div style={{
                padding: "20px 24px", borderBottom: `1px solid ${T.glassBorder}`,
                background: "rgba(124,58,237,0.04)",
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <AvatarCircle name={selected.name} size={56} gradient={getRoleGradient(selected.role)} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.bright }}>{selected.name}</h2>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6,
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      textTransform: "capitalize",
                      background: `${getRoleColor(selected.role)}14`,
                      color: getRoleColor(selected.role),
                      border: `1px solid ${getRoleColor(selected.role)}30`,
                    }}>
                      {getRoleIcon(selected.role)} {selected.role}
                    </span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelected(null)}
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    border: `1px solid ${T.glassBorder}`, background: T.glass,
                    color: T.muted, display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <X size={18} />
                </motion.button>
              </div>

              {/* Drawer Body */}
              <div style={{ flex: 1, overflow: "auto", padding: 24 }}>

                {/* Status Card */}
                <div style={{
                  padding: "16px 20px", borderRadius: 16, marginBottom: 20,
                  background: selected.active !== false
                    ? "linear-gradient(135deg,rgba(16,185,129,0.08),rgba(6,182,212,0.04))"
                    : "linear-gradient(135deg,rgba(239,68,68,0.08),rgba(244,63,94,0.04))",
                  border: `1px solid ${selected.active !== false ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, marginBottom: 4 }}>
                      Account Status
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      fontSize: 16, fontWeight: 800,
                      color: selected.active !== false ? T.green : T.rose,
                    }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: selected.active !== false ? T.green : T.rose,
                        boxShadow: `0 0 12px ${selected.active !== false ? T.greenGlow : T.roseGlow}`,
                      }} />
                      {selected.active !== false ? "Active" : "Inactive"}
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleEmployeeStatus(selected.id)}
                    style={{
                      padding: "8px 18px", borderRadius: 10, border: "none",
                      background: selected.active !== false
                        ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                      color: selected.active !== false ? T.rose : T.green,
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}
                  >
                    <Power size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {selected.active !== false ? "Deactivate" : "Activate"}
                  </motion.button>
                </div>

                {/* Info Cards */}
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.accentLight, marginBottom: 12 }}>
                  Contact Information
                </div>
                <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
                  {[
                    { icon: <Mail size={18} />, label: "Email", value: selected.email, color: T.blue },
                    { icon: <Phone size={18} />, label: "Phone", value: selected.phone || "Not provided", color: T.cyan },
                    { icon: <Building2 size={18} />, label: "Department", value: selected.department || "General", color: T.amber },
                    { icon: <CalendarDays size={18} />, label: "Joined", value: formatDate(selected.createdAt), color: T.green },
                  ].map((item) => (
                    <div key={item.label} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 16px", borderRadius: 14,
                      background: T.glass, border: `1px solid ${T.glassBorder}`,
                      transition: "background .15s",
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = T.glassHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = T.glass)}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: `${item.color}12`, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        color: item.color, flexShrink: 0,
                      }}>
                        {item.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.bright, marginTop: 2, wordBreak: "break-all" }}>
                          {item.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Stats (if available) */}
                {(selected.eventsCount !== undefined || selected.totalSpent !== undefined) && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.accentLight, marginBottom: 12 }}>
                      Performance
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {selected.eventsCount !== undefined && (
                        <div style={{
                          padding: "18px 16px", borderRadius: 14, textAlign: "center",
                          background: "rgba(124,58,237,0.06)", border: `1px solid rgba(124,58,237,0.12)`,
                        }}>
                          <div style={{ fontSize: 28, fontWeight: 900, color: T.accentLight }}>{selected.eventsCount}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginTop: 4, textTransform: "uppercase" }}>Events</div>
                        </div>
                      )}
                      {selected.totalSpent !== undefined && (
                        <div style={{
                          padding: "18px 16px", borderRadius: 14, textAlign: "center",
                          background: "rgba(16,185,129,0.06)", border: `1px solid rgba(16,185,129,0.12)`,
                        }}>
                          <div style={{ fontSize: 28, fontWeight: 900, color: T.green }}>
                            {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(selected.totalSpent || 0)}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginTop: 4, textTransform: "uppercase" }}>Total Spent</div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Drawer Footer */}
              <div style={{
                padding: "16px 24px", borderTop: `1px solid ${T.glassBorder}`,
                background: "rgba(124,58,237,0.03)", display: "flex", gap: 10,
              }}>
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    flex: 1, padding: "11px 0", borderRadius: 12,
                    border: `1px solid ${T.glassBorder}`, background: T.glass,
                    color: T.text, fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}