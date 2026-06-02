import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { getMediaUploadRoot } from "./modules/admin/media.service.js";
import helmet from "helmet";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { logError } from "./lib/app-logger.js";
import { asyncHandler } from "./lib/async-handler.js";
import { HttpError } from "./lib/http-error.js";
import { enforceHttpsMiddleware } from "./middleware/https-enforce.middleware.js";
import { abuseBlockMiddleware, globalApiLimiter } from "./middleware/api-security.middleware.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { verifyEmailController } from "./modules/auth/auth.controller.js";
import { submitContactController } from "./modules/contact/contact.controller.js";
import { contactPostLimiter } from "./modules/contact/contact.rate-limit.js";
import { fakePaymentRouter } from "./modules/fake-payment/index.js";
import { paymentCallbackController, paymentCallbackUrlencoded } from "./modules/payment/payment.controller.js";
import { apiRouter } from "./routes/index.js";
import { registerTeamJobs } from "./jobs/teamJobs.js";
import { registerDataRetentionJobs } from "./jobs/dataRetentionJobs.js";
import { registerSubscriptionJobs } from "./jobs/subscriptionJobs.js";

/** localhost ↔ 127.0.0.1 (aynı port) tarayıcıda farklı origin sayılır; ikisini de CORS’ta kabul eder. */
/**
 * İzinli origin'leri toplar ve her biri için varyantlarını ekler:
 *  - localhost ↔ 127.0.0.1 (yerel geliştirme)
 *  - apex ↔ www (örn. pdfplatform.app ↔ www.pdfplatform.app)
 * Site www'a (veya tam tersi) yönlendiğinde CORS'un kırılmaması için.
 */
function addOriginVariants(set: Set<string>, raw: string): void {
  const origin = raw.replace(/\/$/, "");
  if (!origin) return;
  set.add(origin);
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost") {
      const v = new URL(origin); v.hostname = "127.0.0.1"; set.add(v.origin);
    } else if (u.hostname === "127.0.0.1") {
      const v = new URL(origin); v.hostname = "localhost"; set.add(v.origin);
    } else {
      const v = new URL(origin);
      v.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
      set.add(v.origin);
    }
  } catch {
    /* ignore */
  }
}

function corsAllowedOrigins(): Set<string> {
  const set = new Set<string>();
  addOriginVariants(set, env.FRONTEND_ORIGIN);
  addOriginVariants(set, env.OAUTH_FRONTEND_REDIRECT_ORIGIN);
  return set;
}

export const app = express();

const trust = env.TRUST_PROXY.trim();
if (trust === "true" || trust === "1") {
  app.set("trust proxy", true);
} else if (/^\d+$/.test(trust)) {
  app.set("trust proxy", Number.parseInt(trust, 10));
} else if (trust.length > 0) {
  app.set("trust proxy", trust);
} else if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

if (env.NODE_ENV === "production") {
  app.use(
    helmet({
      /** E-posta doğrulama HTML’i satır içi style kullanır; script yok. API yanıtları çoğunlukla JSON. */
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          styleSrc: ["'unsafe-inline'"],
          scriptSrc: ["'none'"],
          imgSrc: ["'none'"],
          fontSrc: ["'none'"],
          connectSrc: ["'none'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: false,
      },
      xContentTypeOptions: true,
    }),
  );
}

app.use(compression());
app.use(enforceHttpsMiddleware);

// API versiyonu — tüm yanıtlarda bildirilir; istemciler gelecek kırılma değişikliklerini bu header'dan takip eder.
app.use((_req, res, next) => {
  res.setHeader("X-API-Version", "1");
  next();
});

const corsOrigins = corsAllowedOrigins();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    // ``X-SaaS-Gating`` carries the entitlement engine's decision on
    // streamed tool responses (JSON responses embed the same data under
    // ``saasGating``). The legacy ``X-NB-Processing-Tier`` /
    // ``X-NB-SaaS-Friction`` / ``X-NB-Priority-Processing`` headers were
    // retired together with the daily-limit system.
    exposedHeaders: ["X-SaaS-Gating"],
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use(cookieParser());

/** Fake PSP: JWT + same abuse/rate limits as `/api`; mounted here so paths are explicit in `app`. */
app.use(
  "/api/fake-payment",
  abuseBlockMiddleware,
  globalApiLimiter,
  requireAuth,
  fakePaymentRouter,
);

/** iyzico form POST — abonelik ve kredi paketi callback’i; JWT yok. `/api` router’daki 503’ten önce kayıtlı olmalı. */
if (env.iyzicoEnabled) {
  app.post("/api/payment/callback", paymentCallbackUrlencoded, asyncHandler(paymentCallbackController));
}

app.get("/verify-email", (request, response, next) => {
  void verifyEmailController(request, response).catch(next);
});

// İletişim formunu kök URL altında da kabul eder; gövde POST /api/contact ile aynı denetleyicidir.
// Eski veya kısa URL sözleşmeleri ve CDN yönlendirmeleri için esnek giriş noktası sağlar.
// Yol veya handler ayrılırsa istemciler yanlış uç noktaya yazıp 404 alabilir.
app.post("/contact", abuseBlockMiddleware, globalApiLimiter, contactPostLimiter, asyncHandler(submitContactController));

app.use(
  "/api/media/files",
  express.static(getMediaUploadRoot(), {
    fallthrough: false,
    index: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }),
);

app.use("/api", apiRouter);

registerTeamJobs();
registerDataRetentionJobs();
registerSubscriptionJobs();

// İstek yolunu sorgu dizesi olmadan döndürür; günlük ve hata kayıtlarında tutarlı anahtar üretir.
// Express'te path ve originalUrl farklı bağlamlarda farklı değerler verebileceği için tek yerde toplanır.
// Yanlış alan seçilirse aynı uç nokta farklı path anahtarlarıyla loglanır ve korelasyon zorlaşır.
function requestPath(request: express.Request) {
  return request.originalUrl?.split("?")[0] ?? request.url?.split("?")[0] ?? "";
}

// Şifre ile giriş ve kayıt için 4xx HttpError'ları dosya günlüğünde iki kez yazmayı engeller (controller zaten yazar).
// Gürültüyü azaltır; 5xx ve diğer rotalar etkilenmez.
// Bu filtre kaldırılırsa aynı olay hem login_attempt hem error satırında tekrarlanır.
function skipDuplicateHttpErrorLog(request: express.Request, statusCode: number) {
  if (statusCode >= 500) {
    return false;
  }
  if (request.method !== "POST") {
    return false;
  }
  const p = requestPath(request);
  const authFormRoutes =
    p === "/api/auth/login" ||
    p.endsWith("/auth/login") ||
    p === "/api/auth/register" ||
    p.endsWith("/auth/register");
  return authFormRoutes;
}

// Merkezi hata işleyici: HttpError, Zod doğrulama ve beklenmeyen hataları JSON yanıtına çevirir ve dosyaya loglar.
// Tüm API için tutarlı hata sözleşmesi ve üretim izlenebilirliği sağlamak zorundadır.
// Sıra bozulursa veya middleware atlanırsa istemciye ham hata sızdırılabilir veya loglar eksik kalır.
app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const ip = request.ip || request.socket?.remoteAddress;
  const path = requestPath(request);

  if (error instanceof HttpError) {
    if (!skipDuplicateHttpErrorLog(request, error.statusCode)) {
      logError({
        category: "http",
        message: error.message,
        status: error.statusCode,
        method: request.method,
        path,
        ip,
      });
    }
    response.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    logError({
      category: "validation",
      message: error.issues[0]?.message ?? "Validation failed.",
      status: 400,
      method: request.method,
      path,
      ip,
      issues: error.issues.map((i) => i.message),
    });
    response.status(400).json({ message: error.issues[0]?.message ?? "Validation failed." });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    logError({
      category: "prisma",
      message: error.message,
      status: 400,
      method: request.method,
      path,
      ip,
      prismaCode: error.code,
      meta: error.meta,
    });
    console.error("[prisma]", error.code, error.message, error.meta);

    if (error.code === "P2002") {
      const targets = (error.meta?.target as string[] | undefined) ?? [];
      const label = targets.length ? targets.join(", ") : "alan";
      response.status(409).json({
        message: `Bu ${label} zaten kayıtlı.`,
      });
      return;
    }

    if (error.code === "P2025") {
      response.status(404).json({ message: "Kayıt bulunamadı." });
      return;
    }

    if (error.code === "P2021" || error.code === "P2010") {
      response.status(503).json({
        message: "Veritabanı şeması güncel değil. Lütfen yöneticiyle iletişime geçin.",
      });
      return;
    }

    response.status(400).json({ message: "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin." });
    return;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    logError({
      category: "prisma",
      message: error.message,
      status: 400,
      method: request.method,
      path,
      ip,
    });
    console.error("[prisma] validation", error.message);
    response.status(400).json({ message: "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin." });
    return;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    logError({
      category: "prisma",
      message: error.message,
      status: 503,
      method: request.method,
      path,
      ip,
    });
    console.error("[prisma] init", error.message);
    response.status(503).json({ message: "Sunucu geçici olarak kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin." });
    return;
  }

  const stack = error instanceof Error ? error.stack : undefined;
  logError({
    category: "unhandled",
    message: error instanceof Error ? error.message : String(error),
    status: 500,
    method: request.method,
    path,
    ip,
    stack,
  });
  console.error(error);
  response.status(500).json({ message: "Bir hata oluştu. Lütfen tekrar deneyin." });
});
