const User = require("../Models/UserModel");
const Event = require("../Models/EventModel");
const Bill = require("../Models/BillModel");
const PaymentRequest = require("../Models/PaymentRequestModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { isTaskCategory, TASK_CATEGORIES } = require("../constants/taskCategories");
const {
  syncBillsToGoogleSheet
} = require("../Services/GoogleSheetsSync");

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

/** Resolve a User id from email (Director / Team Leader flows). Empty string → null id. */
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
 * `teamLeader` (ObjectId) and/or `teamLeaderEmail`. Email overrides id when `teamLeaderEmail` is present.
 * Returns `undefined` when neither field is in the body (caller decides default).
 */
const pickTeamLeaderIdFromUserBody = async (reqBody) => {
  let teamLeaderId = Object.prototype.hasOwnProperty.call(reqBody, "teamLeader")
    ? reqBody.teamLeader
    : undefined;

  if (Object.prototype.hasOwnProperty.call(reqBody, "teamLeaderEmail")) {
    const r = await resolveUserIdFromEmail(reqBody.teamLeaderEmail, "teamLeader");
    if (!r.ok) {
      return { ok: false, message: r.message };
    }
    teamLeaderId = r.id;
  }

  return { ok: true, teamLeaderId };
};

/** `director` (ObjectId) and/or `directorEmail` — email overrides id when present. */
const pickDirectorIdFromUserBody = async (reqBody) => {
  let directorId = Object.prototype.hasOwnProperty.call(reqBody, "director")
    ? reqBody.director
    : undefined;

  if (Object.prototype.hasOwnProperty.call(reqBody, "directorEmail")) {
    const r = await resolveUserIdFromEmail(reqBody.directorEmail, "director");
    if (!r.ok) {
      return { ok: false, message: r.message };
    }
    directorId = r.id;
  }

  return { ok: true, directorId };
};

// ✅ REGISTER USER (SEPARATE USER API)
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    const allowedRoles = ["user", "organizer", "director", "teamLeader", "employee"];
    const finalRole = role || "user";

    if (!allowedRoles.includes(finalRole)) {
      return res.status(400).json({
        message: "Invalid role"
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: finalRole
    });

    const safeUser = user.toObject();
    delete safeUser.password;

    return res.status(201).json({
      message: "User registered successfully",
      user: safeUser
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ LOGIN USER
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.password) {
      return res.status(401).json({
        message: "Password is not set for this user. Contact admin."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const safeUser = user.toObject();
    delete safeUser.password;

    return res.status(200).json({
      message: "Login successful",
      token,
      user: safeUser
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ GET MY PROFILE
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.auth.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ DIRECTOR / TEAM LEADER CREATE EVENT (NO UPDATE/DELETE POWER)
exports.createEventByRoleUser = async (req, res) => {
  try {
    const {
      date,
      accountNumber,
      activityName,
      startDate,
      closingDate,
      endDate,
      director,
      employeeEmail,        // ← single (legacy)
      employeeEmails,       // ← NEW: array
      employee,
      budget,
      cashAmount,
      sign,
    } = req.body;

    const actorRole = req.auth.role;
    const actorId = req.auth.id;

    if (actorRole !== "director") {
      return res.status(403).json({ message: "Only a director can create events" });
    }

    if (!accountNumber || !activityName || budget == null) {
      return res.status(400).json({ message: "Required fields missing" });
    }
    if (!startDate) {
      return res.status(400).json({ message: "Start date is required" });
    }
    if (startDate && closingDate && new Date(closingDate) < new Date(startDate)) {
      return res.status(400).json({ message: "Closing date cannot be before start date" });
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ message: "End date cannot be before start date" });
    }
    if (closingDate && endDate && new Date(endDate) < new Date(closingDate)) {
      return res.status(400).json({ message: "End date cannot be before closing date" });
    }

    if (actorRole === "teamLeader" && director) {
      return res.status(403).json({ message: "Team Leader cannot assign a director" });
    }

    const tlPick = await pickTeamLeaderIdFromUserBody(req.body);
    if (!tlPick.ok) {
      return res.status(400).json({ message: tlPick.message });
    }

    if (
      actorRole === "teamLeader" &&
      tlPick.teamLeaderId != null &&
      String(tlPick.teamLeaderId) !== String(actorId)
    ) {
      return res.status(403).json({
        message: "Team leaders cannot assign a different team leader",
      });
    }

    const finalDirector =
      actorRole === "director" ? director || actorId : director || null;
    const finalTeamLeader =
      actorRole === "teamLeader"
        ? actorId
        : tlPick.teamLeaderId == null
        ? null
        : tlPick.teamLeaderId;

    const assignedValidation = await validateAssignedUsers(finalDirector, finalTeamLeader);
    if (!assignedValidation.ok) {
      return res.status(400).json({ message: assignedValidation.message });
    }

    // ✅ Build a list of employee emails (supports both single & array)
    const emailList = [];
    if (Array.isArray(employeeEmails)) {
      for (const e of employeeEmails) {
        if (e && String(e).trim()) emailList.push(String(e).trim().toLowerCase());
      }
    }
    if (employeeEmail && String(employeeEmail).trim()) {
      emailList.push(String(employeeEmail).trim().toLowerCase());
    }

    const employeeAssignments = [];

    if (emailList.length > 0) {
      // Resolve each email
      for (const email of [...new Set(emailList)]) {
        const u = await User.findOne({ email }).select("_id email role");
        if (!u) {
          return res.status(400).json({ message: `Employee not found: ${email}` });
        }
        if (u.role !== "employee") {
          return res
            .status(400)
            .json({ message: `User ${u.email} must have role "employee"` });
        }
        employeeAssignments.push({ employee: u._id });
      }
    } else if (employee) {
      const u = await User.findById(employee).select("_id email role");
      if (!u) {
        return res.status(400).json({ message: "Employee not found" });
      }
      if (u.role !== "employee") {
        return res
          .status(400)
          .json({ message: `User ${u.email} must have role "employee"` });
      }
      employeeAssignments.push({ employee: u._id });
    } else {
      return res.status(400).json({
        message: "At least one employee is required (employeeEmails or employee)",
      });
    }

    const event = await Event.create({
      date: date || null,
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
      approvedAt: new Date(),
      createdBy: actorId,
    });

    return res.status(201).json({
      message: "Event created successfully",
      event,
    });
  } catch (error) {
    console.error("Create event error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ✅ DIRECTOR / TEAM LEADER: VIEW ONLY RUNNING ASSIGNED EVENTS
exports.getMyRunningEvents = async (req, res) => {
  try {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const userId = req.auth.id;

    const events = await Event.find({
      status: "approved",
      startDate: { $lte: todayEnd },
      $and: [
        { $or: [{ closingDate: { $gte: todayStart } }, { closingDate: null }] },
        { $or: [{ director: userId }, { teamLeader: userId }] }
      ]
    })
      .populate("director", "name email role")
      .populate("teamLeader", "name email role")
      .populate("employeeAssignments.employee", "name email role")
      .sort({ startDate: 1 });

    return res.status(200).json({
      count: events.length,
      events
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ DIRECTOR / TEAM LEADER: VIEW ALL ASSIGNED EVENTS (for Team Leader employee assignment)
exports.getMyAssignedEvents = async (req, res) => {
  try {
    const userId = req.auth.id;

    const events = await Event.find({
      $or: [{ director: userId }, { teamLeader: userId }]
    })
      .populate("director", "name email role")
      .populate("teamLeader", "name email role")
      .populate("employeeAssignments.employee", "name email role")
      .sort({ startDate: -1, createdAt: -1 });

    return res.status(200).json({
      count: events.length,
      events
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ SEPARATE USER DASHBOARD FOR DIRECTOR / TEAM LEADER
exports.getUserDashboardStats = async (req, res) => {
  try {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const userId = req.auth.id;

    const baseFilter = {
      $or: [{ director: userId }, { teamLeader: userId }]
    };

    const [totalAssigned, running, pending, approved, rejected] = await Promise.all([
      Event.countDocuments(baseFilter),
      Event.countDocuments({
        ...baseFilter,
        status: "approved",
        startDate: { $lte: todayEnd },
        $or: [{ closingDate: { $gte: todayStart } }, { closingDate: null }]
      }),
      Event.countDocuments({ ...baseFilter, status: "pending" }),
      Event.countDocuments({ ...baseFilter, status: "approved" }),
      Event.countDocuments({ ...baseFilter, status: "rejected" })
    ]);

    return res.status(200).json({
      totalAssignedEvents: totalAssigned,
      runningEvents: running,
      eventsByStatus: {
        pending,
        approved,
        rejected
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/** Director: event.director or createdBy. Team Leader: event.teamLeader */
const userCanManageEvent = (event, userId, role) => {
  const uid = String(userId);
  if (role === "director") {
    return (
      (event.director && String(event.director) === uid) ||
      (event.createdBy && String(event.createdBy) === uid)
    );
  }
  if (role === "teamLeader") {
    return event.teamLeader && String(event.teamLeader) === uid;
  }
  return false;
};

/**
 * PUT /api/user/events/:id — Director or Team Leader updates an event they manage.
 * Team Leaders cannot change `director`.
 */
exports.updateUserEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const actorRole = req.auth.role;
    const actorId = req.auth.id;

    if (!["director", "teamLeader"].includes(actorRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (!userCanManageEvent(event, actorId, actorRole)) {
      return res.status(403).json({
        message: "You can only update events assigned to you"
      });
    }

    if (actorRole === "teamLeader" && Object.prototype.hasOwnProperty.call(req.body, "director")) {
      return res.status(403).json({ message: "Team leaders cannot change director" });
    }
    if (actorRole === "teamLeader" && Object.prototype.hasOwnProperty.call(req.body, "directorEmail")) {
      return res.status(403).json({ message: "Team leaders cannot change director" });
    }

    const allowed = [
      "date",
      "accountNumber",
      "activityName",
      "startDate",
      "closingDate",
      "budget",
      "cashAmount",
      "sign"
    ];
    if (actorRole === "director") {
      allowed.push("teamLeader");
    }

    const patch = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        patch[key] = req.body[key];
      }
    }

    if (actorRole === "director" && Object.prototype.hasOwnProperty.call(req.body, "teamLeaderEmail")) {
      const tlPick = await pickTeamLeaderIdFromUserBody(req.body);
      if (!tlPick.ok) {
        return res.status(400).json({ message: tlPick.message });
      }
      patch.teamLeader = tlPick.teamLeaderId;
    }

    if (
      actorRole === "director" &&
      (Object.prototype.hasOwnProperty.call(req.body, "director") ||
        Object.prototype.hasOwnProperty.call(req.body, "directorEmail"))
    ) {
      const dPick = await pickDirectorIdFromUserBody(req.body);
      if (!dPick.ok) {
        return res.status(400).json({ message: dPick.message });
      }
      patch.director = dPick.directorId;
    }

    if (patch.startDate && patch.closingDate && new Date(patch.closingDate) < new Date(patch.startDate)) {
      return res.status(400).json({
        message: "Closing date cannot be before start date"
      });
    }

    const nextDirector = Object.prototype.hasOwnProperty.call(patch, "director")
      ? patch.director
      : event.director;
    const nextTeamLeader = Object.prototype.hasOwnProperty.call(patch, "teamLeader")
      ? patch.teamLeader
      : event.teamLeader;

    if (
      Object.prototype.hasOwnProperty.call(patch, "teamLeader") ||
      Object.prototype.hasOwnProperty.call(patch, "director")
    ) {
      const assignedValidation = await validateAssignedUsers(nextDirector, nextTeamLeader);
      if (!assignedValidation.ok) {
        return res.status(400).json({ message: assignedValidation.message });
      }
    }

    Object.assign(event, patch);
    await event.save();

    const populated = await Event.findById(event._id)
      .populate("director", "name email role")
      .populate("teamLeader", "name email role");

    return res.status(200).json({
      message: "Event updated",
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/user/events/:id/assign — Director assigns a Team Leader (own events only).
 */
exports.assignTeamLeaderByDirector = async (req, res) => {
  try {
    const { id } = req.params;
    const actorId = req.auth.id;

    const tlPick = await pickTeamLeaderIdFromUserBody(req.body);
    if (!tlPick.ok) {
      return res.status(400).json({ message: tlPick.message });
    }

    let teamLeader = tlPick.teamLeaderId;
    if (
      teamLeader === undefined &&
      Object.prototype.hasOwnProperty.call(req.body, "teamLeader") &&
      req.body.teamLeader !== undefined &&
      req.body.teamLeader !== null &&
      req.body.teamLeader !== ""
    ) {
      teamLeader = req.body.teamLeader;
    }

    if (teamLeader === undefined || teamLeader === null || teamLeader === "") {
      return res.status(400).json({
        message: "teamLeader or teamLeaderEmail is required"
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const isOwner =
      (event.director && String(event.director) === String(actorId)) ||
      (event.createdBy && String(event.createdBy) === String(actorId));

    if (!isOwner) {
      return res.status(403).json({
        message: "Only the event director can assign a team leader"
      });
    }

    const directorForValidation = event.director || actorId;
    const assignedValidation = await validateAssignedUsers(directorForValidation, teamLeader);
    if (!assignedValidation.ok) {
      return res.status(400).json({ message: assignedValidation.message });
    }

    event.teamLeader = teamLeader;
    await event.save();

    const populated = await Event.findById(event._id)
      .populate("director", "name email role")
      .populate("teamLeader", "name email role");

    return res.status(200).json({
      message: "Team leader assigned",
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const employeeAssignedOnEvent = (event, employeeId) =>
  (event.employeeAssignments || []).some((a) => String(a.employee) === String(employeeId));

/**
 * PATCH /api/user/events/:id/employee-assignments — Team Leader only.
 * Body: { assignments: [{ employee | employeeEmail }] }
 */
exports.assignEmployeesByTeamLeader = async (req, res) => {
  try {
    const { id } = req.params;
    const actorId = req.auth.id;

    if (req.auth.role !== "teamLeader") {
      return res.status(403).json({ message: "Only a team leader can assign employees" });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (!event.teamLeader || String(event.teamLeader) !== String(actorId)) {
      return res.status(403).json({
        message: "You can only assign employees on events where you are the team leader"
      });
    }

    const { assignments } = req.body;
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ message: "assignments must be an array" });
    }

    const normalized = [];
    const seen = new Set();
    const emails = assignments
      .map((row) =>
        row.employeeEmail != null ? String(row.employeeEmail).trim().toLowerCase() : ""
      )
      .filter(Boolean);
    const directIds = assignments.map((row) => row.employee).filter(Boolean);

    // Batch-load all referenced users to avoid N+1 queries.
    const [emailUsers, idUsers] = await Promise.all([
      emails.length
        ? User.find({ email: { $in: emails } }).select("_id email role")
        : Promise.resolve([]),
      directIds.length
        ? User.find({ _id: { $in: directIds } }).select("_id email role")
        : Promise.resolve([])
    ]);

    const userByEmail = new Map(emailUsers.map((u) => [String(u.email).toLowerCase(), u]));
    const userById = new Map(idUsers.map((u) => [String(u._id), u]));

    for (const row of assignments) {
      let empUser = null;
      const email = row.employeeEmail != null ? String(row.employeeEmail).trim().toLowerCase() : "";
      if (email) {
        empUser = userByEmail.get(email) || null;
        if (!empUser) {
          return res.status(400).json({ message: `No user with email: ${email}` });
        }
      } else if (row.employee) {
        empUser = userById.get(String(row.employee)) || null;
        if (!empUser) {
          return res.status(400).json({ message: "Each assignment must reference an employee user" });
        }
      } else {
        return res.status(400).json({ message: "Each assignment needs employee or employeeEmail" });
      }

      if (empUser.role !== "employee") {
        return res.status(400).json({
          message: `User ${empUser.email} must have role "employee" (current: "${empUser.role}")`
        });
      }

      const key = String(empUser._id);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      normalized.push({ employee: empUser._id });
    }

    event.employeeAssignments = normalized;
    await event.save();

    const populated = await Event.findById(event._id)
      .populate("director", "name email role")
      .populate("teamLeader", "name email role")
      .populate("employeeAssignments.employee", "name email role");

    return res.status(200).json({
      message: "Employee assignments updated",
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getEmployeeAssignedEvents = async (req, res) => {
  try {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const userId = req.auth.id;

    const events = await Event.find({
      status: "approved",
      startDate: { $lte: todayEnd },
      $or: [{ closingDate: { $gte: todayStart } }, { closingDate: null }],
      "employeeAssignments.employee": userId
    })
      .populate("teamLeader", "name email role")
      .populate("director", "name email role")
      .populate("employeeAssignments.employee", "name email role")
      .sort({ startDate: 1 });

    const shaped = events.map((ev) => ev.toObject());

    return res.status(200).json({
      count: shaped.length,
      events: shaped
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getEmployeeAllAssignedEvents = async (req, res) => {
  try {
    const userId = req.auth.id;

    const events = await Event.find({
      "employeeAssignments.employee": userId
    })
      .populate("teamLeader", "name email role")
      .populate("director", "name email role")
      .populate("employeeAssignments.employee", "name email role")
      .sort({ startDate: -1, createdAt: -1 });

    const shaped = events.map((ev) => ev.toObject());

    return res.status(200).json({
      count: shaped.length,
      events: shaped
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getEmployeeDashboardStats = async (req, res) => {
  try {
    const userId = req.auth.id;
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [assignedEvents, pendingBills, pendingPr, runningEventDocs] = await Promise.all([
      Event.countDocuments({ "employeeAssignments.employee": userId, status: "approved" }),
      Bill.countDocuments({ contactPerson: userId, status: { $in: ["pending", "review"] } }),
      PaymentRequest.countDocuments({ submittedBy: userId, status: "pending" }),
      Event.find({
        status: "approved",
        startDate: { $lte: todayEnd },
        $or: [{ closingDate: { $gte: todayStart } }, { closingDate: null }],
        "employeeAssignments.employee": userId
      })
        .populate("teamLeader", "name email role")
        .populate("director", "name email role")
        .select(
          "activityName accountNumber budget startDate closingDate teamLeader director employeeAssignments"
        )
        .sort({ startDate: 1 })
    ]);

    const runningAssignments = runningEventDocs.map((ev) => {
      const tl = ev.teamLeader;
      const dir = ev.director;
      return {
        eventId: ev._id,
        activityName: ev.activityName,
        accountNumber: ev.accountNumber,
        budgetRemaining: ev.budget,
        startDate: ev.startDate,
        closingDate: ev.closingDate,
        teamLeader: tl
          ? { name: tl.name, email: tl.email }
          : null,
        director: dir
          ? { name: dir.name, email: dir.email }
          : null,
      };
    });

    return res.status(200).json({
      assignedEvents,
      billsPendingReview: pendingBills,
      paymentRequestsPending: pendingPr,
      runningEventsCount: runningAssignments.length,
      runningAssignments
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.uploadEmployeeBillImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Bill image is required" });
    }

    const { remark, remarks } = req.body;

    // ✅ normalize remark
    const finalRemark = String(remarks || remark || "").trim();

    const publicUrl = `${req.protocol}://${req.get("host")}/uploads/bills/${req.file.filename}`;

    return res.status(201).json({
      message: "Bill image uploaded",
      data: {
        url: publicUrl,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,

        // ✅ IMPORTANT (send remark to frontend)
        remark: finalRemark,
        remarks: finalRemark
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.employeeCreateBill = async (req, res) => {
  try {
    const userId = req.auth.id;

    const {
      entityName,
      amount,
      event: eventId,
      description,
      particulars,
      category,
      voucherUrl,
      gstPercentage,
      paymentType,
      tokenAmount,
      paidBy,
      remark // ✅ added
    } = req.body;

    // ── VALIDATION ──
    if (!entityName || amount == null || !eventId || !category) {
      return res.status(400).json({
        message: "entityName, amount, event, and category are required"
      });
    }

    if (!voucherUrl || !String(voucherUrl).trim()) {
      return res.status(400).json({ message: "Bill image is required" });
    }

    const totalAmount = Number(amount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    const normalizedGstPercentage =
      gstPercentage == null || gstPercentage === "" ? 0 : Number(gstPercentage);

    const normalizedPaymentType = String(paymentType || "full").toLowerCase();
    const normalizedPaidBy =
      String(paidBy || "").toLowerCase() === "own" ? "self" : String(paidBy || "").toLowerCase();

    const normalizedTokenAmount =
      tokenAmount == null || tokenAmount === "" ? 0 : Number(tokenAmount);

    const eventDoc = await Event.findById(eventId);
    if (!eventDoc || eventDoc.status !== "approved") {
      return res.status(404).json({ message: "Event not found or not approved" });
    }

    if (!employeeAssignedOnEvent(eventDoc, userId)) {
      return res.status(403).json({
        message: "You are not assigned to this event"
      });
    }

    // ── NORMALIZE FIELDS ──
    const normalizedParticulars = String(particulars || description || "").trim();
    if (!normalizedParticulars) {
      return res.status(400).json({ message: "particulars is required" });
    }

    const normalizedRemark = String(remark || description || "").trim();

    // ── CREATE BILL ──
    const bill = await Bill.create({
      entityName,
      amount: totalAmount,
      gstPercentage: normalizedGstPercentage,
      gstAmount: (totalAmount * normalizedGstPercentage) / (100 + normalizedGstPercentage),
      event: eventId,
      contactPerson: userId,

      particulars: normalizedParticulars,
      description: String(description || normalizedParticulars),

      // ✅ IMPORTANT FIX
      remark: normalizedRemark,
      remarks: normalizedRemark,

      category,
      voucherUrl: String(voucherUrl).trim(),
      paymentType: normalizedPaymentType,
      tokenAmount: normalizedPaymentType === "token" ? normalizedTokenAmount : 0,
      paidBy: normalizedPaidBy,
      status: "pending"
    });

    // ── OPTIONAL GOOGLE SHEET SYNC ──
    try {
      await syncBillsToGoogleSheet([bill], new Map([[String(eventDoc._id), eventDoc]]));
    } catch (err) {
      console.error("[Sheets Sync Error]", err.message);
    }

    const populated = await Bill.findById(bill._id)
      .populate("event", "activityName startDate budget")
      .populate("contactPerson", "name email");

    return res.status(201).json({
      message: "Bill submitted for review",
      data: populated
    });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.employeeListBills = async (req, res) => {
  try {
    const userId = req.auth.id;
    const bills = await Bill.find({ contactPerson: userId })
      .populate("event", "activityName startDate status")
      .sort({ updatedAt: -1 });

    return res.status(200).json({ count: bills.length, bills });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.employeeUpdateBill = async (req, res) => {
  try {
    const userId = req.auth.id;
    const { id } = req.params;
    const {
      entityName,
      amount,
      event: eventId,
      description,
      particulars,
      category,
      voucherUrl,
      gstPercentage,
      paymentType,
      tokenAmount,
      paidBy
    } = req.body;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    if (String(bill.contactPerson) !== String(userId)) {
      return res.status(403).json({ message: "You can edit only your own bills" });
    }

    if (!["pending", "review"].includes(String(bill.status))) {
      return res.status(400).json({ message: "Only pending/review bills can be edited" });
    }

    if (!entityName || amount == null || !eventId || !category) {
      return res.status(400).json({
        message: "entityName, amount, event, and category are required"
      });
    }

    if (!isTaskCategory(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const totalAmount = Number(amount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    const normalizedGstPercentage =
      gstPercentage == null || gstPercentage === "" ? 0 : Number(gstPercentage);
    if (!Number.isFinite(normalizedGstPercentage) || normalizedGstPercentage < 0) {
      return res.status(400).json({ message: "gstPercentage must be 0 or more" });
    }

    const normalizedPaymentType = String(paymentType || "full").toLowerCase();
    if (!["full", "token"].includes(normalizedPaymentType)) {
      return res.status(400).json({ message: "paymentType must be full or token" });
    }

    const normalizedPaidByRaw = String(paidBy || "").toLowerCase();
    const normalizedPaidBy = normalizedPaidByRaw === "own" ? "self" : normalizedPaidByRaw;
    if (!["company", "self"].includes(normalizedPaidBy)) {
      return res.status(400).json({ message: "paidBy must be company or self" });
    }

    const normalizedTokenAmount =
      tokenAmount == null || tokenAmount === "" ? 0 : Number(tokenAmount);
    if (!Number.isFinite(normalizedTokenAmount) || normalizedTokenAmount < 0) {
      return res.status(400).json({ message: "tokenAmount must be 0 or more" });
    }
    if (normalizedPaymentType === "token") {
      if (normalizedTokenAmount <= 0) {
        return res.status(400).json({ message: "tokenAmount is required for token payments" });
      }
      if (normalizedTokenAmount > totalAmount) {
        return res.status(400).json({ message: "tokenAmount cannot exceed total amount" });
      }
    }

    if (!voucherUrl || !String(voucherUrl).trim()) {
      return res.status(400).json({ message: "Bill image is required" });
    }

    const eventDoc = await Event.findById(eventId);
    if (!eventDoc || eventDoc.status !== "approved") {
      return res.status(404).json({ message: "Event not found or not approved" });
    }

    if (!employeeAssignedOnEvent(eventDoc, userId)) {
      return res.status(403).json({ message: "You are not assigned to this event" });
    }

    const normalizedParticulars = String(particulars || description || "").trim();
    if (!normalizedParticulars) {
      return res.status(400).json({ message: "particulars is required" });
    }

    bill.entityName = entityName;
    bill.amount = totalAmount;
    bill.event = eventId;
    bill.particulars = normalizedParticulars;
    bill.description = String(description || normalizedParticulars || "").trim();
    bill.category = category;
    bill.voucherUrl = String(voucherUrl).trim();
    bill.gstPercentage = normalizedGstPercentage;
    bill.gstAmount = (totalAmount * normalizedGstPercentage) / (100 + normalizedGstPercentage);
    bill.paymentType = normalizedPaymentType;
    bill.tokenAmount = normalizedPaymentType === "token" ? normalizedTokenAmount : 0;
    bill.paidBy = normalizedPaidBy;
    await bill.save();

    try {
      await syncBillsToGoogleSheet([bill], new Map([[String(eventDoc._id), eventDoc]]));
    } catch (syncError) {
      console.error("[Sheets Sync] employeeUpdateBill failed:", syncError.message);
    }

    const populated = await Bill.findById(bill._id)
      .populate("event", "activityName startDate budget")
      .populate("contactPerson", "name email");

    return res.status(200).json({
      message: "Bill updated successfully",
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.employeeCreatePaymentRequest = async (req, res) => {
  try {
    const userId = req.auth.id;
    const { title, amount, description, event: eventId, category } = req.body;

    if (!title || amount == null || !eventId) {
      return res.status(400).json({
        message: "title, amount, and event are required"
      });
    }

    if (category != null && category !== "" && !isTaskCategory(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const eventDoc = await Event.findById(eventId);
    if (!eventDoc || eventDoc.status !== "approved") {
      return res.status(404).json({ message: "Event not found or not approved" });
    }

    const cat = category || null;
    if (!cat) {
      return res.status(400).json({ message: "category is required for employee payment requests" });
    }

    if (!employeeAssignedOnEvent(eventDoc, userId)) {
      return res.status(403).json({
        message: "You are not assigned to this event"
      });
    }

    const pr = await PaymentRequest.create({
      title,
      amount,
      description: description || "",
      event: eventId,
      submittedBy: userId,
      category: cat,
      status: "pending"
    });

    const populated = await PaymentRequest.findById(pr._id)
      .populate("event", "activityName startDate budget")
      .populate("submittedBy", "name email");

    return res.status(201).json({
      message: "Payment request submitted",
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.employeeListPaymentRequests = async (req, res) => {
  try {
    const userId = req.auth.id;
    const items = await PaymentRequest.find({ submittedBy: userId })
      .populate("event", "activityName startDate status")
      .sort({ updatedAt: -1 });

    return res.status(200).json({ count: items.length, paymentRequests: items });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

