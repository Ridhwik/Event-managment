const Admin = require("../Models/AdminModel");
const User = require("../Models/UserModel");
const Event = require("../Models/EventModel");
const Booking = require("../Models/BookingModel");
const Bill = require("../Models/BillModel");
const PaymentRequest = require("../Models/PaymentRequestModel");
const Settlement = require("../Models/SettlementModel");
const Vendor = require("../Models/Vendor");
const {
  syncBillsToGoogleSheet,
  syncEventsToGoogleSheet,
  syncClosingReportToGoogleSheet,
  exportClosingSheetDetailsPdfBuffer,
  readEventsFromGoogleSheet,
  getGoogleSheetUrl
} = require("../Services/GoogleSheetsSync");

const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { isTaskCategory } = require("../constants/taskCategories");
const SheetAuditLog = require("../Models/SheetAuditLogModel");

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/** Positive delta increases remaining budget; negative deducts. */
async function adjustEventBudget(eventId, delta) {
  if (!eventId || !delta) {
    return { ok: true };
  }
  const ev = await Event.findById(eventId);
  if (!ev) {
    return { ok: false, message: "Event not found for budget update" };
  }
  const next = Number(ev.budget) + Number(delta);
  if (next < 0) {
    return { ok: false, message: "Insufficient event budget for this amount" };
  }
  ev.budget = next;
  await ev.save();
  return { ok: true };
}
const bcrypt = require("bcryptjs");

const validateAssignedUsers = async (directorId, teamLeaderId) => {
  if (directorId && teamLeaderId && String(directorId) === String(teamLeaderId)) {
    return {
      ok: false,
      message: "Director and Team Leader must be different users"
    };
  }

  const [directorUser, teamLeaderUser] = await Promise.all([
    directorId ? User.findById(directorId) : null,
    teamLeaderId ? User.findById(teamLeaderId) : null
  ]);

  if (directorId && (!directorUser || directorUser.role !== "director")) {
    return { ok: false, message: "Selected director is invalid" };
  }

  if (teamLeaderId && (!teamLeaderUser || teamLeaderUser.role !== "teamLeader")) {
    return { ok: false, message: "Selected team leader is invalid" };
  }

  return { ok: true };
};

/** Resolve a User id from email for admin assign flows (Director / Team Leader roles). */
const resolveUserIdFromEmail = async (email, requiredRole) => {
  const trimmed = String(email ?? "").trim().toLowerCase();
  if (!trimmed) {
    return { ok: true, id: null };
  }
  const u = await User.findOne({ email: trimmed });
  if (!u) {
    return { ok: false, message: `No user registered with email: ${email}` };
  }
  if (u.role !== requiredRole) {
    return {
      ok: false,
      message: `User ${email} must have role "${requiredRole}" (current role: "${u.role}")`
    };
  }
  return { ok: true, id: u._id };
};

/**
 * Admin may send `director` / `teamLeader` (ObjectId) and/or `directorEmail` / `teamLeaderEmail`.
 * Email fields override matching id fields when present.
 * Returns `undefined` for a role when that role was not mentioned in the body (PATCH-safe).
 */
const pickDirectorTeamLeaderFromAdminBody = async (reqBody) => {
  let directorId = Object.prototype.hasOwnProperty.call(reqBody, "director")
    ? reqBody.director
    : undefined;
  let teamLeaderId = Object.prototype.hasOwnProperty.call(reqBody, "teamLeader")
    ? reqBody.teamLeader
    : undefined;

  if (Object.prototype.hasOwnProperty.call(reqBody, "directorEmail")) {
    const r = await resolveUserIdFromEmail(reqBody.directorEmail, "director");
    if (!r.ok) {
      return { ok: false, message: r.message };
    }
    directorId = r.id;
  }

  if (Object.prototype.hasOwnProperty.call(reqBody, "teamLeaderEmail")) {
    const r = await resolveUserIdFromEmail(reqBody.teamLeaderEmail, "teamLeader");
    if (!r.ok) {
      return { ok: false, message: r.message };
    }
    teamLeaderId = r.id;
  }

  return { ok: true, directorId, teamLeaderId };
};

//✅ REGISTER ADMIN (SECURE)
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({
        message: "Admin already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      role: "admin"
    });

    admin.password = undefined;

    return res.status(201).json({
      message: "Admin registered successfully",
      admin
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};
//✅ LOGIN ADMIN
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
//✅ CREATE EVENT (FIXED)
exports.createEvent = async (req, res) => {
  try {
    const {
      date,
      accountNumber,
      activityName,
      startDate,
      closingDate,
      endDate,
      director,
      teamLeader,
      budget,
      cashAmount,
      sign
    } = req.body;

    const actorRole = req.auth.role;
    const actorId = req.auth.id;

    if (!accountNumber || !activityName || budget == null) {
      return res.status(400).json({
        message: "Required fields missing"
      });
    }

    if (startDate && closingDate && new Date(closingDate) < new Date(startDate)) {
      return res.status(400).json({
        message: "Closing date cannot be before start date"
      });
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        message: "End date cannot be before start date"
      });
    }

    if (closingDate && endDate && new Date(endDate) < new Date(closingDate)) {
      return res.status(400).json({
        message: "End date cannot be before closing date"
      });
    }

    if (actorRole === "teamLeader" && director) {
      return res.status(403).json({
        message: "Team Leader cannot assign a director"
      });
    }

    let finalDirector = director || null;
    let finalTeamLeader =
      actorRole === "teamLeader"
        ? (teamLeader || actorId)
        : (teamLeader || null);

    if (actorRole === "admin") {
      const picked = await pickDirectorTeamLeaderFromAdminBody(req.body);

      if (!picked.ok) {
        return res.status(400).json({
          message: picked.message
        });
      }

      finalDirector =
        picked.directorId !== undefined ? picked.directorId : null;

      finalTeamLeader =
        picked.teamLeaderId !== undefined ? picked.teamLeaderId : null;
    }

    const assignedValidation = await validateAssignedUsers(
      finalDirector,
      finalTeamLeader
    );

    if (!assignedValidation.ok) {
      return res.status(400).json({
        message: assignedValidation.message
      });
    }

    // MULTIPLE EMPLOYEE SUPPORT
    let employeeAssignments = [];

    const employeeEmailList = Array.isArray(req.body.employeeEmails)
      ? req.body.employeeEmails
          .map((email) => String(email).trim().toLowerCase())
          .filter(Boolean)
      : [];

    if (!employeeEmailList.length) {
      return res.status(400).json({
        message: "At least one employee email is required"
      });
    }

    for (const email of employeeEmailList) {
      const employeeUser = await User.findOne({
        email
      }).select("_id email role");

      if (!employeeUser) {
        return res.status(400).json({
          message: `Employee not found: ${email}`
        });
      }

      if (employeeUser.role !== "employee") {
        return res.status(400).json({
          message: `User ${employeeUser.email} must have role "employee"`
        });
      }

      employeeAssignments.push({
        employee: employeeUser._id
      });
    }

    const event = await Event.create({
      date,
      accountNumber,
      activityName,
      startDate,
      closingDate: closingDate || null,
      endDate: endDate || null,
      director: finalDirector,
      teamLeader: finalTeamLeader,
      employeeAssignments,
      budget,
      cashAmount,
      sign,
      status: "approved",
      createdBy: actorRole === "admin" ? null : actorId,
      approvedBy: actorRole === "admin" ? actorId : null,
      approvedAt: new Date()
    });

    try {
      await syncEventsToGoogleSheet([event]);
    } catch (syncError) {
      console.error(
        "[Sheets Sync] createEvent failed:",
        syncError.message
      );
    }

    return res.status(201).json({
      message: "Event created successfully",
      data: event
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};
//✅ UPDATE EVENT
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { director, teamLeader, startDate, closingDate } = req.body;

    if (startDate && closingDate && new Date(closingDate) < new Date(startDate)) {
      return res.status(400).json({
        message: "Closing date cannot be before start date"
      });
    }

    const updates = { ...req.body };
    delete updates.directorEmail;
    delete updates.teamLeaderEmail;

    const picked = await pickDirectorTeamLeaderFromAdminBody(req.body);
    if (!picked.ok) {
      return res.status(400).json({ message: picked.message });
    }
    if (picked.directorId !== undefined) {
      updates.director = picked.directorId;
    }
    if (picked.teamLeaderId !== undefined) {
      updates.teamLeader = picked.teamLeaderId;
    }

    const willChangeMembers =
      Object.prototype.hasOwnProperty.call(req.body, "director") ||
      Object.prototype.hasOwnProperty.call(req.body, "teamLeader") ||
      Object.prototype.hasOwnProperty.call(req.body, "directorEmail") ||
      Object.prototype.hasOwnProperty.call(req.body, "teamLeaderEmail");

    if (willChangeMembers) {
      const existingEvent = await Event.findById(id);
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      const directorToValidate = Object.prototype.hasOwnProperty.call(updates, "director")
        ? updates.director
        : existingEvent.director;
      const teamLeaderToValidate = Object.prototype.hasOwnProperty.call(updates, "teamLeader")
        ? updates.teamLeader
        : existingEvent.teamLeader;
      const assignedValidation = await validateAssignedUsers(
        directorToValidate,
        teamLeaderToValidate
      );

      if (!assignedValidation.ok) {
        return res.status(400).json({ message: assignedValidation.message });
      }
    }

    const event = await Event.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    )
    .populate("director", "name email")
    .populate("teamLeader", "name email");

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    try {
      await syncEventsToGoogleSheet([event]);
    } catch (syncError) {
      console.error("[Sheets Sync] updateEvent failed:", syncError.message);
    }

    res.status(200).json({
      message: "Event updated",
      data: event
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ ASSIGN DIRECTOR / TEAM LEADER TO EVENT
exports.assignEventMembers = async (req, res) => {
  try {
    const { id } = req.params;

    const hasDirectorField =
      Object.prototype.hasOwnProperty.call(req.body, "director") ||
      Object.prototype.hasOwnProperty.call(req.body, "directorEmail");
    const hasTeamLeaderField =
      Object.prototype.hasOwnProperty.call(req.body, "teamLeader") ||
      Object.prototype.hasOwnProperty.call(req.body, "teamLeaderEmail");

    if (!hasDirectorField && !hasTeamLeaderField) {
      return res.status(400).json({
        message:
          "At least one of director, directorEmail, teamLeader, or teamLeaderEmail is required"
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const picked = await pickDirectorTeamLeaderFromAdminBody(req.body);
    if (!picked.ok) {
      return res.status(400).json({ message: picked.message });
    }

    const nextDirector = hasDirectorField
      ? picked.directorId
      : event.director;
    const nextTeamLeader = hasTeamLeaderField
      ? picked.teamLeaderId
      : event.teamLeader;

    const assignedValidation = await validateAssignedUsers(nextDirector, nextTeamLeader);
    if (!assignedValidation.ok) {
      return res.status(400).json({ message: assignedValidation.message });
    }

    event.director = nextDirector;
    event.teamLeader = nextTeamLeader;
    await event.save();

    try {
      await syncEventsToGoogleSheet([event]);
    } catch (syncError) {
      console.error("[Sheets Sync] assignEventMembers failed:", syncError.message);
    }

    const populatedEvent = await Event.findById(event._id)
      .populate("director", "name email role")
      .populate("teamLeader", "name email role");

    return res.status(200).json({
      message: "Event members assigned successfully",
      data: populatedEvent
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

//✅ DELETE EVENT
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    try {
      await syncEventsToGoogleSheet([event]);
    } catch (syncError) {
      console.error("[Sheets Sync] reviewEventApproval failed:", syncError.message);
    }

    res.status(200).json({ message: "Event deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//✅ APPROVE / REJECT EVENT
exports.reviewEventApproval = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status"
      });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        status,
        approvedBy: req.admin.id,
        approvedAt: new Date()
      },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.status(200).json({
      message: `Event ${status}`,
      event
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//✅ DASHBOARD (ADMIN)
exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await Promise.all([
      User.countDocuments(),
      Event.countDocuments(),
      Booking.countDocuments(),
      Event.countDocuments({ status: "approved" }),
      Event.countDocuments({ status: "pending" }),
      Event.countDocuments({ status: "rejected" })
    ]);

    res.status(200).json({
      totalUsers: stats[0],
      totalEvents: stats[1],
      totalBookings: stats[2],
      eventsByStatus: {
        approved: stats[3],
        pending: stats[4],
        rejected: stats[5]
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ LOGOUT ADMIN
exports.logoutAdmin = async (req, res) => {
  return res.status(200).json({
    message: "Logout successful"
  });
};

// ✅ GET ALL BOOKINGS
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate("event", "activityName startDate status");

    return res.status(200).json({
      count: bookings.length,
      bookings
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

const initialsFromPersonName = (fullName) => {
  if (!fullName || fullName === "—") {
    return "?";
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const activityFromBill = (b) => {
  const eventName = b.event?.activityName || "—";
  const person = b.contactPerson?.name || "—";
  const detailLine = `${person} · ${eventName}`;
  return {
    id: b._id,
    type: "bill",
    entityName: b.entityName,
    detailLine,
    initials: initialsFromPersonName(person),
    amount: b.amount,
    status: b.status,
    updatedAt: b.updatedAt
  };
};

const activityFromPaymentRequest = (p) => {
  const eventName = p.event?.activityName || "—";
  const person =
    p.submittedBy?.name ||
    p.event?.teamLeader?.name ||
    p.event?.director?.name ||
    "—";
  const detailLine = `${person} · ${eventName}`;
  return {
    id: p._id,
    type: "payment_request",
    entityName: p.title,
    detailLine,
    initials: initialsFromPersonName(person),
    amount: p.amount,
    status: p.status,
    updatedAt: p.updatedAt
  };
};

// ✅ GET ALL EVENTS (ADMIN)
exports.getAllEvents = async (req, res) => {
  try {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const events = await Event.find()
      .populate("director", "name email role")
      .populate("teamLeader", "name email role")
      .populate("employeeAssignments.employee", "name email role")
      .sort({ createdAt: -1 });

    const eventIds = events.map((e) => e._id);

    const [billSums, paymentSums] = await Promise.all([
      Bill.aggregate([
        { $match: { status: "approved", event: { $in: eventIds } } },
        { $group: { _id: "$event", total: { $sum: "$amount" } } }
      ]),
      PaymentRequest.aggregate([
        { $match: { status: "approved", event: { $in: eventIds } } },
        { $group: { _id: "$event", total: { $sum: "$amount" } } }
      ])
    ]);

    const billByEvent = new Map(
      billSums.map((x) => [String(x._id), Number(x.total || 0)])
    );
    const payByEvent = new Map(
      paymentSums.map((x) => [String(x._id), Number(x.total || 0)])
    );

    const enhanced = events.map((e) => {
      const start = e.startDate ? startOfDay(e.startDate) : null;
      const end = e.closingDate ? endOfDay(e.closingDate) : null;
      const isActive =
        e.status === "approved" &&
        start &&
        start <= todayEnd &&
        (!end || end >= todayStart);
      const isClosed = end ? end < todayStart : false;
      const lifecycleStatus = isActive ? "active" : isClosed ? "closed" : "upcoming";

      const spent =
        (billByEvent.get(String(e._id)) || 0) + (payByEvent.get(String(e._id)) || 0);

      return {
        ...e.toObject(),
        lifecycleStatus,
        spent
      };
    });

    return res.status(200).json({
      count: enhanced.length,
      events: enhanced
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ DASHBOARD OVERVIEW (EventCo-style summary + recent activity)
exports.getAdminDashboardOverview = async (req, res) => {
  try {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const activeEventsFilter = {
      status: "approved",
      startDate: { $lte: todayEnd },
      $or: [{ closingDate: { $gte: todayStart } }, { closingDate: null }]
    };

    const [
      activeEvents,
      totalBills,
      billsPending,
      totalPaymentRequests,
      paymentRequestsPending,
      approvedBillsSum,
      approvedPaymentsSum
    ] = await Promise.all([
      Event.countDocuments(activeEventsFilter),
      Bill.countDocuments(),
      Bill.countDocuments({ status: "pending" }),
      PaymentRequest.countDocuments(),
      PaymentRequest.countDocuments({ status: "pending" }),
      Bill.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      PaymentRequest.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    const billSpend = approvedBillsSum[0]?.total || 0;
    const paySpend = approvedPaymentsSum[0]?.total || 0;

    const eventPopulate = {
      path: "event",
      select: "activityName director teamLeader",
      populate: [
        { path: "director", select: "name" },
        { path: "teamLeader", select: "name" }
      ]
    };

    const [recentBills, recentPayments] = await Promise.all([
      Bill.find()
        .populate(eventPopulate)
        .populate("contactPerson", "name")
        .sort({ updatedAt: -1 })
        .limit(25)
        .lean(),
      PaymentRequest.find()
        .populate("submittedBy", "name")
        .populate(eventPopulate)
        .sort({ updatedAt: -1 })
        .limit(25)
        .lean()
    ]);

    const activity = [
      ...recentBills.map(activityFromBill),
      ...recentPayments.map(activityFromPaymentRequest)
    ]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 20);

    return res.status(200).json({
      activeEvents,
      bills: {
        total: totalBills,
        pending: billsPending
      },
      totalSpent: billSpend + paySpend,
      paymentRequests: {
        total: totalPaymentRequests,
        pending: paymentRequestsPending
      },
      recentActivity: activity
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ BILLS
exports.getAllBills = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) {
      const allowed = ["pending", "review", "approved", "rejected"];
      if (!allowed.includes(String(status))) {
        return res.status(400).json({
          message: `Invalid status. Allowed: ${allowed.join(", ")}`
        });
      }
      filter.status = String(status);
    }

    const bills = await Bill.find(filter)
      .populate("event", "activityName startDate status accountNumber")
      .populate("contactPerson", "name email role")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      count: bills.length,
      bills
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createBill = async (req, res) => {
  try {
    const {
      entityName,
      amount,
      event: eventId,
      contactPerson,
      description,
      category,
      voucherUrl,
      billSheet
    } = req.body;

    if (!entityName || amount == null || !eventId) {
      return res.status(400).json({
        message: "entityName, amount, and event are required"
      });
    }

    const eventDoc = await Event.findById(eventId);
    if (!eventDoc) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (contactPerson) {
      const u = await User.findById(contactPerson);
      if (!u) {
        return res.status(400).json({ message: "contactPerson is invalid" });
      }
    }

    if (category != null && category !== "" && !isTaskCategory(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const bill = await Bill.create({
      entityName,
      amount,
      event: eventId,
      contactPerson: contactPerson || null,
      description: description || "",
      ...(category ? { category } : {}),
      voucherUrl: voucherUrl != null ? String(voucherUrl).trim() : "",
      ...(billSheet && typeof billSheet === "object" ? { billSheet } : {})
    });

    try {
      await syncBillsToGoogleSheet([bill], new Map([[String(eventDoc._id), eventDoc]]));
    } catch (syncError) {
      console.error("[Sheets Sync] createBill failed:", syncError.message);
    }

    const populated = await Bill.findById(bill._id)
      .populate("event", "activityName startDate status")
      .populate("contactPerson", "name email");

    return res.status(201).json({
      message: "Bill created",
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    if (!["pending", "review"].includes(bill.status)) {
      return res.status(400).json({
        message: "Only pending/review bills can be edited"
      });
    }

    const allowed = [
      "entityName",
      "amount",
      "event",
      "contactPerson",
      "description",
      "category",
      "voucherUrl",
      "billSheet"
    ];
    const patch = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        patch[key] = req.body[key];
      }
    }

    if (patch.event) {
      const eventDoc = await Event.findById(patch.event);
      if (!eventDoc) {
        return res.status(404).json({ message: "Event not found" });
      }
    }

    if (Object.prototype.hasOwnProperty.call(patch, "contactPerson")) {
      if (patch.contactPerson) {
        const u = await User.findById(patch.contactPerson);
        if (!u) {
          return res.status(400).json({ message: "contactPerson is invalid" });
        }
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(patch, "category") &&
      patch.category != null &&
      patch.category !== "" &&
      !isTaskCategory(patch.category)
    ) {
      return res.status(400).json({ message: "Invalid category" });
    }

    Object.assign(bill, patch);
    await bill.save();

    try {
      const eventRef = patch.event ? await Event.findById(patch.event).select("activityName accountNumber") : null;
      const fallbackRef = !eventRef && bill.event
        ? await Event.findById(bill.event).select("activityName accountNumber")
        : null;
      const selectedEvent = eventRef || fallbackRef;
      await syncBillsToGoogleSheet(
        [bill],
        selectedEvent ? new Map([[String(selectedEvent._id), selectedEvent]]) : new Map()
      );
    } catch (syncError) {
      console.error("[Sheets Sync] updateBill failed:", syncError.message);
    }

    const populated = await Bill.findById(bill._id)
      .populate("event", "activityName startDate status")
      .populate("contactPerson", "name email");

    return res.status(200).json({
      message: "Bill updated",
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.reviewBill = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["review", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    const prev = bill.status;
    const amt = Number(bill.amount) || 0;

    if (status === "approved" && prev !== "approved" && bill.event) {
      const adj = await adjustEventBudget(bill.event, -amt);
      if (!adj.ok) {
        return res.status(400).json({ message: adj.message });
      }
    }

    if (prev === "approved" && status !== "approved" && bill.event) {
      const adj = await adjustEventBudget(bill.event, amt);
      if (!adj.ok) {
        return res.status(400).json({ message: adj.message });
      }
    }

    bill.status = status;
    bill.reviewedBy = req.admin.id;
    bill.reviewedAt = new Date();
    await bill.save();

    try {
      const eventDoc = bill.event ? await Event.findById(bill.event).select("activityName accountNumber") : null;
      await syncBillsToGoogleSheet(
        [bill],
        eventDoc ? new Map([[String(eventDoc._id), eventDoc]]) : new Map()
      );
    } catch (syncError) {
      console.error("[Sheets Sync] reviewBill failed:", syncError.message);
    }

    const populated = await Bill.findById(bill._id)
      .populate("event", "activityName budget")
      .populate("contactPerson", "name email");

    return res.status(200).json({
      message: `Bill ${status}`,
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }
    return res.status(200).json({ message: "Bill deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ PAYMENT REQUESTS
exports.getPaymentRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) {
      const allowed = ["pending", "approved", "rejected"];
      if (!allowed.includes(String(status))) {
        return res.status(400).json({
          message: `Invalid status. Allowed: ${allowed.join(", ")}`
        });
      }
      filter.status = String(status);
    }

    const items = await PaymentRequest.find(filter)
      .populate("event", "activityName startDate status")
      .populate("submittedBy", "name email")
      .sort({ updatedAt: -1 });

    const paymentRequests = items.map((p) => {
      const person = p.submittedBy?.name || "—";
      return {
        ...p.toObject(),
        initials: initialsFromPersonName(person)
      };
    });

    return res.status(200).json({
      count: paymentRequests.length,
      paymentRequests
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createPaymentRequest = async (req, res) => {
  try {
    const { title, amount, description, event: eventId, submittedBy, category } =
      req.body;

    if (!title || amount == null) {
      return res.status(400).json({
        message: "title and amount are required"
      });
    }

    if (eventId) {
      const eventDoc = await Event.findById(eventId);
      if (!eventDoc) {
        return res.status(404).json({ message: "Event not found" });
      }
    }

    if (submittedBy) {
      const u = await User.findById(submittedBy);
      if (!u) {
        return res.status(400).json({ message: "submittedBy is invalid" });
      }
    }

    if (category != null && category !== "" && !isTaskCategory(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const pr = await PaymentRequest.create({
      title,
      amount,
      description: description || "",
      event: eventId || null,
      submittedBy: submittedBy || null,
      ...(category ? { category } : {})
    });

    const populated = await PaymentRequest.findById(pr._id)
      .populate("event", "activityName startDate status")
      .populate("submittedBy", "name email");

    return res.status(201).json({
      message: "Payment request created",
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.reviewPaymentRequest = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const pr = await PaymentRequest.findById(req.params.id);
    if (!pr) {
      return res.status(404).json({ message: "Payment request not found" });
    }

    const prev = pr.status;
    const amt = Number(pr.amount) || 0;

    if (status === "approved" && prev !== "approved" && pr.event) {
      const adj = await adjustEventBudget(pr.event, -amt);
      if (!adj.ok) {
        return res.status(400).json({ message: adj.message });
      }
    }

    if (prev === "approved" && status !== "approved" && pr.event) {
      const adj = await adjustEventBudget(pr.event, amt);
      if (!adj.ok) {
        return res.status(400).json({ message: adj.message });
      }
    }

    pr.status = status;
    pr.reviewedBy = req.admin.id;
    pr.reviewedAt = new Date();
    await pr.save();

    const populated = await PaymentRequest.findById(pr._id)
      .populate("event", "activityName budget")
      .populate("submittedBy", "name email");

    return res.status(200).json({
      message: `Payment request ${status}`,
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ TEAM MANAGEMENT (ADMIN)
exports.getTeamMembers = async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) {
      const allowedRoles = ["organizer", "director", "teamLeader", "employee"];
      if (!allowedRoles.includes(String(role))) {
        return res.status(400).json({
          message: `Invalid role. Allowed: ${allowedRoles.join(", ")}`
        });
      }
      filter.role = String(role);
    } else {
      // Default to “team” roles (not normal end-users)
      filter.role = { $in: ["organizer", "director", "teamLeader", "employee"] };
    }

    const users = await User.find(filter).select("-password").sort({ createdAt: -1 });
    const userIds = users.map((u) => u._id);

    const [eventsCounts, billsCounts, spentBills, spentPayReq] = await Promise.all([
      Event.aggregate([
        {
          $match: {
            $or: [
              { director: { $in: userIds } },
              { teamLeader: { $in: userIds } },
              { createdBy: { $in: userIds } }
            ]
          }
        },
        {
          $group: {
            _id: {
              $cond: [
                { $in: ["$director", userIds] },
                "$director",
                {
                  $cond: [
                    { $in: ["$teamLeader", userIds] },
                    "$teamLeader",
                    "$createdBy"
                  ]
                }
              ]
            },
            total: { $sum: 1 }
          }
        }
      ]),
      Bill.aggregate([
        { $match: { contactPerson: { $in: userIds } } },
        { $group: { _id: "$contactPerson", total: { $sum: 1 } } }
      ]),
      Bill.aggregate([
        { $match: { status: "approved", contactPerson: { $in: userIds } } },
        { $group: { _id: "$contactPerson", total: { $sum: "$amount" } } }
      ]),
      PaymentRequest.aggregate([
        { $match: { status: "approved", submittedBy: { $in: userIds } } },
        { $group: { _id: "$submittedBy", total: { $sum: "$amount" } } }
      ])
    ]);

    const mapFromAgg = (arr) =>
      new Map(arr.map((x) => [String(x._id), Number(x.total || 0)]));

    const eventsByUser = mapFromAgg(eventsCounts);
    const billsByUser = mapFromAgg(billsCounts);
    const spentBillsByUser = mapFromAgg(spentBills);
    const spentPayByUser = mapFromAgg(spentPayReq);

    const members = users.map((u) => {
      const id = String(u._id);
      const spent = (spentBillsByUser.get(id) || 0) + (spentPayByUser.get(id) || 0);
      // Simple “rating” placeholder: 0..5 based on spend buckets (UI can ignore if not needed)
      const rating =
        spent >= 200000 ? 5 : spent >= 100000 ? 4 : spent >= 50000 ? 3 : spent >= 20000 ? 2 : spent > 0 ? 1 : 0;

      return {
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        role: u.role,
        initials: initialsFromPersonName(u.name),
        metrics: {
          events: eventsByUser.get(id) || 0,
          bills: billsByUser.get(id) || 0,
          spent
        },
        rating
      };
    });

    return res.status(200).json({
      count: members.length,
      members
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createTeamMember = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "name, email, password, and role are required"
      });
    }

    const allowedRoles = ["organizer", "director", "teamLeader", "employee"];
    if (!allowedRoles.includes(String(role))) {
      return res.status(400).json({
        message: `Invalid role. Allowed: ${allowedRoles.join(", ")}`
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: String(role),
      phone: phone || ""
    });

    const safe = user.toObject();
    delete safe.password;

    return res.status(201).json({
      message: "Team member created",
      member: {
        id: safe._id,
        name: safe.name,
        email: safe.email,
        phone: safe.phone || "",
        role: safe.role,
        initials: initialsFromPersonName(safe.name)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role } = req.body;
    const allowedRoles = ["organizer", "director", "teamLeader", "employee"];

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (role) {
      if (!allowedRoles.includes(String(role))) {
        return res.status(400).json({
          message: `Invalid role. Allowed: ${allowedRoles.join(", ")}`
        });
      }
      user.role = String(role);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "phone")) {
      user.phone = phone || "";
    }
    if (name) {
      user.name = name;
    }

    await user.save();
    return res.status(200).json({
      message: "Team member updated",
      member: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        initials: initialsFromPersonName(user.name)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ EVENT CLOSING SHEETS (ADMIN)
exports.getEventClosingSheet = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id)
      .populate("director", "name email role")
      .populate("teamLeader", "name email role");

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const [bills, payments] = await Promise.all([
      Bill.find({ event: event._id, status: { $ne: "rejected" } })
        .populate("contactPerson", "name email phone role")
        .sort({ updatedAt: -1 })
        .lean(),
      PaymentRequest.find({ event: event._id, status: { $ne: "rejected" } })
        .populate("submittedBy", "name email phone role")
        .sort({ updatedAt: -1 })
        .lean()
    ]);

    const people = new Map(); // userId -> { user, rows }
    const ensurePerson = (u) => {
      if (!u || !u._id) {
        return null;
      }
      const key = String(u._id);
      if (!people.has(key)) {
        people.set(key, {
          user: {
            id: u._id,
            name: u.name,
            email: u.email,
            phone: u.phone || "",
            role: u.role,
            initials: initialsFromPersonName(u.name)
          },
          metrics: {
            bills: 0,
            spent: 0,
            company: 0,
            own: 0,
            advance: 0,
            used: 0,
            return: 0,
            owed: 0
          }
        });
      }
      return people.get(key);
    };

    for (const b of bills) {
      const p = ensurePerson(b.contactPerson);
      if (!p) {
        continue;
      }
      p.metrics.bills += 1;
      p.metrics.spent += Number(b.amount || 0);
      if (b.paidBy === "own" || b.paidBy === "self") {
        p.metrics.own += Number(b.amount || 0);
      } else {
        p.metrics.company += Number(b.amount || 0);
      }
    }

    for (const pr of payments) {
      const p = ensurePerson(pr.submittedBy);
      if (!p) {
        continue;
      }
      const amount = Number(pr.amount || 0);
      const used = Number(pr.usedAmount || 0);
      const ret = Number(pr.returnAmount || 0);
      p.metrics.advance += amount;
      p.metrics.used += used;
      p.metrics.return += ret;
    }

    // Owed meaning (matches UI idea):
    // company owes employee when employee paid from own pocket (own) OR advance used beyond company bills.
    // Here: owed = own - return (if employee returned money, reduce owed). Clamp at 0.
    for (const item of people.values()) {
      const owed = Number(item.metrics.own || 0) - Number(item.metrics.return || 0);
      item.metrics.owed = owed > 0 ? owed : 0;
    }

    const rows = Array.from(people.values()).map((x) => ({
      user: x.user,
      metrics: x.metrics
    }));

    const totals = rows.reduce(
      (acc, r) => {
        acc.totalSpent += r.metrics.spent;
        acc.companyOwesEmployees += r.metrics.owed;
        acc.employeesReturn += r.metrics.return;
        return acc;
      },
      { totalSpent: 0, companyOwesEmployees: 0, employeesReturn: 0 }
    );

    let reportSheetUrl = "";
    try {
      console.log(`[Sheets Sync] View details sync started | eventId=${String(event._id)}`);
      const reportSync = await syncClosingReportToGoogleSheet({
        event: {
          id: event._id,
          activityName: event.activityName,
          accountNumber: event.accountNumber,
          date: event.date || null,
          startDate: event.startDate,
          closingDate: event.closingDate,
          endDate: event.endDate || null,
          budget: Number(event.budget || 0),
          cashAmount: Number(event.cashAmount || 0),
          sign: event.sign || "",
          status: event.status,
          director: event.director,
          teamLeader: event.teamLeader
        },
        rows,
        bills
      });
      reportSheetUrl = String(reportSync?.sheetUrl || getGoogleSheetUrl());
      console.log(`[Sheets Sync] View details sync completed | eventId=${String(event._id)}`);
    } catch (syncError) {
      console.error("[Sheets Sync] View details sync failed:", syncError.message);
      reportSheetUrl = getGoogleSheetUrl();
    }

    return res.status(200).json({
      success: true,
      event: {
        id: event._id,
        activityName: event.activityName,
        date: event.date || null,
        accountNumber: event.accountNumber,
        startDate: event.startDate,
        closingDate: event.closingDate,
        endDate: event.endDate || null,
        budget: Number(event.budget || 0),
        status: event.status,
        director: event.director,
        teamLeader: event.teamLeader
      },
      totals,
      rows,
      bills: bills.map((b) => ({
        id: b._id,
        entityName: b.entityName || "",
        description: b.description || "",
        category: b.category || "",
        amount: Number(b.amount || 0),
        paidBy: b.paidBy || "",
        paymentType: b.paymentType || "",
        status: b.status || "",
        contactPerson: b.contactPerson
          ? {
              id: b.contactPerson._id,
              name: b.contactPerson.name || "",
              email: b.contactPerson.email || ""
            }
          : null
      })),
      googleSheetUrl: reportSheetUrl || getGoogleSheetUrl(),
      sheetUrl: reportSheetUrl || getGoogleSheetUrl()
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getClosingSheetByEventId = async (req, res) => {
  req.params.id = req.params.eventId;
  return exports.getEventClosingSheet(req, res);
};

exports.getClosingSheetByEventIdForAdmin = async (req, res) => {
  req.params.id = req.params.eventId;
  return exports.getEventClosingSheet(req, res);
};

exports.getEventBillDetails = async (req, res) => {
  try {
    const eventId = String(req.params.eventId || "").trim();
    const billId = String(req.params.billId || "").trim();
    const actorRole = String(req.auth?.role || "");
    const actorId = String(req.auth?.id || "");

    if (!eventId || !billId) {
      return res.status(400).json({ message: "eventId and billId are required" });
    }

    const event = await Event.findById(eventId)
      .populate("director", "name email")
      .populate("teamLeader", "name email")
      .lean();
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const bill = await Bill.findOne({ _id: billId, event: eventId })
      .populate("contactPerson", "name email role")
      .lean();
    if (!bill) {
      return res.status(404).json({ message: "Bill not found for this event" });
    }

    const isAdmin = actorRole === "admin";
    const isDirector = actorRole === "director" && String(event?.director?._id || "") === actorId;
    const isTeamLeader = actorRole === "teamLeader" && String(event?.teamLeader?._id || "") === actorId;
    const isOwnerEmployee =
      actorRole === "employee" && String(bill?.contactPerson?._id || bill?.contactPerson || "") === actorId;
    if (!isAdmin && !isDirector && !isTeamLeader && !isOwnerEmployee) {
      return res.status(403).json({ message: "Access denied for this bill" });
    }

    const safeCategory = String(bill.category || "General");
    const particularsText = String(bill.description || "").trim();
    const persistedSheet = bill.billSheet && typeof bill.billSheet === "object" ? bill.billSheet : null;

    const fallbackItems = particularsText
      ? particularsText
          .split(/\r?\n|,/)
          .map((x) => String(x).trim())
          .filter(Boolean)
          .map((p, idx) => ({
            srNo: idx + 1,
            section: safeCategory,
            particular: p,
            quantity: 1,
            size: "-",
            rate: idx === 0 ? Number(bill.amount || 0) : 0,
            amount: idx === 0 ? Number(bill.amount || 0) : 0,
            remarks: idx === 0 ? "Captured from bill description" : ""
          }))
      : [
          {
            srNo: 1,
            section: safeCategory,
            particular: bill.entityName || "Expense item",
            quantity: 1,
            size: "-",
            rate: Number(bill.amount || 0),
            amount: Number(bill.amount || 0),
            remarks: particularsText || ""
          }
        ];

    const persistedSections = Array.isArray(persistedSheet?.sections) ? persistedSheet.sections : null;
    const sections = persistedSections && persistedSections.length
      ? persistedSections
      : [
          {
            key: "A",
            title: safeCategory,
            items: fallbackItems
          }
        ];

    const computedSubtotal = sections.reduce((acc, sec) => {
      const rows = Array.isArray(sec?.items) ? sec.items : [];
      return acc + rows.reduce((rowAcc, row) => rowAcc + Number(row?.amount || 0), 0);
    }, 0);
    const subtotal = Number(persistedSheet?.totals?.subtotal ?? computedSubtotal ?? bill.amount ?? 0);
    const tax = Number(persistedSheet?.totals?.tax ?? bill.gstAmount ?? 0);
    const finalTotal = Number(persistedSheet?.totals?.finalTotal ?? subtotal + tax);
    const advance = Number(
      persistedSheet?.totals?.advance ??
        (bill.paymentType === "token" ? bill.tokenAmount || 0 : 0)
    );
    const remaining = Number(
      persistedSheet?.totals?.remaining ?? Math.max(finalTotal - advance, 0)
    );

    return res.status(200).json({
      eventId: String(event._id),
      billId: String(bill._id),
      eventName: String(persistedSheet?.eventName || event.activityName || ""),
      eventDate: persistedSheet?.eventDate || event.date || event.startDate || null,
      venue: String(persistedSheet?.venue || event.venue || "Jaipur"),
      vendorName: String(persistedSheet?.vendorName || bill.entityName || ""),
      vendorSignature: String(persistedSheet?.vendorSignature || ""),
      billNumber: `BILL-${String(bill._id).slice(-6).toUpperCase()}`,
      closingNumber: String(event.accountNumber || ""),
      employee: {
        id: String(bill?.contactPerson?._id || ""),
        name: String(bill?.contactPerson?.name || bill?.contactPerson?.email || ""),
        email: String(bill?.contactPerson?.email || "")
      },
      category: String(persistedSheet?.category || safeCategory),
      approvalStatus: String(bill.status || ""),
      paidBy: String(bill.paidBy || ""),
      paymentType: String(bill.paymentType || ""),
      remarks: String(persistedSheet?.remarks || particularsText),
      voucherUrl: String(bill.voucherUrl || ""),
      googleSheetUrl: getGoogleSheetUrl(),
      sectionTitle: String(persistedSheet?.sectionTitle || safeCategory).toUpperCase(),
      sections,
      totals: {
        subtotal,
        tax,
        finalTotal,
        advance,
        remaining
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getClosingSheets = async (req, res) => {
  try {
    console.log("[Closing Sheets] /api/admin/closing-sheets called");
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const events = await Event.find()
      .select(
        "activityName accountNumber startDate closingDate endDate status budget cashAmount director teamLeader createdAt updatedAt"
      )
      .populate("director", "name email")
      .populate("teamLeader", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const itemsFromDb = events.map((e) => {
      const start = e.startDate ? startOfDay(e.startDate) : null;
      const end = e.closingDate ? endOfDay(e.closingDate) : null;
      const isActive =
        e.status === "approved" &&
        start &&
        start <= todayEnd &&
        (!end || end >= todayStart);
      const isClosed = end ? end < todayStart : false;
      const lifecycleStatus = isActive ? "active" : isClosed ? "closed" : "upcoming";

      return {
        event: {
          id: e._id,
          activityName: e.activityName,
          accountNumber: e.accountNumber,
          startDate: e.startDate,
          closingDate: e.closingDate,
          status: e.status,
          lifecycleStatus
        }
      };
    });

    let items = itemsFromDb;
    let sheetsWarning = "";
    try {
      const sheetRead = await readEventsFromGoogleSheet();
      if (sheetRead.ok && sheetRead.rows.length) {
        items = sheetRead.rows.map((r) => {
          const start = r.startDate ? startOfDay(new Date(r.startDate)) : null;
          const end = r.closingDate ? endOfDay(new Date(r.closingDate)) : null;
          const isActive =
            String(r.status).toLowerCase() === "approved" &&
            start &&
            start <= todayEnd &&
            (!end || end >= todayStart);
          const isClosed = end ? end < todayStart : false;
          const lifecycleStatus = isActive ? "active" : isClosed ? "closed" : "upcoming";

          return {
            event: {
              id: r.id,
              activityName: r.activityName,
              accountNumber: r.accountNumber,
              startDate: r.startDate || null,
              closingDate: r.closingDate || null,
              status: r.status,
              lifecycleStatus
            }
          };
        });
      } else if (!sheetRead.ok && sheetRead.reason) {
        sheetsWarning = String(sheetRead.reason);
      }
    } catch (sheetReadError) {
      console.error("[Sheets Sync] read events failed:", sheetReadError.message);
      sheetsWarning = String(sheetReadError.message || "Google Sheets credentials missing");
    }

    return res.status(200).json({
      success: true,
      message: "Sheets synced successfully",
      count: items.length,
      items,
      googleSheetUrl: getGoogleSheetUrl(),
      sheetsWarning
    });
  } catch (error) {
    console.error("[Sheets Sync] closing sheets controller failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

function isActorAllowedForEvent({ actorRole, actorId, event }) {
  if (!actorRole || !actorId || !event) {
    return false;
  }
  if (actorRole === "admin") {
    return true;
  }
  if (actorRole === "director") {
    return String(event.director?._id || event.director || "") === String(actorId);
  }
  if (actorRole === "teamLeader") {
    return String(event.teamLeader?._id || event.teamLeader || "") === String(actorId);
  }
  return false;
}

async function writeSheetAuditLog(req, { action, eventId }) {
  try {
    const actorId = String(req?.auth?.id || "");
    const actorRole = String(req?.auth?.role || "");
    const ip =
      String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      String(req.socket?.remoteAddress || "");
    const userAgent = String(req.headers["user-agent"] || "");
    if (!actorId || !actorRole || !eventId || !action) {
      return;
    }
    await SheetAuditLog.create({
      actorId,
      actorRole,
      eventId: String(eventId),
      action: String(action),
      ip,
      userAgent
    });
  } catch {
    // Never block the main flow on audit logging
  }
}

async function buildClosingPayloadForEvent(eventId) {
  const event = await Event.findById(eventId)
    .populate("director", "name email role")
    .populate("teamLeader", "name email role");
  if (!event) {
    return { ok: false, code: 404, message: "Event not found", event: null, payload: null };
  }

  const [bills, payments] = await Promise.all([
    Bill.find({ event: event._id, status: { $ne: "rejected" } })
      .populate("contactPerson", "name email phone role")
      .sort({ updatedAt: -1 })
      .lean(),
    PaymentRequest.find({ event: event._id, status: { $ne: "rejected" } })
      .populate("submittedBy", "name email phone role")
      .sort({ updatedAt: -1 })
      .lean()
  ]);

  const people = new Map();
  const ensurePerson = (u) => {
    if (!u || !u._id) return null;
    const key = String(u._id);
    if (!people.has(key)) {
      people.set(key, {
        user: {
          id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone || "",
          role: u.role,
          initials: initialsFromPersonName(u.name)
        },
        metrics: {
          bills: 0,
          spent: 0,
          company: 0,
          own: 0,
          advance: 0,
          used: 0,
          return: 0,
          owed: 0
        }
      });
    }
    return people.get(key);
  };

  for (const b of bills) {
    const p = ensurePerson(b.contactPerson);
    if (!p) continue;
    p.metrics.bills += 1;
    p.metrics.spent += Number(b.amount || 0);
    if (b.paidBy === "own" || b.paidBy === "self") {
      p.metrics.own += Number(b.amount || 0);
    } else {
      p.metrics.company += Number(b.amount || 0);
    }
  }

  for (const pr of payments) {
    const p = ensurePerson(pr.submittedBy);
    if (!p) continue;
    p.metrics.advance += Number(pr.amount || 0);
    p.metrics.used += Number(pr.usedAmount || 0);
    p.metrics.return += Number(pr.returnAmount || 0);
  }

  for (const item of people.values()) {
    const owed = Number(item.metrics.own || 0) - Number(item.metrics.return || 0);
    item.metrics.owed = owed > 0 ? owed : 0;
  }

  const rows = Array.from(people.values()).map((x) => ({ user: x.user, metrics: x.metrics }));

  const payload = {
    event: {
      id: event._id,
      activityName: event.activityName,
      accountNumber: event.accountNumber,
      date: event.date || null,
      startDate: event.startDate,
      closingDate: event.closingDate,
      endDate: event.endDate || null,
      budget: Number(event.budget || 0),
      cashAmount: Number(event.cashAmount || 0),
      sign: event.sign || "",
      status: event.status,
      director: event.director,
      teamLeader: event.teamLeader
    },
    rows,
    bills
  };

  return { ok: true, event, payload };
}

exports.getEventGoogleSheetEmbed = async (req, res) => {
  try {
    const eventId = String(req.params.eventId || "").trim();
    const actorId = String(req.auth?.id || "");
    const actorRole = String(req.auth?.role || "");
    if (!eventId) {
      return res.status(400).json({ message: "eventId is required" });
    }

    const build = await buildClosingPayloadForEvent(eventId);
    if (!build.ok) {
      return res.status(build.code || 404).json({ message: build.message || "Event not found" });
    }
    if (!isActorAllowedForEvent({ actorRole, actorId, event: build.event })) {
      return res.status(403).json({ message: "Access denied for this event" });
    }

    // Sync on demand (ensures the sheet contains ONLY this event in our tab)
    await syncClosingReportToGoogleSheet(build.payload);

    const embedToken = jwt.sign(
      { typ: "sheet_embed", actorId, actorRole, eventId },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const secureEmbedUrl = `${baseUrl}/api/admin/events/${encodeURIComponent(
      eventId
    )}/google-sheet/pdf?embedToken=${encodeURIComponent(embedToken)}`;

    await writeSheetAuditLog(req, { action: "open_embed", eventId });

    return res.status(200).json({
      eventId,
      eventName: String(build.event.activityName || ""),
      secureEmbedUrl,
      permissions: { role: actorRole },
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.syncEventGoogleSheet = async (req, res) => {
  try {
    const eventId = String(req.params.eventId || "").trim();
    const actorId = String(req.auth?.id || "");
    const actorRole = String(req.auth?.role || "");
    if (!eventId) {
      return res.status(400).json({ message: "eventId is required" });
    }

    const build = await buildClosingPayloadForEvent(eventId);
    if (!build.ok) {
      return res.status(build.code || 404).json({ message: build.message || "Event not found" });
    }
    if (!isActorAllowedForEvent({ actorRole, actorId, event: build.event })) {
      return res.status(403).json({ message: "Access denied for this event" });
    }

    await syncClosingReportToGoogleSheet(build.payload);
    await writeSheetAuditLog(req, { action: "sync", eventId });

    return res.status(200).json({
      success: true,
      eventId,
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.streamEventGoogleSheetPdf = async (req, res) => {
  try {
    // Token verified by middleware; `req.embed` contains payload.
    const eventId = String(req.params.eventId || "").trim();
    const embedded = req.embed || {};
    const actorId = String(embedded.actorId || "");
    const actorRole = String(embedded.actorRole || "");
    const tokenEventId = String(embedded.eventId || "");

    if (!eventId || !tokenEventId || eventId !== tokenEventId) {
      return res.status(401).json({ message: "Unauthorized: event mismatch" });
    }

    const build = await buildClosingPayloadForEvent(eventId);
    if (!build.ok) {
      return res.status(build.code || 404).json({ message: build.message || "Event not found" });
    }
    if (!isActorAllowedForEvent({ actorRole, actorId, event: build.event })) {
      return res.status(403).json({ message: "Access denied for this event" });
    }

    // Ensure fresh enough output: we DON'T auto-sync here for performance; user can click Refresh.
    const pdf = await exportClosingSheetDetailsPdfBuffer({
      eventId,
      eventName: build?.event?.activityName || "",
      saveToDisk: true
    });
    if (!pdf?.ok || !pdf.buffer) {
      return res.status(500).json({ message: pdf?.reason || "Failed to export sheet PDF" });
    }

    await writeSheetAuditLog(
      { ...req, auth: { id: actorId, role: actorRole } },
      { action: "view_pdf", eventId }
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(String(pdf.fileName || `closing-sheet-${eventId}.pdf`))}"`
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pdf.buffer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ ACCOUNTS & SETTLEMENTS (ADMIN)
exports.getAccountsOverview = async (req, res) => {
  try {
    // Consider only “team” roles for settlements UI
    const teamRoles = ["organizer", "director", "teamLeader", "employee"];
    const users = await User.find({ role: { $in: teamRoles } })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    const userIds = users.map((u) => u._id);

    // Compute per-user balances from payment requests + bills
    // - receivable_from_employee: remaining advance not returned (advance - used - return), clamped at 0
    // - payable_to_employee: employee paid own-pocket (own bills) minus returned cash, clamped at 0
    const [ownBillsAgg, prAgg, pendingApprovals] = await Promise.all([
      Bill.aggregate([
        {
          $match: {
            status: { $in: ["pending", "review", "approved"] },
            paidBy: "own",
            contactPerson: { $in: userIds }
          }
        },
        { $group: { _id: "$contactPerson", total: { $sum: "$amount" } } }
      ]),
      PaymentRequest.aggregate([
        {
          $match: {
            status: { $in: ["pending", "approved"] },
            submittedBy: { $in: userIds }
          }
        },
        {
          $group: {
            _id: "$submittedBy",
            advance: { $sum: "$amount" },
            used: { $sum: "$usedAmount" },
            returned: { $sum: "$returnAmount" }
          }
        }
      ]),
      Promise.all([
        Bill.countDocuments({ status: { $in: ["pending", "review"] } }),
        PaymentRequest.countDocuments({ status: "pending" })
      ])
    ]);

    const ownBillsByUser = new Map(
      ownBillsAgg.map((x) => [String(x._id), Number(x.total || 0)])
    );
    const prByUser = new Map(prAgg.map((x) => [String(x._id), x]));

    // Apply settlements already recorded
    const settlements = await Settlement.find({ user: { $in: userIds } })
      .sort({ createdAt: -1 })
      .lean();

    const settledPayable = new Map();
    const settledReceivable = new Map();
    for (const s of settlements) {
      const key = String(s.user);
      if (s.type === "payable_to_employee") {
        settledPayable.set(key, (settledPayable.get(key) || 0) + Number(s.amount || 0));
      } else if (s.type === "receivable_from_employee") {
        settledReceivable.set(
          key,
          (settledReceivable.get(key) || 0) + Number(s.amount || 0)
        );
      }
    }

    const employeeSettlement = users.map((u) => {
      const id = String(u._id);
      const ownBills = ownBillsByUser.get(id) || 0;
      const pr = prByUser.get(id) || { advance: 0, used: 0, returned: 0 };

      const rawReceivable = Number(pr.advance || 0) - Number(pr.used || 0) - Number(pr.returned || 0);
      const rawPayable = Number(ownBills || 0) - Number(pr.returned || 0);

      const receivableOutstanding = Math.max(0, rawReceivable - (settledReceivable.get(id) || 0));
      const payableOutstanding = Math.max(0, rawPayable - (settledPayable.get(id) || 0));

      const status =
        receivableOutstanding === 0 && payableOutstanding === 0 ? "settled" : "open";

      return {
        user: {
          id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone || "",
          role: u.role,
          initials: initialsFromPersonName(u.name)
        },
        balances: {
          payableToEmployee: payableOutstanding,
          receivableFromEmployee: receivableOutstanding
        },
        meta: {
          advance: Number(pr.advance || 0),
          used: Number(pr.used || 0),
          returned: Number(pr.returned || 0),
          ownBills: Number(ownBills || 0)
        },
        status
      };
    });

    const payableToEmployees = employeeSettlement.reduce(
      (sum, x) => sum + Number(x.balances.payableToEmployee || 0),
      0
    );
    const receivableFromEmployees = employeeSettlement.reduce(
      (sum, x) => sum + Number(x.balances.receivableFromEmployee || 0),
      0
    );

    return res.status(200).json({
      totals: {
        payableToEmployees,
        receivableFromEmployees,
        pendingApprovals: pendingApprovals[0] + pendingApprovals[1]
      },
      employeeSettlement
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createSettlement = async (req, res) => {
  try {
    const { userId, type, amount, method, note } = req.body;

    if (!userId || !type || amount == null) {
      return res.status(400).json({
        message: "userId, type and amount are required"
      });
    }

    const allowedTypes = ["payable_to_employee", "receivable_from_employee"];
    if (!allowedTypes.includes(String(type))) {
      return res.status(400).json({
        message: `Invalid type. Allowed: ${allowedTypes.join(", ")}`
      });
    }

    const u = await User.findById(userId);
    if (!u) {
      return res.status(404).json({ message: "User not found" });
    }

    const s = await Settlement.create({
      user: userId,
      type: String(type),
      amount: Number(amount),
      method: method || "transfer",
      note: note || "",
      createdBy: req.admin?.id || null
    });

    return res.status(201).json({
      message: "Settlement recorded",
      settlement: s
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createReminder = async (req, res) => {
  try {
    const { userId, note } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const u = await User.findById(userId);
    if (!u) {
      return res.status(404).json({ message: "User not found" });
    }
    // Backend-only: we just record a note; WhatsApp/SMS integration can be added later.
    const reminder = await Settlement.create({
      user: userId,
      type: "receivable_from_employee",
      amount: 0,
      method: "other",
      note: note || "Reminder sent",
      createdBy: req.admin?.id || null
    });

    return res.status(201).json({
      message: "Reminder recorded",
      reminder
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ ROLE & PERMISSION MATRIX (ADMIN)
exports.getPermissionMatrix = async (req, res) => {
  try {
    // Keep this in sync with actual route protections over time.
    const roles = [
      { key: "admin", label: "ADMIN / ACCOUNTANT" },
      { key: "director", label: "DIRECTOR" },
      { key: "teamLeader", label: "TEAM LEADER" },
      { key: "employee", label: "EVENT HANDLER" }
    ];

    const permissions = [
      { key: "view_all_events", label: "View all events" },
      { key: "create_events", label: "Create events" },
      { key: "assign_team_members", label: "Assign team members" },
      { key: "approve_payments", label: "Approve payments" },
      { key: "view_all_bills", label: "View all bills" },
      { key: "system_settings", label: "System settings" },
      { key: "view_closing_sheets", label: "View closing sheets" },
      { key: "transfer_money", label: "Transfer money" },
      { key: "accounts_panel", label: "Accounts panel" },
      { key: "rate_employees", label: "Rate employees" },
      { key: "edit_others_bills", label: "Edit other's bills" },
      { key: "close_events", label: "Close events" },
      { key: "payment_history", label: "Payment history" },
      { key: "manage_users", label: "Manage users" },
      { key: "view_reports", label: "View reports" }
    ];

    // Matrix values are “what UI should show” for the RBAC demo screen.
    // Actual enforcement is handled by middleware on routes.
    const matrix = {
      admin: {
        view_all_events: true,
        create_events: true,
        assign_team_members: true,
        approve_payments: true,
        view_all_bills: true,
        system_settings: true,
        view_closing_sheets: true,
        transfer_money: true,
        accounts_panel: true,
        rate_employees: true,
        edit_others_bills: true,
        close_events: true,
        payment_history: true,
        manage_users: true,
        view_reports: true
      },
      director: {
        view_all_events: true,
        create_events: true,
        assign_team_members: true,
        approve_payments: false,
        view_all_bills: true,
        system_settings: false,
        view_closing_sheets: true,
        transfer_money: false,
        accounts_panel: false,
        rate_employees: true,
        edit_others_bills: true,
        close_events: true,
        payment_history: true,
        manage_users: false,
        view_reports: true
      },
      teamLeader: {
        view_all_events: false,
        create_events: true,
        assign_team_members: true,
        approve_payments: false,
        view_all_bills: true,
        system_settings: false,
        view_closing_sheets: true,
        transfer_money: false,
        accounts_panel: false,
        rate_employees: true,
        edit_others_bills: false,
        close_events: false,
        payment_history: true,
        manage_users: false,
        view_reports: false
      },
      employee: {
        view_all_events: false,
        create_events: false,
        assign_team_members: false,
        approve_payments: false,
        view_all_bills: false,
        system_settings: false,
        view_closing_sheets: false,
        transfer_money: false,
        accounts_panel: false,
        rate_employees: false,
        edit_others_bills: false,
        close_events: false,
        payment_history: false,
        manage_users: false,
        view_reports: false
      }
    };

    const keyAccessRules = [
      {
        title: "Admin-only routes",
        description:
          "All /api/admin endpoints require a valid JWT with role=admin (requireAdmin middleware)."
      },
      {
        title: "Team roles",
        description:
          "Director / Team Leader can create events via /api/user/events (requireDirectorOrTeamLeader)."
      },
      {
        title: "Approvals",
        description:
          "Bill/payment approvals are done by admin via review endpoints."
      }
    ];

    return res.status(200).json({
      roles,
      permissions,
      matrix,
      keyAccessRules
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ ALL USERS (ADMIN) — Director / Team Leader use /api/user/* with JWT
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    return res.status(200).json({
      count: users.length,
      users
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
      ];
    }
    const vendors = await Vendor.find(filter).sort({ createdAt: -1 });
    res.json({ data: vendors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET single vendor
exports.getSingleVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Not found" });
    res.json({ data: vendor });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST create vendor
exports.createVendor = async (req, res) => {
  try {
    const vendor = await Vendor.create(req.body);
    res.status(201).json({ data: vendor });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT update vendor
exports.updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!vendor) return res.status(404).json({ message: "Not found" });
    res.json({ data: vendor });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE vendor
exports.deleteVendor = async (req, res) => {
  try {
    await Vendor.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBillsByEmployeeForEvent = async (req, res) => {
  try {
    const { employeeId, eventId } = req.params;

    // 1️⃣ Validate IDs
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID" });
    }
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    // 2️⃣ Check event exists & is approved
    const eventDoc = await Event.findById(eventId);
    if (!eventDoc || eventDoc.status !== "approved") {
      return res.status(404).json({
        message: "Event not found or not approved"
      });
    }

    // 3️⃣ Check employee is assigned to this event
    if (!employeeAssignedOnEvent(eventDoc, employeeId)) {
      return res.status(403).json({
        message: "This employee is not assigned to this event"
      });
    }

    // 4️⃣ Query using EXACT model field names
    const bills = await Bill.find({
      contactPerson: employeeId,   // ✅ matches model: contactPerson → ref "User"
      event: eventId               // ✅ matches model: event → ref "Event"
    })
      .populate("event", "activityName startDate budget venue")       // ref: "Event"
      .populate("contactPerson", "name email phone")                  // ref: "User"
      .populate("reviewedBy", "name email")                           // ref: "Admin"
      .sort({ createdAt: -1 });

    // 5️⃣ Check empty array
    if (!bills || bills.length === 0) {
      return res.status(404).json({
        message: "No bills found for this employee in this event"
      });
    }

    // 6️⃣ Format — EVERY field from your Bill model included
    const formattedBills = bills.map((bill) => ({
      _id: bill._id,

      // ── String Fields ──
      entityName: bill.entityName,                    // String ✅
      description: bill.description || "",            // String ✅
      category: bill.category,                        // String enum ✅
      voucherUrl: bill.voucherUrl || "",              // String ✅

      // ── Populated Refs ──
      event: {                                        // ObjectId → Event ✅
        _id: bill.event?._id || null,
        name: bill.event?.activityName || "",
        date: bill.event?.startDate || "",
        venue: bill.event?.venue || "",
        budget: bill.event?.budget || 0
      },
      contactPerson: bill.contactPerson               // ObjectId → User ✅
        ? {
            _id: bill.contactPerson._id,
            name: bill.contactPerson.name,
            email: bill.contactPerson.email,
            phone: bill.contactPerson.phone || ""
          }
        : null,

      // ── Number Fields ──
      amount: bill.amount,                            // Number ✅
      gstPercentage: bill.gstPercentage,              // Number ✅
      gstAmount: bill.gstAmount,                      // Number ✅
      totalWithGst: bill.amount + bill.gstAmount,     // Calculated ✅
      tokenAmount: bill.tokenAmount,                  // Number ✅

      // ── Enum Fields ──
      paidBy: bill.paidBy === "own"                   // enum fix ✅
        ? "self"
        : bill.paidBy,
      paymentType: bill.paymentType,                  // enum ✅
      status: bill.status,                            // enum ✅

      // ── Bill Sheet (Mixed type) ──
      billSheet: bill.billSheet || null,              // Mixed ✅

      // ── Review Fields ──
      reviewedBy: bill.reviewedBy                     // ObjectId → Admin ✅
        ? {
            _id: bill.reviewedBy._id,
            name: bill.reviewedBy.name,
            email: bill.reviewedBy.email
          }
        : null,
      reviewedAt: bill.reviewedAt || null,            // Date ✅

      // ── Timestamps ──
      createdAt: bill.createdAt,                      // Date ✅
      updatedAt: bill.updatedAt                       // Date ✅
    }));

    return res.status(200).json({
      message: "Bills fetched successfully",
      total: formattedBills.length,
      data: formattedBills
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

function resolveSectionFromCategory(category) {
  const normalized = String(category || "").trim().toLowerCase();
  if (normalized === "infrastructure" || normalized === "setup") {
    return { key: "A", title: "SETUP AND INFRASTRUCTURE" };
  }
  if (normalized === "furniture_rentals" || normalized === "tentage") {
    return { key: "B", title: "TENTAGE" };
  }
  if (normalized === "furniture") {
    return { key: "C", title: "FURNITURE" };
  }
  if (normalized === "technical") {
    return { key: "D", title: "TECHNICALS" };
  }
  if (normalized === "services" || normalized === "service") {
    return { key: "E", title: "SERVICES" };
  }
  if (normalized === "entertainment") {
    return { key: "F", title: "ENTERTAINMENT" };
  }
  if (normalized === "other") {
    return { key: "E", title: "SERVICES" };
  }
  return { key: "A", title: "SETUP AND INFRASTRUCTURE" };
}

exports.getBillsByEventId = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const [eventDoc, bills] = await Promise.all([
      Event.findById(eventId).select("activityName startDate venue"),
      Bill.find({ event: eventId }).sort({ createdAt: 1 }),
    ]);

    if (!eventDoc) {
      return res.status(404).json({ message: "Event not found" });
    }

    const sectionBuckets = new Map();
    let srNo = 1;

    for (const bill of bills) {
      const section = resolveSectionFromCategory(bill.category);

      if (!sectionBuckets.has(section.key)) {
        sectionBuckets.set(section.key, { ...section, items: [] });
      }

      const amount = Number(bill.amount || 0);

      sectionBuckets.get(section.key).items.push({
        srNo: srNo++,
        billId: String(bill._id),

        particular: String(
          bill.particulars ||
          bill.entityName ||
          "Particular"
        ),

        quantity: 1,
        size: "-",
        rate: amount,
        amount: amount,

        // ✅ FINAL REMARK FIX
        remarks: String(
          bill.description ||     // MAIN
          bill.particulars ||     // fallback
          bill.entityName ||      // fallback
          ""
        ),

        category: String(bill.category || ""),
        vendorName: String(bill.entityName || ""),
      });
    }

    const sections = ["A", "B", "C", "D", "E", "F"]
      .map((k) => sectionBuckets.get(k))
      .filter(Boolean);

    const total = sections.reduce(
      (sum, sec) =>
        sum + sec.items.reduce((s, r) => s + r.amount, 0),
      0
    );

    return res.json({
      eventId: String(eventDoc._id),
      eventName: eventDoc.activityName,
      eventDate: eventDoc.startDate,
      venue: eventDoc.venue,

      bills: bills.map((b) => ({
        billId: String(b._id),
        vendorName: b.entityName,
        category: b.category,
        amount: b.amount,

        // ✅ FIX HERE ALSO
        remark: String(
          b.description ||
          b.particulars ||
          b.entityName ||
          ""
        ),

        particulars: b.particulars || "",
      })),

      sections,
      totals: {
        total,
        finalTotal: total,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.updateBillRemark = async (req, res) => {
  try {
    const { billId } = req.params;
    const { eventId, remark, vendorName } = req.body;

    const bill = await Bill.findOne({ _id: billId, event: eventId });
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    // ✅ ALWAYS STORE HERE
    bill.description = String(remark || "").trim();
    await bill.save();

    await Vendor.findOneAndUpdate(
      { eventId, billId },
      {
        $set: {
          name: vendorName || bill.entityName,
          vendorName: vendorName || bill.entityName,
          remark: bill.description,
          notes: bill.description,
          eventId,
          billId,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );

    res.json({ message: "Remark saved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveSectionRemarksToVendors = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { rows } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(String(eventId || ""))) {
      return res.status(400).json({ message: "Invalid event ID" });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "rows payload is required" });
    }

    const results = [];
    for (const row of rows) {
      const billId = String(row?.billId || "");
      if (!mongoose.Types.ObjectId.isValid(billId)) continue;

      const bill = await Bill.findOne({ _id: billId, event: eventId });
      if (!bill) continue;

      const nextRemark = String(row?.remark || "").trim();
      const nextVendorName =
        String(row?.vendorName || bill.entityName || "Vendor").trim() || "Vendor";

      if (nextRemark) {
        bill.description = nextRemark;
        await bill.save();
      }

      const vendor = await Vendor.findOneAndUpdate(
        { eventId, billId: bill._id },
        {
          $set: {
            name: nextVendorName,
            vendorName: nextVendorName,
            remark: nextRemark,
            notes: nextRemark,
            eventId,
            billId: bill._id,
            category: "other",
            isActive: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: false }
      );

      results.push({
        billId: String(bill._id),
        remark: nextRemark,
        vendorId: String(vendor._id),
      });
    }

    return res.status(200).json({
      message: "Section remarks synced",
      eventId: String(eventId),
      updated: results.length,
      results,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};