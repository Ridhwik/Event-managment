import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  type TaskCategory
} from "../constants/taskCategories";
import { useAuthedApi } from "../lib/api";

type EventOption = { _id: string; activityName?: string };

type PaymentRequestRow = {
  _id: string;
  title?: string;
  amount?: number;
  status?: string;
  category?: string;
  event?: { activityName?: string } | null;
};

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

const glass = {
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  boxShadow: "0 10px 40px rgba(0,0,0,0.4)"
};

export function EmployeePaymentRequestsPage() {
  const api = useAuthedApi();
  const qc = useQueryClient();

  const { data: evData } = useQuery({
    queryKey: ["events"],
    queryFn: async () => (await api.get("/user/employee/events")).data
  });

  const {
    data: prData,
    isLoading,
    isError
  } = useQuery({
    queryKey: ["requests"],
    queryFn: async () =>
      (await api.get("/user/employee/payment-requests")).data
  });

  const events = (evData?.events ?? []) as EventOption[];
  const list = (prData?.paymentRequests ?? []) as PaymentRequestRow[];

  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState("");
  const [category, setCategory] = useState<TaskCategory | "">("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!eventId || !category || !title || !amount) {
        throw new Error("All fields are required");
      }

      await api.post("/user/employee/payment-requests", {
        title,
        amount: Number(amount),
        event: eventId,
        category
      });
    },
    onSuccess: () => {
      setOpen(false);
      setTitle("");
      setAmount("");
      setCategory("");
      setEventId("");
      qc.invalidateQueries({ queryKey: ["requests"] });
    }
  });

  return (
    <div style={{ padding: 28, maxWidth: 1000, margin: "auto" }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Payment Requests</h1>

        <button className="btn primary" onClick={() => setOpen(true)}>
          + Create Request
        </button>
      </div>

      {/* MODAL */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "grid",
            placeItems: "center",
            zIndex: 50
          }}
        >
          <div style={{ ...glass, padding: 24, width: 400 }}>
            <h3>Create Payment Request</h3>

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>

              {/* Event */}
              <select
                className="input"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                <option value="">Select Event</option>
                {events.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.activityName}
                  </option>
                ))}
              </select>

              {/* Category */}
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
              >
                <option value="">Select Category</option>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {TASK_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>

              {/* Title */}
              <input
                className="input"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              {/* Amount */}
              <input
                className="input"
                type="number"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              {/* Error */}
              {submit.isError && (
                <div style={{ color: "red", fontSize: 12 }}>
                  {(submit.error as Error).message}
                </div>
              )}

              {/* Submit */}
              <button
                className="btn primary"
                disabled={submit.isPending}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? "Submitting..." : "Submit"}
              </button>

              <button className="btn ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      <div style={{ marginTop: 24, display: "grid", gap: 16 }}>

        {isLoading && <div>Loading...</div>}
        {isError && <div style={{ color: "red" }}>Failed to load data</div>}

        {list.map((p) => (
          <div key={p._id} style={{ ...glass, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>

              <div>
                <div style={{ fontWeight: 700 }}>
                  {p.title ?? "Payment request"}
                </div>

                <div className="muted" style={{ fontSize: 12 }}>
                  {p.event?.activityName} • {p.category}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800 }}>
                  {formatINR(Number(p.amount ?? 0))}
                </div>

                <div style={{ fontSize: 12 }}>
                  {p.status ?? ""}
                </div>
              </div>
            </div>
          </div>
        ))}

        {!isLoading && list.length === 0 && (
          <div>No requests yet</div>
        )}
      </div>
    </div>
  );
}