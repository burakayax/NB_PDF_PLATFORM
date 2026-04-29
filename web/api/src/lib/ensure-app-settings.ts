import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

const APP_SETTINGS_SINGLETON_ID = 1;

/**
 * Ensures the single `AppSettings` row exists (site / SEO). `globalMaintenanceMode` is synced from
 * `MAINTENANCE_MODE` for legacy DB consumers; public maintenance comes from env at read time.
 */
export async function ensureAppSettingsRow(): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_SINGLETON_ID },
    create: { id: APP_SETTINGS_SINGLETON_ID, globalMaintenanceMode: env.maintenanceModeEnabled },
    update: { globalMaintenanceMode: env.maintenanceModeEnabled },
  });
}
