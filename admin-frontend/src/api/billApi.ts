import type {
  ApiBillListResponse,
  ApiBillResponse,
  EditableBillData,
  EditableBillSection,
  EditableBillRow,
} from "../views/BillSheetTypes";

const API_ORIGIN = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const API_PREFIX = `${API_ORIGIN}/api`;

// ── Auth ──
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("token") || "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ─────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────
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
    throw new Error(err.message || `Error ${res.status}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────
// SAVE
// ─────────────────────────────────────────────
export async function saveBillSheet(
  billId: string,
  billSheetData: EditableBillData
): Promise<ApiBillResponse> {
  const payload = mapEditableDataToApi(billSheetData);

  const res = await fetch(`${API_PREFIX}/admin/bills/${billId}/sheet`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

// ─────────────────────────────────────────────
// MAP: API → UI (FIXED REMARKS)
// ─────────────────────────────────────────────
export function mapApiBillToEditable(
  bill: ApiBillResponse
): EditableBillData {
  let sections: EditableBillSection[] = [];

  if (bill.billSheet && typeof bill.billSheet === "object") {
    const sheet: any = bill.billSheet;

    if (Array.isArray(sheet.sections)) {
      sections = sheet.sections.map((sec: any, idx: number) => ({
        key: sec.key || String.fromCharCode(65 + idx),
        title: sec.title || sec.sectionTitle || "",
        items: (sec.items || sec.rows || []).map(
          (row: any, rowIdx: number): EditableBillRow => ({
            srNo: row.srNo ?? rowIdx + 1,
            particular: row.particular || row.particulars || "",
            quantity: row.quantity ?? row.qty ?? 0,
            size: row.size || row.sizes || "",
            rate: row.rate ?? 0,
            amount: row.amount ?? 0,

            // ✅ FIXED
            remarks: row.remarks ?? row.remark ?? "",
          })
        ),
      }));
    }
  }

  return {
    eventName: bill.event?.activityName || "",
    eventDate: bill.event?.startDate || "",
    venue: bill.event?.venue || "",
    sectionTitle: bill.category || "INFRASTRUCTURE",
    sections,
    totals: {
      total: bill.amount || 0,
      finalTotal: bill.totalWithGst || bill.amount || 0,
    },
  };
}

// ─────────────────────────────────────────────
// MAP: UI → API (FIXED REMARKS)
// ─────────────────────────────────────────────
export function mapEditableDataToApi(data: EditableBillData) {
  const sections = data.sections.map((sec) => ({
    key: sec.key,
    sectionTitle: sec.title,
    rows: sec.items.map((row) => ({
      srNo: row.srNo,
      particulars: row.particular,
      qty: row.quantity,
      sizes: row.size,
      rate: row.rate,
      amount: row.amount,

      // ✅ FIXED
      remarks: row.remarks,
      remark: row.remarks,
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
    billSheet: { sections, grandTotal },
    amount: data.totals.finalTotal || grandTotal,
    category: data.sectionTitle,
  };
}