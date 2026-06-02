# Vercel + Express monorepo (PDF PLATFORM)

This repo builds the **static SPA** from `web/frontend`. The **Express API** (`web/api`) is a separate Node.js server—it is **not** automatically packaged as “Vercel Functions” unless you add a dedicated serverless entry (advanced). The practical fix is:

1. **Deploy the SPA on Vercel** (same settings you use today, Root = `web/frontend`).
2. **Deploy the API elsewhere** (Railway, Render, Fly.io, ECS, VM, …) running `npm run build && npm run start --prefix web/api` with a **production Postgres** `DATABASE_URL` (SQLite paths are unreliable on ephemeral serverless).

Then either:

- **A — Same-origin (recommended UX):** Vercel **rewrites** `/api/*` → your backend public URL so the browser still calls **`/api/...`** on your Vercel domain; **or**
- **B — Split origins:** Frontend uses **`VITE_SAAS_API_BASE=https://api.your-backend.com`**; configure **CORS** on the API (`FRONTEND_ORIGIN` / `OAUTH_FRONTEND_REDIRECT_ORIGIN`) so cookies + OAuth work (may need **`SameSite=None; Secure`** tuning for cross-site cookies).

---

## 1. Vercel project (frontend)

| Dashboard field      | Recommended value                         |
| -------------------- | ----------------------------------------- |
| **Root Directory**   | `web/frontend`                            |
| **Install Command**  | default (`npm install` in Root Directory) |
| **Build Command**    | `npm run build`                           |
| **Output Directory** | `dist`                                    |

### `web/frontend/vercel.json`

Rewrites **`/api/*`** to your deployed API (**replace placeholder**). The second rule sends client routes (`/workspace`, `/login`, `/terms`, …) to **`index.html`**.

Place this file **`web/frontend/vercel.json`** (not the repo root) when Root Directory is `web/frontend`.

Environment variables (**Production**):

| Variable             | Purpose                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_SAAS_API_BASE` | Leave **empty** if you rewrite `/api` to the backend on Vercel. If backend is another origin and you skip rewrites, set **`https://your-api-origin.com`** (no trailing slash). |
| `VITE_API_BASE`      | Public URL for the **PDF Python/API** tier if deployed separately (see frontend `.env.example`).                                                                               |

After changing env vars, **redeploy** so Vite picks them up at build time.

---

## 2. Backend (Railway-style)

Set **`web/api`** env using `web/api/.env.example` as a checklist.

**Critical URLs (must match your real HTTPS URLs):**

| Variable                         | Typical production meaning                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APP_BASE_URL`                   | **Public canonical URL hit by Google OAuth redirect.** If you proxy `/api` from Vercel, use **`https://your-vercel-domain.com`** so **`getGoogleRedirectUri()`** resolves to **`https://your-vercel-domain.com/api/auth/google/callback`**. If the API runs on **`https://api.your-domain.com`** only (no proxy), set **`APP_BASE_URL` to that API origin.** |
| `FRONTEND_ORIGIN`                | SPA origin, e.g. **`https://your-vercel-domain.com`**                                                                                                                                                                                                                                                                                                        |
| `OAUTH_FRONTEND_REDIRECT_ORIGIN` | Defaults to **`FRONTEND_ORIGIN`**; set if OAuth return pages live on another host                                                                                                                                                                                                                                                                            |
| `TRUST_PROXY`                    | **`1`** if behind HTTPS reverse proxy                                                                                                                                                                                                                                                                                                                        |

**Database:**

- Prefer **PostgreSQL** for production; point **`DATABASE_URL`** at your provider.

**Google OAuth (Google Cloud Console):**

Under **Authorized redirect URIs**, add **exactly** the string **`getGoogleRedirectUri()` produces**:

```text
{APP_BASE_URL}/api/auth/google/callback
```

Example (proxy through Vercel):

```text
https://YOUR-PROJECT.vercel.app/api/auth/google/callback
```

---

## 3. If you insist on “Root Directory = repo root” on Vercel

Point **Output** to **`web/frontend/dist`**, increase **Install** to install both packages (your root **`package.json`** `postinstall` already runs installs under `web/api` and `web/frontend`). You **still** must run the Express app on a hosting product that keeps a server process—it will not magically become Vercel Functions without an `api/` serverless shim.

Duplicate **`rewrites`** in a root **`vercel.json`** **only when** Project Root **`.`**.

---

## 4. Sanity checks

1. **`GET https://<APP_BASE_HOST>/api/health`** returns JSON (**before** chasing OAuth).
2. **`GET`** Google auth start URL **`/api/auth/google`** redirects to **`accounts.google.com`** with **`redirect_uri`** equal to Console entry.
3. Production build **`VITE_SAAS_API_BASE`**: empty = relative **`/api`**, verified in DevTools Network.
