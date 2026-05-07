const mongoose = require("mongoose");
const { TASK_CATEGORIES } = require("../constants/taskCategories");

const paymentRequestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    category: {
      type: String,
      enum: TASK_CATEGORIES
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    usedAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    returnAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentRequest", paymentRequestSchema);
