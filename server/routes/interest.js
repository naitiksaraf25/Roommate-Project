import express from "express";
import { requireAuth, requireVerified } from "../middleware/auth.js";
import { MatchInterest } from "../models/MatchInterest.js";
import { Chat } from "../models/Chat.js";
import { LandlordListing } from "../models/LandlordListing.js";

const router = express.Router();

// Helper to resolve candidate target ID (handles both user IDs and landlord listing IDs)
async function resolveToUserId(targetId) {
  if (!targetId) return null;
  // If targetId is a valid Mongo ObjectId, check if it's a LandlordListing
  if (targetId.length === 24) {
    const listing = await LandlordListing.findById(targetId).lean();
    if (listing && listing.landlordId) {
      return String(listing.landlordId);
    }
  }
  return String(targetId);
}

/**
 * POST /api/interest
 * Express interest in a candidate (or landlord listing).
 * Idempotent, creates mutual match and deduped chat document if reverse interest exists.
 * Protected by requireAuth + requireVerified per PRD §5.4 US-10.
 */
router.post("/", requireAuth, requireVerified, async (req, res) => {
  try {
    const fromUserId = String(req.user.id);
    const rawTargetId = req.body.toUserId || req.body.targetId;

    if (!rawTargetId) {
      return res.status(400).json({ error: "Bad Request", message: "toUserId or targetId is required." });
    }

    const toUserId = await resolveToUserId(rawTargetId);

    // Self-interest protection
    if (fromUserId === toUserId) {
      return res.status(400).json({ error: "Bad Request", message: "You cannot express interest in yourself." });
    }

    // 1. Idempotency Edge Case #1: Check if direct interest already exists
    const existingDirectInterest = await MatchInterest.findOne({ fromUserId, toUserId });
    if (existingDirectInterest) {
      let chatDoc = null;
      if (existingDirectInterest.status === "matched") {
        chatDoc = await Chat.findOne({
          participantIds: { $all: [fromUserId, toUserId], $size: 2 },
        });
      }
      return res.status(200).json({
        isMutualMatch: existingDirectInterest.status === "matched",
        status: existingDirectInterest.status,
        message:
          existingDirectInterest.status === "matched"
            ? "Already mutually matched!"
            : "Interest already expressed.",
        interest: existingDirectInterest,
        chat: chatDoc,
      });
    }

    // 2. Check if reverse interest exists (toUserId -> fromUserId)
    const reverseInterest = await MatchInterest.findOne({ fromUserId: toUserId, toUserId: fromUserId });

    if (reverseInterest) {
      // Reverse interest exists! This creates a MUTUAL MATCH
      reverseInterest.status = "matched";
      await reverseInterest.save();

      // Create/update direct interest with status "matched"
      const directInterest = await MatchInterest.findOneAndUpdate(
        { fromUserId, toUserId },
        { status: "matched" },
        { upsert: true, new: true }
      );

      // Idempotency Edge Case #2: Reuse existing chat or create new deduped chat document
      let chatDoc = await Chat.findOne({
        participantIds: { $all: [fromUserId, toUserId], $size: 2 },
      });

      if (!chatDoc) {
        chatDoc = new Chat({
          participantIds: [fromUserId, toUserId],
          matchInterestId: String(directInterest._id),
        });
        await chatDoc.save();
      }

      return res.status(201).json({
        isMutualMatch: true,
        status: "matched",
        message: "🎉 It's a Mutual Match!",
        interest: directInterest,
        chat: chatDoc,
      });
    }

    // 3. No reverse interest yet: Record pending interest
    const directInterest = new MatchInterest({
      fromUserId,
      toUserId,
      status: "pending",
    });
    await directInterest.save();

    return res.status(201).json({
      isMutualMatch: false,
      status: "pending",
      message: "Interest expressed! Waiting for candidate response.",
      interest: directInterest,
    });
  } catch (err) {
    // Gracefully handle MongoDB duplicate key error (code 11000) if race condition occurs
    if (err.code === 11000) {
      const existing = await MatchInterest.findOne({
        fromUserId: String(req.user.id),
        toUserId: await resolveToUserId(req.body.toUserId || req.body.targetId),
      });
      return res.status(200).json({
        isMutualMatch: existing?.status === "matched",
        status: existing?.status || "pending",
        message: "Interest record updated.",
        interest: existing,
      });
    }
    console.error("[POST /api/interest Error]:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

/**
 * GET /api/interest/status/:targetId
 * Check interest status between current user and a candidate user/listing
 * Protected by requireAuth + requireVerified
 */
router.get("/status/:targetId", requireAuth, requireVerified, async (req, res) => {
  try {
    const fromUserId = String(req.user.id);
    const toUserId = await resolveToUserId(req.params.targetId);

    const directInterest = await MatchInterest.findOne({ fromUserId, toUserId }).lean();
    const reverseInterest = await MatchInterest.findOne({ fromUserId: toUserId, toUserId: fromUserId }).lean();

    if (directInterest) {
      return res.status(200).json({
        status: directInterest.status,
        isMutualMatch: directInterest.status === "matched",
        expressedAt: directInterest.createdAt,
      });
    }

    if (reverseInterest) {
      return res.status(200).json({
        status: "none",
        reverseInterestPending: reverseInterest.status === "pending",
        isMutualMatch: false,
      });
    }

    return res.status(200).json({
      status: "none",
      isMutualMatch: false,
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

/**
 * GET /api/interest/my-interests
 * Retrieve all sent, received, and mutual match interests for current user
 */
router.get("/my-interests", requireAuth, requireVerified, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const sent = await MatchInterest.find({ fromUserId: userId }).lean();
    const received = await MatchInterest.find({ toUserId: userId }).lean();

    const mutualMatches = sent.filter((s) => s.status === "matched");

    return res.status(200).json({
      sent,
      received,
      mutualMatches,
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

export default router;
