import { useMemo, useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TASK_CATEGORY_LABELS,
  type TaskCategory,
} from "../constants/taskCategories";
import { useAuthedApi } from "../lib/api";
import { EditableBillSheet, type EditableBillData } from "./EditableBillSheet";
import { buildDefaultEditableBillData } from "./EditableBillSheetDefaults";
import "../App.css";

/* ── helpers ── */
function formatINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency", currency: "INR", maximumFractionDigits: 0,
    }).format(n);
  } catch { return `₹${n}`; }
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (
    err && typeof err === "object" && "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (err as { response: { data: { message: string } } }).response.data.message;
  }
  return err instanceof Error ? err.message : fallback;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const TABS: Array<{ key: string; label: string; icon: string; status?: string }> = [
  { key: "all", label: "All", icon: "🗂" },
  { key: "pending", label: "Pending", icon: "⏳", status: "pending" },
  { key: "approved", label: "Approved", icon: "✅", status: "approved" },
  { key: "review", label: "Review", icon: "🔍", status: "review" },
];

/* ── types ── */
type BillItem = {
  _id: string;
  entityName?: string;
  amount?: number;
  gstPercentage?: number;
  gstAmount?: number;
  status?: string;
  category?: string;
  description?: string;
  voucherUrl?: string;
  paidBy?: string;
  paymentType?: string;
  tokenAmount?: number;
  contactPerson?: { _id?: string; name?: string; email?: string };
  event?: { _id?: string; activityName?: string; startDate?: string; venue?: string; budget?: number };
  billSheet?: BillSheetMixed | null;
  reviewedBy?: { _id?: string; name?: string; email?: string } | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type BillSheetMixed = {
  sections?: Array<{
    key?: string; sectionTitle?: string; title?: string;
    rows?: Array<{ srNo?: number; particulars?: string; particular?: string; qty?: number; quantity?: number; sizes?: string; size?: string; rate?: number; amount?: number; remarks?: string }>;
    items?: Array<{ srNo?: number; particulars?: string; particular?: string; qty?: number; quantity?: number; sizes?: string; size?: string; rate?: number; amount?: number; remarks?: string }>;
    sectionTotal?: number;
  }>;
  grandTotal?: number;
};

type BillsResponse = { bills?: BillItem[] };
type EventOption = { _id: string; activityName?: string };
type TeamMember = { _id: string; name?: string; email?: string };
type EmployeeBillsResponse = { message: string; total: number; data: BillItem[] };

/* ── mappers ── */
function mapBillToEditableData(bill: BillItem): EditableBillData {
  const rawSheet = bill.billSheet;
  const parsedSections: Array<{ key: string; title: string; items: Array<{ srNo: number; particular: string; quantity: number; size: string; rate: number; amount: number; remarks: string }> }> = [];

  if (rawSheet && typeof rawSheet === "object" && Array.isArray(rawSheet.sections)) {
    rawSheet.sections.forEach((sec, idx) => {
      const rawRows = sec.items || sec.rows || [];
      parsedSections.push({
        key: sec.key || String.fromCharCode(65 + idx),
        title: sec.title || sec.sectionTitle || `Section ${String.fromCharCode(65 + idx)}`,
        items: rawRows.map((row, rowIdx) => ({
          srNo: row.srNo ?? rowIdx + 1,
          particular: row.particular || row.particulars || "",
          quantity: row.quantity ?? row.qty ?? 0,
          size: row.size || row.sizes || "",
          rate: row.rate ?? 0,
          amount: row.amount ?? 0,
          remarks: row.remarks || "",
        })),
      });
    });
  }

  let eventDate = "";
  if (bill.event?.startDate) {
    try { eventDate = new Date(bill.event.startDate).toISOString(); }
    catch { eventDate = bill.event.startDate; }
  }

  return buildDefaultEditableBillData({
    eventName: bill.event?.activityName || "",
    eventDate,
    venue: bill.event?.venue || "",
    activityName: bill.event?.activityName || "",
    sectionTitle: bill.category || "CATEGORY",
    vendorName: bill.entityName || "",
    vendorSignature: "",
    paymentRemarks: bill.description || "",
    billRemarks: bill.description || "",
    category: bill.category || "",
    paidBy: bill.paidBy || "",
    paymentType: bill.paymentType || "",
    approvedBy: bill.status || "",
    closingNumber: "",
    sections: parsedSections,
    totals: {
      total: bill.amount || 0,
      finalTotal: bill.amount || 0,
      totalWithTax: bill.gstAmount || 0,
      gstPercentage: bill.gstPercentage || 0,
    },
  });
}

function mapEditableDataToApiPayload(data: EditableBillData) {
  const sections = data.sections.filter(s => s.items.length > 0).map(sec => ({
    key: sec.key,
    sectionTitle: sec.title,
    rows: sec.items.map(row => ({
      srNo: row.srNo, particulars: row.particular, qty: row.quantity,
      sizes: row.size, rate: row.rate, amount: row.amount, remarks: row.remarks,
    })),
    sectionTotal: sec.items.reduce((sum, row) => sum + Number(row.amount || 0), 0),
  }));
  const grandTotal = sections.reduce((sum, sec) => sum + (sec.sectionTotal || 0), 0);
  return {
    billSheet: { sections, grandTotal },
    amount: data.totals?.total || data.totals?.finalTotal || grandTotal,
    category: data.sectionTitle || undefined,
  };
}

/* ══════════════════════════════
   IMAGE UPLOAD ZONE
══════════════════════════════ */
function ImageUploadZone({ file, previewUrl, uploading, uploadedUrl, onFileSelect, onRemove, error }: {
  file: File | null; previewUrl: string | null; uploading: boolean;
  uploadedUrl: string; onFileSelect: (f: File) => void; onRemove: () => void; error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFileSelect(f);
  }, [onFileSelect]);

  const displayUrl = uploadedUrl || previewUrl;

  return (
    <div className="bl-upload">
      {!displayUrl && (
        <div
          className={`bl-upload__zone ${dragOver ? "bl-upload__zone--over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <span className="bl-upload__ico">📁</span>
          <div className="bl-upload__text">
            <strong>Click to upload</strong> or drag & drop
          </div>
          <div className="bl-upload__hint">JPG, PNG, WebP, GIF or PDF — max 5 MB</div>
        </div>
      )}
      <input
        ref={inputRef} type="file" accept={ALLOWED_TYPES.join(",")}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ""; }}
        style={{ display: "none" }}
      />
      {displayUrl && (
        <div className="bl-upload__preview">
          {file?.type === "application/pdf"
            ? <div className="bl-upload__pdf">📄 {file.name}</div>
            : <img src={displayUrl} alt="Voucher preview" className="bl-upload__img" />
          }
          {uploading && <div className="bl-upload__overlay">Uploading…</div>}
          {uploadedUrl && !uploading && (
            <span className="bl-upload__ok">✓ Uploaded</span>
          )}
          <button type="button" className="bl-upload__remove" onClick={onRemove} aria-label="Remove">✕</button>
        </div>
      )}
      {file && !uploading && (
        <div className="bl-upload__name">{file.name} — {(file.size / 1024).toFixed(1)} KB</div>
      )}
      {error && <div className="bl-upload__err">{error}</div>}
    </div>
  );
}

/* ══════════════════════════════
   CREATE BILL MODAL
══════════════════════════════ */
function CreateBillModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useAuthedApi();
  const qc = useQueryClient();

  const [entityName, setEntityName] = useState("");
  const [amount, setAmount] = useState("");
  const [eventId, setEventId] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ events?: EventOption[] }>({
    queryKey: ["admin", "events"], queryFn: async () => (await api.get("/admin/events")).data, enabled: open,
  });
  const events = eventsData?.events ?? [];

  const { data: teamData, isLoading: teamLoading } = useQuery<{ users?: TeamMember[] }>({
    queryKey: ["admin", "team"], queryFn: async () => (await api.get("/admin/team")).data, enabled: open,
  });
  const teamMembers = teamData?.users ?? [];

  const handleFileSelect = useCallback(async (selected: File) => {
    setUploadError(null);
    if (!ALLOWED_TYPES.includes(selected.type)) { setUploadError("Unsupported file type."); return; }
    if (selected.size > MAX_FILE_SIZE) { setUploadError("File too large. Max 5 MB."); return; }
    setFile(selected);
    if (selected.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(selected);
    } else { setPreviewUrl(null); }
    setUploading(true); setUploadedUrl("");
    try {
      const form = new FormData(); form.append("file", selected);
      const { data } = await api.post("/admin/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      const url = data?.url || data?.fileUrl || data?.voucherUrl || "";
      if (!url) throw new Error("No URL returned");
      setUploadedUrl(url);
    } catch (err) {
      setUploadError(extractErrorMessage(err, "Upload failed"));
    } finally { setUploading(false); }
  }, [api]);

  const handleRemoveImage = () => { setFile(null); setPreviewUrl(null); setUploadedUrl(""); setUploadError(null); };

  const resetForm = () => {
    setEntityName(""); setAmount(""); setEventId(""); setContactPerson("");
    setDescription(""); setCategory(""); setError(null); handleRemoveImage();
  };
  const handleClose = () => { resetForm(); onClose(); };

  const createBillMut = useMutation({
    mutationFn: async () => {
      const amountNum = Number(amount);
      if (!entityName.trim()) throw new Error("Entity / vendor name is required");
      if (!eventId) throw new Error("Please select an event");
      if (Number.isNaN(amountNum) || amountNum <= 0) throw new Error("Amount must be a positive number");
      if (file && !uploadedUrl && !uploading) throw new Error("Image upload failed — remove and re-upload");
      if (uploading) throw new Error("Please wait for the image to finish uploading");

      const payload: Record<string, unknown> = {
        entityName: entityName.trim(), amount: amountNum, event: eventId,
      };
      if (contactPerson) payload.contactPerson = contactPerson;
      if (description.trim()) payload.description = description.trim();
      if (category) payload.category = category;
      if (uploadedUrl) payload.voucherUrl = uploadedUrl;

      return (await api.post("/admin/bills", payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "bills"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard", "overview"] });
      handleClose();
    },
    onError: (err: unknown) => setError(extractErrorMessage(err, "Failed to create bill")),
  });

  if (!open) return null;

  return (
    <div className="bl-backdrop" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="bl-modal" onClick={(e) => e.stopPropagation()}>

        <div className="bl-modal__glow-bar" />

        <div className="bl-modal__header">
          <div className="bl-modal__header-left">
            <div className="bl-modal__icon">🧾</div>
            <div>
              <h2 className="bl-modal__title">Create Bill</h2>
              <p className="bl-modal__sub">Link a new bill to an existing event.</p>
            </div>
          </div>
          <button className="bl-close" type="button" onClick={handleClose}>✕</button>
        </div>

        <form
          className="bl-modal__form"
          onSubmit={(e) => { e.preventDefault(); setError(null); createBillMut.mutate(); }}
        >
          <MField label="Event" icon="📅" required>
            <select className="bl-input" value={eventId} onChange={(e) => setEventId(e.target.value)} required>
              <option value="">{eventsLoading ? "Loading events…" : "— Select an event —"}</option>
              {events.map((ev) => (
                <option key={ev._id} value={ev._id}>{ev.activityName || ev._id}</option>
              ))}
            </select>
          </MField>

          <MField label="Entity / Vendor Name" icon="🏪" required>
            <input className="bl-input" value={entityName} onChange={(e) => setEntityName(e.target.value)} placeholder="e.g. Sunrise Catering" required />
          </MField>

          <div className="bl-row">
            <MField label="Amount (₹)" icon="💰" required>
              <input className="bl-input" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
            </MField>
            <MField label="Category" icon="🏷️">
              <select className="bl-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">— None —</option>
                {Object.entries(TASK_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </MField>
          </div>

          <MField label="Contact Person" icon="👤">
            <select className="bl-input" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)}>
              <option value="">{teamLoading ? "Loading…" : "— None —"}</option>
              {teamMembers.map((u) => (
                <option key={u._id} value={u._id}>{u.name || u.email || u._id}</option>
              ))}
            </select>
          </MField>

          <MField label="Description" icon="📝">
            <textarea className="bl-input bl-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description…" />
          </MField>

          <MField label="Voucher / Bill Image" icon="📎">
            <ImageUploadZone
              file={file} previewUrl={previewUrl} uploading={uploading}
              uploadedUrl={uploadedUrl} onFileSelect={handleFileSelect}
              onRemove={handleRemoveImage} error={uploadError}
            />
          </MField>

          {error && (
            <div className="bl-error">
              <span className="bl-error__ico">⚠️</span><span>{error}</span>
            </div>
          )}

          <div className="bl-modal__footer">
            <button type="button" className="bl-btn bl-btn--ghost" onClick={handleClose}>Cancel</button>
            <button type="submit" className="bl-btn bl-btn--primary" disabled={createBillMut.isPending || uploading}>
              {uploading ? <><span className="bl-spin" />Uploading…</>
                : createBillMut.isPending ? <><span className="bl-spin" />Creating…</>
                  : <>🧾 Create Bill</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MField({ label, icon, required, children }: {
  label: string; icon?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="bl-field">
      <label className="bl-label">
        {icon && <span>{icon}</span>}
        {label}
        {required && <span className="bl-label__req">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ══════════════════════════════
   STATUS CONFIG
══════════════════════════════ */
const STATUS_CONFIG: Record<string, { cls: string; icon: string; label: string }> = {
  pending: { cls: "bl-status--pending", icon: "⏳", label: "Pending" },
  approved: { cls: "bl-status--approved", icon: "✅", label: "Approved" },
  review: { cls: "bl-status--review", icon: "🔍", label: "Review" },
  rejected: { cls: "bl-status--rejected", icon: "❌", label: "Rejected" },
};

/* ══════════════════════════════
   BILLS PAGE
══════════════════════════════ */
export function BillsPage() {
  const api = useAuthedApi();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const selected = useMemo(() => TABS.find((t) => t.key === tab), [tab]);

  const [popup, setPopup] = useState<{ kind: "success" | "error"; title: string; message: string } | null>(null);
  const [viewBillLoadingId, setViewBillLoadingId] = useState("");
  const [billSheetData, setBillSheetData] = useState<EditableBillData | null>(null);
  const [activeBillId, setActiveBillId] = useState("");
  const [showCreateBill, setShowCreateBill] = useState(false);
  const [savingSheet, setSavingSheet] = useState(false);

  const { data, isLoading } = useQuery<BillsResponse>({
    queryKey: ["admin", "bills", selected?.status ?? "all"],
    queryFn: async () => (await api.get("/admin/bills", { params: selected?.status ? { status: selected.status } : undefined })).data,
  });
  const bills = data?.bills ?? [];

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      await api.patch(`/admin/bills/${id}/review`, { status });
    },
    onSuccess: async (_data, vars) => {
      setPopup({ kind: "success", title: vars.status === "approved" ? "Bill Approved" : "Bill Rejected", message: vars.status === "approved" ? "The bill has been approved successfully." : "The bill has been rejected successfully." });
      setTimeout(() => setPopup(null), 2800);
      await qc.invalidateQueries({ queryKey: ["admin", "bills"] });
      await qc.invalidateQueries({ queryKey: ["admin", "dashboard", "overview"] });
    },
    onError: (e: unknown) => {
      setPopup({ kind: "error", title: "Action Failed", message: extractErrorMessage(e, "Could not update bill status") });
      setTimeout(() => setPopup(null), 3200);
    },
  });

  const handleViewBill = async (bill: BillItem) => {
    const eventId = bill.event?._id || "";
    const employeeId = bill.contactPerson?._id || "";
    const billId = bill._id || "";

    if (!eventId || !employeeId) {
      setPopup({ kind: "error", title: "View Bill Unavailable", message: !eventId ? "Event reference is missing." : "Contact person is missing." });
      setTimeout(() => setPopup(null), 2800);
      return;
    }
    setViewBillLoadingId(billId);
    try {
      const { data } = await api.get<EmployeeBillsResponse>(`/admin/employee/${employeeId}/event/${eventId}`);
      const targetBill = data.data?.find((b) => b._id === billId);
      const fallback = data.data?.[0] || bill;
      const source = targetBill || fallback;
      const mapped = mapBillToEditableData(source);
      setActiveBillId(source._id || billId);
      setBillSheetData(mapped);
    } catch (err) {
      try {
        const mapped = mapBillToEditableData(bill);
        setActiveBillId(billId);
        setBillSheetData(mapped);
      } catch {
        setPopup({ kind: "error", title: "Could not open bill", message: extractErrorMessage(err, "Unable to load bill sheet.") });
        setTimeout(() => setPopup(null), 2800);
      }
    } finally { setViewBillLoadingId(""); }
  };

  const handleSaveBillSheet = useCallback(async (updated: EditableBillData) => {
    setBillSheetData(updated);
    if (!activeBillId) return;
    try {
      setSavingSheet(true);
      await api.put(`/admin/bills/${activeBillId}/sheet`, mapEditableDataToApiPayload(updated));
      qc.invalidateQueries({ queryKey: ["admin", "bills"] });
      setPopup({ kind: "success", title: "Saved", message: "Bill sheet updated successfully." });
      setTimeout(() => setPopup(null), 2000);
    } catch (err) {
      setPopup({ kind: "error", title: "Save Failed", message: extractErrorMessage(err, "Could not save bill sheet.") });
      setTimeout(() => setPopup(null), 3000);
    } finally { setSavingSheet(false); }
  }, [activeBillId, api, qc]);

  const closeBillSheet = useCallback(() => { setBillSheetData(null); setActiveBillId(""); }, []);

  const tabCounts = useMemo(() => ({
    all: bills.length,
    pending: bills.filter(b => b.status === "pending").length,
    approved: bills.filter(b => b.status === "approved").length,
    review: bills.filter(b => b.status === "review").length,
  }), [bills]);

  return (
    <div className="bl-root">

      {/* ── HEADER ── */}
      <div className="bl-header">
        <div className="bl-header__left">
          <div className="bl-header__tag">🧾 Finance</div>
          <h1 className="bl-header__title">Bill Review Centre</h1>
          <p className="bl-header__sub">Approve, reject and manage all submitted bills.</p>
        </div>
        <button className="bl-create-btn" onClick={() => setShowCreateBill(true)}>
          <span>＋</span> Create Bill
        </button>
      </div>

      {/* ── STAT PILLS ── */}
      <div className="bl-stats-row">
        {[
          { label: "Total", value: bills.length, color: "#7c3aed" },
          { label: "Pending", value: bills.filter(b => b.status === "pending").length, color: "#f59e0b" },
          { label: "Approved", value: bills.filter(b => b.status === "approved").length, color: "#10b981" },
          { label: "Review", value: bills.filter(b => b.status === "review").length, color: "#2563eb" },
        ].map((s) => (
          <div className="bl-stat" key={s.label} style={{ "--acc": s.color } as React.CSSProperties}>
            <div className="bl-stat__value" style={{ color: s.color }}>{s.value}</div>
            <div className="bl-stat__label">{s.label}</div>
            <div className="bl-stat__bar" style={{ background: s.color }} />
          </div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div className="bl-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`bl-tab ${tab === t.key ? "bl-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            <span className="bl-tab__count">{tabCounts[t.key as keyof typeof tabCounts]}</span>
          </button>
        ))}
      </div>

      {/* ── LOADING ── */}
      {isLoading && (
        <div className="bl-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="bl-card bl-card--skeleton" key={i}>
              <div className="bl-skel bl-skel--avatar" />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="bl-skel bl-skel--title" />
                <div className="bl-skel bl-skel--row" />
                <div className="bl-skel bl-skel--row" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BILL GRID ── */}
      {!isLoading && (
        <>
          {bills.length === 0 ? (
            <div className="bl-empty">
              <div className="bl-empty__ico">🧾</div>
              <div className="bl-empty__title">No bills found</div>
              <div className="bl-empty__sub">Try switching tabs or create a new bill.</div>
            </div>
          ) : (
            <div className="bl-grid">
              {bills.map((b, idx) => {
                const person = b.contactPerson?.name || "Unknown";
                const initials = person === "Unknown" ? "?" : person.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
                const st = STATUS_CONFIG[b.status ?? ""] ?? { cls: "bl-status--default", icon: "❓", label: b.status ?? "Unknown" };

                return (
                  <div
                    className="bl-card"
                    key={b._id}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    {/* left accent */}
                    <div className={`bl-card__accent bl-card__accent--${b.status}`} />

                    {/* top row */}
                    <div className="bl-card__top">
                      <div className="bl-card__avatar">{initials}</div>
                      <div className="bl-card__info">
                        <div className="bl-card__name">{b.entityName || "Unnamed Bill"}</div>
                        <div className="bl-card__meta">
                          👤 {person}
                          {b.event?.activityName && <> · 📅 {b.event.activityName}</>}
                        </div>
                        {b.category && (
                          <span className="bl-card__cat">
                            {TASK_CATEGORY_LABELS[b.category as TaskCategory] ?? b.category}
                          </span>
                        )}
                      </div>
                      <div className="bl-card__right">
                        <div className="bl-card__amount">{formatINR(b.amount ?? 0)}</div>
                        <span className={`bl-status ${st.cls}`}>{st.icon} {st.label}</span>
                      </div>
                    </div>

                    {/* voucher */}
                    {b.voucherUrl ? (
                      <div className="bl-card__voucher">
                        <img src={b.voucherUrl} alt="Voucher" />
                        <span className="bl-card__voucher-label">📎 Voucher attached</span>
                      </div>
                    ) : (
                      <div className="bl-card__no-voucher">📭 No voucher uploaded</div>
                    )}

                    {/* actions */}
                    <div className="bl-card__actions">


                      {(b.status === "pending" || b.status === "review") && (
                        <>
                          <button
                            className="bl-btn bl-btn--reject"
                            disabled={reviewMutation.isPending}
                            onClick={() => reviewMutation.mutate({ id: b._id, status: "rejected" })}
                          >
                            ❌ Reject
                          </button>
                          <button
                            className="bl-btn bl-btn--approve"
                            disabled={reviewMutation.isPending}
                            onClick={() => reviewMutation.mutate({ id: b._id, status: "approved" })}
                          >
                            ✅ Approve
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TOAST ── */}
      {popup && (
        <div className={`bl-toast bl-toast--${popup.kind}`}>
          <span className="bl-toast__ico">
            {popup.kind === "success" ? "✅" : "⚠️"}
          </span>
          <div>
            <div className="bl-toast__title">{popup.title}</div>
            <div className="bl-toast__msg">{popup.message}</div>
          </div>
        </div>
      )}

      {/* ── BILL SHEET MODAL ── */}
      {billSheetData && (
        <div
          className="bl-sheet-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) closeBillSheet(); }}
        >
          <div className="bl-sheet-modal">
            <div className="bl-sheet-modal__glow-bar" />
            <div className="bl-sheet-modal__header">
              <div className="bl-sheet-modal__header-left">
                <div className="bl-sheet-modal__icon">📋</div>
                <div>
                  <h2 className="bl-sheet-modal__title">Bill Sheet</h2>
                  {savingSheet && <span className="bl-sheet-modal__saving">Saving…</span>}
                </div>
              </div>
              <div className="bl-sheet-modal__actions">
                <button className="bl-btn bl-btn--ghost" onClick={() => window.print()}>🖨 Print</button>
                <button
                  className="bl-btn bl-btn--primary"
                  disabled={savingSheet}
                  onClick={() => billSheetData && handleSaveBillSheet(billSheetData)}
                >
                  {savingSheet ? <><span className="bl-spin" />Saving…</> : <>💾 Save</>}
                </button>
                <button className="bl-btn bl-btn--ghost" onClick={closeBillSheet}>✕ Close</button>
              </div>
            </div>
            <div className="bl-sheet-modal__body">
              <EditableBillSheet value={billSheetData} onChange={handleSaveBillSheet} />
            </div>
          </div>
        </div>
      )}

      <CreateBillModal open={showCreateBill} onClose={() => setShowCreateBill(false)} />
    </div>
  );
}