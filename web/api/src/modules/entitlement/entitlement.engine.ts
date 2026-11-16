import { prisma } from "../../lib/prisma.js";
import { checkQuota } from "../../lib/quota.js";
import type { QuotaCheckResult } from "../../lib/quota.js";

export async function canExecuteAsFree(
  userId: string,
  toolType: string,
  fileCount: number,
  totalSizeMB: number,
): Promise<QuotaCheckResult> {
  // Ekip yararı olmadan (kullanıcının kendi planı) kontrol — kota zaten aktif ekip üyesini havuza yönlendirir.
  return checkQuota(userId, toolType, fileCount, totalSizeMB);
}

export async function canExecute(
  userId: string,
  toolType: string,
  fileCount: number,
  totalSizeMB: number,
): Promise<QuotaCheckResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, reason: "user_not_found" };

  // 1. Admin bypass
  if (user.role === "ADMIN") {
    return { allowed: true, reason: "admin_bypass" };
  }

  // 2. Plan tabanlı kota. Aktif Business ekibinin üyesi de buradan geçer: kota ekip HAVUZUNDAN
  //    (Business sınırları) kontrol edilir; ekip aboneliği bitmişse üye kendi planına döner.
  //    (Eskiden ekip üyeleri kotadan tümüyle muaf sayılıyordu — "sınırsız" vaadi.)
  return checkQuota(userId, toolType, fileCount, totalSizeMB);
}
