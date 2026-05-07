// ─────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────
export interface EditableBillRow {
  srNo: number;
  particular: string;
  quantity: number;
  size: string;
  rate: number;
  amount: number;
  remarks: string;

  // extra fields used in some UI views / exports
  billId?: string;
  vendorName?: string;
  category?: string;
}

// ─────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────
export interface EditableBillSection {
  key: string;
  title: string;
  items: EditableBillRow[];
}

// ─────────────────────────────────────────────
// Totals
// ─────────────────────────────────────────────
export interface EditableBillTotals {
  total: number;
  finalTotal: number;

  // optional totals used by some bill/closing replicas
  subtotal?: number;
  tax?: number;
  totalWithTax?: number;
  gstPercentage?: number;
  advance?: number;
  remaining?: number;
  cashPaid?: number;
  balance?: number;
  signature?: string;
  customerSignatory?: string;
  authorizedSignatory?: string;
}

// ─────────────────────────────────────────────
// Main Editable Bill
// ─────────────────────────────────────────────
export interface EditableBillData {
  eventName: string;
  eventDate: string;
  venue: string;
  sectionTitle: string;
  sections: EditableBillSection[];
  totals: EditableBillTotals;

  // optional fields referenced by bill replicas / closing sheets
  date?: string;
  accountNo?: string;
  activityName?: string;
  startDate?: string;
  closingDate?: string;
  personName?: string;
  underWhom?: string;
  closingAmt?: number;
  cashAmt?: number;
  psAmt?: number;
  sign?: string;
  signApprovedBy?: string;
  accountsUseOnly?: string;
  ccNo?: string;
  mainTitle?: string;
  vendorName?: string;
  supplierName?: string;
  vendorSignature?: string;
  paymentRemarks?: string;
  billRemarks?: string;
  category?: string;
  paidBy?: string;
  paymentType?: string;
  approvedBy?: string;
  closingNumber?: string;
  paymentAcknowledgement?: Array<{
    date?: string;
    particulars?: string;
    chNoCash?: string;
    chNo?: string;
    amount?: number;
  }>;
}

// ─────────────────────────────────────────────
// Contact Person
// ─────────────────────────────────────────────
export interface ApiContactPerson {
  _id: string;
  name: string;
  email: string;
  phone: string;
}

// ─────────────────────────────────────────────
// Event
// ─────────────────────────────────────────────
export interface ApiEvent {
  _id: string;
  activityName: string;
  startDate: string;
  budget: number;
  venue: string;
}

// ─────────────────────────────────────────────
// Review
// ─────────────────────────────────────────────
export interface ApiReviewer {
  name: string;
  email: string;
}

// ─────────────────────────────────────────────
// Raw API Bill Response
// ─────────────────────────────────────────────
export interface ApiBillResponse {
  _id: string;
  entityName: string;
  event: ApiEvent | null;
  contactPerson: ApiContactPerson | null;
  category: string;
  description: string;
  billSheet: EditableBillData | null;
  amount: number;
  gstPercentage: number;
  gstAmount: number;
  totalWithGst: number;
  paidBy: string;
  paymentType: string;
  tokenAmount: number;
  voucherUrl: string;
  status: string;
  reviewedBy: ApiReviewer | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// API Bill List Response
// ─────────────────────────────────────────────
export interface ApiBillListResponse {
  message: string;
  total: number;
  data: ApiBillResponse[];
}