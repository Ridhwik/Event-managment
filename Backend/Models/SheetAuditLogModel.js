const mongoose = require("mongoose");

const sheetAuditLogSchema = new mongoose.Schema(
  {
    actorId: { type: String, required: true }, // Admin/User id from JWT
    actorRole: { type: String, required: true }, // admin | director | teamLeader
    eventId: { type: String, required: true },
    action: { type: String, required: true }, // open_embed, view_pdf, sync
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SheetAuditLog", sheetAuditLogSchema);

