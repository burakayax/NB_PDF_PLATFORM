import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7: bağlantı adresi ve şema yolu artık package.json / schema yerine burada.
// DATABASE_URL postgres ile başlıyorsa üretim şeması, aksi halde yerel SQLite şeması.
// (Komut satırındaki --schema bayrağı varsa o önceliklidir.)
const rawUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const isPostgres = /^postgres(ql)?:/i.test(rawUrl);

// Göreli "file:./x.db" Prisma 6'da prisma/ klasörüne göre çözülürdü; uygulama kodu
// (src/lib/prisma-client-factory.ts) aynısını yapar. İkisi ayrışırsa komut satırı
// bir dosyaya migration uygular, uygulama başka dosyayı açar — o yüzden burada da aynı kural.
const url =
  !isPostgres && rawUrl.startsWith("file:") && !path.isAbsolute(rawUrl.slice(5)) && !/^[A-Za-z]:[\/]/.test(rawUrl.slice(5))
    ? `file:${path.resolve("prisma", rawUrl.slice(5))}`
    : rawUrl;

export default defineConfig({
  schema: path.join("prisma", isPostgres ? "schema.postgres.prisma" : "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url },
});
