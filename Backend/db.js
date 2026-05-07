const mongoose = require("mongoose");

const connectDB = async () => {
  const DB_URL =
    process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/EventManagementSystem";
  const maxRetries = Number(process.env.DB_CONNECT_RETRIES || 5);
  let attempt = 0;

  try {
    while (attempt < maxRetries) {
      try {
        attempt += 1;
        await mongoose.connect(DB_URL, {
          serverSelectionTimeoutMS: 8000
        });
        console.log(`Connected to MongoDB (attempt ${attempt})`);
        return;
      } catch (error) {
        const message = String(error?.message || error);
        console.error(`[DB] Connection attempt ${attempt}/${maxRetries} failed: ${message}`);
        if (attempt >= maxRetries) {
          console.error(
            "[DB] Mongo connection failed. Verify DATABASE_URL or ensure local MongoDB service is running."
          );
          process.exit(1);
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  } catch (error) {
    console.error("[DB] Fatal connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;