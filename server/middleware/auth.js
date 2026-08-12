import { auth } from "../auth.js";
import { fromNodeHeaders } from "better-auth/node";

/**
 * Express middleware to protect routes requiring a valid BetterAuth session.
 * Rejects unauthenticated requests with HTTP 401 Unauthorized.
 * Attaches user and session objects to req.user and req.session.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Active authentication session required.",
      });
    }

    req.user = session.user;
    req.session = session.session;
    next();
  } catch (err) {
    console.error("[Auth Middleware Error]:", err.message);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired session token.",
    });
  }
};
