# Entitlement/auth API (`web/api`). Uses Prisma against Postgres (see docker-compose.yml).
# Build: docker compose build (from web/api).

FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# `postinstall` runs `prisma generate`; schema must exist before `npm ci`.
COPY prisma ./prisma/
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/server.js"]
