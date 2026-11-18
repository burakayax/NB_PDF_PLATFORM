import { createPrismaClient } from "../src/lib/prisma-client-factory.js";
import { BUSINESS_TEAM, PLAN_LIMITS, PLAN_PRICES } from "../src/lib/plan-catalogue.js";
import { applySavedLimits, extractSavedLimitOverrides, type SavedLimitOverrides } from "../src/lib/seed-limit-overrides.js";

const prisma = createPrismaClient();

/**
 * PlanConfig satırları fiyat kataloğundan (src/lib/plan-catalogue.ts) TÜRETİLİR — burada elle rakam
 * tutulmaz (eskiden tutulup katalogla ayrışıyordu). Fiyatlar küçük birimdedir (kuruş / sent).
 * TL fiyat KDV DAHİLDİR. EUR yalnız ekran içindir (~0,92 × USD).
 */
const minor = (amount: string) => Math.round(Number.parseFloat(amount) * 100);
const eur = (usdMinor: number) => Math.round(usdMinor * 0.92);

function planRow(
  plan: "STARTER" | "PLUS" | "PRO" | "BUSINESS",
  extra: { queuePriority: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST"; maxSeats: number },
) {
  const price = PLAN_PRICES[plan];
  const limits = PLAN_LIMITS[plan];
  const monthlyUsd = minor(price.usdMonthly);
  const yearlyUsd = minor(price.usdYearly);
  return {
    plan,
    dailyOperationLimit: limits.dailyOperationLimit,
    monthlyOperationLimit: limits.monthlyOperationLimit,
    fileSizeLimitMB: limits.fileSizeLimitMB,
    batchLimit: limits.batchLimit,
    watermarkEnabled: false,
    queuePriority: extra.queuePriority,
    allowedTools: "all",
    maxSeats: extra.maxSeats,
    monthlyPriceTry: minor(price.tryGrossMonthly),
    monthlyPriceUsd: monthlyUsd,
    monthlyPriceEur: eur(monthlyUsd),
    yearlyPriceTry: minor(price.tryGrossYearly),
    yearlyPriceUsd: yearlyUsd,
    yearlyPriceEur: eur(yearlyUsd),
  };
}

const PLAN_CONFIGS = [
  {
    plan: "FREE" as const,
    dailyOperationLimit: PLAN_LIMITS.FREE.dailyOperationLimit,
    monthlyOperationLimit: PLAN_LIMITS.FREE.monthlyOperationLimit,
    fileSizeLimitMB: PLAN_LIMITS.FREE.fileSizeLimitMB,
    batchLimit: PLAN_LIMITS.FREE.batchLimit,
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
  planRow("STARTER", { queuePriority: "LOW", maxSeats: 1 }),
  planRow("PLUS", { queuePriority: "MEDIUM", maxSeats: 1 }),
  planRow("PRO", { queuePriority: "HIGH", maxSeats: 1 }),
  // Business: sunucu işlemi/dosya/toplu işlem artık SINIRLIDIR (ekip havuzu; ek koltukla büyür).
  planRow("BUSINESS", { queuePriority: "HIGHEST", maxSeats: BUSINESS_TEAM.maxTotalSeats }),
];

/**
 * Panelde (Paket ve fiyat → Limitler) KAYDEDİLMİŞ limitleri okur. Okunamazsa boş döner: seed kodun
 * varsayılanlarıyla eskisi gibi çalışır (asla çökmez, asla bozuk veri yazmaz).
 */
async function loadSavedLimits(): Promise<SavedLimitOverrides> {
  try {
    const rows = await prisma.siteSetting.findMany({ where: { key: { in: ["packages.config", "plans.override"] } } });
    const parse = (key: string): unknown => {
      const raw = rows.find((r) => r.key === key)?.value;
      if (!raw?.trim()) return null;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    };
    return extractSavedLimitOverrides(parse("packages.config"), parse("plans.override"));
  } catch (e) {
    console.warn("⚠️  Panel limitleri okunamadı; kodun varsayılanları kullanılacak:", e instanceof Error ? e.message : e);
    return {};
  }
}

async function main() {
  console.log("🌱 PlanConfig seed başlıyor...");
  const savedLimits = await loadSavedLimits();

  for (const codeConfig of PLAN_CONFIGS) {
    // Panel kazanır, kod varsayılandır: panelde kayıtlı limit koddakinin yerine geçer.
    const { config, changed } = applySavedLimits(codeConfig.plan, codeConfig, savedLimits);
    if (changed.length > 0) {
      console.log(`    ↳ ${config.plan}: panelde kayıtlı limit korundu (${changed.join(", ")})`);
    }
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
