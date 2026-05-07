import type { EditableBillData } from "./BillSheetTypes";
import type { CSSProperties } from "react";

type Props = {
  value: EditableBillData;
  onChange: (next: EditableBillData) => void;
};

const containerStyle: CSSProperties = {
  border: "2px solid #0f172a",
  background: "#f8fafc",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
  fontFamily: "'Inter', sans-serif",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "180px 1fr",
  borderBottom: "1px solid #cbd5e1",
  minHeight: "56px",
  alignItems: "center",
};

const labelStyle: CSSProperties = {
  borderRight: "1px solid #cbd5e1",
  padding: "14px 12px",
  fontWeight: 700,
  fontSize: "12px",
  letterSpacing: "0.8px",
  color: "#0f172a",
  background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
  textTransform: "uppercase",
};

const inputWrapperStyle: CSSProperties = {
  padding: "8px 12px",
  background: "#ffffff",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1.5px solid #cbd5e1",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: 500,
  color: "#0f172a",
  outline: "none",
  background: "#f8fafc",
  transition: "all 0.3s ease",
  boxSizing: "border-box",
};

export function ClosingFormReplica({ value, onChange }: Props) {
  const set = <K extends keyof EditableBillData>(
    key: K,
    v: EditableBillData[K]
  ) => onChange({ ...value, [key]: v });

  const box = (
    label: string,
    val: string | number,
    onVal: (v: string) => void
  ) => (
    <div style={rowStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={inputWrapperStyle}>
        <input
          value={val}
          onChange={(e) => onVal(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.border = "1.5px solid #2563eb";
            e.currentTarget.style.background = "#ffffff";
            e.currentTarget.style.boxShadow =
              "0 0 0 4px rgba(37, 99, 235, 0.12)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = "1.5px solid #cbd5e1";
            e.currentTarget.style.background = "#f8fafc";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>
    </div>
  );

  return (
    <div style={containerStyle}>
      {box("DATE", value.date ?? "", (v) => set("date", v))}
      {box("A/C NO", value.accountNo ?? "", (v) => set("accountNo", v))}
      {box("ACTIVITY NAME", value.activityName ?? "", (v) =>
        set("activityName", v)
      )}
      {box("START DATE", value.startDate ?? "", (v) => set("startDate", v))}
      {box("CLOSING DATE", value.closingDate ?? "", (v) =>
        set("closingDate", v)
      )}
      {box("PERSON NAME", value.personName ?? "", (v) => set("personName", v))}
      {box("UNDER WHOM", value.underWhom ?? "", (v) => set("underWhom", v))}
      {box("CLOSING AMT", value.closingAmt ?? 0, (v) =>
        set("closingAmt", Number(v || 0))
      )}
      {box("CASH AMT", value.cashAmt ?? 0, (v) =>
        set("cashAmt", Number(v || 0))
      )}
      {box("PS AMT", value.psAmt ?? 0, (v) =>
        set("psAmt", Number(v || 0))
      )}
      {box("SIGN", value.sign ?? "", (v) => set("sign", v))}
      {box("SIGN APPROVED BY", value.signApprovedBy ?? "", (v) =>
        set("signApprovedBy", v)
      )}
      {box("FOR ACCOUNTS USE ONLY", value.accountsUseOnly ?? "", (v) =>
        set("accountsUseOnly", v)
      )}
      {box("C.C NO", value.ccNo ?? "", (v) => set("ccNo", v))}
    </div>
  );
}