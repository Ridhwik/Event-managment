import { useQuery } from "@tanstack/react-query";
import { useAuthedApi } from "../lib/api";
import { motion } from "framer-motion";

export function StaffDashboardPage() {
  const api = useAuthedApi();

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["user", "dashboard"],
    queryFn: async () => (await api.get("/user/dashboard")).data,
    retry: 1
  });

  if (isLoading) return <div className="muted">Loading dashboard…</div>;
  if (error) return <div className="muted">Could not load dashboard.</div>;

  const e = data?.eventsByStatus ?? {};

  const stats = [
    {
      label: "Assigned Events",
      value: data?.totalAssignedEvents ?? 0,
      gradient: "linear-gradient(135deg, #2563eb, #1d4ed8)"
    },
    {
      label: "Running Now",
      value: data?.runningEvents ?? 0,
      gradient: "linear-gradient(135deg, #7c3aed, #6d28d9)"
    },
    {
      label: "Pending",
      value: e.pending ?? 0,
      gradient: "linear-gradient(135deg, #f59e0b, #d97706)"
    },
    {
      label: "Approved",
      value: e.approved ?? 0,
      gradient: "linear-gradient(135deg, #22c55e, #16a34a)"
    },
    {
      label: "Rejected",
      value: e.rejected ?? 0,
      gradient: "linear-gradient(135deg, #ef4444, #b91c1c)"
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="pageTitle" style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Dashboard</h1>

        {isFetching && (
          <span className="muted" style={{ fontSize: 12 }}>
            Updating…
          </span>
        )}
      </div>

      <p className="muted" style={{ marginBottom: 16, maxWidth: 560 }}>
        Overview of your assigned events with live status tracking.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 14
        }}
      >
        {stats.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ scale: 1.06 }}
            style={{
              padding: 16,
              borderRadius: 16,
              background: item.gradient,
              color: "#fff",
              boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
              position: "relative",
              overflow: "hidden"
            }}
          >
            {/* glow effect */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at top left, rgba(255,255,255,0.25), transparent 60%)",
                pointerEvents: "none"
              }}
            />

            <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 600 }}>
              {item.label.toUpperCase()}
            </div>

            <div style={{ fontSize: 30, fontWeight: 900, marginTop: 6 }}>
              {item.value}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}