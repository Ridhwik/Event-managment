const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true },
    gstNumber: { type: String, default: "", trim: true, uppercase: true },
    contactPerson: { type: String, default: "", trim: true },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },
    category: {
      type: String,
      enum: [
        "setup", "tentage", "furniture", "technical",
        "services", "entertainment", "catering",
        "decoration", "transport", "other",
      ],
      default: "other",
    },
    bankDetails: {
      accountName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      bankName: { type: String, default: "" },
      ifscCode: { type: String, default: "", uppercase: true },
      upiId: { type: String, default: "" },
    },
    notes: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
      index: true,
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      default: null,
      index: true,
    },
    vendorName: { type: String, default: "", trim: true },
    remark: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

vendorSchema.index({ eventId: 1, billId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Vendor", vendorSchema);