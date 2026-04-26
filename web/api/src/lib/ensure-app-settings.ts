import { prisma } from "./prisma.js";

const APP_SETTINGS_SINGLETON_ID = 1;

/**
 * Ensures the single `AppSettings` row exists (typed global site / SEO / maintenance flags for Admin UI).
 */
export async function ensureAppSettingsRow(): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_SINGLETON_ID },
    create: { id: APP_SETTINGS_SINGLETON_ID },
    update: {},
  });
}
