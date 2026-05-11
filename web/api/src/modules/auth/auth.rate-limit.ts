import rateLimit from "express-rate-limit";

/**
 * DELETE /api/auth/me: authenticated user ID + IP çifti başına dakikada en fazla 1 istek.
 * Kaba kuvvet saldırısını ve kazara çift silmeyi önler.
 */
export const deleteAccountLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  keyGenerator: (req) => {
    const userId = req.authUser?.id ?? "anon";
    const ip = req.ip ?? "unknown";
    return `delete-account:${userId}:${ip}`;
  },
  message: {
    message: "Too many deletion attempts. Please wait a minute before trying again.",
  },
});
