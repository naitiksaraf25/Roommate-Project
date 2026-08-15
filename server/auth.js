import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";

// Use public DNS resolvers for reliable MongoDB Atlas SRV resolution on Windows
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore if dns override fails in specific restricted environments
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/roomiematch";
let client;
try {
  client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  console.log(`[Auth DB] Connected to MongoDB at ${MONGODB_URI}`);
} catch (err) {
  console.warn(`[Auth DB] Failed to connect to primary MONGODB_URI (${err.message}). Falling back to local MongoDB mongodb://127.0.0.1:27017/roomiematch`);
  client = new MongoClient("mongodb://127.0.0.1:27017/roomiematch");
  await client.connect();
  console.log(`[Auth DB] Connected to fallback local MongoDB.`);
}
const db = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    transaction: false, // Disabled for standalone MongoDB compatibility
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendVerificationEmail: async ({ user, url, token }, request) => {
      console.log("==================================================");
      console.log(`[DEV EMAIL SENDER] Verification email for: ${user.email}`);
      console.log(`Verification URL: ${url}`);
      console.log(`Verification Token: ${token}`);
      console.log("==================================================");
    },
    sendResetPassword: async ({ user, url, token }, request) => {
      console.log("==================================================");
      console.log(`[DEV EMAIL SENDER] Password Reset email for: ${user.email}`);
      console.log(`Reset Password URL: ${url}`);
      console.log(`Reset Token: ${token}`);
      console.log("==================================================");
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "placeholder_google_client_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder_google_client_secret",
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
      },
      accountStatus: {
        type: "string",
        required: false,
        defaultValue: "active",
      },
      platformVerification: {
        type: "object",
        required: false,
      },
    },
  },
  trustedOrigins: [process.env.CLIENT_URL || "http://localhost:5173"],
});
