import { useState, useEffect, useCallback } from "react";
import "../App.css";

const API_ORIGIN = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const API_PREFIX = `${API_ORIGIN}/api`;

type Vendor = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  gstNumber: string;
  contactPerson: string;
  address: { street: string; city: string; state: string; pincode: string };
  category: string;
  bankDetails: { accountName: string; accountNumber: string; bankName: string; ifscCode: string; upiId: string };
  notes: string;
  isActive: boolean;
  eventId?: string;
  billId?: string;
  vendorName?: string;
  remark?: string;
};
type EditForm = Omit<Vendor, "_id">;

const CATEGORIES = ["setup", "tentage", "furniture", "technical", "services", "entertainment", "catering", "decoration", "transport", "other"];

const CAT_META: Record<string, { color: string; icon: string; bg: string }> = {
  setup: { color: "#3b82f6", icon: "🔧", bg: "#3b82f615" },
  tentage: { color: "#8b5cf6", icon: "⛺", bg: "#8b5cf615" },
  furniture: { color: "#f59e0b", icon: "🪑", bg: "#f59e0b15" },
  technical: { color: "#ef4444", icon: "💡", bg: "#ef444415" },
  services: { color: "#10b981", icon: "🛠", bg: "#10b98115" },
  entertainment: { color: "#ec4899", icon: "🎭", bg: "#ec489915" },
  catering: { color: "#f97316", icon: "🍽", bg: "#f9731615" },
  decoration: { color: "#06b6d4", icon: "🎨", bg: "#06b6d415" },
  transport: { color: "#6366f1", icon: "🚚", bg: "#6366f115" },
  other: { color: "#6b7280", icon: "📦", bg: "#6b728015" },
};

const emptyForm: EditForm = {
  name: "", email: "", phone: "", gstNumber: "", contactPerson: "",
  address: { street: "", city: "", state: "", pincode: "" },
  category: "other",
  bankDetails: { accountName: "", accountNumber: "", bankName: "", ifscCode: "", upiId: "" },
  notes: "", isActive: true,
};

function apiHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  };
}

function isValidGST(g: string) {
  if (!g) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g);
}

/* ══════════════════════════════
   FIELD COMPONENT
══════════════════════════════ */
function Field({
  label, value, onChange, placeholder, type = "text", error, icon, mono,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; error?: string; icon?: string; mono?: boolean;
}) {
  return (
    <div className="xf-wrap">
      <label className="xf-label">
        {icon && <span className="xf-label__ico">{icon}</span>}
        {label}
      </label>
      <input
        className={`xf-inp ${error ? "xf-inp--err" : ""} ${mono ? "xf-inp--mono" : ""}`}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
      />
      {error && <p className="xf-err"><span>⚠</span>{error}</p>}
    </div>
  );
}

/* ══════════════════════════════
   VENDOR CARD
══════════════════════════════ */
function VendorCard({ vendor, isExpanded, onToggle, onSaved, onDeleted }: {
  vendor: Vendor; isExpanded: boolean;
  onToggle: () => void; onSaved: () => void; onDeleted: () => void;
}) {
  const [form, setForm] = useState<EditForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm({
      name: vendor.name || "", email: vendor.email || "", phone: vendor.phone || "",
      gstNumber: vendor.gstNumber || "", contactPerson: vendor.contactPerson || "",
      address: {
        street: vendor.address?.street || "", city: vendor.address?.city || "",
        state: vendor.address?.state || "", pincode: vendor.address?.pincode || "",
      },
      category: vendor.category || "other",
      bankDetails: {
        accountName: vendor.bankDetails?.accountName || "",
        accountNumber: vendor.bankDetails?.accountNumber || "",
        bankName: vendor.bankDetails?.bankName || "",
        ifscCode: vendor.bankDetails?.ifscCode || "",
        upiId: vendor.bankDetails?.upiId || "",
      },
      notes: vendor.notes || "", isActive: vendor.isActive ?? true,
    });
    setErrors({}); setConfirmDelete(false);
  }, [vendor]);

  const set = (k: keyof EditForm, v: any) =>
    setForm(p => ({ ...p, [k]: v }));
  const setAddr = (k: keyof EditForm["address"], v: string) =>
    setForm(p => ({ ...p, address: { ...p.address, [k]: v } }));
  const setBank = (k: keyof EditForm["bankDetails"], v: string) =>
    setForm(p => ({ ...p, bankDetails: { ...p.bankDetails, [k]: v } }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (form.phone && !/^[+\d\s\-()]{7,15}$/.test(form.phone)) e.phone = "Invalid phone";
    if (form.gstNumber && !isValidGST(form.gstNumber)) e.gstNumber = "Invalid GST";
    if (form.address.pincode && !/^\d{6}$/.test(form.address.pincode)) e.pincode = "Must be 6 digits";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_PREFIX}/admin/vendors/${vendor._id}`, {
        method: "PUT", headers: apiHeaders(),
        body: JSON.stringify({
          ...form,
          gstNumber: form.gstNumber.toUpperCase(),
          bankDetails: { ...form.bankDetails, ifscCode: form.bankDetails.ifscCode.toUpperCase() },
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Save failed"); }
      showToast("Changes saved successfully!", "success");
      onSaved();
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await fetch(`${API_PREFIX}/admin/vendors/${vendor._id}`, { method: "DELETE", headers: apiHeaders() });
      onDeleted();
    } catch { showToast("Delete failed", "error"); }
  };

  const meta = CAT_META[vendor.category] ?? CAT_META.other;
  const addr = [vendor.address?.city, vendor.address?.state].filter(Boolean).join(", ");
  const initials = vendor.name.slice(0, 2).toUpperCase();

  return (
    <div className={`vnd-card ${isExpanded ? "vnd-card--open" : ""}`}
      style={{ "--cat-color": meta.color } as React.CSSProperties}>

      {/* glow accent */}
      <div className="vnd-card__stripe" style={{ background: meta.color }} />

      {/* ── HEADER ── */}
      <div className="vnd-card__head" onClick={onToggle}>

        <div className="vnd-card__avatar"
          style={{ background: meta.bg, color: meta.color, boxShadow: `0 0 20px ${meta.color}30` }}>
          {initials}
        </div>

        <div className="vnd-card__info">
          <div className="vnd-card__name">
            {vendor.name}
            {!vendor.isActive && <span className="vnd-tag vnd-tag--off">Inactive</span>}
          </div>
          <div className="vnd-card__pills">
            {vendor.phone && <span className="vnd-pill">📞 {vendor.phone}</span>}
            {vendor.email && <span className="vnd-pill">✉️ {vendor.email}</span>}
            {addr && <span className="vnd-pill">📍 {addr}</span>}
            {vendor.eventId && <span className="vnd-pill">🗂 {vendor.eventId.slice(-6)}</span>}
            {vendor.billId && <span className="vnd-pill">🧾 {vendor.billId.slice(-6)}</span>}
          </div>
          {(vendor.remark || vendor.notes) && (
            <div className="vnd-card__note">
              📝 {vendor.remark || vendor.notes}
            </div>
          )}
        </div>

        <div className="vnd-card__side">
          {vendor.gstNumber && (
            <span className="vnd-gst-chip">GST {vendor.gstNumber}</span>
          )}
          <span className="vnd-cat-badge"
            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}35` }}>
            {meta.icon} {vendor.category}
          </span>
        </div>

        <span className={`vnd-chevron ${isExpanded ? "vnd-chevron--up" : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      {/* ── EXPANDED BODY ── */}
      {isExpanded && (
        <div className="vnd-body">

          {/* Basic */}
          <div className="vnd-sec-head">
            <span className="vnd-sec-head__icon">👤</span>
            <span>Basic Information</span>
          </div>
          <div className="vnd-grid">
            <Field label="Vendor Name" value={form.name} onChange={v => set("name", v)} error={errors.name} icon="🏪" />
            <Field label="Contact Person" value={form.contactPerson} onChange={v => set("contactPerson", v)} icon="👤" />
            <div className="xf-wrap">
              <label className="xf-label"><span className="xf-label__ico">🏷️</span>Category</label>
              <select className="xf-inp xf-select" value={form.category} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="xf-wrap">
              <label className="xf-label"><span className="xf-label__ico">⚡</span>Status</label>
              <div className="xf-toggle-row">
                <button type="button"
                  className={`xf-toggle ${form.isActive ? "xf-toggle--on" : ""}`}
                  onClick={() => set("isActive", !form.isActive)}>
                  <span className="xf-toggle__knob" />
                </button>
                <span className={`xf-toggle__txt ${form.isActive ? "xf-toggle__txt--on" : ""}`}>
                  {form.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="vnd-sec-head">
            <span className="vnd-sec-head__icon">📞</span>
            <span>Contact Details</span>
          </div>
          <div className="vnd-grid">
            <Field label="Email" value={form.email} onChange={v => set("email", v)}
              type="email" error={errors.email} icon="✉️" placeholder="vendor@example.com" />
            <Field label="Phone" value={form.phone} onChange={v => set("phone", v)}
              type="tel" error={errors.phone} icon="📞" placeholder="+91 98765 43210" />
            <div className="xf-wrap">
              <label className="xf-label">
                <span className="xf-label__ico">🔖</span>GST Number
                {form.gstNumber && (
                  <span className={`xf-gst-tag ${isValidGST(form.gstNumber) ? "xf-gst-tag--ok" : "xf-gst-tag--bad"}`}>
                    {isValidGST(form.gstNumber) ? "✓ Valid" : "✕ Invalid"}
                  </span>
                )}
              </label>
              <input
                className={`xf-inp xf-inp--mono
                  ${form.gstNumber ? (isValidGST(form.gstNumber) ? "xf-inp--gst-ok" : "xf-inp--gst-bad") : ""}`}
                value={form.gstNumber}
                onChange={e => set("gstNumber", e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
              {errors.gstNumber && <p className="xf-err"><span>⚠</span>{errors.gstNumber}</p>}
            </div>
          </div>

          {/* Address */}
          <div className="vnd-sec-head">
            <span className="vnd-sec-head__icon">📍</span>
            <span>Address</span>
          </div>
          <div className="vnd-grid vnd-grid--full">
            <Field label="Street" value={form.address.street}
              onChange={v => setAddr("street", v)} placeholder="Building, Street, Area" icon="🏠" />
          </div>
          <div className="vnd-grid" style={{ marginTop: "0.65rem" }}>
            <Field label="City" value={form.address.city} onChange={v => setAddr("city", v)} icon="🏙" />
            <Field label="State" value={form.address.state} onChange={v => setAddr("state", v)} icon="🗺" />
            <Field label="Pincode" value={form.address.pincode}
              onChange={v => setAddr("pincode", v.replace(/\D/g, "").slice(0, 6))}
              placeholder="400001" error={errors.pincode} icon="📮" />
          </div>

          {/* Bank */}
          <div className="vnd-sec-head">
            <span className="vnd-sec-head__icon">🏦</span>
            <span>Bank Details</span>
          </div>
          <div className="vnd-grid">
            <Field label="Account Name" value={form.bankDetails.accountName} onChange={v => setBank("accountName", v)} icon="👤" />
            <Field label="Account Number" value={form.bankDetails.accountNumber}
              onChange={v => setBank("accountNumber", v.replace(/\D/g, ""))} mono icon="🔢" />
            <Field label="Bank Name" value={form.bankDetails.bankName} onChange={v => setBank("bankName", v)} icon="🏛" />
            <Field label="IFSC Code" value={form.bankDetails.ifscCode}
              onChange={v => setBank("ifscCode", v.toUpperCase())} mono placeholder="SBIN0001234" icon="🔑" />
            <Field label="UPI ID" value={form.bankDetails.upiId}
              onChange={v => setBank("upiId", v)} placeholder="vendor@upi" icon="📲" />
          </div>

          {/* Notes */}
          <div className="vnd-sec-head">
            <span className="vnd-sec-head__icon">📝</span>
            <span>Notes</span>
          </div>
          <textarea className="xf-textarea" value={form.notes}
            onChange={e => set("notes", e.target.value)}
            placeholder="Any additional notes about this vendor…" rows={3} />

          {/* Actions */}
          <div className="vnd-actions">
            {confirmDelete ? (
              <div className="vnd-confirm">
                <span className="vnd-confirm__txt">⚠️ Delete this vendor?</span>
                <button className="xbtn xbtn--danger" onClick={handleDelete}>Yes, Delete</button>
                <button className="xbtn xbtn--ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            ) : (
              <button className="xbtn xbtn--danger" onClick={() => setConfirmDelete(true)}>
                🗑 Delete
              </button>
            )}
            <div className="vnd-actions__right">
              <button className="xbtn xbtn--ghost" onClick={onToggle}>Close</button>
              <button className="xbtn xbtn--save" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="xbtn__spin" />Saving…</> : <>💾 Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`vnd-toast vnd-toast--${toast.type}`}>
          {toast.type === "success" ? "✅" : "⚠️"} {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════
   ADD VENDOR MODAL
══════════════════════════════ */
function AddVendorModal({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<EditForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverErr, setServerErr] = useState("");

  const set = (k: keyof EditForm, v: any) => setForm(p => ({ ...p, [k]: v }));
  const setAddr = (k: keyof EditForm["address"], v: string) =>
    setForm(p => ({ ...p, address: { ...p.address, [k]: v } }));
  const setBank = (k: keyof EditForm["bankDetails"], v: string) =>
    setForm(p => ({ ...p, bankDetails: { ...p.bankDetails, [k]: v } }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (form.gstNumber && !isValidGST(form.gstNumber)) e.gstNumber = "Invalid GST format";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true); setServerErr("");
    try {
      const res = await fetch(`${API_PREFIX}/admin/vendors`, {
        method: "POST", headers: apiHeaders(),
        body: JSON.stringify({ ...form, gstNumber: form.gstNumber.toUpperCase() }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Create failed"); }
      onCreated();
    } catch (e: any) { setServerErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="xmodal-bg" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="xmodal" onClick={e => e.stopPropagation()}>

        <div className="xmodal__bar" />

        <div className="xmodal__hd">
          <div className="xmodal__hd-left">
            <div className="xmodal__ico">🏪</div>
            <div>
              <h2 className="xmodal__title">Add New Vendor</h2>
              <p className="xmodal__sub">Register a new vendor in the system</p>
            </div>
          </div>
          <button className="xmodal__close" onClick={onCancel}>✕</button>
        </div>

        <div className="xmodal__body">
          {serverErr && <div className="xmodal__err-banner">⚠️ {serverErr}</div>}

          <div className="vnd-sec-head"><span className="vnd-sec-head__icon">👤</span><span>Basic Information</span></div>
          <div className="vnd-grid">
            <Field label="Vendor Name" value={form.name} onChange={v => set("name", v)} error={errors.name} icon="🏪" />
            <Field label="Contact Person" value={form.contactPerson} onChange={v => set("contactPerson", v)} icon="👤" />
            <Field label="Email" value={form.email} onChange={v => set("email", v)} type="email" error={errors.email} icon="✉️" />
            <Field label="Phone" value={form.phone} onChange={v => set("phone", v)} type="tel" icon="📞" />
            <div className="xf-wrap">
              <label className="xf-label"><span className="xf-label__ico">🔖</span>GST Number</label>
              <input
                className={`xf-inp xf-inp--mono ${form.gstNumber ? (isValidGST(form.gstNumber) ? "xf-inp--gst-ok" : "xf-inp--gst-bad") : ""}`}
                value={form.gstNumber}
                onChange={e => set("gstNumber", e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5" maxLength={15}
              />
              {errors.gstNumber && <p className="xf-err"><span>⚠</span>{errors.gstNumber}</p>}
            </div>
            <div className="xf-wrap">
              <label className="xf-label"><span className="xf-label__ico">🏷️</span>Category</label>
              <select className="xf-inp xf-select" value={form.category} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="vnd-sec-head" style={{ marginTop: "1.25rem" }}><span className="vnd-sec-head__icon">📍</span><span>Address</span></div>
          <div className="vnd-grid">
            <Field label="Street" value={form.address.street} onChange={v => setAddr("street", v)} icon="🏠" />
            <Field label="City" value={form.address.city} onChange={v => setAddr("city", v)} icon="🏙" />
            <Field label="State" value={form.address.state} onChange={v => setAddr("state", v)} icon="🗺" />
            <Field label="Pincode" value={form.address.pincode} onChange={v => setAddr("pincode", v.replace(/\D/g, "").slice(0, 6))} icon="📮" />
          </div>

          <div className="vnd-sec-head" style={{ marginTop: "1.25rem" }}><span className="vnd-sec-head__icon">🏦</span><span>Bank Details</span></div>
          <div className="vnd-grid">
            <Field label="Account Name" value={form.bankDetails.accountName} onChange={v => setBank("accountName", v)} icon="👤" />
            <Field label="Account Number" value={form.bankDetails.accountNumber} onChange={v => setBank("accountNumber", v.replace(/\D/g, ""))} mono icon="🔢" />
            <Field label="Bank Name" value={form.bankDetails.bankName} onChange={v => setBank("bankName", v)} icon="🏛" />
            <Field label="IFSC Code" value={form.bankDetails.ifscCode} onChange={v => setBank("ifscCode", v.toUpperCase())} mono icon="🔑" />
            <Field label="UPI ID" value={form.bankDetails.upiId} onChange={v => setBank("upiId", v)} icon="📲" />
          </div>

          <div className="xmodal__ft">
            <button className="xbtn xbtn--ghost" onClick={onCancel}>Cancel</button>
            <button className="xbtn xbtn--save" onClick={handleCreate} disabled={saving}>
              {saving ? <><span className="xbtn__spin" />Creating…</> : <>✓ Create Vendor</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════
   MAIN PAGE
══════════════════════════════ */
export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [catFilter, setCatFilter] = useState("all");

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${API_PREFIX}/admin/vendors${q}`, { headers: apiHeaders() });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const json = await res.json();
      setVendors(json.data || json.vendors || json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchAll, 300);
    return () => clearTimeout(t);
  }, [fetchAll]);

  const filtered = catFilter === "all"
    ? vendors
    : vendors.filter(v => v.category === catFilter);

  const catCounts = CATEGORIES.reduce((acc, c) => {
    acc[c] = vendors.filter(v => v.category === c).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="vnp-root">

      {/* ── HEADER ── */}
      <div className="vnp-hd">
        <div className="vnp-hd__left">
          <div className="vnp-hd__pill">🏪 Vendor Management</div>
          <h1 className="vnp-hd__title">Vendors</h1>
          <p className="vnp-hd__sub">Manage all vendors — click any card to expand and edit details.</p>
        </div>
        <button className="vnp-add-btn" onClick={() => { setShowAdd(true); setExpandedId(null); }}>
          <span className="vnp-add-btn__plus">＋</span>
          Add Vendor
        </button>
      </div>

      {/* ── STATS ── */}
      <div className="vnp-stats">
        {[
          { val: vendors.length, lbl: "Total Vendors", color: "#7c3aed", icon: "🏪" },
          { val: vendors.filter(v => v.isActive).length, lbl: "Active", color: "#10b981", icon: "✅" },
          { val: vendors.filter(v => !v.isActive).length, lbl: "Inactive", color: "#f87171", icon: "⛔" },
          { val: new Set(vendors.map(v => v.category)).size, lbl: "Categories", color: "#60a5fa", icon: "🏷️" },
        ].map((s, i) => (
          <div className="vnp-stat" key={i}
            style={{ "--s-color": s.color } as React.CSSProperties}>
            <div className="vnp-stat__icon">{s.icon}</div>
            <div className="vnp-stat__val" style={{ color: s.color }}>{s.val}</div>
            <div className="vnp-stat__lbl">{s.lbl}</div>
            <div className="vnp-stat__glow" style={{ background: s.color }} />
          </div>
        ))}
      </div>

      {/* ── TOOLBAR ── */}
      <div className="vnp-toolbar">
        <div className="vnp-search">
          <span className="vnp-search__ico">🔍</span>
          <input className="vnp-search__inp" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendors by name, email, phone, GST…" />
          {search && <button className="vnp-search__clr" onClick={() => setSearch("")}>✕</button>}
        </div>
        <button className="xbtn xbtn--ghost" onClick={fetchAll}>↻ Refresh</button>
      </div>

      {/* ── CATEGORY PILLS ── */}
      <div className="vnp-filter">
        <button className={`vnp-fpill ${catFilter === "all" ? "vnp-fpill--on" : ""}`}
          onClick={() => setCatFilter("all")}>
          🗂 All
          <span className="vnp-fpill__cnt">{vendors.length}</span>
        </button>
        {CATEGORIES.filter(c => (catCounts[c] || 0) > 0).map(c => {
          const m = CAT_META[c];
          return (
            <button key={c}
              className={`vnp-fpill ${catFilter === c ? "vnp-fpill--on" : ""}`}
              style={catFilter === c
                ? { borderColor: m.color, color: m.color, background: m.bg }
                : {}}
              onClick={() => setCatFilter(c)}>
              {m.icon} {c}
              <span className="vnp-fpill__cnt">{catCounts[c]}</span>
            </button>
          );
        })}
      </div>

      {/* ── LOADING ── */}
      {loading && (
        <div className="vnp-skels">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="vnp-skel" key={i}>
              <div className="vnp-skel__av" />
              <div className="vnp-skel__body">
                <div className="vnp-skel__line vnp-skel__line--lg" />
                <div className="vnp-skel__line vnp-skel__line--sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ERROR ── */}
      {!loading && error && (
        <div className="vnp-err-state">
          <div className="vnp-err-state__ico">⚠️</div>
          <div className="vnp-err-state__title">Failed to load vendors</div>
          <div className="vnp-err-state__msg">{error}</div>
          <button className="xbtn xbtn--save" onClick={fetchAll} style={{ marginTop: "1.25rem" }}>
            ↻ Retry
          </button>
        </div>
      )}

      {/* ── EMPTY ── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="vnp-empty">
          <div className="vnp-empty__ico">🏪</div>
          <div className="vnp-empty__title">
            {search ? "No vendors match your search" : "No vendors yet"}
          </div>
          <div className="vnp-empty__sub">
            {search ? "Try a different search term." : "Add your first vendor to get started."}
          </div>
          {!search && (
            <button className="vnp-add-btn" onClick={() => setShowAdd(true)} style={{ marginTop: "1.25rem" }}>
              <span className="vnp-add-btn__plus">＋</span> Add First Vendor
            </button>
          )}
        </div>
      )}

      {/* ── LIST ── */}
      {!loading && filtered.length > 0 && (
        <div className="vnp-list">
          {filtered.map((v, idx) => (
            <div key={v._id} className="vnp-list__row"
              style={{ animationDelay: `${idx * 0.045}s` }}>
              <VendorCard
                vendor={v}
                isExpanded={expandedId === v._id}
                onToggle={() => setExpandedId(expandedId === v._id ? null : v._id)}
                onSaved={fetchAll}
                onDeleted={fetchAll}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── ADD MODAL ── */}
      {showAdd && (
        <AddVendorModal
          onCreated={() => { setShowAdd(false); fetchAll(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}