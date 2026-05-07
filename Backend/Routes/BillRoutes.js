const express = require("express");
const {
  getBillsByEventId,
  updateBillRemark,
  saveSectionRemarksToVendors,
} = require("../Controllers/AdminControllers");
const { authenticate, requireRoles } = require("../Middlewares/AuthMiddleware");

const router = express.Router();

router.get(
  "/:eventId",
  authenticate,
  requireRoles(["admin", "director", "teamLeader"]),
  getBillsByEventId
);

router.put(
  "/remark/:billId",
  authenticate,
  requireRoles(["admin", "director", "teamLeader"]),
  updateBillRemark
);

router.post(
  "/section-remarks/:eventId",
  authenticate,
  requireRoles(["admin", "director", "teamLeader"]),
  saveSectionRemarksToVendors
);

module.exports = router;
