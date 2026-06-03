import rateLimit from "express-rate-limit";

/**
 * İletişim uç noktası:
 * - Dakikalık limit: aynı IP için dakikada en fazla 5 POST (kötüye kullanımı engellemek)
 * - Günlük limit: aynı IP için 24 saatte en fazla 3 mesaj
 * Üretimde doğru IP için `app.set("trust proxy", …)` ayarı gerekir (ters proxy arkasında).
 */
export const contactPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    message: "Too many contact requests from this IP. Please try again in a minute.",
  },
});

export const contactDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    message: "You have exceeded the daily limit for contact requests. Please try again tomorrow.",
  },
});
