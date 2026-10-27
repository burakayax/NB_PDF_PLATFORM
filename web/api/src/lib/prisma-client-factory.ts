import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma 7 her bağlantı için bir "adapter" ister. DATABASE_URL'ye göre seçilir:
 *   postgres://…  → PrismaPg (üretim, Render Postgres)
 *   file:…        → better-sqlite3 (yerel geliştirme)
 * Seed ve yardımcı betikler de aynı fabrikayı kullanır; böylece tek yerden yönetilir.
 */

const prismaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "prisma");

/** Prisma 6'da göreli "file:./dev.db" şema klasörüne göre çözülürdü; aynı dosyayı bulmak için bunu koruyoruz. */
function resolveSqliteUrl(url: string): string {
  const rest = url.slice("file:".length);
  if (path.isAbsolute(rest) || /^[A-Za-z]:[/]/.test(rest)) {
    return url;
  }
  return `file:${path.resolve(prismaDir, rest)}`;
}

/** Eski Prisma'ya özgü ?connection_limit / ?pool_timeout parametrelerini pg havuz ayarlarına çevirir. */
function buildPgOptions(rawUrl: string) {
  const u = new URL(rawUrl);
  const limit = Number(u.searchParams.get("connection_limit"));
  const poolTimeout = Number(u.searchParams.get("pool_timeout"));
  for (const key of ["connection_limit", "pool_timeout", "schema"]) {
    u.searchParams.delete(key);
  }
  return {
    connectionString: u.toString(),
    max: Number.isFinite(limit) && limit > 0 ? limit : 10,
    connectionTimeoutMillis: Number.isFinite(poolTimeout) && poolTimeout > 0 ? poolTimeout * 1000 : 30_000,
  };
}

export function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (/^postgres(ql)?:/i.test(url)) {
    return new PrismaClient({ adapter: new PrismaPg(buildPgOptions(url)) });
  }
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: resolveSqliteUrl(url) }) });
}
