import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { requireAuth } from "../middleware/auth.js";
import LifestyleProfile from "../models/LifestyleProfile.js";
import LandlordListing from "../models/LandlordListing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config();

const router = express.Router();
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/roomiematch";

// Photo storage directory
const photosDir = path.join(__dirname, "../uploads/photos");
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, photosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const prefix = req.user?.id || "user";
    cb(null, `photo_${prefix}_${Date.now()}_${Math.round(Math.random() * 1e4)}${ext}`);
  },
});

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error("Only image files (JPG, PNG, WEBP) are allowed for photos"));
  },
});

/**
 * GET /api/profile/lifestyle
 * Fetch lifestyle profile for current user
 */
router.get("/lifestyle", requireAuth, async (req, res) => {
  try {
    const profile = await LifestyleProfile.findOne({ userId: req.user.id });
    return res.status(200).json({ profile: profile || null });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

/**
 * POST /api/profile/lifestyle
 * Create or update lifestyle profile for Seeker or Resident
 */
router.post("/lifestyle", requireAuth, (req, res) => {
  if (req.user?.role !== "seeker" && req.user?.role !== "resident") {
    return res.status(403).json({
      error: "Forbidden",
      message: `Role mismatch. Your account role is '${req.user?.role || "unset"}', but lifestyle profiles are only for Seekers or Resident space-holders.`,
    });
  }

  uploadPhoto.single("photo")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: "Photo Upload Error", message: err.message });
    }

    try {
      const {
        city,
        locality,
        budgetMin,
        budgetMax,
        gender,
        genderPreference,
        sleepSchedule,
        cleanliness,
        smokingDrinking,
        foodPreference,
        guestsFrequency,
        bio,
      } = req.body;

      // Validation
      const errors = [];
      if (!city) errors.push("City is required");
      if (budgetMin === undefined || budgetMin === "") errors.push("Minimum budget is required");
      if (budgetMax === undefined || budgetMax === "") errors.push("Maximum budget is required");
      if (!gender) errors.push("Gender is required");
      if (!genderPreference) errors.push("Gender preference is required");
      if (!sleepSchedule) errors.push("Sleep schedule is required");
      if (cleanliness === undefined || cleanliness === "") errors.push("Cleanliness level (1-5) is required");
      if (!smokingDrinking) errors.push("Smoking/drinking preference is required");
      if (!foodPreference) errors.push("Food preference is required");
      if (!guestsFrequency) errors.push("Guests frequency is required");
      if (bio && bio.length > 300) errors.push("Bio cannot exceed 300 characters");

      if (errors.length > 0) {
        return res.status(400).json({
          error: "Validation Error",
          message: "Please fill out all required fields",
          details: errors,
        });
      }

      let photoUrl = req.body.existingPhotoUrl || "";
      if (req.file) {
        photoUrl = `/api/photos/${req.file.filename}`;
      }

      const updateData = {
        userId: req.user.id,
        city: city.trim(),
        locality: locality ? locality.trim() : "",
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
        gender,
        genderPreference,
        sleepSchedule,
        cleanliness: Number(cleanliness),
        smokingDrinking,
        foodPreference,
        guestsFrequency,
        bio: bio ? bio.trim() : "",
        photoUrl,
      };

      const profile = await LifestyleProfile.findOneAndUpdate(
        { userId: req.user.id },
        updateData,
        { upsert: true, new: true, runValidators: true }
      );

      return res.status(200).json({
        message: "Lifestyle profile saved successfully",
        profile,
      });
    } catch (dbErr) {
      console.error("[Lifestyle Profile Save Error]:", dbErr);
      return res.status(500).json({ error: "Database Error", message: dbErr.message });
    }
  });
});

/**
 * GET /api/profile/landlord-listing
 * Fetch landlord listing for current landlord
 */
router.get("/landlord-listing", requireAuth, async (req, res) => {
  try {
    const listing = await LandlordListing.findOne({ landlordId: req.user.id });
    return res.status(200).json({ listing: listing || null });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

/**
 * POST /api/profile/landlord-listing
 * Create or update landlord listing for Landlords
 */
router.post("/landlord-listing", requireAuth, (req, res) => {
  if (req.user?.role !== "landlord") {
    return res.status(403).json({
      error: "Forbidden",
      message: `Role mismatch. Your account role is '${req.user?.role || "unset"}', but property listings are only for Landlords.`,
    });
  }

  uploadPhoto.array("photos", 5)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: "Photos Upload Error", message: err.message });
    }

    try {
      const { city, locality, rent, roomType, genderPreference, houseRules, linkedTenantIds, status } = req.body;

      let parsedRules = houseRules;
      if (typeof houseRules === "string") {
        try {
          parsedRules = JSON.parse(houseRules);
        } catch (e) {
          parsedRules = {};
        }
      }

      let parsedTenants = linkedTenantIds;
      if (typeof linkedTenantIds === "string") {
        try {
          parsedTenants = JSON.parse(linkedTenantIds);
        } catch (e) {
          parsedTenants = [];
        }
      }

      // Validation
      const errors = [];
      if (!city) errors.push("City is required");
      if (!locality) errors.push("Locality is required");
      if (rent === undefined || rent === "") errors.push("Rent amount is required");
      if (!roomType) errors.push("Room type is required");
      if (!genderPreference) errors.push("Gender preference is required");
      if (!parsedRules || typeof parsedRules !== "object") errors.push("House rules object is required");
      if (!parsedRules?.guestPolicy) errors.push("House rule: guest policy is required");
      if (!parsedRules?.curfew) errors.push("House rule: curfew rule is required");

      if (errors.length > 0) {
        return res.status(400).json({
          error: "Validation Error",
          message: "Please fill out all required listing fields",
          details: errors,
        });
      }

      let photoUrls = [];
      if (req.body.existingPhotoUrls) {
        photoUrls = Array.isArray(req.body.existingPhotoUrls)
          ? req.body.existingPhotoUrls
          : [req.body.existingPhotoUrls];
      }

      if (req.files && req.files.length > 0) {
        const newUrls = req.files.map((f) => `/api/photos/${f.filename}`);
        photoUrls = [...photoUrls, ...newUrls];
      }

      const updateData = {
        landlordId: req.user.id,
        city: city.trim(),
        locality: locality.trim(),
        rent: Number(rent),
        roomType,
        genderPreference,
        houseRules: {
          smokingAllowed: Boolean(parsedRules.smokingAllowed),
          drinkingAllowed: Boolean(parsedRules.drinkingAllowed),
          petsAllowed: Boolean(parsedRules.petsAllowed),
          guestPolicy: parsedRules.guestPolicy,
          curfew: parsedRules.curfew,
        },
        linkedTenantIds: Array.isArray(parsedTenants) ? parsedTenants : [],
        photoUrls,
        status: status || "active",
      };

      const listing = await LandlordListing.findOneAndUpdate(
        { landlordId: req.user.id },
        updateData,
        { upsert: true, new: true, runValidators: true }
      );

      return res.status(200).json({
        message: "Landlord property listing saved successfully",
        listing,
      });
    } catch (dbErr) {
      console.error("[Landlord Listing Save Error]:", dbErr);
      return res.status(500).json({ error: "Database Error", message: dbErr.message });
    }
  });
});

/**
 * GET /api/profile/search-residents
 * Helper for landlords to search resident users by exact email address.
 * Enforces strict exact match and returns minimal masked identity fields for privacy protection.
 */
router.get("/search-residents", requireAuth, async (req, res) => {
  try {
    const rawEmail = req.query.email;
    if (!rawEmail || typeof rawEmail !== "string" || !rawEmail.trim()) {
      return res.status(400).json({
        error: "Missing Email",
        message: "Please provide an exact email address query parameter (e.g. ?email=resident@example.com).",
      });
    }

    const targetEmail = rawEmail.trim().toLowerCase();

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();

    const collections = await db.listCollections().toArray();
    const collectionName = collections.some((c) => c.name === "user") ? "user" : "users";

    const user = await db.collection(collectionName).findOne({
      email: targetEmail,
      role: "resident",
    });

    await client.close();

    if (!user) {
      return res.status(404).json({
        found: false,
        message: "No verified Resident user found with that exact email address.",
      });
    }

    // Mask email for privacy (e.g. "john.doe@gmail.com" -> "j***e@gmail.com")
    const parts = user.email.split("@");
    const namePart = parts[0];
    const maskedName = namePart.length > 2 ? `${namePart[0]}***${namePart[namePart.length - 1]}` : `${namePart[0]}***`;
    const maskedEmail = `${maskedName}@${parts[1]}`;

    return res.status(200).json({
      found: true,
      resident: {
        id: user.id || user._id,
        name: user.name || "Resident User",
        maskedEmail,
        role: "resident",
        platformVerified: user.platformVerification?.status === "verified",
      },
    });
  } catch (err) {
    console.error("[Search Residents Error]:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

export default router;
