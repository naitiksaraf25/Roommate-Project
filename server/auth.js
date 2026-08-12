import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/roomiematch";
const client = new MongoClient(MONGODB_URI);
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
        defaultValue: "seeker",
      },
      accountStatus: {
        type: "string",
        required: false,
        defaultValue: "active",
      },
      platformVerificationStatus: {
        type: "string",
        required: false,
        defaultValue: "pending",
      },
    },
  },
  trustedOrigins: [process.env.CLIENT_URL || "http://localhost:5173"],
});
