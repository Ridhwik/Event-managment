// pages/BillSheetPage.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { EventBillReplica } from "./EventBillReplica";
import {
  fetchBillsByEmployeeForEvent,
  saveBillSheet,
  mapApiBillToEditable,
  mapEditableDataToApi,
} from "../api/billApi";
import type {
  EditableBillData,
  ApiBillResponse,
} from "./BillSheetTypes";

// ── Empty default state ──
const EMPTY_BILL_DATA: EditableBillData = {
  eventName: "",
  eventDate: "",
  venue: "",
  sectionTitle: "INFRASTRUCTURE",
  sections: [],
  totals: { total: 0, finalTotal: 0 },
};

export default function BillSheetPage() {
  const { employeeId, eventId } = useParams<{
    employeeId: string;
    eventId: string;
  }>();

  // ── State ──
  const [bills, setBills] = useState<ApiBillResponse[]>([]);
  const [activeBillIndex, setActiveBillIndex] = useState(0);
  const [billData, setBillData] = useState<EditableBillData>(EMPTY_BILL_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const activeBillId = useRef<string>("");

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // FETCH BILLS FROM API
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  const loadBills = useCallback(async () => {
    if (!employeeId || !eventId) {
      setError("Missing employeeId or eventId");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetchBillsByEmployeeForEvent(
        employeeId,
        eventId
      );

      if (!response.data || response.data.length === 0) {
        setError("No bills found for this employee in this event");
        setBills([]);
        setBillData(EMPTY_BILL_DATA);
        setLoading(false);
        return;
      }

      setBills(response.data);

      // ── Map first bill to editable format ──
      const firstBill = response.data[0];
      activeBillId.current = firstBill._id;
      const mappedData = mapApiBillToEditable(firstBill);
      setBillData(mappedData);

      setLoading(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch bills";
      setError(message);
      setLoading(false);
    }
  }, [employeeId, eventId]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // SWITCH BETWEEN BILLS
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  const switchBill = useCallback(
    (index: number) => {
      if (index < 0 || index >= bills.length) return;
      setActiveBillIndex(index);
      activeBillId.current = bills[index]._id;
      const mappedData = mapApiBillToEditable(bills[index]);
      setBillData(mappedData);
    },
    [bills]
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // SAVE BILL TO API
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  const handleSave = useCallback(
    async (updatedData: EditableBillData) => {
      if (!activeBillId.current) {
        setSaveMessage("No bill selected");
        return;
      }

      try {
        setSaving(true);
        setSaveMessage("");

        // 1️⃣ Save to API
        const savedBill = await saveBillSheet(
          activeBillId.current,
          updatedData
        );

        // 2️⃣ Update local bills array
        setBills((prev) =>
          prev.map((b) =>
            b._id === activeBillId.current ? { ...b, ...savedBill } : b
          )
        );

        // 3️⃣ Update local data
        setBillData(updatedData);

        setSaveMessage("✓ Bill saved successfully");
        setTimeout(() => setSaveMessage(""), 3000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save bill";
        setSaveMessage(`✕ ${message}`);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // PRINT HANDLER
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // LOADING STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading bill sheet...</p>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // ERROR STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>⚠ {error}</p>
        <button onClick={loadBills} style={styles.retryBtn}>
          Retry
        </button>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div style={styles.pageContainer}>
      {/* ── Top Bar ── */}
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <span style={styles.icon}>📄</span>
          <h1 style={styles.pageTitle}>Editable Bill Sheet</h1>
        </div>
        <div style={styles.topBarRight}>
          {saveMessage && (
            <span
              style={{
                ...styles.saveMessage,
                color: saveMessage.startsWith("✓") ? "#16a34a" : "#dc2626",
              }}
            >
              {saveMessage}
            </span>
          )}
          <button onClick={handlePrint} style={styles.printBtn}>
            🖨 Print
          </button>
        </div>
      </div>

      {/* ── Bill Tabs (if multiple bills) ── */}
      {bills.length > 1 && (
        <div style={styles.tabsContainer}>
          {bills.map((bill, idx) => (
            <button
              key={bill._id}
              onClick={() => switchBill(idx)}
              style={{
                ...styles.tabBtn,
                ...(idx === activeBillIndex ? styles.tabBtnActive : {}),
              }}
            >
              {bill.entityName || `Bill ${idx + 1}`}
              <span style={styles.tabStatus}>{bill.status}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Bill Meta Info ── */}
      {bills.length > 0 && (
        <div style={styles.metaContainer}>
          <MetaCard
            label="Entity"
            value={bills[activeBillIndex]?.entityName || "—"}
          />
          <MetaCard
            label="Status"
            value={bills[activeBillIndex]?.status || "—"}
            highlight
          />
          <MetaCard
            label="Paid By"
            value={bills[activeBillIndex]?.paidBy || "—"}
          />
          <MetaCard
            label="Payment"
            value={bills[activeBillIndex]?.paymentType || "—"}
          />
          <MetaCard
            label="GST"
            value={`${bills[activeBillIndex]?.gstPercentage || 0}%`}
          />
          <MetaCard
            label="Contact"
            value={bills[activeBillIndex]?.contactPerson?.name || "—"}
          />
        </div>
      )}

      {/* ── Voucher Image ── */}
      {bills[activeBillIndex]?.voucherUrl && (
        <div style={styles.voucherContainer}>
          <a
            href={bills[activeBillIndex].voucherUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.voucherLink}
          >
            📎 View Bill Voucher
          </a>
        </div>
      )}

      {/* ── Main Editable Bill Sheet ── */}
      <EventBillReplica value={billData} onChange={handleSave} />
    </div>
  );
}

// ── Meta Card Sub-component ──
function MetaCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={styles.metaCard}>
      <span style={styles.metaLabel}>{label}</span>
      <span
        style={{
          ...styles.metaValue,
          ...(highlight ? styles.metaHighlight : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━
// STYLES
// ━━━━━━━━━━━━━━━━━━━━━━━━
const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    padding: "16px 20px",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  topBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  topBarRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  icon: { fontSize: "24px" },
  pageTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  printBtn: {
    padding: "8px 20px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    backgroundColor: "#ffffff",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
  },
  saveMessage: {
    fontSize: "13px",
    fontWeight: 600,
  },
  tabsContainer: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
    overflowX: "auto" as const,
  },
  tabBtn: {
    padding: "10px 20px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    backgroundColor: "#ffffff",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  tabBtnActive: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    borderColor: "#0f172a",
  },
  tabStatus: {
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    backgroundColor: "rgba(255,255,255,0.2)",
    textTransform: "uppercase" as const,
    fontWeight: 700,
  },
  metaContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    marginBottom: "20px",
  },
  metaCard: {
    padding: "12px 16px",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  metaLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase" as const,
  },
  metaValue: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
  },
  metaHighlight: {
    color: "#2563eb",
    textTransform: "capitalize" as const,
  },
  voucherContainer: {
    marginBottom: "16px",
  },
  voucherLink: {
    color: "#2563eb",
    fontWeight: 600,
    fontSize: "13px",
    textDecoration: "none",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    gap: "16px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #e5e7eb",
    borderTopColor: "#0f172a",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    color: "#6b7280",
    fontSize: "14px",
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    minHeight: "300px",
    gap: "16px",
  },
  errorText: {
    color: "#dc2626",
    fontSize: "15px",
    fontWeight: 600,
  },
  retryBtn: {
    padding: "10px 24px",
    backgroundColor: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "13px",
  },
};