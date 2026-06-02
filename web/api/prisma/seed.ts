import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLAN_CONFIGS = [
  {
    plan: "FREE" as const,
    dailyOperationLimit: 3,
    monthlyOperationLimit: 30,
    fileSizeLimitMB: 25,
    batchLimit: 0,
    watermarkEnabled: true,
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
    watermarkEnabled: true,
    queuePriority: "LOW" as const,
    allowedTools: "all",
    maxSeats: 1,
    monthlyPriceTry: 4900,
    monthlyPriceUsd: 1599,
    monthlyPriceEur: 1471,   // ~0.92 × 1599
    yearlyPriceTry: 49000,
    yearlyPriceUsd: 15900,
    yearlyPriceEur: 14628,   // ~0.92 × 15900
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
    monthlyPriceTry: 14900,
    monthlyPriceUsd: 4799,
    monthlyPriceEur: 4415,   // ~0.92 × 4799
    yearlyPriceTry: 149000,
    yearlyPriceUsd: 47990,
    yearlyPriceEur: 44151,   // ~0.92 × 47990
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
    monthlyPriceTry: 29900,
    monthlyPriceUsd: 9799,
    monthlyPriceEur: 9015,   // ~0.92 × 9799
    yearlyPriceTry: 299000,
    yearlyPriceUsd: 97990,
    yearlyPriceEur: 90151,   // ~0.92 × 97990
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
    monthlyPriceTry: 79900,
    monthlyPriceUsd: 25000,
    monthlyPriceEur: 23000,  // ~0.92 × 25000
    yearlyPriceTry: 799000,
    yearlyPriceUsd: 250000,
    yearlyPriceEur: 230000,  // ~0.92 × 250000
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
