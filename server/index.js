import dns from "dns";

// Use public DNS resolvers for reliable MongoDB Atlas SRV resolution on Windows
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore if dns override fails in restricted environments
}

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { requireAuth, requireVerified } from "./middleware/auth.js";

import onboardingRouter from "./routes/onboarding.js";
import verificationRouter from "./routes/verification.js";
import documentsRouter from "./routes/documents.js";
import profileRouter from "./routes/profile.js";
import photosRouter from "./routes/photos.js";
import matchRouter from "./routes/match.js";
import interestRouter from "./routes/interest.js";
import chatRouter from "./routes/chat.js";

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

// Mount Platform Feature Routes
app.use("/api/onboarding", onboardingRouter);
app.use("/api/verification", verificationRouter);
app.use("/api/profile", profileRouter);
app.use("/api/match", matchRouter);
app.use("/api/interest", interestRouter);
app.use("/api/chat", chatRouter);

// Secure Private Document Handler & Public Photo Handler
app.use("/api/documents", documentsRouter);
app.use("/api/photos", photosRouter);

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log(`[Database] Successfully connected to MongoDB at ${MONGODB_URI}`);
  })
  .catch((err) => {
    console.error(`[Database Error] Primary MongoDB connection failed (${err.message}). Retrying...`);
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    mongoose
      .connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .then(() => console.log(`[Database] Successfully connected on retry to MongoDB at ${MONGODB_URI}`))
      .catch((e) => console.error(`[Database Critical Failure] Unable to connect to MongoDB: ${e.message}`));
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

// Sample Verified Route (Guarded by requireVerified middleware)
app.get("/api/verified-sample", requireVerified, (req, res) => {
  res.status(200).json({
    message: "Verified route accessed successfully! Platform verification confirmed.",
    user: req.user,
    platformVerification: req.user.platformVerification,
  });
});

app.listen(PORT, () => {
  console.log(`[Server] Server starting on http://localhost:${PORT}`);
  console.log(`[Server] Restricted CORS allowed origin: ${CLIENT_URL}`);
  console.log(`[Auth] BetterAuth endpoints mounted at /api/auth/*`);
  console.log(`[Onboarding] Onboarding endpoints mounted at /api/onboarding/*`);
  console.log(`[Verification] Verification endpoints mounted at /api/verification/*`);
  console.log(`[Profile] Lifestyle profile & landlord listing endpoints mounted at /api/profile/*`);
  console.log(`[Documents] Protected document endpoints mounted at /api/documents/*`);
  console.log(`[Photos] Public photo endpoints mounted at /api/photos/*`);
});
