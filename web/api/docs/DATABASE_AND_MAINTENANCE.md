# Local database isolation and maintenance mode

## Why not `file:./dev.db` (SQLite)?

Prisma uses one `datasource` provider per schema file (`web/api/prisma/schema.prisma` is **`postgresql`**). Supporting SQLite alongside PostgreSQL normally means duplicate schemas/migrations or a separate Postgres in Docker/Web. This project defaults **`DATABASE_URL` in development** to a local PostgreSQL URL when unset; start the DB with **`docker compose up -d`** in `web/api`.

Production **`DATABASE_URL`** must point at your managed instance (for example PostgreSQL in `eu-central-1` Frankfurt). The API rejects **`file:`** SQLite URLs when **`NODE_ENV=production`**.

## Git push and production data

Git **never pushes your database**. Risk comes from accidentally running **`prisma db push`** / **`prisma migrate deploy`** / backups **against production** credentials on your workstation. Practical rules:

- Keep **production `DATABASE_URL` only on the host** (Vercel server/env, Render, etc.), not in the repo or in a committed `.env`.
- Prefer **staging** databases for experiments; rotate credentials if leaked.
- Do not copy local `dev.db` or dump into production manually unless you intend a deliberate migration with a rollback plan.

## Maintenance mode

- **API (authoritative):** set **`MAINTENANCE_MODE=true`** on the Express API environment and redeploy. Public runtime responds with **503** and maintenance JSON when maintenance is enabled.
- **SPA-only (local UX):** set **`VITE_MAINTENANCE_MODE=true`** in `web/frontend/.env`, rebuild/start Vite — affects only bundles built with that flag.
- Database toggles **no longer drive** global site maintenance (admin settings were migrated off `global.flags.maintenanceMode`).
