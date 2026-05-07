const mongoose = require("mongoose");
const { TASK_CATEGORIES } = require("../constants/taskCategories");

const billSchema = new mongoose.Schema(
  {
    entityName: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    gstPercentage: {
      type: Number,
      default: 0,
      min: 0
    },
    gstAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },
    contactPerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    particulars: {
      type: String,
      default: "",
      trim: true
    },
    category: {
      type: String,
      enum: TASK_CATEGORIES
    },
    voucherUrl: {
      type: String,
      default: "",
      trim: true
    },
    paidBy: {
      type: String,
      enum: ["company", "self", "own"] ,
      // Add this helper
      paidBy: this.paidBy === "own" ? "self" : this.paidBy,
      default: "company"
    },
    paymentType: {
      type: String,
      enum: ["full", "token"],
      default: "full"
    },
    tokenAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ["pending", "review", "approved", "rejected"],
      default: "pending"
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId, ref: "Admin"
    ,
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    billSheet: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bill", billSchema);
