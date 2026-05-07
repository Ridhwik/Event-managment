import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthedApi } from "../lib/api";
import { useAuth } from "../state/auth";
import { motion } from "framer-motion";

export function StaffCreateEventPage() {
  const api = useAuthedApi();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { user } = useAuth();

  const [activityName, setActivityName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [date, setDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [sign, setSign] = useState("Staff");

  // ✅ Single employee email (matches backend)
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [teamLeaderEmail, setTeamLeaderEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isDirector = user?.role === "director";

  const createMut = useMutation({
    mutationFn: async () => {
      if (!isDirector) throw new Error("Only a director can create events");
      if (!activityName.trim()) throw new Error("Activity name is required");
      if (!accountNumber.trim()) throw new Error("Closing number is required");
      if (!startDate) throw new Error("Start date is required");
      if (!budget) throw new Error("Budget is required");
      if (!employeeEmail.trim()) throw new Error("Employee email is required");
      if (!sign.trim()) throw new Error("Signature is required");

      const payload: any = {
        date: date ? new Date(date).toISOString() : undefined,
        accountNumber: accountNumber.trim(),
        activityName: activityName.trim(),
        startDate: new Date(startDate).toISOString(),
        closingDate: closingDate ? new Date(closingDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        budget: Number(budget),
        cashAmount: 0,
        sign: sign.trim(),
        employeeEmail: employeeEmail.trim().toLowerCase(), // ✅ matches backend
      };

      if (teamLeaderEmail.trim()) {
        payload.teamLeaderEmail = teamLeaderEmail.trim().toLowerCase();
      }

      const res = await api.post("/user/events", payload);
      return res.data;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user"] });
      setError(null);
      nav("/staff/events", { replace: true });
    },

    onError: (err: any) => {
      console.error("Create event failed:", err?.response?.data || err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Something went wrong";
      setError(msg);
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        minHeight: "100vh",
        padding: 24,
        background:
          "radial-gradient(circle at top left, #0b1020 0%, #05060f 40%, #000 100%)",
      }}
    >
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 style={{ color: "#fff", fontSize: 30, fontWeight: 800 }}>
          ✨ Create Event
        </h1>
        <p style={{ color: "#94a3b8", maxWidth: 600 }}>
          Build structured closing sheet events with employees and budget tracking.
        </p>
      </motion.div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          marginTop: 20,
          padding: 24,
          maxWidth: 650,
          borderRadius: 24,
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(236,72,153,0.08), rgba(34,211,238,0.08))",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(24px)",
          boxShadow:
            "0 0 50px rgba(99,102,241,0.18), 0 0 80px rgba(236,72,153,0.12)",
        }}
      >
        <form
          style={{ display: "grid", gap: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
          }}
        >
          <Field label="Activity Name *">
            <Input value={activityName} onChange={setActivityName} />
          </Field>

          <Field label="Closing Number *">
            <Input value={accountNumber} onChange={setAccountNumber} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Event Date">
              <Input type="date" value={date} onChange={setDate} />
            </Field>
            <Field label="Start Date *">
              <Input type="date" value={startDate} onChange={setStartDate} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Closing Date">
              <Input type="date" value={closingDate} onChange={setClosingDate} />
            </Field>
            <Field label="End Date">
              <Input type="date" value={endDate} onChange={setEndDate} />
            </Field>
          </div>

          <Field label="Budget (₹) *">
            <Input type="number" value={budget} onChange={setBudget} />
          </Field>

          <Field label="Signature *">
            <Input value={sign} onChange={setSign} />
          </Field>

          {/* ✅ SINGLE Employee Email */}
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              background:
                "linear-gradient(135deg, rgba(34,211,238,0.08), rgba(236,72,153,0.06))",
              border: "1px solid rgba(34,211,238,0.18)",
            }}
          >
            <div style={{ color: "#fff", fontWeight: 700, marginBottom: 10 }}>
              Employee Email *
            </div>
            <Input
              value={employeeEmail}
              onChange={setEmployeeEmail}
              placeholder="employee@email.com"
            />
          </div>

          <Field label="Team Leader Email (optional)">
            <Input value={teamLeaderEmail} onChange={setTeamLeaderEmail} />
          </Field>

          {error && (
            <div
              style={{
                color: "#f87171",
                padding: 10,
                borderRadius: 10,
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.3)",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <motion.button
            whileHover={{ scale: createMut.isPending ? 1 : 1.03 }}
            whileTap={{ scale: createMut.isPending ? 1 : 0.97 }}
            type="submit"
            disabled={createMut.isPending}
            style={{
              padding: "12px",
              borderRadius: 14,
              border: "none",
              fontWeight: 800,
              color: "#fff",
              background: createMut.isPending
                ? "rgba(99,102,241,0.5)"
                : "linear-gradient(135deg, #6366f1, #ec4899, #22d3ee)",
              boxShadow:
                "0 10px 30px rgba(99,102,241,0.25), 0 0 30px rgba(236,72,153,0.18)",
              cursor: createMut.isPending ? "not-allowed" : "pointer",
            }}
          >
            {createMut.isPending ? "Submitting..." : "Submit Event"}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      type={type}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "11px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.35)",
        color: "#fff",
        outline: "none",
        transition: "0.25s",
      }}
    />
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, color: "#94a3b8" }}>{label}</div>
      {children}
    </div>
  );
}