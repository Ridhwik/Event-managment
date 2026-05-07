import { useQuery } from "@tanstack/react-query";
import { useAuthedApi } from "../lib/api";
import { motion } from "framer-motion";

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

type Ev = {
  _id: string;
  activityName?: string;
  Clossing_Number?: string;
  budget?: number;
  employeeAssignments?: Array<{
    employee?: { email?: string; name?: string };
  }>;
};

export function StaffEventsPage() {
  const api = useAuthedApi();

  const { data, isLoading } = useQuery({
    queryKey: ["user", "events", "assigned"],
    queryFn: async () => (await api.get("/user/events/assigned")).data
  });

  const events = (data?.events ?? []) as Ev[];

  return (
    <div style={{ padding: 10 }}>
      <div className="pageTitle">
        <h1 style={{ color: "white" }}>My Assigned Events</h1>
      </div>

      <p className="muted" style={{ marginBottom: 18, maxWidth: 640 }}>
        Track all events where you are assigned as Director or Team Leader.
      </p>

      {isLoading ? (
        <div className="muted">Loading…</div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {events.map((e, i) => (
          <motion.div
            key={e._id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.02 }}
            style={{
              padding: 16,
              borderRadius: 16,
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              color: "white"
            }}
          >
            {/* HEADER */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                {e.activityName}
              </div>

              <div
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(59,130,246,0.2)",
                  color: "#60a5fa",
                  border: "1px solid rgba(59,130,246,0.4)"
                }}
              >
                ACTIVE
              </div>
            </div>

            {/* SUB INFO */}
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Account: {e.Clossing_Number ?? "—"}
            </div>

            {/* BUDGET */}
            <div
              style={{
                marginTop: 10,
                display: "inline-block",
                padding: "6px 10px",
                borderRadius: 10,
                background: "rgba(34,197,94,0.15)",
                color: "#22c55e",
                fontWeight: 700,
                fontSize: 13
              }}
            >
              Budget: {formatINR(Number(e.budget ?? 0))}
            </div>

            {/* EMPLOYEES */}
            {e.employeeAssignments?.length ? (
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Team Members
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {e.employeeAssignments.map((a, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: 12,
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.1)"
                      }}
                    >
                      {a.employee?.name ?? a.employee?.email ?? "Unknown"}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        ))}

        {events.length === 0 && !isLoading ? (
          <div className="muted">No events assigned to you right now.</div>
        ) : null}
      </div>
    </div>
  );
}