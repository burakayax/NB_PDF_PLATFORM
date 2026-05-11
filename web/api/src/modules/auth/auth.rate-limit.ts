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

/**
 * POST /api/auth/forgot-password/*: IP başına saatte en fazla 10 istek.
 * Servis tarafı e-posta başına 5 saat limiti ile birlikte çalışır.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  keyGenerator: (req) => `forgot-password:${req.ip ?? "unknown"}`,
  message: {
    message: "Too many password reset requests. Please try again later.",
  },
});
