import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLAN_CONFIGS = [
  {
    plan: "FREE" as const,
    dailyOperationLimit: 5,
    monthlyOperationLimit: 50,
    fileSizeLimitMB: 20,
    batchLimit: 0,
    watermarkEnabled: true,
    queuePriority: "LOW" as const,
    allowedTools: "merge,split,compress",
    maxSeats: 1,
    monthlyPriceTry: 0,
    monthlyPriceUsd: 0,
    yearlyPriceTry: 0,
    yearlyPriceUsd: 0,
  },
  {
    plan: "PLUS" as const,
    dailyOperationLimit: null,
    monthlyOperationLimit: 500,
    fileSizeLimitMB: 200,
    batchLimit: 5,
    watermarkEnabled: false,
    queuePriority: "MEDIUM" as const,
    allowedTools: "all",
    maxSeats: 1,
    monthlyPriceTry: 220,
    monthlyPriceUsd: 699,
    yearlyPriceTry: 220,
    yearlyPriceUsd: 699,
  },
  {
    plan: "PRO" as const,
    dailyOperationLimit: null,
    monthlyOperationLimit: 800,
    fileSizeLimitMB: 500,
    batchLimit: 20,
    watermarkEnabled: false,
    queuePriority: "HIGH" as const,
    allowedTools: "all",
    maxSeats: 1,
    monthlyPriceTry: 158,
    monthlyPriceUsd: 499,
    yearlyPriceTry: 1900,
    yearlyPriceUsd: 5900,
  },
  {
    plan: "BUSINESS" as const,
    dailyOperationLimit: null,
    monthlyOperationLimit: 999999,
    fileSizeLimitMB: 999999,
    batchLimit: 50,
    watermarkEnabled: false,
    queuePriority: "HIGHEST" as const,
    allowedTools: "all",
    maxSeats: 5,
    monthlyPriceTry: 650,
    monthlyPriceUsd: 2000,
    yearlyPriceTry: 6240,
    yearlyPriceUsd: 19200,
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
