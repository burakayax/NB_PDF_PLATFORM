/**
 * Video çekimi için GEÇİCİ deneme hesabı açar (yalnızca iş akışının kendi, tek kullanımlık
 * yerel veritabanında; canlı veriye dokunmaz).
 *
 *   REELS_DEMO_EMAIL=... REELS_DEMO_PASSWORD=... node scripts/tool-reels/seed-demo.mjs [apiUrl]
 *
 * Kayıt API'den yapılır; ardından yerel veritabanında planı PRO yapar (kota/duvar çıkmasın).
 */

import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(here, "../../../api");
const api = (process.argv[2] ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const email = process.env.REELS_DEMO_EMAIL;
const password = process.env.REELS_DEMO_PASSWORD;
if (!email || !password) {
  console.error("REELS_DEMO_EMAIL ve REELS_DEMO_PASSWORD gerekli.");
  process.exit(2);
}

const res = await fetch(`${api}/api/auth/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    firstName: "Demo",
    lastName: "Hesap",
    email,
    password,
    preferredLanguage: "tr",
    termsAccepted: true,
    privacyNoticeRead: true,
    skipEmailVerification: true,
  }),
});
if (!res.ok) {
  console.error(`Kayıt başarısız (${res.status}): ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

// Plan PRO: yerel (tek kullanımlık) veritabanında tüm hesaplar.
const require = createRequire(`${apiDir}/package.json`);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: `file:${apiDir}/prisma/dev.db` } } });
try {
  await prisma.organization.updateMany({ data: { plan: "PRO" } });
  await prisma.user.updateMany({ data: { plan: "PRO" } });
} finally {
  await prisma.$disconnect();
}
console.log("Deneme hesabı hazır.");
