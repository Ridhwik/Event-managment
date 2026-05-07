import { useMemo } from "react";
import { EventBillReplica } from "./EventBillReplica";
import { buildDefaultEditableBillData } from "./EditableBillSheetDefaults";
import type { EditableBillData } from "./BillSheetTypes";
export type { EditableBillData } from "./BillSheetTypes";

type Props = {
  value: EditableBillData;
  onChange: (next: EditableBillData) => void;
};

export function EditableBillSheet({ value, onChange }: Props) {
  const normalized = useMemo(() => buildDefaultEditableBillData(value), [value]);

  return (
    <div style={{ background: "#f8fafc", color: "#0f172a", border: "1px solid #0f172a", padding: 10 }}>
      <div style={{ width: "100%", maxWidth: 1020, margin: "0 auto", background: "#fff", border: "1px solid #0f172a", padding: 10 }}>
        <EventBillReplica value={normalized} onChange={onChange} />
      </div>
    </div>
  );
}

