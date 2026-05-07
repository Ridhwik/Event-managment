const jwt = require("jsonwebtoken");

exports.authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
};

exports.requireAdmin = (req, res, next) => {
  if (!req.auth || req.auth.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: admin only" });
  }

  req.admin = { id: req.auth.id, role: req.auth.role };
  next();
};

exports.requireDirectorOrTeamLeader = (req, res, next) => {
  if (!req.auth || !["director", "teamLeader"].includes(req.auth.role)) {
    return res
      .status(403)
      .json({ message: "Forbidden: director or team leader only" });
  }

  req.user = { id: req.auth.id, role: req.auth.role };
  next();
};

/** Only User accounts with role `director` (not Admin JWT). */
exports.requireDirector = (req, res, next) => {
  if (!req.auth || req.auth.role !== "director") {
    return res.status(403).json({ message: "Forbidden: director only" });
  }
  req.user = { id: req.auth.id, role: req.auth.role };
  next();
};

exports.requireTeamLeader = (req, res, next) => {
  if (!req.auth || req.auth.role !== "teamLeader") {
    return res.status(403).json({ message: "Forbidden: team leader only" });
  }
  req.user = { id: req.auth.id, role: req.auth.role };
  next();
};

exports.requireEmployee = (req, res, next) => {
  if (!req.auth || req.auth.role !== "employee") {
    return res.status(403).json({ message: "Forbidden: employee only" });
  }
  req.user = { id: req.auth.id, role: req.auth.role };
  next();
};

exports.requireRoles = (roles = []) => {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({
        message: `Forbidden: allowed roles are ${roles.join(", ")}`
      });
    }

    next();
  };
};
