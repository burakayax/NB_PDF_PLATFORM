import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import { assertEnvFileExists } from "./ensure-env-file.js";

/**
 * Path to `web/api/.env`, resolved from this file's location so it cannot
 * drift based on `process.cwd()`.
 *
 * Without this anchor, `dotenv.config()` loads from cwd and any ancestor
 * `.env` (e.g. a repo-root `.env` with a relative `DATABASE_URL`) can win,
 * producing a different SQLite file than the one Prisma's CLI wrote the
 * schema to. That is the class of bug behind "column does not exist"
 * errors when `prisma db push` reports in-sync.
 */
const configDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(configDir, "..", "..");
const envPath = path.join(packageRoot, ".env");

if (process.env.NODE_ENV !== "production") {
  assertEnvFileExists();
}

dotenv.config({ path: envPath });

const rawEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
    /** Public API origin (emails, OAuth, payment callback fallback). */
    APP_BASE_URL: z.string().url().default("http://localhost:4000"),
    /**
     * Optional public origin where the PSP POSTs callbacks (e.g. ngrok). When unset or empty,
     * iyzico `callbackUrl` is derived from APP_BASE_URL.
     */
    PAYMENT_CALLBACK_BASE_URL: z.preprocess((v) => {
      if (v === undefined || v === null) {
        return undefined;
      }
      const s = String(v).trim();
      return s === "" ? undefined : s;
    }, z.string().url().optional()),
    /** Google OAuth sonrası tarayıcı yönlendirmesi (varsayılan: FRONTEND_ORIGIN). Örn. http://localhost:5173 */
    OAUTH_FRONTEND_REDIRECT_ORIGIN: z.string().url().optional(),
    /**
     * Virgül/noktalı virgül ile ayrılmış tam SPA kökleri (OAuth sonrası yönlendirme güvenir listesi).
     * Örn. staging veya Vercel preview: https://my-app.vercel.app
     */
    OAUTH_ALLOWED_REDIRECT_ORIGINS: z.string().optional().default(""),
    /**
     * true ise localhost / 127.0.0.1 / ::1 üzerinden http ile her port SPA kökü kabul edilir
     * (Üretim .env kullanılsa bile localhost testi için; aksi halde yalnızca FRONTEND_ORIGIN veya allowlist ile eşleşen origin).
     */
    OAUTH_ALLOW_LOOPBACK_REDIRECTS: z
      .enum(["true", "false"])
      .optional()
      .default("false"),
    /**
     * Global maintenance (API + `/api/public/runtime`). Set on the API host (e.g. Vercel server env) and
     * redeploy; not stored in the DB. The SPA may also set `VITE_MAINTENANCE_MODE` (build-time) for local-only UI.
     */
    MAINTENANCE_MODE: z.enum(["true", "false"]).optional().default("false"),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    EMAIL_VERIFICATION_TTL_HOURS: z.coerce
      .number()
      .int()
      .positive()
      .default(24),
    /**
     * İsteğe bağlı çerez Domain (çoğu zaman BOŞ bırakın = host-only).
     * SPA farklı alanda (Vercel) API başka alanda (Render) ise `.frontend.app` yazmak çerezin reddine yol açar — OAuth state/session için kullanılmamalı.
     * Yalnızca API ve SPA ortak üst alan paylaşıyorsa (ör. `.yourcompany.com`) kullanın ve APP_BASE_URL hostname ile uyumlu olduğundan emin olun.
     */
    COOKIE_DOMAIN: z.string().optional(),
    /**
     * SMTP_USER / SMTP_PASS boşken Nodemailer kimlik doğrulaması olarak kullanılır.
     * Eksik veya hatalı olursa doğrulama ve bildirim e-postaları gönderilemez.
     */
    EMAIL_USER: z.string().email().optional(),
    EMAIL_PASS: z.string().min(1).optional(),
    /** Özel SMTP sunucusu (varsayılanlar Gmail ile uyumludur). */
    SMTP_HOST: z.string().min(1).default("smtp.gmail.com"),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z
      .string()
      .optional()
      .transform((value) => value === "true"),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM_EMAIL: z.string().email().optional(),
    SMTP_FROM_NAME: z.string().min(1).default("NB PDF PLATFORM"),
    /** Yönetici bildirimleri ve iletişim formu için gelen kutusu adresi. */
    ADMIN_EMAIL: z.string().email(),
    /** İletişim formu POST /api/contact bildirimlerinin alıcısı (varsayılan: nbglobalstudio@gmail.com). */
    CONTACT_TO_EMAIL: z.string().email().default("nbglobalstudio@gmail.com"),
    /**
     * İlk sunucu açılışında isteğe bağlı hesap (ikisi de dolu olmalı). Rol e-postaya göre (yalnızca nbglobalstudio@gmail.com → ADMIN).
     */
    BOOTSTRAP_ADMIN_EMAIL: z.string().optional().default(""),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().optional().default(""),
    /** Web "Google ile devam et" OAuth; boş bırakılırsa Google girişi devre dışı kalır. */
    GOOGLE_CLIENT_ID: z.string().optional().default(""),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
    /** Günlük dosyası yolu (göreli veya mutlak); üst dizin başlangıçta oluşturulur. */
    LOG_FILE_PATH: z.string().min(1).default("logs/nb-pdf-TOOLS-api.log"),
    LOG_FILE_ENABLED: z.enum(["true", "false"]).optional().default("true"),
    /** Dakikada çoğu /api yolu için IP başına üst sınır (SPA eşzamanlı istekleri için 60 önerilir; /auth/preferences ayrı kota). */
    API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
    /** Aynı IP tekrarlı rate limit ihlalinde kaç kez sonra geçici blok (varsayılan 5). */
    API_ABUSE_THRESHOLD: z.coerce.number().int().positive().default(5),
    /** Tekrarlı kötüye kullanım sonrası IP blok süresi (dakika). */
    API_ABUSE_BLOCK_MINUTES: z.coerce.number().int().positive().default(60),
    /**
     * Varsayılan “ücretsiz günlük limit” gösterimi (`site.settings.freeDailyLimitDisplay` / public bootstrap).
     * FREE planında günlük üst sınır yok; yumuşak sürtünme `TOOLS.config.postLimitThrottle` ile yönetilir.
     */
    DEFAULT_FREE_DAILY_LIMIT: z.coerce
      .number()
      .int()
      .min(0)
      .max(10_000)
      .default(5),
    /** `TOOLS.config` yokken masaüstü FREE max dosya boyutu (MB). */
    DEFAULT_FREE_DESKTOP_MAX_FILE_MB: z.coerce
      .number()
      .int()
      .min(1)
      .max(5000)
      .default(15),
    /** Ters proxy arkasında doğru istemci IP için (örn. 1 veya sayı). Boş = güvenme. */
    TRUST_PROXY: z.string().optional().default(""),
    /**
     * Ödeme sağlayıcı seçim bayrağı — ŞU AN DORMANT.
     *
     * Ödemeler sistem genelinde DEVRE DIŞI: `/api/payment` rotası `paymentsDisabledRouter`
     * tarafından handle ediliyor (503 + JSON) ve bu bayrak routing kararlarında kullanılmıyor.
     *
     * iyzico modülü (`modules/payment/**`) ve Stripe modülü (`modules/payment/stripe/**`)
     * diskte library-only modda durur; ikisinin de router'ı mount edilmez. Bayrak schema'da
     * korunuyor çünkü Phase 3'te provider seçimi için (routing yeniden aktifleştirildiğinde)
     * kullanılacak. Varsayılan değer geriye dönük uyumluluk için `iyzico` olarak bırakıldı.
     */
    PAYMENTS_PROVIDER: z.enum(["iyzico", "stripe"]).default("iyzico"),
    /** iyzico API (boşsa POST /api/payment/create 503 döner). */
    IYZICO_API_KEY: z.string().optional().default(""),
    IYZICO_SECRET_KEY: z.string().optional().default(""),
    /** Örn. https://sandbox-api.iyzipay.com veya üretim https://api.iyzipay.com */
    IYZICO_URI: z.string().optional().default(""),
    /** Alias for `IYZICO_URI` (e.g. sandbox `https://sandbox-api.iyzipay.com`). */
    IYZICO_BASE_URL: z.string().optional().default(""),
    /** Sandbox / test alıcı T.C. kimlik no (11 hane). */
    IYZICO_BUYER_IDENTITY_NUMBER: z
      .string()
      .length(11)
      .optional()
      .default("74300864791"),
    /** Alıcı GSM; iyzico formatı (+90...) */
    IYZICO_BUYER_GSM: z.string().min(5).optional().default("+905350000000"),
    /**
     * Üretimde ters proxy arkasında HTTP→HTTPS yönlendirmesi (X-Forwarded-Proto gerekir).
     * Doğrudan Node üzerinde TLS kullanıyorsanız genelde false bırakın; nginx/Caddy kullanımında true önerilir.
     */
    FORCE_HTTPS: z.enum(["true", "false"]).optional().default("false"),
    /** Doğrudan Node’da TLS için PEM yolları (ikisi de doluysa server.ts HTTPS dinler). */
    HTTPS_KEY_PATH: z.string().optional().default(""),
    HTTPS_CERT_PATH: z.string().optional().default(""),
    /** Admin uploads: `local` (disk under uploads/media) or `s3` (S3-compatible). */
    MEDIA_STORAGE: z.enum(["local", "s3"]).default("local"),
    /** Public URL prefix for S3 objects (e.g. https://cdn.example.com or https://bucket.s3.region.amazonaws.com). Trailing slash optional. */
    MEDIA_PUBLIC_BASE_URL: z.string().optional().default(""),
    S3_BUCKET: z.string().optional().default(""),
    S3_REGION: z.string().optional().default("us-east-1"),
    S3_ACCESS_KEY_ID: z.string().optional().default(""),
    S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
    /** MinIO / custom endpoint; leave empty for AWS. */
    S3_ENDPOINT: z.string().optional().default(""),
    S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional().default("false"),
    /**
     * Kredi paketi checkout: gerçek iyzico çağrısı yerine anında sahte ödeme oturumu.
     * (Örn. staging testi; üretimde açık bırakmayın.)
     */
    CREDIT_CHECKOUT_USE_FAKE: z
      .enum(["true", "false"])
      .optional()
      .default("false"),
    /**
     * Yalnız development: `true` iken IYZICO anahtarları dolu olsa bile kredi checkout iyzico kullanır.
     * Aksi halde dev ortamda varsayılan sahte (anında onay) akışı kullanılır.
     */
    CREDIT_CHECKOUT_IYZICO_IN_DEV: z
      .enum(["true", "false"])
      .optional()
      .default("false"),
    /** Yeni kayıt (e-posta doğrulaması sonrası) ve Google ile ilk kayıtta verilen hoş geldin kredisi aralığı (dahil). */
    WELCOME_CREDITS_MIN: z.coerce.number().int().min(0).max(500).default(5),
    WELCOME_CREDITS_MAX: z.coerce.number().int().min(0).max(500).default(10),
  })
  .superRefine((data, ctx) => {
    const smtpOk = Boolean(data.SMTP_USER && data.SMTP_PASS);
    const emailOk = Boolean(data.EMAIL_USER && data.EMAIL_PASS);
    if (!smtpOk && !emailOk) {
      ctx.addIssue({
        code: "custom",
        message:
          "Set EMAIL_USER and EMAIL_PASS (recommended for Gmail) or both SMTP_USER and SMTP_PASS for Nodemailer.",
        path: ["EMAIL_USER"],
      });
    }
    if (data.WELCOME_CREDITS_MIN > data.WELCOME_CREDITS_MAX) {
      ctx.addIssue({
        code: "custom",
        message:
          "WELCOME_CREDITS_MIN must be less than or equal to WELCOME_CREDITS_MAX.",
        path: ["WELCOME_CREDITS_MIN"],
      });
    }
  });

const raw = rawEnvSchema.parse(process.env);

const DATABASE_URL = process.env.DATABASE_URL?.trim();

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

process.env.DATABASE_URL = DATABASE_URL;

const welcomeCreditsMin = Math.min(
  raw.WELCOME_CREDITS_MIN,
  raw.WELCOME_CREDITS_MAX,
);
const welcomeCreditsMax = Math.max(
  raw.WELCOME_CREDITS_MIN,
  raw.WELCOME_CREDITS_MAX,
);

const iyzicoUriMerged =
  raw.IYZICO_URI?.trim() || raw.IYZICO_BASE_URL?.trim() || "";

const iyzicoKeysOk = Boolean(
  raw.IYZICO_API_KEY?.trim() &&
  raw.IYZICO_SECRET_KEY?.trim() &&
  iyzicoUriMerged,
);
/** Kredi paketi: iyzico yerine anında onay (fake) — dev varsayılanı, veya açık bayrak, veya anahtar eksik. */
const creditCheckoutUseFake =
  raw.CREDIT_CHECKOUT_USE_FAKE === "true" ||
  !iyzicoKeysOk ||
  (raw.NODE_ENV === "development" &&
    raw.CREDIT_CHECKOUT_IYZICO_IN_DEV !== "true");

const smtpUser = raw.SMTP_USER ?? raw.EMAIL_USER;
const smtpPass = raw.SMTP_PASS ?? raw.EMAIL_PASS;
if (!smtpUser || !smtpPass) {
  throw new Error(
    "Mail credentials missing after parse; check EMAIL_USER/EMAIL_PASS or SMTP_USER/SMTP_PASS.",
  );
}

const smtpFromEmail = raw.SMTP_FROM_EMAIL ?? raw.EMAIL_USER ?? smtpUser;

const oauthRedirectOrigin = (
  raw.OAUTH_FRONTEND_REDIRECT_ORIGIN ?? raw.FRONTEND_ORIGIN
).replace(/\/$/, "");

const oauthAllowedRedirectOrigins = (raw.OAUTH_ALLOWED_REDIRECT_ORIGINS ?? "")
  .split(/[,;\n]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const oauthAllowLoopbackRedirects =
  raw.OAUTH_ALLOW_LOOPBACK_REDIRECTS === "true" ||
  raw.NODE_ENV === "development";

/** iyzico `callbackUrl`: must match reachable POST /api/payments/callback. */
const paymentCallbackRaw = raw.PAYMENT_CALLBACK_BASE_URL?.trim() ?? "";
const paymentCallbackBase = /^https?:\/\/.+/i.test(paymentCallbackRaw)
  ? paymentCallbackRaw.replace(/\/$/, "")
  : raw.APP_BASE_URL.trim().replace(/\/$/, "");

export const env = {
  ...raw,
  welcomeCreditsMin,
  welcomeCreditsMax,
  /** Normalized API origin (from raw). */
  APP_BASE_URL: raw.APP_BASE_URL.trim().replace(/\/$/, ""),
  IYZICO_URI: iyzicoUriMerged,
  /** Effective origin for iyzico checkout callback (raw PAYMENT_CALLBACK_BASE_URL or APP_BASE_URL). */
  PAYMENT_CALLBACK_BASE_URL: paymentCallbackBase,
  TRUST_PROXY: raw.TRUST_PROXY?.trim() ?? "",
  forceHttps: raw.FORCE_HTTPS === "true",
  HTTPS_KEY_PATH: raw.HTTPS_KEY_PATH?.trim() ?? "",
  HTTPS_CERT_PATH: raw.HTTPS_CERT_PATH?.trim() ?? "",
  iyzicoEnabled: iyzicoKeysOk,
  creditCheckoutUseFake,
  SMTP_USER: smtpUser,
  SMTP_PASS: smtpPass,
  SMTP_FROM_EMAIL: smtpFromEmail,
  GOOGLE_CLIENT_ID: raw.GOOGLE_CLIENT_ID?.trim() ?? "",
  GOOGLE_CLIENT_SECRET: raw.GOOGLE_CLIENT_SECRET?.trim() ?? "",
  LOG_FILE_ENABLED: raw.LOG_FILE_ENABLED === "true",
  BOOTSTRAP_ADMIN_EMAIL: raw.BOOTSTRAP_ADMIN_EMAIL?.trim() ?? "",
  BOOTSTRAP_ADMIN_PASSWORD: raw.BOOTSTRAP_ADMIN_PASSWORD ?? "",
  /** Global maintenance (`MAINTENANCE_MODE=true`). */
  maintenanceModeEnabled: raw.MAINTENANCE_MODE === "true",
  /** Google callback sonrası /login-success ve /login-error adreslerinin kökü */
  OAUTH_FRONTEND_REDIRECT_ORIGIN: oauthRedirectOrigin,
  /** Tam origin listesi (`OAUTH_ALLOWED_REDIRECT_ORIGINS` ayrıştırılmış). */
  oauthAllowedRedirectOrigins,
  /** localhost:any http için SPA OAuth dönüşü (development veya bayrak ile). */
  oauthAllowLoopbackRedirects,
  mediaStorage: raw.MEDIA_STORAGE,
  mediaS3: {
    bucket: raw.S3_BUCKET?.trim() ?? "",
    region: raw.S3_REGION?.trim() || "us-east-1",
    accessKeyId: raw.S3_ACCESS_KEY_ID?.trim() ?? "",
    secretAccessKey: raw.S3_SECRET_ACCESS_KEY?.trim() ?? "",
    endpoint: raw.S3_ENDPOINT?.trim() ?? "",
    forcePathStyle: raw.S3_FORCE_PATH_STYLE === "true",
    publicBaseUrl: (raw.MEDIA_PUBLIC_BASE_URL?.trim() ?? "").replace(/\/$/, ""),
  },
};
