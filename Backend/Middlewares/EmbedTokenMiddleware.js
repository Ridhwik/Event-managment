const jwt = require("jsonwebtoken");

function verifyEmbedToken(req, res, next) {
  const token = String(req.query.embedToken || "").trim();
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: embed token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || decoded.typ !== "sheet_embed") {
      return res.status(401).json({ message: "Unauthorized: invalid embed token" });
    }
    req.embed = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized: invalid embed token" });
  }
}

module.exports = { verifyEmbedToken };

