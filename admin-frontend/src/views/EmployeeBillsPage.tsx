import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { type TaskCategory } from "../constants/taskCategories";
import { useAuthedApi } from "../lib/api";

type EventOption = { _id: string; activityName?: string };
type BillRow = {
  _id: string;
  entityName?: string;
  particulars?: string;
  amount?: number;
  gstPercentage?: number;
  paymentType?: "full" | "token";
  tokenAmount?: number;
  paidBy?: "company" | "self" | "own";
  voucherUrl?: string;
  status?: string;
  event?: { _id?: string; activityName?: string } | null;
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

export function EmployeeBillsPage() {
  const categoryOptions: Array<{ value: TaskCategory; label: string }> = [
    { value: "infrastructure", label: "A. Setup and Infrastructure" },
    { value: "furniture_rentals", label: "B. Tentage / Furniture" },
    { value: "technical", label: "D. Technicals" },
    { value: "services", label: "E. Services" },
    { value: "entertainment", label: "F. Entertainment" },
    { value: "other", label: "Other" }
  ];

  const api = useAuthedApi();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  const { data: evData } = useQuery({
    queryKey: ["events"],
    queryFn: async () => (await api.get("/user/employee/events")).data
  });

  const { data: billData, isLoading } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => (await api.get("/user/employee/bills")).data,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 10000
  });

  const events = (evData?.events ?? []) as EventOption[];
  const bills = (billData?.bills ?? []) as BillRow[];
  const preselectedEventId = searchParams.get("eventId") ?? "";
  const requestedAction = searchParams.get("action");

  const [showForm, setShowForm] = useState(requestedAction === "create");

  const [eventId, setEventId] = useState(preselectedEventId);
  const [category, setCategory] = useState<TaskCategory | "">("");
  const [entityName, setEntityName] = useState("");
  const [particulars, setParticulars] = useState("");
  const [amount, setAmount] = useState("");
  const [gstPercentage, setGstPercentage] = useState("");
  const [paymentType, setPaymentType] = useState<"full" | "token">("full");
  const [tokenAmount, setTokenAmount] = useState("");
  const [paidBy, setPaidBy] = useState<"company" | "self">("company");
  const [billImage, setBillImage] = useState<File | null>(null);
  const [previewBillId, setPreviewBillId] = useState("");
  const [editingBillId, setEditingBillId] = useState("");
  const [existingVoucherUrl, setExistingVoucherUrl] = useState("");

  const baseAmount = Number(amount) || 0;
  const gstPct = Number(gstPercentage) || 0;
  const totalWithGst = baseAmount > 0 ? baseAmount + (baseAmount * gstPct) / 100 : 0;
  const selectedEvent = events.find((e) => e._id === eventId) ?? null;
  const visibleBills = eventId
    ? bills.filter((b) => {
        const billEvent = b.event as ({ _id?: string; activityName?: string } | null | undefined);
        return String(billEvent?._id ?? "") === String(eventId);
      })
    : bills;
  const previewBill =
    visibleBills.find((b) => String(b._id) === String(previewBillId)) ?? visibleBills[0] ?? null;

  useEffect(() => {
    if (requestedAction !== "view") {
      return;
    }
    if (visibleBills.length === 0) {
      setPreviewBillId("");
      return;
    }
    setPreviewBillId((prev) => (prev ? prev : String(visibleBills[0]._id)));
  }, [requestedAction, visibleBills]);

  const submit = useMutation({
    mutationFn: async () => {
      const a = Number(amount);
      const g = Number(gstPercentage || 0);
      const totalAmount = a + (a * g) / 100;
      const token = Number(tokenAmount || 0);
      if (!entityName || !particulars.trim() || !eventId || !category || a <= 0 || g < 0 || !billImage) {
        throw new Error("Fill all fields properly");
      }
      if (!["full", "token"].includes(paymentType)) {
        throw new Error("Select payment type");
      }
      if (!["company", "self"].includes(paidBy)) {
        throw new Error("Select payment source");
      }
      if (paymentType === "token") {
        if (token <= 0) {
          throw new Error("Token amount is required");
        }
        if (token > totalAmount) {
          throw new Error("Token amount cannot exceed total bill");
        }
      }

      const form = new FormData();
      form.append("billImage", billImage as File);

      const upload = await api.post("/user/employee/bills/upload-image", form);
      const url = upload.data?.data?.url;

      const payload = {
        entityName,
        particulars,
        amount: totalAmount,
        gstPercentage: g,
        paymentType,
        tokenAmount: paymentType === "token" ? token : 0,
        paidBy,
        event: eventId,
        category,
        voucherUrl: url
      };

      await api.post("/user/employee/bills", payload);
    },
    onSuccess: () => {
      setShowForm(false);
      setEntityName("");
      setParticulars("");
      setAmount("");
      setGstPercentage("");
      setPaymentType("full");
      setTokenAmount("");
      setPaidBy("company");
      setBillImage(null);
      setExistingVoucherUrl("");
      setEditingBillId("");
      qc.invalidateQueries({ queryKey: ["bills"] });
    }
  });

  const updateBill = useMutation({
    mutationFn: async () => {
      if (!editingBillId) {
        throw new Error("No bill selected for edit");
      }
      const a = Number(amount);
      const g = Number(gstPercentage || 0);
      const totalAmount = a + (a * g) / 100;
      const token = Number(tokenAmount || 0);

      if (!entityName || !particulars.trim() || !eventId || !category || a <= 0 || g < 0) {
        throw new Error("Fill all fields properly");
      }
      if (paymentType === "token" && (token <= 0 || token > totalAmount)) {
        throw new Error("Enter a valid token amount");
      }

      let voucherUrl = existingVoucherUrl;
      if (billImage) {
        const form = new FormData();
        form.append("billImage", billImage);
        const upload = await api.post("/user/employee/bills/upload-image", form);
        voucherUrl = String(upload.data?.data?.url ?? "").trim();
      }

      if (!voucherUrl) {
        throw new Error("Bill image is required");
      }

      await api.put(`/user/employee/bills/${editingBillId}`, {
        entityName,
        particulars,
        amount: totalAmount,
        gstPercentage: g,
        paymentType,
        tokenAmount: paymentType === "token" ? token : 0,
        paidBy,
        event: eventId,
        category,
        voucherUrl
      });
    },
    onSuccess: () => {
      setShowForm(false);
      setEntityName("");
      setParticulars("");
      setAmount("");
      setGstPercentage("");
      setPaymentType("full");
      setTokenAmount("");
      setPaidBy("company");
      setBillImage(null);
      setExistingVoucherUrl("");
      setEditingBillId("");
      qc.invalidateQueries({ queryKey: ["bills"] });
    }
  });

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: "auto" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Bills</h1>

        <button
          className="btn primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Close Form" : "Add New Bill"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 14, padding: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Event-specific bill management
        </div>
        <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">All my events</option>
          {events.map((e) => (
            <option key={e._id} value={e._id}>
              {e.activityName}
            </option>
          ))}
        </select>
        {selectedEvent ? (
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Viewing bills for <strong>{selectedEvent.activityName}</strong>
          </div>
        ) : null}
      </div>

      {/* ✅ INLINE FORM (NO POPUP) */}
      {showForm && (
        <div className="card" style={{ padding: 16, marginTop: 20, borderColor: "rgba(168,85,247,0.28)" }}>
          <div style={{ fontWeight: 750, marginBottom: 10 }}>
            {editingBillId ? "Edit Bill" : "New Bill"}
          </div>

          <div style={{ display: "grid", gap: 10, maxWidth: 480 }}>
            
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

            <select
              className="input"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as TaskCategory)
              }
            >
              <option value="">Select Category</option>
              {categoryOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <input
              className="input"
              placeholder="Vendor / Title"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
            />

            <textarea
              className="input"
              placeholder="Particulars (bill details)"
              value={particulars}
              onChange={(e) => setParticulars(e.target.value)}
              rows={3}
              style={{ resize: "vertical" }}
            />

            <input
              className="input"
              type="number"
              placeholder="Amount (before GST)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <input
              className="input"
              type="number"
              placeholder="GST %"
              value={gstPercentage}
              onChange={(e) => setGstPercentage(e.target.value)}
            />

            <div className="card" style={{ padding: 10, fontSize: 13 }}>
              <div className="muted">Total including GST</div>
              <div style={{ fontWeight: 800, marginTop: 2 }}>
                {formatINR(Number(totalWithGst.toFixed(2)))}
              </div>
            </div>

            <select
              className="input"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as "full" | "token")}
            >
              <option value="full">Full</option>
              <option value="token">Token</option>
            </select>

            {paymentType === "token" ? (
              <input
                className="input"
                type="number"
                placeholder="Token Amount"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
              />
            ) : null}

            <select
              className="input"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value as "company" | "self")}
            >
              <option value="company">Paid by Company</option>
              <option value="self">Paid by Self</option>
            </select>

            <input
              type="file"
              className="input"
              onChange={(e) =>
                setBillImage(e.target.files?.[0] ?? null)
              }
            />
            {existingVoucherUrl && !billImage ? (
              <div className="muted" style={{ fontSize: 12 }}>
                Existing bill image will be kept unless you upload a new one.
              </div>
            ) : null}

            <button
              className="btn primary"
              onClick={() => {
                if (editingBillId) {
                  updateBill.mutate();
                } else {
                  submit.mutate();
                }
              }}
            >
              {editingBillId ? "Update Bill" : "Submit Bill"}
            </button>
          </div>
        </div>
      )}

      {/* LIST */}
      <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
        {isLoading && <div>Loading...</div>}

        {previewBill?.voucherUrl ? (
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 750, marginBottom: 10 }}>Bill Image Preview</div>
            <img
              src={previewBill.voucherUrl}
              alt={previewBill.entityName ?? "Bill image"}
              style={{
                width: "100%",
                maxHeight: 420,
                objectFit: "contain",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(5,8,14,0.55)"
              }}
            />
          </div>
        ) : null}

        {visibleBills.map((b) => (
          <div key={b._id} className="card" style={{ padding: 18, borderColor: "rgba(59,130,246,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {b.entityName ?? "Bill"}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {b.event?.activityName}
                </div>
                {String(b.particulars || "").trim() ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Particulars: {String(b.particulars)}
                  </div>
                ) : null}
                {typeof b.gstPercentage === "number" ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    GST: {b.gstPercentage}%
                  </div>
                ) : null}
              </div>

              <div style={{ textAlign: "right" }}>
                {(() => {
                  const canEdit = ["pending", "review"].includes(
                    String(b.status ?? "").trim().toLowerCase()
                  );
                  return (
                    <>
                <div style={{ fontWeight: 800 }}>
                  {formatINR(Number(b.amount ?? 0))}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {String(b.paymentType ?? "full").toUpperCase()} · Paid by{" "}
                  {String(b.paidBy === "own" ? "self" : b.paidBy ?? "company")}
                </div>
                {b.paymentType === "token" ? (
                  <div className="muted" style={{ fontSize: 12 }}>
                    Token: {formatINR(Number(b.tokenAmount ?? 0))}
                  </div>
                ) : null}
                <div style={{ fontSize: 12 }}>
                  {String(b.status ?? "")}
                </div>
                <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={!canEdit}
                    title={
                      canEdit
                        ? "Edit this bill"
                        : "Only pending/review bills can be edited"
                    }
                    onClick={() => {
                      if (!canEdit) {
                        return;
                      }
                      const gross = Number(b.amount ?? 0);
                      const g = Number(b.gstPercentage ?? 0);
                      const base = g >= 0 ? gross / (1 + g / 100) : gross;
                      setEditingBillId(String(b._id));
                      setShowForm(true);
                      setEntityName(String(b.entityName ?? ""));
                      setParticulars(String(b.particulars ?? ""));
                      setAmount(base > 0 ? base.toFixed(2) : "");
                      setGstPercentage(String(g || 0));
                      setPaymentType((b.paymentType ?? "full") as "full" | "token");
                      setTokenAmount(
                        b.paymentType === "token" ? String(Number(b.tokenAmount ?? 0)) : ""
                      );
                      setPaidBy(
                        (b.paidBy === "self" || b.paidBy === "own" ? "self" : "company") as
                          | "company"
                          | "self"
                      );
                      setEventId(String(b.event?._id ?? ""));
                      setExistingVoucherUrl(String(b.voucherUrl ?? ""));
                      setBillImage(null);
                    }}
                  >
                    Edit Bill
                  </button>
                </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        ))}

        {visibleBills.length === 0 && !isLoading && (
          <div>No bills found for this event.</div>
        )}
      </div>
    </div>
  );
}