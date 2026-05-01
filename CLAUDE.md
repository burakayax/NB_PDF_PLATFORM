# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Full Setup (first time)
```bash
npm run install-all   # Installs all deps + Python venv + Prisma generate
npm run prisma:push   # Apply DB schema (SQLite dev.db by default)
```

### Running in Development
```bash
npm run dev           # Starts all three services concurrently:
                      #   PDF API (FastAPI) on :8000
                      #   Auth API (Express) on :4000
                      #   Frontend (Vite) on :5173
npm run dev:local     # Same but forces SQLite (file:./dev.db) for auth API
```

### Build
```bash
npm run build:all     # tsc + vite build for both web/api and web/frontend
```

### Database
```bash
npm run prisma:push      # Apply schema changes to DB
npm run prisma:generate  # Regenerate Prisma client after schema edits
```

### Individual services
```bash
# From web/api:
npm run dev          # Auth API only (tsx watch, port 4000)

# From web/frontend:
npm run dev          # Vite only (port 5173)
npm run build        # Type check + production bundle → dist/
npm run preview      # Serve dist/ locally
```

## Architecture

Three-tier web application plus a legacy Python desktop app:

```
React SPA (Vite, :5173)
   ├── /api/auth/* ──proxy──→ Express Auth API (:4000)  ← JWT, subscriptions, payments
   ├── /api/payment/* ────────────────────────────────── same
   └── /api/* ──────proxy──→ FastAPI PDF API (:8000)    ← all PDF operations
```

- **web/frontend** — React + TypeScript + Tailwind CSS 4 + Vite. Entry: `src/main.tsx`.
- **web/api** — Express + Prisma + TypeScript. Entry: `src/server.ts`. Compiled to `dist/`.
- **web/backend** — Python FastAPI service. Shares `src/pdf_engine.py` with the desktop app.
- **src/** — Legacy Python desktop app (CustomTkinter).

### Auth API module layout (`web/api/src/modules/`)
Each module owns its own router, service, and types. Key modules: `auth`, `subscription`, `payment`, `credit-checkout`, `admin`, `user`, `entitlement`, `coupon`, `analytics`.

### Frontend layout (`web/frontend/src/`)
- `components/` — Feature-grouped UI (auth, dashboard, landing, pricing, tools)
- `contexts/` — React Context providers (auth state, site settings)
- `i18n/` — Turkish + English string maps
- `seo/` — Route-level SEO config and JSON-LD helpers
- `api.ts` — Central API client used across the app

## Database

**Dev:** SQLite at `web/api/dev.db` (auto-created on `prisma:push`).  
**Prod:** PostgreSQL — set `DATABASE_URL` in `web/api/.env`.

Schema is at `web/api/prisma/schema.prisma`. Key models: `User`, `RefreshToken`, `SubscriptionStatus`, `CreditTransaction`, `DailyUsage`, `ToolRegistry`, `SiteSetting`, `AdminAuditLog`.

Plans: `FREE | PRO | BUSINESS`. Roles: `USER | ADMIN`. Languages: `tr | en`.

## Environment Variables

Copy `web/api/.env.example` → `web/api/.env`. Required for local dev:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `file:./dev.db` for SQLite |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 32+ char random strings |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail + app password |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth (optional for basic dev) |
| `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` | Use sandbox URI for dev |

Frontend env: `web/frontend/.env` (copy from `.env.example`). Notable:

| Variable | Notes |
|---|---|
| `VITE_API_BASE` | FastAPI base URL, default `http://localhost:8000` |
| `VITE_SAAS_PROXY_TARGET` | Auth API proxy target, default `http://127.0.0.1:4000` |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics 4 ID |

## Key Patterns

**Authentication:** JWT access token (short-lived) + HttpOnly refresh cookie. Refresh via `POST /api/auth/refresh`. Google OAuth redirect flow ends at `/login-success` on frontend.

**Credits & Entitlement:** Each tool has a credit cost in `ToolRegistry`. `UserEntitlement` tracks per-user credit limits and feature flags. `DailyUsage` enforces daily caps by plan.

**Subscriptions:** iyzico PSP handles payment. Callback webhooks update `User.plan` and issue credits. Fake payment module (`fake-payment`) available for dev/testing.

**Vite Proxy:** All `/api/auth/*`, `/api/payment*`, `/api/subscription*`, `/api/admin*` routes proxy to `:4000`; everything else under `/api/*` proxies to `:8000` (PDF API).

**i18n:** Language context switches between `tr` and `en` string maps in `src/i18n/`. SEO strings are in separate files under the same directory.

**SEO:** Static HTML pages exist under `web/frontend/public/tools/*/index.html` for SSR-like SEO. `prebuild` and `predev` hooks auto-generate SEO files.

**JS Obfuscation:** Production Vite build obfuscates output. Controlled by `VITE_DISABLE_OBFUSCATION`.
