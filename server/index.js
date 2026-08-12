import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { requireAuth } from "./middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (check root .env first, fallback to current dir .env)
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/roomiematch";

// CORS configuration with explicit allowed origin
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

// Mount BetterAuth Express Handler at /api/auth/*
app.all("/api/auth/*", toNodeHandler(auth));

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
  .then(() => {
    console.log(`[Database] Successfully connected to MongoDB at ${MONGODB_URI}`);
  })
  .catch((err) => {
    console.warn(`[Database] Primary MongoDB connection failed (${err.message}). Connecting to local fallback...`);
    mongoose
      .connect("mongodb://127.0.0.1:27017/roomiematch")
      .then(() => console.log(`[Database] Successfully connected to fallback local MongoDB.`))
      .catch((e) => console.error(`[Database] Local fallback MongoDB error: ${e.message}`));
  });

// Health check endpoint
app.get("/api/health", (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mongodb: isConnected ? "connected" : "disconnected",
    message: "RoomieMatch Server is up and running.",
  });
});

// Sample Protected Route (Guarded by requireAuth middleware)
app.get("/api/protected-sample", requireAuth, (req, res) => {
  res.status(200).json({
    message: "Protected route accessed successfully!",
    user: req.user,
    session: req.session,
  });
});

app.listen(PORT, () => {
  console.log(`[Server] Server starting on http://localhost:${PORT}`);
  console.log(`[Server] Restricted CORS allowed origin: ${CLIENT_URL}`);
  console.log(`[Auth] BetterAuth endpoints mounted at /api/auth/*`);
});
