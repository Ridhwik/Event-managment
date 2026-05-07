import type { EditableBillData } from "./BillSheetTypes";

type Props = {
  value: EditableBillData;
  onChange: (next: EditableBillData) => void;
};

export function PaymentAcknowledgementReplica({ value, onChange }: Props) {
  const rows = value.paymentAcknowledgement ?? [];

  const updateRow = (idx: number, key: "date" | "particulars" | "chNoCash" | "chNo" | "amount", val: string) => {
    const next = rows.map((row, i) =>
      i === idx ? { ...row, [key]: key === "amount" ? Number(val || 0) : val } : row
    );
    onChange({ ...value, paymentAcknowledgement: next });
  };

  return (
    <div style={{ border: "1px solid #0f172a", marginTop: 8 }}>
      <div style={{ fontWeight: 700, padding: 6, borderBottom: "1px solid #0f172a", textTransform: "uppercase", fontSize: 12 }}>
        Payment Acknowledgement
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {["DATE", "PARTICULARS", "CH NO./CASH", "CH NO.", "AMOUNT"].map((h) => (
              <th key={h} style={{ border: "1px solid #0f172a", padding: 6, background: "#fff", fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td style={{ border: "1px solid #0f172a", padding: 4 }}><input value={row.date ?? ""} onChange={(e) => updateRow(idx, "date", e.target.value)} /></td>
              <td style={{ border: "1px solid #0f172a", padding: 4 }}><input value={row.particulars ?? ""} onChange={(e) => updateRow(idx, "particulars", e.target.value)} /></td>
              <td style={{ border: "1px solid #0f172a", padding: 4 }}><input value={row.chNoCash ?? ""} onChange={(e) => updateRow(idx, "chNoCash", e.target.value)} /></td>
              <td style={{ border: "1px solid #0f172a", padding: 4 }}><input value={row.chNo ?? ""} onChange={(e) => updateRow(idx, "chNo", e.target.value)} /></td>
              <td style={{ border: "1px solid #0f172a", padding: 4 }}><input value={String(row.amount ?? "")} onChange={(e) => updateRow(idx, "amount", e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

