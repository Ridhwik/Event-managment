/// services/billApi.ts
import type {
  ApiBillListResponse,
  ApiBillResponse,
  EditableBillData,
  EditableBillSection,
  EditableBillRow,
} from "./BillSheetTypes";

// NOTE: prefer relative `/api` in dev (Vite proxy), or set VITE_API_URL in prod.
const API_ORIGIN = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const API_PREFIX = `${API_ORIGIN}/api`;

// ── Get auth token ──
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("token") || "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FETCH — Bills by employee for a specific event
// GET /api/admin/employee/:employeeId/event/:eventId
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function fetchBillsByEmployeeForEvent(
  employeeId: string,
  eventId: string
): Promise<ApiBillListResponse> {
  const res = await fetch(
    `${API_PREFIX}/admin/bills/employee/${employeeId}/event/${eventId}`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || `Error ${res.status}`
    );
  }

  return res.json();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SAVE — Update bill sheet data
// PUT /api/admin/bills/:billId/sheet
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function saveBillSheet(
  billId: string,
  billSheetData: EditableBillData
): Promise<ApiBillResponse> {
  const payload = mapEditableDataToApi(billSheetData);

  const res = await fetch(
    `${API_PREFIX}/admin/bills/${billId}/sheet`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || `Error ${res.status}`
    );
  }

  const json = await res.json();
  return json.data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAPPER: API Response → EditableBillData (for UI)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function mapApiBillToEditable(
  bill: ApiBillResponse
): EditableBillData {
  // ── Parse billSheet from API (Mixed type) ──
  let sections: EditableBillSection[] = [];

  if (bill.billSheet && typeof bill.billSheet === "object") {
    const sheet = bill.billSheet as {
      sections?: Array<{
        key?: string;
        title?: string;
        sectionTitle?: string;
        items?: Array<{
          srNo?: number;
          particular?: string;
          particulars?: string;
          quantity?: number;
          qty?: number;
          size?: string;
          sizes?: string;
          rate?: number;
          amount?: number;
          remarks?: string;
        }>;
        rows?: Array<{
          srNo?: number;
          particular?: string;
          particulars?: string;
          quantity?: number;
          qty?: number;
          size?: string;
          sizes?: string;
          rate?: number;
          amount?: number;
          remarks?: string;
        }>;
      }>;
    };

    if (Array.isArray(sheet.sections)) {
      sections = sheet.sections.map((sec, idx) => ({
        key: sec.key || String.fromCharCode(65 + idx), // A, B, C...
        title: sec.title || sec.sectionTitle || "",
        items: (sec.items || sec.rows || []).map(
          (row, rowIdx): EditableBillRow => ({
            srNo: row.srNo ?? rowIdx + 1,
            particular: row.particular || row.particulars || "",
            quantity: row.quantity ?? row.qty ?? 0,
            size: row.size || row.sizes || "",
            rate: row.rate ?? 0,
            amount: row.amount ?? 0,
            remarks: row.remarks || "",
          })
        ),
      }));
    }
  }

  // ── Format event date ──
  let eventDate = "";
  if (bill.event?.startDate) {
    try {
      eventDate = new Date(bill.event.startDate).toISOString();
    } catch {
      eventDate = bill.event.startDate;
    }
  }

  return {
    eventName: bill.event?.activityName || "",
    eventDate,
    venue: bill.event?.venue || "",
    sectionTitle: bill.category || "INFRASTRUCTURE",
    sections,
    totals: {
      total: bill.amount || 0,
      finalTotal: bill.totalWithGst || bill.amount || 0,
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAPPER: EditableBillData → API payload (for save)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function mapEditableDataToApi(data: EditableBillData) {
  const sections = data.sections
    .filter((sec) => sec.items.length > 0) // skip empty sections
    .map((sec) => ({
      key: sec.key,
      sectionTitle: sec.title,
      rows: sec.items.map((row) => ({
        srNo: row.srNo,
        particulars: row.particular,
        qty: row.quantity,
        sizes: row.size,
        rate: row.rate,
        amount: row.amount,
        remarks: row.remarks,
      })),
      sectionTotal: sec.items.reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0
      ),
    }));

  const grandTotal = sections.reduce(
    (sum, sec) => sum + sec.sectionTotal,
    0
  );

  return {
    billSheet: {
      sections,
      grandTotal,
    },
    amount: data.totals.finalTotal || data.totals.total || grandTotal,
    category: data.sectionTitle,
  };
}