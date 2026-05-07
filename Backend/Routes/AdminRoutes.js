const express = require("express");
const {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  createEvent,
  assignEventMembers,
  updateEvent,
  deleteEvent,
  getAllEvents,
  reviewEventApproval,
  getAllBookings,
  getDashboardStats,
  getAdminDashboardOverview,
  getAllBills,
  createBill,
  updateBill,
  reviewBill,
  deleteBill,
  getPaymentRequests,
  createPaymentRequest,
  reviewPaymentRequest,
  getTeamMembers,
  createTeamMember,
  updateTeamMember,
  getEventClosingSheet,
  getClosingSheetByEventIdForAdmin,
  getClosingSheetByEventId,
  getEventBillDetails,
  getClosingSheets,
  getAccountsOverview,
  createSettlement,
  createReminder,
  getPermissionMatrix,
  getAllUsers,
  getEventGoogleSheetEmbed,
  syncEventGoogleSheet,
  streamEventGoogleSheetPdf
  ,
  getSingleVendor,
  createVendor,
  updateVendor,
  deleteVendor,
  getVendors,
  getBillsByEmployeeForEvent
} = require("../Controllers/AdminControllers");
const {
  authenticate,
  requireAdmin,
  requireRoles
} = require("../Middlewares/AuthMiddleware");
const { verifyEmbedToken } = require("../Middlewares/EmbedTokenMiddleware");

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.post("/logout", authenticate, requireAdmin, logoutAdmin);
router.get("/users", authenticate, requireAdmin, getAllUsers);
router.get("/events", authenticate, requireAdmin, getAllEvents);
router.post("/events", authenticate, requireAdmin, createEvent);
router.patch("/events/:id/assign", authenticate, requireAdmin, assignEventMembers);
router.put("/events/:id", authenticate, requireAdmin, updateEvent);
router.delete("/events/:id", authenticate, requireAdmin, deleteEvent);
router.patch("/events/:id/approval", authenticate, requireAdmin, reviewEventApproval);
router.get("/bookings", authenticate, requireAdmin, getAllBookings);
router.get("/bills", authenticate, requireAdmin, getAllBills);
router.post("/bills", authenticate, requireAdmin, createBill);
router.put("/bills/:id", authenticate, requireAdmin, updateBill);
router.patch("/bills/:id/review", authenticate, requireAdmin, reviewBill);
router.delete("/bills/:id", authenticate, requireAdmin, deleteBill);
router.get("/dashboard/stats", authenticate, requireAdmin, getDashboardStats);
router.get(
  "/dashboard/overview",
  authenticate,
  requireAdmin,
  getAdminDashboardOverview
);
router.get("/payment-requests", authenticate, requireAdmin, getPaymentRequests);
router.post("/payment-requests", authenticate, requireAdmin, createPaymentRequest);
router.patch(
  "/payment-requests/:id/review",
  authenticate,
  requireAdmin,
  reviewPaymentRequest
);


// Team management
router.get("/team", authenticate, requireAdmin, getTeamMembers);
router.post("/team", authenticate, requireAdmin, createTeamMember);
router.patch("/team/:id", authenticate, requireAdmin, updateTeamMember);

// Closing sheets
router.get("/closing-sheets", authenticate, requireAdmin, getClosingSheets);
router.get("/closing-sheets/:eventId", authenticate, requireAdmin, getClosingSheetByEventId);
router.get("/closing-sheet/:eventId", authenticate, requireAdmin, getClosingSheetByEventIdForAdmin);
router.get("/events/:id/closing-sheet", authenticate, requireAdmin, getEventClosingSheet);
router.get(
  "/events/:eventId/bills/:billId",
  authenticate,
  requireRoles(["admin", "director", "teamLeader", "employee"]),
  getEventBillDetails
);

// Secure embedded Google Sheet (PDF stream + tokenized embed)
router.get(
  "/events/:eventId/google-sheet",
  authenticate,
  requireRoles(["admin", "director", "teamLeader"]),
  getEventGoogleSheetEmbed
);
router.post(
  "/events/:eventId/sync-sheet",
  authenticate,
  requireRoles(["admin", "director", "teamLeader"]),
  syncEventGoogleSheet
);
router.get(
  "/events/:eventId/google-sheet/pdf",
  verifyEmbedToken,
  streamEventGoogleSheetPdf
);

// Accounts & settlements
router.get("/accounts/overview", authenticate, requireAdmin, getAccountsOverview);
router.post("/accounts/settlements", authenticate, requireAdmin, createSettlement);
router.post("/accounts/reminders", authenticate, requireAdmin, createReminder);

// Permissions matrix
router.get("/permissions/matrix", authenticate, requireAdmin, getPermissionMatrix);

// Vendors 
router.get("/vendors", getVendors);
router.get("/vendors/:id", getSingleVendor);
router.post("/vendors", createVendor);
router.put("/vendors/:id",  updateVendor);
router.delete("/vendors/:id", deleteVendor);

router.get("/bills/employee/:employeeId/event/:eventId", getBillsByEmployeeForEvent);

module.exports = router;
