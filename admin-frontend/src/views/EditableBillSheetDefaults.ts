import type { EditableBillData } from "./BillSheetTypes";

export function buildDefaultEditableBillData(partial?: Partial<EditableBillData>): EditableBillData {
  return {
    date: partial?.date || "",
    accountNo: partial?.accountNo || "",
    activityName: partial?.activityName || partial?.eventName || "",
    startDate: partial?.startDate || "",
    closingDate: partial?.closingDate || "",
    personName: partial?.personName || "",
    underWhom: partial?.underWhom || "",
    closingAmt: Number(partial?.closingAmt || 0),
    cashAmt: Number(partial?.cashAmt || 0),
    psAmt: Number(partial?.psAmt || 0),
    sign: partial?.sign || "",
    signApprovedBy: partial?.signApprovedBy || "",
    accountsUseOnly: partial?.accountsUseOnly || "",
    ccNo: partial?.ccNo || "",
    eventName: partial?.eventName || "",
    eventDate: partial?.eventDate || "",
    venue: partial?.venue || "",
    mainTitle: partial?.mainTitle || "EVENT BILL SHEET",
    sectionTitle: partial?.sectionTitle || "PRODUCTION / TECHNICALS / FABRICATION",
    vendorName: partial?.vendorName || "",
    supplierName: partial?.supplierName || "",
    vendorSignature: partial?.vendorSignature || "",
    paymentRemarks: partial?.paymentRemarks || "",
    billRemarks: partial?.billRemarks || "",
    category: partial?.category || "",
    paidBy: partial?.paidBy || "",
    paymentType: partial?.paymentType || "",
    approvedBy: partial?.approvedBy || "",
    closingNumber: partial?.closingNumber || "",
    sections:
      partial?.sections && partial.sections.length
        ? partial.sections
        : [
            { key: "A", title: "Setup and Infrastructure", items: [] },
            { key: "B", title: "Tentage", items: [] },
            { key: "C", title: "Furniture", items: [] },
            { key: "D", title: "Technicals", items: [] },
            { key: "E", title: "Services", items: [] },
            { key: "F", title: "Entertainment", items: [] }
          ],
    paymentAcknowledgement:
      partial?.paymentAcknowledgement && partial.paymentAcknowledgement.length
        ? partial.paymentAcknowledgement
        : Array.from({ length: 6 }).map(() => ({
            date: "",
            particulars: "",
            chNoCash: "",
            chNo: "",
            amount: 0
          })),
    totals: {
      total: Number(partial?.totals?.total || 0),
      subtotal: Number(partial?.totals?.subtotal || 0),
      tax: Number(partial?.totals?.tax || 0),
      advance: Number(partial?.totals?.advance || 0),
      finalTotal: Number(partial?.totals?.finalTotal || 0),
      cashPaid: Number(partial?.totals?.cashPaid || 0),
      balance: Number(partial?.totals?.balance || 0),
      remaining: Number(partial?.totals?.remaining || 0),
      signature: String(partial?.totals?.signature || ""),
      customerSignatory: String(partial?.totals?.customerSignatory || ""),
      authorizedSignatory: String(partial?.totals?.authorizedSignatory || "")
    }
  };
}

