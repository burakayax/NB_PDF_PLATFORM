import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { getSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";
import { sendWelcomeEmailToUser } from "../../lib/email-service.js";

export type EmailAutomationConfig = {
  /** Yeni kayıt olan kullanıcıya hoş geldin e-postası. */
  welcomeEnabled: boolean;
  /** Dönüşmeyen FREE kullanıcılara zamanlı yaşam-döngüsü (drip) serisi. */
  lifecycleEnabled: boolean;
  /** Lifecycle e-postalarındaki ana CTA hedefi (boşsa /workspace). */
  upgradeCtaUrl: string;
  /** Win-back e-postasında öne çıkarılacak kupon kodu (boşsa indirim gösterilmez, değer-odaklı kalır). */
  winbackCouponCode: string;
};

const defaultConfig: EmailAutomationConfig = {
  welcomeEnabled: true,
  lifecycleEnabled: true,
  upgradeCtaUrl: "",
  winbackCouponCode: "",
};

function mergeConfig(raw: unknown): EmailAutomationConfig {
  if (!raw || typeof raw !== "object") {
    return { ...defaultConfig };
  }
  const o = raw as Record<string, unknown>;
  return {
    welcomeEnabled: o.welcomeEnabled !== false,
    lifecycleEnabled: o.lifecycleEnabled !== false,
    upgradeCtaUrl: typeof o.upgradeCtaUrl === "string" ? o.upgradeCtaUrl : "",
    winbackCouponCode: typeof o.winbackCouponCode === "string" ? o.winbackCouponCode.trim().toUpperCase() : "",
  };
}

export async function readEmailAutomationConfig(): Promise<EmailAutomationConfig> {
  const v = await getSetting(SITE_SETTING_KEYS.EMAIL_AUTOMATION);
  return mergeConfig(v);
}

export function displayNameForEmail(u: { firstName: string | null; lastName: string | null; name: string | null; email: string }) {
  const t = `${(u.firstName ?? "").trim()} ${(u.lastName ?? "").trim()}`.trim();
  return t || u.name?.trim() || u.email.split("@")[0] || "there";
}

export async function trySendWelcomeAfterRegistration(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  role: string;
}) {
  if (user.role === "ADMIN") {
    return;
  }
  const cfg = await readEmailAutomationConfig();
  if (!cfg.welcomeEnabled) {
    return;
  }
  const name = displayNameForEmail(user);
  try {
    await sendWelcomeEmailToUser(user.email, { name, userId: user.id });
  } catch (e) {
    console.warn("welcome email failed", e);
  }
}
