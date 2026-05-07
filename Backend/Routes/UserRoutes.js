const express = require("express");
const {
  registerUser,
  loginUser,
  getMyProfile,
  createEventByRoleUser,
  getMyAssignedEvents,
  getMyRunningEvents,
  getUserDashboardStats,
  updateUserEvent,
  assignTeamLeaderByDirector,
  assignEmployeesByTeamLeader,
  getEmployeeAssignedEvents,
  getEmployeeAllAssignedEvents,
  getEmployeeDashboardStats,
  uploadEmployeeBillImage,
  employeeCreateBill,
  employeeListBills,
  employeeUpdateBill,
  employeeCreatePaymentRequest,
  employeeListPaymentRequests
} = require("../Controllers/UserControllers");
const {
  authenticate,
  requireDirector,
  requireDirectorOrTeamLeader,
  requireTeamLeader,
  requireEmployee
} = require("../Middlewares/AuthMiddleware");
const { uploadBillImage } = require("../Middlewares/UploadMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authenticate, getMyProfile);
router.post(
  "/events",
  authenticate,
  requireDirectorOrTeamLeader,
  createEventByRoleUser
);
router.get(
  "/events/assigned",
  authenticate,
  requireDirectorOrTeamLeader,
  getMyAssignedEvents
);
router.get(
  "/events/running",
  authenticate,
  requireDirectorOrTeamLeader,
  getMyRunningEvents
);
router.get(
  "/dashboard",
  authenticate,
  requireDirectorOrTeamLeader,
  getUserDashboardStats
);

// Director & Team Leader: update own / assigned events (no delete here — Admin only)
router.put(
  "/events/:id",
  authenticate,
  requireDirectorOrTeamLeader,
  updateUserEvent
);

// Director only: assign Team Leader on own events
router.patch(
  "/events/:id/assign",
  authenticate,
  requireDirector,
  assignTeamLeaderByDirector
);

// Team Leader: assign employees to categories on events they lead
router.patch(
  "/events/:id/employee-assignments",
  authenticate,
  requireTeamLeader,
  assignEmployeesByTeamLeader
);

// Director: update optional employee closing/end dates on own events
// Employee portal
router.get("/employee/dashboard", authenticate, requireEmployee, getEmployeeDashboardStats);
router.get("/employee/events", authenticate, requireEmployee, getEmployeeAssignedEvents);
router.get("/employee/events/all", authenticate, requireEmployee, getEmployeeAllAssignedEvents);
router.post(
  "/employee/bills/upload-image",
  authenticate,
  requireEmployee,
  uploadBillImage.single("billImage"),
  uploadEmployeeBillImage
);
router.post("/employee/bills", authenticate, requireEmployee, employeeCreateBill);
router.get("/employee/bills", authenticate, requireEmployee, employeeListBills);
router.put("/employee/bills/:id", authenticate, requireEmployee, employeeUpdateBill);
router.post(
  "/employee/payment-requests",
  authenticate,
  requireEmployee,
  employeeCreatePaymentRequest
);
router.get(
  "/employee/payment-requests",
  authenticate,
  requireEmployee,
  employeeListPaymentRequests
);

module.exports = router;
