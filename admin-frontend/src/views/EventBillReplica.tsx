import type {
  EditableBillData,
  EditableBillRow,
  EditableBillSection,
} from "./BillSheetTypes";
import type {
  ReactNode,
  CSSProperties,
  InputHTMLAttributes,
  ButtonHTMLAttributes,
} from "react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ══════════════════════════════════════════════
   PROPS — Now includes API save capability
   ══════════════════════════════════════════════ */
type Props = {
  value: EditableBillData;
  onChange: (next: EditableBillData) => void;

  // ✅ NEW: API integration props
  billId?: string;                                    // Which bill to save
  onSaveToApi?: (data: EditableBillData) => Promise<void>;  // Parent handles API call
  isSaving?: boolean;                                 // Parent tells us if saving
  saveError?: string | null;                          // Parent tells us if error
  onRemarkAutoSave?: (payload: {
    sectionKey: string;
    billIds: string[];
    remark: string;
  }) => Promise<void> | void;
  onAddToRemark?: (payload: {
    sectionKey: string;
    remark: string;
    billIds: string[];
  }) => Promise<void> | void;
};

const theme = {
  navy: "#0f172a",
  slate: "#1e293b",
  white: "#ffffff",
  border: "#d1d5db",
  text: "#1f2937",
  muted: "#6b7280",
  headerBg: "#1e293b",
  headerText: "#ffffff",
  sectionBg: "#334155",
  totalBg: "#0f172a",
  totalText: "#ffffff",
  success: "#16a34a",
  successLight: "#dcfce7",
  error: "#dc2626",
};

const border = `1px solid ${theme.border}`;

const cellStyle: CSSProperties = {
  border,
  padding: "10px 8px",
  verticalAlign: "middle",
  color: theme.text,
  wordBreak: "break-word",
  backgroundColor: theme.white,
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: `1px solid ${theme.border}`,
  borderRadius: "4px",
  backgroundColor: theme.white,
  padding: "6px 8px",
  fontSize: "13px",
  fontFamily: "Arial, sans-serif",
  color: theme.text,
  fontWeight: 600,
  boxSizing: "border-box" as const,
  outline: "none",
};

const labelCellStyle: CSSProperties = {
  ...cellStyle,
  fontWeight: 700,
  backgroundColor: theme.headerBg,
  color: theme.headerText,
  fontSize: "13px",
  border: `1px solid ${theme.headerBg}`,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: "13px",
  fontFamily: "Arial, sans-serif",
  tableLayout: "fixed" as const,
  backgroundColor: theme.white,
};

const centerCell: CSSProperties = { ...cellStyle, textAlign: "center" };
const rightCell: CSSProperties = { ...cellStyle, textAlign: "right" };

const btnBase: CSSProperties = {
  border: "none",
  fontSize: "11px",
  padding: "6px 12px",
  cursor: "pointer",
  fontWeight: 700,
  borderRadius: "4px",
  outline: "none",
};

const addBtnStyle: CSSProperties = {
  ...btnBase,
  backgroundColor: theme.headerBg,
  color: theme.white,
};

const addRemarkBtnStyle: CSSProperties = {
  ...btnBase,
  backgroundColor: "#2563eb",
  color: theme.white,
};

const removeBtnStyle: CSSProperties = {
  ...btnBase,
  backgroundColor: "#dc2626",
  color: theme.white,
};

const saveBtnStyle: CSSProperties = {
  ...btnBase,
  backgroundColor: theme.success,
  color: theme.white,
  fontSize: "13px",
  padding: "10px 28px",
  borderRadius: "6px",
};

const savedBtnStyle: CSSProperties = {
  ...saveBtnStyle,
  backgroundColor: theme.successLight,
  color: theme.success,
  cursor: "default",
};

const errorBtnStyle: CSSProperties = {
  ...saveBtnStyle,
  backgroundColor: theme.error,
  color: theme.white,
};

/* ══════════════════════════════════════════════
   NORMALIZE REMARK
   ══════════════════════════════════════════════ */
function normalizeRemark(r: string): string {
  return (r || "").trim().toLowerCase();
}

/* ══════════════════════════════════════════════
   AUTO-GROUP
   ══════════════════════════════════════════════ */
function groupItemsByRemark(items: EditableBillRow[]): EditableBillRow[] {
  if (items.length <= 1)
    return items.map((r, i) => ({ ...r, srNo: i + 1 }));

  const result: EditableBillRow[] = [];
  const processed = new Set<number>();

  const firstSeen = new Map<string, string>();
  for (const row of items) {
    const norm = normalizeRemark(row.remarks || "");
    if (norm && !firstSeen.has(norm)) {
      firstSeen.set(norm, (row.remarks || "").trim());
    }
  }

  for (let i = 0; i < items.length; i++) {
    if (processed.has(i)) continue;
    const norm = normalizeRemark(items[i].remarks || "");
    const canonical = firstSeen.get(norm) || (items[i].remarks || "").trim();
    result.push({ ...items[i], remarks: norm ? canonical : items[i].remarks });
    processed.add(i);
    if (norm) {
      for (let j = i + 1; j < items.length; j++) {
        if (processed.has(j)) continue;
        if (normalizeRemark(items[j].remarks || "") === norm) {
          result.push({ ...items[j], remarks: canonical });
          processed.add(j);
        }
      }
    }
  }

  return result.map((row, i) => ({ ...row, srNo: i + 1 }));
}

/* ── rowSpan spans ── */
function computeRemarkSpans(items: EditableBillRow[]): (number | null)[] {
  const spans: (number | null)[] = [];
  let i = 0;
  while (i < items.length) {
    const norm = normalizeRemark(items[i].remarks || "");
    if (!norm) {
      spans.push(1);
      i++;
      continue;
    }
    let count = 1;
    while (
      i + count < items.length &&
      normalizeRemark(items[i + count].remarks || "") === norm
    ) {
      count++;
    }
    spans.push(count);
    for (let j = 1; j < count; j++) spans.push(null);
    i += count;
  }
  return spans;
}

/* ══════════════════════════════════════════════
   LOCKED INPUT
   ══════════════════════════════════════════════ */
function LockedInput({
  style,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const lockStyle = useCallback(() => {
    if (!ref.current) return;
    const bg = style?.backgroundColor || theme.white;
    const col = style?.color || theme.text;
    ref.current.style.backgroundColor = String(bg);
    ref.current.style.background = String(bg);
    ref.current.style.color = String(col);
    ref.current.style.outline = "none";
    ref.current.style.boxShadow = "none";
    ref.current.style.borderColor = theme.border;
  }, [style]);

  return (
    <input
      ref={ref}
      {...rest}
      style={style}
      onFocus={(e) => { lockStyle(); rest.onFocus?.(e); }}
      onBlur={(e) => { lockStyle(); rest.onBlur?.(e); }}
      onMouseEnter={(e) => { lockStyle(); rest.onMouseEnter?.(e); }}
      onMouseLeave={(e) => { lockStyle(); rest.onMouseLeave?.(e); }}
      onMouseOver={(e) => { lockStyle(); rest.onMouseOver?.(e); }}
    />
  );
}

/* ══════════════════════════════════════════════
   LOCKED BUTTON
   ══════════════════════════════════════════════ */
function LockedButton({
  style,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const lockStyle = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.transform = "none";
    ref.current.style.boxShadow = "none";
    ref.current.style.outline = "none";
    ref.current.style.opacity = "1";
    if (style?.backgroundColor) {
      ref.current.style.backgroundColor = String(style.backgroundColor);
    }
  }, [style]);

  return (
    <button
      ref={ref}
      {...rest}
      style={style}
      onMouseEnter={(e) => { lockStyle(); rest.onMouseEnter?.(e); }}
      onMouseLeave={(e) => { lockStyle(); rest.onMouseLeave?.(e); }}
      onFocus={(e) => { lockStyle(); rest.onFocus?.(e); }}
      onMouseOver={(e) => { lockStyle(); rest.onMouseOver?.(e); }}
    >
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════
   LOCKED ROW
   ══════════════════════════════════════════════ */
function LockedRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLTableRowElement>(null);
  const lockCells = useCallback(() => {
    if (!ref.current) return;
    ref.current.querySelectorAll("td").forEach((td) => {
      td.style.backgroundColor = theme.white;
      td.style.background = theme.white;
    });
  }, []);

  return (
    <tr
      ref={ref}
      onMouseEnter={lockCells}
      onMouseOver={lockCells}
      onMouseLeave={lockCells}
      onFocus={lockCells}
    >
      {children}
    </tr>
  );
}

function FragmentLike({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ══════════════════════════════════════════════════════
   REMARK AUTOCOMPLETE
   ══════════════════════════════════════════════════════ */
function RemarkAutocomplete({
  value,
  existingRemarks,
  onChange,
  onConfirm,
  onRemarkFocus,
  style,
}: {
  value: string;
  existingRemarks: string[];
  onChange: (val: string) => void;
  onConfirm: () => void;
  onRemarkFocus: (remark: string) => void;
  style?: CSSProperties;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const norm = normalizeRemark(value);

  const suggestions = useMemo(() => {
    if (!norm) return existingRemarks;
    return existingRemarks.filter((r) => {
      const rn = normalizeRemark(r);
      return rn.includes(norm) && rn !== norm;
    });
  }, [existingRemarks, norm]);

  const exactMatch = useMemo(() => {
    if (!norm) return null;
    return existingRemarks.find(
      (r) => normalizeRemark(r) === norm && r.trim() !== value.trim()
    );
  }, [existingRemarks, norm, value]);

  const dropdownItems = useMemo(() => {
    const items: string[] = [];
    if (exactMatch) items.push(exactMatch);
    items.push(...suggestions.filter((s) => s !== exactMatch));
    return items;
  }, [suggestions, exactMatch]);

  const selectSuggestion = (s: string) => {
    onChange(s);
    setShowSuggestions(false);
    setHighlightIdx(-1);
    onRemarkFocus(s);
    setTimeout(() => onConfirm(), 50);
  };

  const lockInputStyle = useCallback(() => {
    if (!inputRef.current) return;
    const bg = style?.backgroundColor || theme.white;
    const col = style?.color || theme.text;
    inputRef.current.style.backgroundColor = String(bg);
    inputRef.current.style.background = String(bg);
    inputRef.current.style.color = String(col);
    inputRef.current.style.outline = "none";
    inputRef.current.style.boxShadow = "none";
    inputRef.current.style.borderColor = theme.border;
  }, [style]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
          setHighlightIdx(-1);
          onRemarkFocus(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIdx((prev) => (prev < dropdownItems.length - 1 ? prev + 1 : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIdx((prev) => (prev > 0 ? prev - 1 : dropdownItems.length - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlightIdx >= 0 && dropdownItems[highlightIdx]) {
              selectSuggestion(dropdownItems[highlightIdx]);
            } else {
              setShowSuggestions(false);
              onConfirm();
            }
          } else if (e.key === "Escape") {
            setShowSuggestions(false);
          }
        }}
        onFocus={() => { lockInputStyle(); setShowSuggestions(true); onRemarkFocus(value); }}
        onBlur={() => { lockInputStyle(); setTimeout(() => setShowSuggestions(false), 200); }}
        onMouseEnter={lockInputStyle}
        onMouseLeave={lockInputStyle}
        onMouseOver={lockInputStyle}
        style={style}
        autoComplete="off"
        placeholder="Type remark..."
      />

      {showSuggestions && dropdownItems.length > 0 && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            backgroundColor: theme.white, border: `1px solid ${theme.border}`,
            borderRadius: "0 0 6px 6px", zIndex: 9999,
            maxHeight: "160px", overflowY: "auto",
            boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
          }}
        >
          <div
            style={{
              padding: "6px 10px", fontSize: "10px", fontWeight: 700,
              color: theme.muted, textTransform: "uppercase",
              letterSpacing: "0.5px", borderBottom: `1px solid ${theme.border}`,
              backgroundColor: "#f8fafc",
            }}
          >
            Existing Remarks — Click to merge
          </div>
          {dropdownItems.map((s, i) => {
            const isHighlighted = i === highlightIdx;
            const isExact = normalizeRemark(s) === norm && norm !== "";
            return (
              <div
                key={`${s}-${i}`}
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                onMouseEnter={() => setHighlightIdx(i)}
                style={{
                  padding: "8px 12px", cursor: "pointer", fontSize: "13px",
                  fontWeight: isExact ? 700 : 500,
                  color: isExact ? "#2563eb" : theme.text,
                  backgroundColor: isHighlighted ? "#e0e7ff" : theme.white,
                  borderBottom: i < dropdownItems.length - 1 ? "1px solid #f1f5f9" : "none",
                  display: "flex", alignItems: "center", gap: "8px",
                  transition: "background-color 0.1s",
                }}
              >
                <span style={{ fontSize: "11px", color: isExact ? "#2563eb" : theme.muted }}>
                  {isExact ? "✓" : "→"}
                </span>
                {s}
                {isExact && (
                  <span style={{ fontSize: "10px", color: "#2563eb", marginLeft: "auto", fontWeight: 600 }}>
                    match
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT — API INTEGRATED
   ══════════════════════════════════════════════ */
export function EventBillReplica({
  value,
  onChange,
  billId,
  onSaveToApi,
  isSaving: externalSaving,
  saveError: externalError,
  onRemarkAutoSave,
  onAddToRemark,
}: Props) {
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [localSaveError, setLocalSaveError] = useState<string | null>(null);
  const [localData, setLocalData] = useState<EditableBillData>(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeRemarks, setActiveRemarks] = useState<Record<string, string>>({});
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isProbablyApiData = useCallback((data: EditableBillData): boolean => {
    if (!data) return false;
    if ((data.eventName || "").trim()) return true;
    if ((data.eventDate || "").trim()) return true;
    if ((data.venue || "").trim()) return true;
    if ((data.sectionTitle || "").trim()) return true;
    if (Array.isArray(data.sections) && data.sections.some((section) => section.items.length > 0)) {
      return true;
    }
    return Number(data.totals?.finalTotal || data.totals?.total || 0) > 0;
  }, []);

  // ✅ Track if data came from API (parent prop)
  const hasApiData = useRef(false);

  // ✅ Sync with parent value (from API)
  useEffect(() => {
    if (value && isProbablyApiData(value)) {
      const timeout = window.setTimeout(() => {
        setLocalData(value);
        setHasUnsavedChanges(false);
      }, 0);
      hasApiData.current = true;
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [value, isProbablyApiData]);

  // ✅ Sync external saving state
  useEffect(() => {
    if (externalSaving) {
      const timeout = window.setTimeout(() => {
        setSaveStatus("saving");
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [externalSaving]);

  // ✅ Sync external error state
  useEffect(() => {
    if (externalError) {
      const timeout = window.setTimeout(() => {
        setSaveStatus("error");
        setLocalSaveError(externalError);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [externalError]);

  useEffect(() => {
    if (saveStatus === "saved") {
      const t = setTimeout(() => setSaveStatus("idle"), 2000);
      return () => clearTimeout(t);
    }
    if (saveStatus === "error") {
      const t = setTimeout(() => {
        setSaveStatus("idle");
        setLocalSaveError(null);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

  // ✅ Style lock interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (!containerRef.current) return;
      containerRef.current.querySelectorAll("input").forEach((el) => {
        if (el.classList.contains("header-input")) return;
        if (el.classList.contains("budget-input")) return;
        el.style.backgroundColor = theme.white;
        el.style.outline = "none";
        el.style.boxShadow = "none";
      });
      containerRef.current.querySelectorAll("td[data-lock]").forEach((el) => {
        (el as HTMLElement).style.backgroundColor = theme.white;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // ✅ Load localStorage ONLY if no API data
  useEffect(() => {
    if (hasApiData.current) return; // Don't override API data

    try {
      const scopedDraftKey = billId ? `billDraft_${billId}` : null;
      const stored =
        (scopedDraftKey ? localStorage.getItem(scopedDraftKey) : null) ??
        localStorage.getItem("billDraft");

      if (stored) {
        const parsed = JSON.parse(stored) as EditableBillData;
        if (parsed && typeof parsed === "object") {
          const timeout = window.setTimeout(() => {
            setLocalData(parsed);
          }, 0);
          return () => window.clearTimeout(timeout);
        }
      }
    } catch {
      /* ignore */
    }
  }, [billId]);

  // ✅ Mark unsaved changes
  const setLocal = useCallback(<K extends keyof EditableBillData>(
    key: K,
    v: EditableBillData[K]
  ) => {
    setLocalData((prev) => ({ ...prev, [key]: v }));
    setSaveStatus("idle");
    setHasUnsavedChanges(true);
  }, []);

  const sectionTemplate = [
    { key: "A", title: "SETUP AND INFRASTRUCTURE", match: /setup|infrastructure/i },
    { key: "B", title: "TENTAGE", match: /tentage/i },
    { key: "C", title: "FURNITURE", match: /furniture/i },
    { key: "D", title: "TECHNICALS", match: /technical/i },
    { key: "E", title: "SERVICES", match: /service/i },
    { key: "F", title: "ENTERTAINMENT", match: /entertainment/i },
  ];

  const orderedSections: EditableBillSection[] = sectionTemplate.map((tpl) => {
    const existing = localData.sections.find(
      (s) => tpl.match.test(String(s.title || "")) || s.key === tpl.key
    );
    return existing
      ? { ...existing, key: tpl.key, title: tpl.title }
      : { key: tpl.key, title: tpl.title, items: [] };
  });

  const allExistingRemarks = useMemo(() => {
    const seen = new Set<string>();
    const remarks: string[] = [];
    for (const section of localData.sections) {
      for (const row of section.items) {
        const norm = normalizeRemark(row.remarks || "");
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          remarks.push((row.remarks || "").trim());
        }
      }
    }
    return remarks;
  }, [localData.sections]);

  const getSectionRemarks = useCallback(
    (sectionKey: string): string[] => {
      const section = orderedSections.find((s) => s.key === sectionKey);
      if (!section) return [];
      const seen = new Set<string>();
      const remarks: string[] = [];
      for (const row of section.items) {
        const norm = normalizeRemark(row.remarks || "");
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          remarks.push((row.remarks || "").trim());
        }
      }
      return remarks;
    },
    [orderedSections]
  );

  const updateSection = useCallback((
    sectionKey: string,
    next: EditableBillSection,
    autoGroup = false
  ) => {
    const finalSection = autoGroup
      ? { ...next, items: groupItemsByRemark(next.items) }
      : next;
    const updated = localData.sections.some((s) => s.key === sectionKey)
      ? localData.sections.map((s) => (s.key === sectionKey ? finalSection : s))
      : [...localData.sections, finalSection];
    setLocal("sections", updated);
  }, [localData.sections, setLocal]);

  const updateRow = useCallback((
    sectionKey: string,
    rowIndex: number,
    patch: Partial<EditableBillRow>
  ) => {
    const section = orderedSections.find((s) => s.key === sectionKey);
    if (!section) return;
    const updatedRows = section.items.map((row, i) =>
      i === rowIndex ? { ...row, ...patch } : row
    );
    updateSection(sectionKey, {
      ...section,
      items: updatedRows.map((row) => ({
        ...row,
        amount: Number(row.quantity || 0) * Number(row.rate || 0),
      })),
    });
  }, [orderedSections, updateSection]);

  const updateRemarkInSpan = useCallback((
    sectionKey: string,
    startIdx: number,
    span: number,
    newVal: string
  ) => {
    const section = orderedSections.find((s) => s.key === sectionKey);
    if (!section) return;
    const updatedRows = section.items.map((row, i) =>
      i >= startIdx && i < startIdx + span ? { ...row, remarks: newVal } : row
    );
    updateSection(sectionKey, {
      ...section,
      items: updatedRows.map((row) => ({
        ...row,
        amount: Number(row.quantity || 0) * Number(row.rate || 0),
      })),
    });
    const affectedBillIds = section.items
      .filter((_, i) => i >= startIdx && i < startIdx + span)
      .map((row) => String((row as EditableBillRow & { billId?: string }).billId || ""))
      .filter(Boolean);
    if (onRemarkAutoSave && affectedBillIds.length > 0) {
      onRemarkAutoSave({
        sectionKey,
        billIds: [...new Set(affectedBillIds)],
        remark: newVal,
      });
    }
  }, [orderedSections, onRemarkAutoSave, updateSection]);

  const regroupSection = useCallback((sectionKey: string) => {
    setLocalData((prev) => {
      const hasSec = prev.sections.some((s) => s.key === sectionKey);
      if (!hasSec) return prev;
      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.key !== sectionKey ? s : { ...s, items: groupItemsByRemark(s.items) }
        ),
      };
    });
    setSaveStatus("idle");
    setHasUnsavedChanges(true);
  }, []);

  const addRow = useCallback((sectionKey: string) => {
    const section = orderedSections.find((s) => s.key === sectionKey);
    if (!section) return;
    const newItems = [
      ...section.items,
      { srNo: section.items.length + 1, quantity: 1, size: "", rate: 0, amount: 0, remarks: "", particular: "" },
    ];
    updateSection(sectionKey, { ...section, items: newItems }, true);
  }, [orderedSections, updateSection]);

  const addRowToRemark = useCallback((sectionKey: string, remarkText?: string) => {
    const section = orderedSections.find((s) => s.key === sectionKey);
    if (!section) return;
    let targetRemark = remarkText || activeRemarks[sectionKey] || "";
    if (!normalizeRemark(targetRemark)) {
      const remarkCounts = new Map<string, number>();
      const remarkOriginal = new Map<string, string>();
      for (const row of section.items) {
        const norm = normalizeRemark(row.remarks || "");
        if (norm) {
          remarkCounts.set(norm, (remarkCounts.get(norm) || 0) + 1);
          if (!remarkOriginal.has(norm)) remarkOriginal.set(norm, (row.remarks || "").trim());
        }
      }
      if (remarkCounts.size === 0) { addRow(sectionKey); return; }
      const topNorm = [...remarkCounts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
      targetRemark = remarkOriginal.get(topNorm) || topNorm;
    }
    const newRow: EditableBillRow = {
      srNo: 0, quantity: 1, size: "", rate: 0, amount: 0, remarks: targetRemark, particular: "",
    };
    updateSection(sectionKey, { ...section, items: [...section.items, newRow] }, true);
    const sameRemarkBillIds = section.items
      .filter((row) => normalizeRemark(row.remarks || "") === normalizeRemark(targetRemark))
      .map((row) => String((row as EditableBillRow & { billId?: string }).billId || ""))
      .filter(Boolean);
    if (onAddToRemark && sameRemarkBillIds.length > 0) {
      onAddToRemark({
        sectionKey,
        remark: targetRemark,
        billIds: [...new Set(sameRemarkBillIds)],
      });
    }
  }, [orderedSections, activeRemarks, addRow, onAddToRemark, updateSection]);

  const removeRow = useCallback((sectionKey: string, rowIndex: number) => {
    const section = orderedSections.find((s) => s.key === sectionKey);
    if (!section) return;
    const filtered = section.items.filter((_, i) => i !== rowIndex);
    updateSection(sectionKey, { ...section, items: filtered }, true);
  }, [orderedSections, updateSection]);

  const computedTotal = orderedSections.reduce(
    (acc, sec) => acc + sec.items.reduce((r, row) => r + Number(row.amount || 0), 0),
    0
  );

  const updateBudget = useCallback((val: string) => {
    const num = Number(val.replace(/[^0-9.-]/g, "")) || 0;
    setLocalData((prev) => ({
      ...prev,
      totals: { ...prev.totals, finalTotal: num, total: num },
    }));
    setSaveStatus("idle");
    setHasUnsavedChanges(true);
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ SAVE HANDLER — API + localStorage + parent
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    setLocalSaveError(null);

    // 1️⃣ Update parent state
    onChange(localData);

    // 2️⃣ Save to localStorage as backup
    try {
      const draftKey = billId ? `billDraft_${billId}` : "billDraft";
      localStorage.setItem(draftKey, JSON.stringify(localData));
    } catch {
      /* silent */
    }

    // 3️⃣ Save to API if handler provided
    if (onSaveToApi) {
      try {
        await onSaveToApi(localData);
        setSaveStatus("saved");
        setHasUnsavedChanges(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save";
        setSaveStatus("error");
        setLocalSaveError(message);
      }
    } else {
      // No API handler — just local save
      setTimeout(() => {
        setSaveStatus("saved");
        setHasUnsavedChanges(false);
      }, 400);
    }
  }, [localData, onChange, onSaveToApi, billId]);

  // ✅ Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const handleRemarkFocus = useCallback(
    (sectionKey: string, remark: string) => {
      setActiveRemarks((prev) => ({ ...prev, [sectionKey]: remark }));
    },
    []
  );

  // ── Determine save button style ──
  const currentSaveStyle = useMemo(() => {
    if (saveStatus === "error") return errorBtnStyle;
    if (saveStatus === "saved") return savedBtnStyle;
    return saveBtnStyle;
  }, [saveStatus]);

  const currentSaveLabel = useMemo(() => {
    if (saveStatus === "saving" || externalSaving) return "Saving…";
    if (saveStatus === "saved") return "Saved ✓";
    if (saveStatus === "error") return "Retry Save";
    return hasUnsavedChanges ? "💾 Save Changes" : "Save Changes";
  }, [saveStatus, externalSaving, hasUnsavedChanges]);

  return (
    <div
      ref={containerRef}
      style={{
        border: `1px solid ${theme.border}`,
        backgroundColor: theme.white,
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        borderRadius: "8px",
        overflowX: "auto",
      }}
    >
      <style>
        {`
          * { box-sizing: border-box; }
          ::placeholder { color: ${theme.muted} !important; opacity: 1; }
        `}
      </style>

      {/* HEADER */}
      <table style={tableStyle}>
        <tbody>
          {(
            [
              ["Event :", "eventName"],
              ["Event Date :", "eventDate"],
              ["Venue :", "venue"],
            ] as const
          ).map(([label, key]) => (
            <tr key={key}>
              <td colSpan={2} style={labelCellStyle}>{label}</td>
              <td colSpan={6} data-lock style={cellStyle}>
                <LockedInput
                  value={String(localData[key] || "")}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    if (key === "eventName") setLocal("eventName", nextVal);
                    if (key === "eventDate") setLocal("eventDate", nextVal);
                    if (key === "venue") setLocal("venue", nextVal);
                  }}
                  style={inputStyle}
                />
              </td>
            </tr>
          ))}

          <tr>
            <td
              colSpan={8}
              style={{
                border: "none", backgroundColor: theme.headerBg,
                color: theme.headerText, fontSize: "20px",
                fontWeight: 800, padding: "16px",
                textTransform: "uppercase", textAlign: "center",
              }}
            >
              {localData.eventName || "EVENT NAME"}
            </td>
          </tr>

          <tr>
            <td
              colSpan={8}
              style={{
                border: "none", backgroundColor: theme.sectionBg,
                padding: "10px", textAlign: "center",
              }}
            >
              <LockedInput
                className="header-input"
                value={localData.sectionTitle ?? ""}
                onChange={(e) => setLocal("sectionTitle", e.target.value)}
                style={{
                  width: "100%", textAlign: "center",
                  color: theme.white, WebkitTextFillColor: theme.white,
                  backgroundColor: "transparent", border: "none",
                  outline: "none", fontWeight: 700, fontSize: "14px",
                  fontFamily: "Arial, sans-serif", padding: "6px 8px",
                  boxSizing: "border-box" as const,
                }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* MAIN TABLE */}
      <table style={{ ...tableStyle, marginTop: "12px" }}>
        <colgroup>
          <col style={{ width: "6%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "17%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>

        <thead>
          <tr>
            {["Sr No", "Particulars", "Qty", "Sizes", "Rate", "Amount", "Remarks", "Action"].map((h) => (
              <th
                key={h}
                style={{
                  border: `1px solid ${theme.headerBg}`, padding: "12px 6px",
                  backgroundColor: theme.headerBg, color: theme.headerText,
                  fontWeight: 700, fontSize: "12px",
                  textTransform: "uppercase", textAlign: "center",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {orderedSections.map((section) => {
            const remarkSpans = computeRemarkSpans(section.items);
            const sectionRemarks = getSectionRemarks(section.key);
            const hasRemarks = sectionRemarks.length > 0;
            const activeRemark = activeRemarks[section.key] || "";
            const activeNorm = normalizeRemark(activeRemark);
            const activeDisplay = activeNorm
              ? sectionRemarks.find((r) => normalizeRemark(r) === activeNorm) || activeRemark.trim()
              : "";
            const btnLabel = activeDisplay
              ? activeDisplay.length > 12
                ? `+ Add to "${activeDisplay.slice(0, 12)}…"`
                : `+ Add to "${activeDisplay}"`
              : "+ Add to Remark";

            return (
              <FragmentLike key={section.key}>
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      backgroundColor: theme.sectionBg, color: theme.headerText,
                      fontWeight: 700, fontSize: "13px", padding: "12px 14px",
                      border: `1px solid ${theme.sectionBg}`,
                    }}
                  >
                    {section.key}. {section.title}
                    <span style={{ float: "right", display: "flex", gap: "8px", alignItems: "center" }}>
                      {sectionRemarks.length > 1 && (
                        <select
                          value={activeNorm}
                          onChange={(e) => {
                            const selected = sectionRemarks.find((r) => normalizeRemark(r) === e.target.value) || "";
                            handleRemarkFocus(section.key, selected);
                          }}
                          style={{
                            fontSize: "11px", padding: "4px 8px", borderRadius: "4px",
                            border: `1px solid ${theme.border}`, backgroundColor: theme.white,
                            color: theme.text, fontWeight: 600, cursor: "pointer",
                            outline: "none", maxWidth: "120px",
                          }}
                        >
                          <option value="">Select remark...</option>
                          {sectionRemarks.map((r) => (
                            <option key={r} value={normalizeRemark(r)}>{r}</option>
                          ))}
                        </select>
                      )}
                      <LockedButton onClick={() => addRow(section.key)} style={addBtnStyle}>
                        + Add Row
                      </LockedButton>
                      <LockedButton
                        onClick={() => addRowToRemark(section.key)}
                        style={{
                          ...addRemarkBtnStyle,
                          opacity: hasRemarks ? 1 : 0.5,
                          cursor: hasRemarks ? "pointer" : "not-allowed",
                          transition: "all 0.2s",
                        }}
                        disabled={!hasRemarks}
                        title={activeDisplay ? `Add new row to "${activeDisplay}" group` : "Click a remark field first"}
                      >
                        {btnLabel}
                      </LockedButton>
                    </span>
                  </td>
                </tr>

                {section.items.map((row, idx) => {
                  const span = remarkSpans[idx];
                  const spanValue = typeof span === "number" && span > 0 ? span : 1;
                  const showRemarkCell = span !== null;

                  return (
                    <LockedRow key={`${section.key}-${idx}`}>
                      <td data-lock style={centerCell}>
                        <LockedInput
                          value={Number(row.srNo ?? 0)}
                          onChange={(e) => updateRow(section.key, idx, { srNo: Number(e.target.value || 0) })}
                          style={{ ...inputStyle, textAlign: "center" }}
                        />
                      </td>
                      <td data-lock style={cellStyle}>
                        <LockedInput
                          value={row.particular ?? ""}
                          onChange={(e) => updateRow(section.key, idx, { particular: e.target.value })}
                          style={{ ...inputStyle, fontWeight: 700 }}
                        />
                      </td>
                      <td data-lock style={centerCell}>
                        <LockedInput
                          value={Number(row.quantity ?? 0)}
                          onChange={(e) => updateRow(section.key, idx, { quantity: Number(e.target.value || 0) })}
                          style={{ ...inputStyle, textAlign: "center" }}
                        />
                      </td>
                      <td data-lock style={cellStyle}>
                        <LockedInput
                          value={row.size ?? ""}
                          onChange={(e) => updateRow(section.key, idx, { size: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td data-lock style={rightCell}>
                        <LockedInput
                          value={Number(row.rate ?? 0)}
                          onChange={(e) => updateRow(section.key, idx, { rate: Number(e.target.value || 0) })}
                          style={{ ...inputStyle, textAlign: "right" }}
                        />
                      </td>
                      <td data-lock style={{ ...rightCell, fontWeight: 700, color: theme.text }}>
                        <LockedInput
                          value={Number(row.amount || 0).toLocaleString("en-IN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9.-]/g, "");
                            const num = Number(raw) || 0;
                            updateRow(section.key, idx, {
                              amount: num,
                              rate: Number(row.quantity || 0) > 0 ? num / Number(row.quantity || 1) : num,
                            });
                          }}
                          style={{ ...inputStyle, textAlign: "right", fontWeight: 700 }}
                        />
                      </td>
                      {showRemarkCell && (
                        <td
                          data-lock
                          style={{
                            ...cellStyle, verticalAlign: "middle", textAlign: "center",
                            overflow: "visible", position: "relative",
                          }}
                          rowSpan={spanValue}
                        >
                          <RemarkAutocomplete
                            value={row.remarks || ""}
                            existingRemarks={allExistingRemarks}
                            onChange={(newVal) => updateRemarkInSpan(section.key, idx, spanValue, newVal)}
                            onConfirm={() => regroupSection(section.key)}
                            onRemarkFocus={(remark) => handleRemarkFocus(section.key, remark)}
                            style={inputStyle}
                          />
                        </td>
                      )}
                      <td data-lock style={centerCell}>
                        <LockedButton onClick={() => removeRow(section.key, idx)} style={removeBtnStyle}>
                          ✕
                        </LockedButton>
                      </td>
                    </LockedRow>
                  );
                })}
              </FragmentLike>
            );
          })}

          {/* TOTAL ROW */}
          <tr>
            <td
              colSpan={5}
              style={{
                border: `1px solid ${theme.totalBg}`, backgroundColor: theme.totalBg,
                color: theme.totalText, fontWeight: 800, fontSize: "15px", padding: "14px",
              }}
            >
              TOTAL
            </td>
            <td
              style={{
                border: `1px solid ${theme.totalBg}`, backgroundColor: theme.totalBg,
                color: theme.totalText, fontWeight: 800, fontSize: "15px",
                padding: "14px", textAlign: "right",
              }}
            >
              {editingBudget ? (
                <input
                  className="budget-input"
                  autoFocus
                  value={budgetValue ?? ""}
                  onChange={(e) => setBudgetValue(e.target.value)}
                  onBlur={() => { updateBudget(budgetValue); setEditingBudget(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { updateBudget(budgetValue); setEditingBudget(false); }
                    if (e.key === "Escape") setEditingBudget(false);
                  }}
                  style={{
                    width: "100%", backgroundColor: "transparent",
                    border: `1px solid ${theme.white}`, borderRadius: "4px",
                    color: theme.totalText, fontSize: "15px", fontWeight: 800,
                    textAlign: "right", padding: "4px 8px", outline: "none",
                    fontFamily: "Arial, sans-serif", boxSizing: "border-box" as const,
                  }}
                />
              ) : (
                <span
                  onClick={() => {
                    const current = localData.totals.finalTotal || localData.totals.total || computedTotal || 0;
                    setBudgetValue(String(current));
                    setEditingBudget(true);
                  }}
                  style={{
                    cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "flex-end", gap: "6px",
                  }}
                  title="Click to edit budget"
                >
                  ₹{Number(localData.totals.finalTotal || localData.totals.total || computedTotal || 0).toLocaleString("en-IN")}
                  <span style={{ fontSize: "10px", opacity: 0.6 }}>✎</span>
                </span>
              )}
            </td>
            <td
              colSpan={2}
              style={{
                border: `1px solid ${theme.totalBg}`, backgroundColor: theme.totalBg,
                color: theme.totalText, textAlign: "center",
                fontSize: "11px", padding: "14px 8px",
              }}
            >
              {(localData.totals.finalTotal || localData.totals.total) &&
                computedTotal !== (localData.totals.finalTotal || localData.totals.total) ? (
                <span style={{ opacity: 0.7 }}>
                  Computed: ₹{computedTotal.toLocaleString("en-IN")}
                </span>
              ) : null}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ✅ SAVE BAR — Enhanced with API status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginTop: "16px",
          padding: "8px 0",
        }}
      >
        {/* Left side — status info */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {hasUnsavedChanges && saveStatus === "idle" && (
            <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: "12px" }}>
              ● Unsaved changes
            </span>
          )}
          {billId && (
            <span style={{ color: theme.muted, fontSize: "11px" }}>
              Bill: {billId.slice(-8)}
            </span>
          )}
        </div>

        {/* Right side — save button + status */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Save status message */}
          {saveStatus === "saved" && (
            <span style={{ color: theme.success, fontWeight: 600, fontSize: "13px" }}>
              ✓ Changes saved
            </span>
          )}
          {saveStatus === "error" && (
            <span style={{ color: theme.error, fontWeight: 600, fontSize: "12px" }}>
              {localSaveError || "Save failed"}
            </span>
          )}

          {/* Save button */}
          <LockedButton
            onClick={handleSave}
            disabled={saveStatus === "saving" || Boolean(externalSaving)}
            style={currentSaveStyle}
          >
            {currentSaveLabel}
          </LockedButton>
        </div>
      </div>
    </div>
  );
}