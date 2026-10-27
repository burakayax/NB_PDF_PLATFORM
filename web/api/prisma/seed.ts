import { createPrismaClient } from "../src/lib/prisma-client-factory.js";

const prisma = createPrismaClient();

const PLAN_CONFIGS = [
  {
    plan: "FREE" as const,
    dailyOperationLimit: 3,
    monthlyOperationLimit: 30,
    fileSizeLimitMB: 80,
    batchLimit: 0,
    watermarkEnabled: false,
    queuePriority: "LOW" as const,
    allowedTools: "merge,split,compress",
    maxSeats: 1,
    monthlyPriceTry: 0,
    monthlyPriceUsd: 0,
    monthlyPriceEur: 0,
    yearlyPriceTry: 0,
    yearlyPriceUsd: 0,
    yearlyPriceEur: 0,
  },
  {
    plan: "STARTER" as const,
    dailyOperationLimit: 25,
    monthlyOperationLimit: 250,
    fileSizeLimitMB: 100,
    batchLimit: 2,
    watermarkEnabled: false,
    queuePriority: "LOW" as const,
    allowedTools: "all",
    maxSeats: 1,
    monthlyPriceTry: 12900,
    monthlyPriceUsd: 399,
    monthlyPriceEur: 367,    // ~0.92 × 399
    yearlyPriceTry: 129000,
    yearlyPriceUsd: 3999,
    yearlyPriceEur: 3679,    // ~0.92 × 3999
  },
  {
    plan: "PLUS" as const,
    dailyOperationLimit: null,
    monthlyOperationLimit: 600,
    fileSizeLimitMB: 250,
    batchLimit: 5,
    watermarkEnabled: false,
    queuePriority: "MEDIUM" as const,
    allowedTools: "all",
    maxSeats: 1,
    monthlyPriceTry: 22900,
    monthlyPriceUsd: 699,
    monthlyPriceEur: 643,    // ~0.92 × 699
    yearlyPriceTry: 229200,
    yearlyPriceUsd: 5004,
    yearlyPriceEur: 4604,    // ~0.92 × 5004
  },
  {
    plan: "PRO" as const,
    dailyOperationLimit: null,
    monthlyOperationLimit: 1000,
    fileSizeLimitMB: 500,
    batchLimit: 25,
    watermarkEnabled: false,
    queuePriority: "HIGH" as const,
    allowedTools: "all",
    maxSeats: 1,
    monthlyPriceTry: 39900,
    monthlyPriceUsd: 1199,
    monthlyPriceEur: 1103,   // ~0.92 × 1199
    yearlyPriceTry: 399600,
    yearlyPriceUsd: 9000,
    yearlyPriceEur: 8280,    // ~0.92 × 9000
  },
  {
    plan: "BUSINESS" as const,
    dailyOperationLimit: null,
    monthlyOperationLimit: 999999,
    fileSizeLimitMB: 999999,
    batchLimit: 999,
    watermarkEnabled: false,
    queuePriority: "HIGHEST" as const,
    allowedTools: "all",
    maxSeats: 999,
    monthlyPriceTry: 109900,
    monthlyPriceUsd: 3999,
    monthlyPriceEur: 3679,   // ~0.92 × 3999
    yearlyPriceTry: 1099200,
    yearlyPriceUsd: 39996,
    yearlyPriceEur: 36796,   // ~0.92 × 39996
  },
];

async function main() {
  console.log("🌱 PlanConfig seed başlıyor...");

  for (const config of PLAN_CONFIGS) {
    await prisma.planConfig.upsert({
      where: { plan: config.plan },
      update: config,
      create: config,
    });
    console.log(`  ✓ ${config.plan} planı oluşturuldu/güncellendi`);

    // Mevcut organizasyonların limitlerini de güncelle
    const orgs = await prisma.organization.findMany({
      where: { plan: config.plan as any },
      select: { id: true },
    });
    for (const org of orgs) {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          dailyOperationLimit: config.dailyOperationLimit,
          monthlyOperationLimit: config.monthlyOperationLimit,
          fileSizeLimitMB: config.fileSizeLimitMB,
          batchLimit: config.batchLimit,
          watermarkEnabled: config.watermarkEnabled,
          queuePriority: config.queuePriority,
          maxSeats: config.maxSeats,
        },
      });
    }
    if (orgs.length > 0) {
      console.log(`    → ${orgs.length} organizasyon güncellendi`);
    }
  }

  console.log("✅ Seed tamamlandı.");
}

main()
  .catch((e) => {
    console.error("❌ Seed hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
