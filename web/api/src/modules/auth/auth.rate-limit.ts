import rateLimit from "express-rate-limit";

/**
 * POST /api/auth/login ve /api/auth/register: IP başına 5 dakikada en fazla 10 istek.
 * Kaba kuvvet parola saldırılarını yavaşlatır.
 */
export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  validate: { default: false },
  keyGenerator: (req) => `login:${req.ip ?? "unknown"}`,
  message: {
    message: "Çok fazla giriş denemesi. Lütfen 5 dakika sonra tekrar deneyin.",
  },
});

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
  validate: { default: false },
  keyGenerator: (req) => {
    const userId = req.authUser?.id ?? "anon";
    const ip = req.ip ?? "unknown";
    return `delete-account:${userId}:${ip}`;
  },
  message: {
    message: "Çok fazla silme denemesi. Lütfen bir dakika sonra tekrar deneyin.",
  },
});

/**
 * POST /api/auth/forgot-password/*: IP başına saatte en fazla 10 istek.
 * Servis tarafı e-posta başına saatte 5 kod limiti ile birlikte çalışır.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  validate: { default: false },
  keyGenerator: (req) => `forgot-password:${req.ip ?? "unknown"}`,
  message: {
    message: "Çok fazla şifre sıfırlama isteği. Lütfen bir saat sonra tekrar deneyin.",
  },
});
