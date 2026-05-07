const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: false,
      default: null
    },

    accountNumber: {
      type: String,
      required: true,
      trim: true
    },

    activityName: {
      type: String,
      required: true,
      trim: true
    },

    startDate: {
      type: Date,
      required: true
    },

    closingDate: {
      type: Date,
      default: null
    },

    endDate: {
      type: Date,
      required: false,
      default: null
    },

   
    director: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null
    },

    // ✅ Team Leader (selected by admin)
    teamLeader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null
    },

    /** Team Leader assigns employees to spend/task categories on this event. */
    employeeAssignments: {
      type: [
        {
          employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false
          }
        }
      ],
      default: []
    },

    budget: {
      type: Number,
      required: true,
      min: 0
    },

    cashAmount: {
      type: Number,
      required: true,
      min: 0
    },

    sign: {
      type: String, // signature or image URL
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null
    },
    employeeAssignments: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        }
      }
    ],

    approvedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }

);

const EventModel = mongoose.model("Event", eventSchema);

module.exports = EventModel;