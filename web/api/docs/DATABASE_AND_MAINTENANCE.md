# Local database isolation and maintenance mode

## SQLite (`DATABASE_URL=file:./dev.db`)

Prisma uses **`sqlite`** as `provider` in `web/api/prisma/schema.prisma`. The database file lives next to the schema (`web/api/prisma/dev.db` when using `file:./dev.db`). No Docker or PostgreSQL installation is required; **`npm run dev`** from the repo root creates/pushes the schema automatically (`ensure-dev-prereqs.mjs` + `prisma db push`).

For hosted deployments where SQLite file storage is unsuitable (e.g. serverless replicas), switch **`DATABASE_URL`** to PostgreSQL or another supported backend via migration/separate branch — Prisma documents SQLite concurrency limits.

## Git push and production data

Git ignores **`*.db`**. Never commit production SQLite snapshots unintentionally.

## Maintenance mode

- **API (authoritative):** set **`MAINTENANCE_MODE=true`** on the Express API environment and redeploy. Public runtime responds with **503** and maintenance JSON when maintenance is enabled.
- **SPA-only (local UX):** set **`VITE_MAINTENANCE_MODE=true`** in `web/frontend/.env`, rebuild/start Vite — affects only bundles built with that flag.
