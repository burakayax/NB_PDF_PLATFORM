import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

const APP_SETTINGS_SINGLETON_ID = 1;

/**
 * Ensures the single `AppSettings` row exists (site / SEO).
 *
 * `globalMaintenanceMode` artık admin panelinden DB üzerinden yönetilir (tek-tık toggle).
 * İlk satır oluşurken `MAINTENANCE_MODE` env'i yalnızca SEED olarak kullanılır; sonraki
 * açılışlarda `update` bu alana DOKUNMAZ — aksi halde admin'in toggle değeri her startup'ta
 * env ile ezilirdi.
 */
export async function ensureAppSettingsRow(): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_SINGLETON_ID },
    create: { id: APP_SETTINGS_SINGLETON_ID, globalMaintenanceMode: env.maintenanceModeEnabled },
    update: {},
  });
}
