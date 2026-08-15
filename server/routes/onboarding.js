import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config();

const router = express.Router();
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/roomiematch";

// Placeholder Allowlist of College Domains for Launch City
export const COLLEGE_ALLOWLIST = [
  "stanford.edu",
  "mit.edu",
  "harvard.edu",
  "berkeley.edu",
  "nyu.edu",
  "iit.ac.in",
  "du.ac.in",
  "bits-pilani.ac.in",
  "college.edu",
  "university.edu"
];

// Helper to update user in MongoDB directly
async function updateUserRecord(user, updateFields) {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  
  const collections = await db.listCollections().toArray();
  const collectionName = collections.some(c => c.name === "user") ? "user" : "users";

  const userId = user.id || user._id;
  const filter = { $or: [{ _id: userId }, { id: userId }, { email: user.email }] };

  await db.collection(collectionName).updateOne(
    filter,
    { $set: updateFields }
  );

  const updatedUser = await db.collection(collectionName).findOne(filter);
  await client.close();

  if (updatedUser && !updatedUser.id) {
    updatedUser.id = updatedUser._id;
  }
  return updatedUser;
}

/**
 * POST /api/onboarding/role
 * Sets the user role after initial authentication.
 */
router.post("/role", requireAuth, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ["seeker", "resident", "landlord"];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        error: "Invalid Role",
        message: "Role must be one of: seeker, resident, landlord",
      });
    }

    const email = req.user.email || "";
    const emailDomain = email.split("@")[1]?.toLowerCase() || "";
    let platformVerification = req.user.platformVerification || { status: "pending" };

    if (role === "seeker" || role === "resident") {
      const isAutoVerified = COLLEGE_ALLOWLIST.some((domain) => emailDomain === domain || emailDomain.endsWith("." + domain));
      if (isAutoVerified) {
        platformVerification = {
          status: "verified",
          method: "college_email",
          collegeEmail: email,
          verifiedAt: new Date().toISOString(),
        };
      } else {
        platformVerification = {
          status: "pending",
          method: "college_email",
          collegeEmail: null,
        };
      }
    } else if (role === "landlord") {
      platformVerification = {
        status: "pending",
        method: "government_id",
        idDocumentUrl: req.user.platformVerification?.idDocumentUrl || null,
      };
    }

    const updatedUser = await updateUserRecord(req.user, {
      role,
      platformVerification,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      message: "Role and initial verification status set successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("[Onboarding Role Error]:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

export default router;
