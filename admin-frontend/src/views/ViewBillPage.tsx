import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { EventBillReplica } from "./EventBillReplica";
import { useAuthedApi } from "../lib/api";
import type { EditableBillData, EditableBillSection } from "./BillSheetTypes";

type ViewBillLocationState = {
  eventId?: string;
  eventName?: string;
  eventDate?: string;
  venue?: string;
};

type ApiBillRow = {
  srNo?: number;
  billId?: string;
  particular?: string;
  quantity?: number;
  size?: string;
  rate?: number;
  amount?: number;
  remarks?: string;
  vendorName?: string;
  category?: string;
};

type ApiSection = {
  key?: string;
  title?: string;
  items?: ApiBillRow[];
};

type ApiEventBillsResponse = {
  eventId?: string;
  eventName?: string;
  eventDate?: string | null;
  venue?: string;
  sections?: ApiSection[];
  totals?: {
    total?: number;
    finalTotal?: number;
  };
  bills?: Array<{
    billId?: string;
    vendorName?: string;
    category?: string;
    amount?: number;
    remark?: string;
    particulars?: string;
  }>;
};

const EMPTY_DATA: EditableBillData = {
  eventName: "",
  eventDate: "",
  venue: "",
  sectionTitle: "INFRASTRUCTURE",
  sections: [],
  totals: { total: 0, finalTotal: 0 },
};

function formatDate(dateValue?: string | null) {
  if (!dateValue) return "";
  const dt = new Date(dateValue);
  return Number.isNaN(dt.getTime())
    ? String(dateValue)
    : dt.toLocaleDateString("en-IN");
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toEditableSections(
  sections?: ApiSection[]
): EditableBillSection[] {
  if (!Array.isArray(sections)) return [];

  return sections.map((section, idx) => ({
    key: String(section.key || String.fromCharCode(65 + idx)),
    title: String(section.title || "Section"),
    items: (section.items || []).map((row, ridx) => {
      const quantity = toNumber(row.quantity, 0);
      const rate = toNumber(row.rate, 0);

      // UI contract for this page:
      // - "Particulars" should display employee "Bill Details" (backend: bill.description)
      // - "Remarks" should display "Vendor Name" (backend: bill.entityName)
      const clean = (v: any) => String(v || "").trim();
      const billDetails = clean(row.remarks) || clean(row.particular);
      const vendorName = clean(row.vendorName) || "";

      return {
        srNo: toNumber(row.srNo, ridx + 1),
        particular: billDetails,
        quantity,
        size: String(row.size || ""),
        rate,
        amount: toNumber(row.amount, quantity * rate),
        remarks: vendorName,
        billId: row.billId ? String(row.billId) : undefined,
        vendorName: vendorName,
        category: String(row.category || section.title || ""),
      };
    }),
  }));
}

export default function ViewBillPage() {
  const api = useAuthedApi();
  const { eventId = "" } = useParams<{ eventId: string }>();
  const location = useLocation();
  const state = location.state as ViewBillLocationState | null;

  const [billData, setBillData] =
    useState<EditableBillData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ================= LOAD DATA =================
  const loadEventBills = useCallback(async () => {
    if (!eventId) {
      setError("Event ID missing");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } =
        await api.get<ApiEventBillsResponse>(`/bills/${eventId}`);

      const metaMap = new Map<string, any>();

      (data.bills || []).forEach((b) => {
        if (!b.billId) return;
        metaMap.set(String(b.billId), b);
      });

      const mappedSections = toEditableSections(data.sections).map(
        (section) => ({
          ...section,
          items: section.items.map((row) => {
            const meta = row.billId ? metaMap.get(row.billId) : undefined;

            const clean = (v: any) => String(v || "").trim();
            const quantity = toNumber(row.quantity);
            const rate = toNumber(row.rate);

            return {
              ...row,
              // Keep the same UI contract as above:
              // - particular = bill details (metadata.remark)
              // - remarks = vendor name (metadata.vendorName)
              particular:
                clean(meta?.remark) ||
                clean(row.particular) ||
                clean(meta?.particulars) ||
                clean(meta?.vendorName) ||
                "",
              remarks:
                clean(meta?.vendorName) ||
                clean(row.vendorName) ||
                clean(row.remarks) ||
                "",
              vendorName:
                clean(meta?.vendorName) ||
                clean(row.vendorName) ||
                clean(row.remarks) ||
                "",
              category:
                clean(row.category) ||
                clean(meta?.category) ||
                section.title,
              amount: toNumber(
                row.amount,
                toNumber(meta?.amount, quantity * rate)
              ),
            };
          }),
        })
      );

      const computedTotal = mappedSections.reduce(
        (sum, sec) =>
          sum +
          sec.items.reduce((s, r) => s + toNumber(r.amount), 0),
        0
      );

      setBillData({
        eventName: data.eventName || state?.eventName || "",
        eventDate: data.eventDate || state?.eventDate || "",
        venue: data.venue || state?.venue || "",
        sectionTitle: "INFRASTRUCTURE",
        sections: mappedSections,
        totals: {
          total: toNumber(data.totals?.total, computedTotal),
          finalTotal: toNumber(
            data.totals?.finalTotal,
            computedTotal
          ),
        },
      });
    } catch (err: any) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [api, eventId, state]);

  useEffect(() => {
    loadEventBills();
  }, [loadEventBills]);

  // ================= SAVE =================
  const saveAll = useCallback(
    async (data: EditableBillData) => {
      setSaving(true);
      setSaveError(null);

      try {
        const updates: Promise<any>[] = [];

        data.sections.forEach((sec) => {
          sec.items.forEach((row: any) => {
            if (!row.billId) return;

            const quantity = toNumber(row.quantity);
            const rate = toNumber(row.rate);

            updates.push(
              api.put(`/admin/bills/${row.billId}`, {
                amount: quantity * rate,
                // UI swap:
                // - row.particular holds Bill Details (bill.description)
                // - row.remarks holds Vendor Name (bill.entityName)
                description: row.particular,
                entityName: row.remarks || row.vendorName,
              })
            );
          });
        });

        await Promise.all(updates);
      } catch (err: any) {
        setSaveError(err.message || "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [api]
  );

  const printSheet = () => window.print();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>{billData.eventName}</h2>
      <button onClick={printSheet}>Print</button>

      <EventBillReplica
        value={billData}
        onChange={setBillData}
        billId={eventId}
        onSaveToApi={saveAll}
        isSaving={saving}
        saveError={saveError}
      />
    </div>
  );
}