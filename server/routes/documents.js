import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads/ids");

/**
 * GET /api/documents/:filename
 * Securely serves private government ID documents.
 * Access is restricted exclusively to:
 * 1. The document owner (matching req.user.id or req.user.platformVerification.idDocumentUrl)
 * 2. Platform Admins (req.user.role === 'admin')
 */
router.get("/:filename", requireAuth, (req, res) => {
  try {
    const filename = req.params.filename;

    // Prevent path traversal attacks
    if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ error: "Invalid Request", message: "Invalid filename" });
    }

    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Not Found", message: "Document file not found" });
    }

    const isOwner =
      req.user?.platformVerification?.idDocumentUrl === `/api/documents/${filename}` ||
      filename.includes(`_${req.user?.id}_`);

    const isAdmin = req.user?.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied. ID documents can only be viewed by the document owner or platform admin reviewers.",
      });
    }

    return res.sendFile(filePath);
  } catch (err) {
    console.error("[Document Serve Error]:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

export default router;
