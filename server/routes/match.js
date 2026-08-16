import express from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { requireVerified } from "../middleware/auth.js";
import MatchRequest from "../models/MatchRequest.js";
import LifestyleProfile from "../models/LifestyleProfile.js";
import LandlordListing from "../models/LandlordListing.js";
import { computeMatches } from "../services/matchingEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config();

const router = express.Router();
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/roomiematch";

/**
 * Helper to compare criteria objects for 24h caching
 */
function isSameCriteria(c1, c2) {
  if (!c1 || !c2) return false;
  const keysToCompare = [
    "city",
    "locality",
    "budgetMin",
    "budgetMax",
    "rent",
    "roomType",
    "gender",
    "genderPreference",
    "sleepSchedule",
    "cleanliness",
    "smokingDrinking",
    "foodPreference",
    "guestsFrequency",
  ];

  for (const key of keysToCompare) {
    if (c1[key] !== undefined || c2[key] !== undefined) {
      if (String(c1[key] ?? "").toLowerCase().trim() !== String(c2[key] ?? "").toLowerCase().trim()) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Helper to retrieve active & verified user records from BetterAuth collection
 */
async function getVerifiedUsersMap() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  const collections = await db.listCollections().toArray();
  const collectionName = collections.some((c) => c.name === "user") ? "user" : "users";

  const rawUsers = await db.collection(collectionName).find().toArray();
  await client.close();

  const verifiedUserMap = new Map();
  for (const u of rawUsers) {
    const userIdStr = String(u.id || u._id);
    const isVerified = u.platformVerification?.status === "verified";
    const isActive = !u.accountStatus || u.accountStatus === "active";

    if (isVerified && isActive) {
      verifiedUserMap.set(userIdStr, {
        id: userIdStr,
        name: u.name || "Verified User",
        role: u.role,
        platformVerification: u.platformVerification,
        accountStatus: u.accountStatus || "active",
      });
    }
  }
  return verifiedUserMap;
}

/**
 * POST /api/match/request
 * Requirement form submission -> candidate pool scoring -> 24h caching -> top 3 matches
 * Protected by requireVerified (user must be logged in & platform-verified)
 */
router.post("/request", requireVerified, async (req, res) => {
  try {
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    // Extract input criteria
    const rawCriteria = req.body.criteria || req.body || {};
    const forceRecompute = Boolean(req.query.recompute || req.body.forceRecompute);

    // Derive requesterType ("seeker" matching against space holders/listings, or "spaceHolder" matching against seekers)
    const requesterType =
      req.body.requesterType ||
      (requesterRole === "seeker" ? "seeker" : "spaceHolder");

    // Fetch user's saved profile / listing directly as the criteria source of truth
    let sourceDocument = null;
    if (requesterRole === "landlord") {
      sourceDocument = await LandlordListing.findOne({ landlordId: requesterId });
      if (!sourceDocument) {
        return res.status(400).json({
          error: "Listing Required",
          message: "Please create a Landlord Property Listing before requesting matches.",
        });
      }
    } else {
      sourceDocument = await LifestyleProfile.findOne({ userId: requesterId });
      if (!sourceDocument) {
        return res.status(400).json({
          error: "Profile Required",
          message: "Please complete your Lifestyle Profile before requesting matches.",
        });
      }
    }

    let requesterCriteria = {
      ...sourceDocument.toObject(),
      userId: requesterId,
      accountStatus: req.user.accountStatus || "active",
      platformVerification: req.user.platformVerification || { status: "verified" },
      gender: sourceDocument.gender || req.user.gender || "any",
      genderPreference: sourceDocument.genderPreference || "no_preference",
    };

    // 1. Check 24h Cache (PRD §8.3)
    if (!forceRecompute) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const cachedRequest = await MatchRequest.findOne({
        requesterId,
        createdAt: { $gte: twentyFourHoursAgo },
      }).sort({ createdAt: -1 });

      if (cachedRequest && isSameCriteria(cachedRequest.criteria, requesterCriteria)) {
        return res.status(200).json({
          message: "Retrieved cached 24h match results",
          isCached: true,
          matchRequest: cachedRequest,
        });
      }
    }

    // 2. Fetch verified candidates pool
    const verifiedUserMap = await getVerifiedUsersMap();
    let candidatesPool = [];

    if (requesterType === "seeker") {
      // Seekers match against:
      // a) Active Landlord Listings
      const activeListings = await LandlordListing.find({ status: "active" }).lean();
      for (const listing of activeListings) {
        const landlordUser = verifiedUserMap.get(String(listing.landlordId));
        if (landlordUser) {
          // If landlord listing has linked tenants, fetch their profiles for blended 50/50 scoring
          let linkedTenantProfiles = [];
          if (Array.isArray(listing.linkedTenantIds) && listing.linkedTenantIds.length > 0) {
            linkedTenantProfiles = await LifestyleProfile.find({
              userId: { $in: listing.linkedTenantIds },
            }).lean();
          }

          candidatesPool.push({
            ...listing,
            candidateType: "landlordListing",
            user: landlordUser,
            linkedTenantProfiles,
          });
        }
      }

      // b) LifestyleProfiles of Resident Space-holders (must have an active room vacancy with rent > 0)
      const residentProfiles = await LifestyleProfile.find().lean();
      for (const prof of residentProfiles) {
        const resUser = verifiedUserMap.get(String(prof.userId));
        const hasVacancy = prof.rent !== undefined && prof.rent !== null && Number(prof.rent) > 0;

        if (resUser && resUser.role === "resident" && hasVacancy && String(prof.userId) !== String(requesterId)) {
          candidatesPool.push({
            ...prof,
            candidateType: "lifestyleProfile",
            user: resUser,
          });
        }
      }
    } else {
      // Space-Holders / Landlords match against Seekers
      const seekerProfiles = await LifestyleProfile.find().lean();
      for (const prof of seekerProfiles) {
        const seekerUser = verifiedUserMap.get(String(prof.userId));
        if (seekerUser && seekerUser.role === "seeker" && String(prof.userId) !== String(requesterId)) {
          candidatesPool.push({
            ...prof,
            candidateType: "lifestyleProfile",
            user: seekerUser,
          });
        }
      }
    }

    // 3. Execute Pure Matching Engine Scoring
    const matchOutput = computeMatches(requesterCriteria, candidatesPool);

    // 4. Format Results with PRIVACY-FILTERED candidateSnapshot (EXCLUDES EMAIL & PHONE)
    const formattedResults = matchOutput.results.map((resItem) => {
      const candidateObj = resItem.candidate;
      const candidateType = candidateObj.candidateType || "lifestyleProfile";
      const candidateUser = candidateObj.user || {};

      let candidateSnapshot = {};

      if (candidateType === "lifestyleProfile") {
        candidateSnapshot = {
          candidateId: String(candidateObj.userId || candidateObj._id),
          candidateType: "lifestyleProfile",
          name: candidateUser.name || "Verified User",
          role: candidateUser.role || "seeker",
          gender: candidateObj.gender || "unspecified",
          city: candidateObj.city || "",
          locality: candidateObj.locality || "",
          budgetMin: candidateObj.budgetMin,
          budgetMax: candidateObj.budgetMax,
          rent: candidateObj.rent,
          roomType: candidateObj.roomType,
          sleepSchedule: candidateObj.sleepSchedule,
          cleanliness: candidateObj.cleanliness,
          smokingDrinking: candidateObj.smokingDrinking,
          foodPreference: candidateObj.foodPreference,
          guestsFrequency: candidateObj.guestsFrequency,
          bio: candidateObj.bio || "",
          photoUrl: candidateObj.photoUrl || "",
        };
      } else {
        candidateSnapshot = {
          candidateId: String(candidateObj._id),
          candidateType: "landlordListing",
          title: `${candidateObj.roomType ? candidateObj.roomType.replace("_", " ").toUpperCase() : "Listing"} in ${candidateObj.locality || candidateObj.city}`,
          landlordName: candidateUser.name || "Verified Landlord",
          city: candidateObj.city || "",
          locality: candidateObj.locality || "",
          rent: candidateObj.rent,
          roomType: candidateObj.roomType,
          genderPreference: candidateObj.genderPreference,
          houseRules: candidateObj.houseRules || {},
          photoUrls: candidateObj.photoUrls || [],
          status: candidateObj.status || "active",
        };
      }

      // Explicit privacy assurance check
      delete candidateSnapshot.email;
      delete candidateSnapshot.phone;
      delete candidateSnapshot.collegeEmail;
      delete candidateSnapshot.idDocumentUrl;

      return {
        candidateId: String(resItem.candidateId),
        candidateType,
        score: resItem.score,
        normalizedScore: resItem.normalizedScore,
        maxApplicablePoints: resItem.maxApplicablePoints,
        factorCoverage: resItem.factorCoverage,
        breakdown: resItem.breakdown,
        candidateSnapshot,
      };
    });

    // 5. Store MatchRequest Document in MongoDB
    const newMatchRequest = new MatchRequest({
      requesterId,
      requesterType,
      criteria: requesterCriteria,
      results: formattedResults,
      totalEligibleCount: matchOutput.totalEligibleCount,
      message: matchOutput.message || "",
    });

    await newMatchRequest.save();

    return res.status(201).json({
      message: "Top matches calculated successfully",
      isCached: false,
      matchRequest: newMatchRequest,
    });
  } catch (err) {
    console.error("[Match Request API Error]:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

/**
 * GET /api/match/history/latest
 * Retrieve the latest match request for current user
 */
router.get("/history/latest", requireVerified, async (req, res) => {
  try {
    const latestRequest = await MatchRequest.findOne({ requesterId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ matchRequest: latestRequest || null });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

/**
 * GET /api/match/:matchRequestId
 * Retrieve past match results document by ID
 */
router.get("/:matchRequestId", requireVerified, async (req, res) => {
  try {
    const matchRequest = await MatchRequest.findById(req.params.matchRequestId);
    if (!matchRequest) {
      return res.status(404).json({ error: "Not Found", message: "Match request not found." });
    }

    if (String(matchRequest.requesterId) !== String(req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden", message: "Access denied to this match request." });
    }

    return res.status(200).json({ matchRequest });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

export default router;
