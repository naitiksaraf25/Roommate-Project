import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const photosDir = path.join(__dirname, "../uploads/photos");

/**
 * GET /api/photos/:filename
 * Serves public profile and listing photos.
 */
router.get("/:filename", (req, res) => {
  try {
    const filename = req.params.filename;

    if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ error: "Invalid Request", message: "Invalid filename" });
    }

    const filePath = path.join(photosDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Not Found", message: "Photo file not found" });
    }

    return res.sendFile(filePath);
  } catch (err) {
    console.error("[Photo Serve Error]:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

export default router;
