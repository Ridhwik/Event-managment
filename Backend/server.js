const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./db");
const adminRoutes = require("./Routes/AdminRoutes");
const userRoutes = require("./Routes/UserRoutes");
const billRoutes = require("./Routes/BillRoutes");

// Backend/.env then repo root .env (root wins on duplicate keys)
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  override: true
});

if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).trim() === "") {
  console.error(
    "\n[Config] JWT_SECRET is missing or empty.\n" +
      "Add to .env in the project folder OR in Backend/.env, for example:\n" +
      "  JWT_SECRET=your-long-random-string-at-least-32-characters\n"
  );
  process.exit(1);
}

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const localhostDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (origin === clientOrigin || localhostDev.test(origin)) {
        return callback(null, origin);
      }
      callback(null, false);
    },
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));

connectDB();

app.get("/", (req, res) => {
    res.send("response.....");
});

app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/bills", billRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});