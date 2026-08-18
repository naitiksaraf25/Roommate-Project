import express from "express";
import mongoose from "mongoose";
import { requireAuth, requireVerified } from "../middleware/auth.js";
import { Chat } from "../models/Chat.js";
import { Message } from "../models/Message.js";
import { LifestyleProfile } from "../models/LifestyleProfile.js";
import { LandlordListing } from "../models/LandlordListing.js";

const router = express.Router();

/**
 * Helper to fetch candidate display info for chat list/headers.
 * STRICT PRIVACY WHITELIST:
 * Only public profile fields are returned.
 * Email, phone, collegeEmail, idDocumentUrl are STRICTLY EXCLUDED.
 */
async function getCandidatePublicInfo(participantId) {
  if (!participantId) return null;

  // 1. Check if participant has a LifestyleProfile (Seeker/Resident)
  const lifestyle = await LifestyleProfile.findOne({ userId: String(participantId) }).lean();
  if (lifestyle) {
    return {
      candidateId: String(participantId),
      userId: String(participantId),
      name: lifestyle.name || "Verified Student",
      photoUrl: lifestyle.photoUrl || null,
      city: lifestyle.city || null,
      locality: lifestyle.locality || null,
      role: lifestyle.role || "seeker",
      gender: lifestyle.gender || null,
    };
  }

  // 2. Check if participant has a LandlordListing
  const listing = await LandlordListing.findOne({ landlordId: String(participantId) }).lean();
  if (listing) {
    return {
      candidateId: String(participantId),
      userId: String(participantId),
      name: listing.title || listing.landlordName || "Property Host",
      photoUrl: Array.isArray(listing.photoUrls) && listing.photoUrls.length > 0 ? listing.photoUrls[0] : null,
      city: listing.city || null,
      locality: listing.locality || null,
      role: "landlord",
      roomType: listing.roomType || null,
      rent: listing.rent || null,
    };
  }

  // Fallback for user without completed profile yet
  return {
    candidateId: String(participantId),
    userId: String(participantId),
    name: "RoomieMatch User",
    photoUrl: null,
    role: "user",
  };
}

/**
 * GET /api/chat/list
 * Returns all active matched chats the requesting user is a participant in.
 * Protected by requireAuth + requireVerified per PRD §5.4 / §7.
 */
router.get("/list", requireAuth, requireVerified, async (req, res) => {
  try {
    const currentUserId = String(req.user.id);

    // Find all chats where user is a participant
    const chats = await Chat.find({ participantIds: currentUserId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const formattedChats = await Promise.all(
      chats.map(async (chat) => {
        const otherParticipantId = chat.participantIds.find((id) => String(id) !== currentUserId);
        const candidateInfo = await getCandidatePublicInfo(otherParticipantId);

        // Fetch last message for snippet preview
        const lastMessage = await Message.findOne({ chatId: chat._id })
          .sort({ sentAt: -1 })
          .lean();

        // Count unread messages for current user
        const unreadCount = await Message.countDocuments({
          chatId: chat._id,
          senderId: { $ne: currentUserId },
          readAt: null,
        });

        return {
          _id: chat._id,
          participantIds: chat.participantIds,
          otherParticipant: candidateInfo,
          lastMessage: lastMessage
            ? {
                text: lastMessage.text,
                senderId: lastMessage.senderId,
                sentAt: lastMessage.sentAt,
              }
            : null,
          unreadCount,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        };
      })
    );

    return res.status(200).json({ chats: formattedChats });
  } catch (err) {
    console.error("[GET /api/chat/list Error]:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

/**
 * GET /api/chat/:chatId/messages
 * Retrieves message thread history for a given chatId.
 * Protected by requireAuth + requireVerified.
 * ENFORCES PARTICIPANT CHECK: Returns 403 Forbidden (or 404) if user is not a participant.
 */
router.get("/:chatId/messages", requireAuth, requireVerified, async (req, res) => {
  try {
    const { chatId } = req.params;
    const currentUserId = String(req.user.id);

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(404).json({ error: "Not Found", message: "Chat not found." });
    }

    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      return res.status(404).json({ error: "Not Found", message: "Chat not found." });
    }

    // 🔒 PARTICIPANT AUTHORIZATION CHECK (PRD US-11 & prompt item 1)
    const isParticipant = chat.participantIds.some((id) => String(id) === currentUserId);
    if (!isParticipant) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You are not authorized to view messages for this chat.",
      });
    }

    // Optional query parameter for delta polling: GET /api/chat/:chatId/messages?since=ISOString
    const query = { chatId };
    if (req.query.since) {
      const sinceDate = new Date(req.query.since);
      if (!isNaN(sinceDate.getTime())) {
        query.sentAt = { $gt: sinceDate };
      }
    }

    const messages = await Message.find(query).sort({ sentAt: 1 }).lean();

    // Mark unread messages sent by other participant as read
    await Message.updateMany(
      { chatId, senderId: { $ne: currentUserId }, readAt: null },
      { $set: { readAt: new Date() } }
    );

    const otherParticipantId = chat.participantIds.find((id) => String(id) !== currentUserId);
    const candidateInfo = await getCandidatePublicInfo(otherParticipantId);

    return res.status(200).json({
      chatId: chat._id,
      participantIds: chat.participantIds,
      otherParticipant: candidateInfo,
      messages: messages.map((m) => ({
        _id: m._id,
        chatId: m.chatId,
        senderId: m.senderId,
        text: m.text,
        sentAt: m.sentAt,
        readAt: m.readAt,
      })),
    });
  } catch (err) {
    console.error("[GET /api/chat/:chatId/messages Error]:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

/**
 * POST /api/chat/:chatId/messages
 * Sends a message in the chat thread.
 * Protected by requireAuth + requireVerified.
 * ENFORCES PARTICIPANT CHECK (403/404) & MESSAGE VALIDATION (400 for empty/whitespace or >2000 chars).
 */
router.post("/:chatId/messages", requireAuth, requireVerified, async (req, res) => {
  try {
    const { chatId } = req.params;
    const currentUserId = String(req.user.id);
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(404).json({ error: "Not Found", message: "Chat not found." });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Not Found", message: "Chat not found." });
    }

    // 🔒 PARTICIPANT AUTHORIZATION CHECK
    const isParticipant = chat.participantIds.some((id) => String(id) === currentUserId);
    if (!isParticipant) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You are not authorized to send messages in this chat.",
      });
    }

    // 1. Message Validation: Reject empty or whitespace-only strings (HTTP 400)
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Message text cannot be empty or whitespace only.",
      });
    }

    // 2. Message Validation: Reject strings exceeding max length of 2000 characters (HTTP 400)
    if (text.length > 2000) {
      return res.status(400).json({
        error: "Bad Request",
        message: `Message exceeds maximum allowed length of 2000 characters (current length: ${text.length}).`,
      });
    }

    const newMessage = new Message({
      chatId: chat._id,
      senderId: currentUserId,
      text: text.trim(),
      sentAt: new Date(),
    });

    await newMessage.save();

    // Update chat timestamps so GET /api/chat/list orders by most recent conversation activity
    chat.updatedAt = new Date();
    await chat.save();

    return res.status(201).json({
      message: {
        _id: newMessage._id,
        chatId: newMessage.chatId,
        senderId: newMessage.senderId,
        text: newMessage.text,
        sentAt: newMessage.sentAt,
        readAt: newMessage.readAt,
      },
    });
  } catch (err) {
    console.error("[POST /api/chat/:chatId/messages Error]:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

export default router;
