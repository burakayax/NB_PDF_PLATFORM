#!/usr/bin/env node

/**
 * Rate limit reset script
 *
 * Usage:
 *   npx tsx web/api/scripts/reset-rate-limit.ts --ip=192.168.1.1
 *   npx tsx web/api/scripts/reset-rate-limit.ts --user=user@example.com
 *   npx tsx web/api/scripts/reset-rate-limit.ts --email=user@example.com
 *   npx tsx web/api/scripts/reset-rate-limit.ts --all
 */

import { createClient } from "redis";

const args = process.argv.slice(2);

// Parse arguments
let targetIp: string | null = null;
let targetEmail: string | null = null;
let resetAll = false;

for (const arg of args) {
  if (arg.startsWith("--ip=")) {
    targetIp = arg.substring("--ip=".length);
  } else if (arg.startsWith("--user=") || arg.startsWith("--email=")) {
    const prefix = arg.startsWith("--user=") ? "--user=" : "--email=";
    targetEmail = arg.substring(prefix.length);
  } else if (arg === "--all") {
    resetAll = true;
  }
}

if (!targetIp && !targetEmail && !resetAll) {
  console.error("❌ Usage:");
  console.error("  npx tsx web/api/scripts/reset-rate-limit.ts --ip=192.168.1.1");
  console.error("  npx tsx web/api/scripts/reset-rate-limit.ts --email=user@example.com");
  console.error("  npx tsx web/api/scripts/reset-rate-limit.ts --all");
  process.exit(1);
}

async function main() {
  // Try Redis first
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    console.log("🔴 Redis baglaniliyor...");
    const redis = createClient({ url: redisUrl });

    try {
      await redis.connect();
      console.log("✅ Redis'e baglandı");

      if (resetAll) {
        // Clear ALL rate limit keys
        const keys = await redis.keys("login:*");
        const forgotKeys = await redis.keys("forgot-password:*");
        const allKeys = [...keys, ...forgotKeys];

        if (allKeys.length === 0) {
          console.log("✅ Rate limit key'leri zaten temiz");
          await redis.disconnect();
          return;
        }

        console.log(`🗑️  ${allKeys.length} rate limit key'i siliniyor...`);
        await redis.del(allKeys);
        console.log(`✅ ${allKeys.length} key silindi`);
      } else if (targetIp) {
        // Clear by IP
        const loginKey = `login:${targetIp}`;
        const forgotKey = `forgot-password:${targetIp}`;
        const deleteKey = `delete-account:*:${targetIp}`;

        console.log(`🗑️  ${targetIp} için rate limit'ler siliniyor...`);

        const deleted1 = await redis.del([loginKey, forgotKey]);
        console.log(`✅ ${deleted1} key silindi (login/forgot-password)`);

        // Pattern-based delete for delete-account
        const deleteKeys = await redis.keys(deleteKey);
        if (deleteKeys.length > 0) {
          const deleted2 = await redis.del(deleteKeys);
          console.log(`✅ ${deleted2} key silindi (delete-account)`);
        }
      } else if (targetEmail) {
        console.log(`⚠️  Email tabanlı rate limit reset mevcut değil`);
        console.log(`IP adresini kullanın: --ip=USER_IP`);
      }

      await redis.disconnect();
      console.log("✅ Bağlanti kapatıldı");
    } catch (error) {
      console.error("❌ Redis hatası:", error);
      process.exit(1);
    }
  } else {
    // No Redis - using MemoryStore (development)
    console.log("⚠️  Redis bulunamadi (REDIS_URL env var)");
    console.log("✅ MemoryStore kullaniliyor (in-memory)");
    console.log("");
    console.log("Rate limit'i sıfırlamak için:");
    console.log("1. Server'ı restart et: npm run dev");
    console.log("2. Veya 5 dakika bekle (pencerenin süresi)");
    console.log("");
    console.log("Production'da Redis kurun:");
    console.log("  export REDIS_URL=redis://localhost:6379");
  }
}

main().catch((err) => {
  console.error("❌ Hata:", err);
  process.exit(1);
});
