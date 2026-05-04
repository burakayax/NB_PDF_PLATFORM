import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { getSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";
import { sendWelcomeEmailToUser } from "../../lib/email-service.js";

export type EmailAutomationConfig = {
  lowCreditEnabled: boolean;
  welcomeEnabled: boolean;
  lowCreditThreshold: number;
  lowCreditCooldownDays: number;
  discountCtaUrl: string;
};

const defaultConfig: EmailAutomationConfig = {
  lowCreditEnabled: true,
  welcomeEnabled: true,
  lowCreditThreshold: 5,
  lowCreditCooldownDays: 7,
  discountCtaUrl: "",
};

function mergeConfig(raw: unknown): EmailAutomationConfig {
  if (!raw || typeof raw !== "object") {
    return { ...defaultConfig };
  }
  const o = raw as Record<string, unknown>;
  return {
    lowCreditEnabled: o.lowCreditEnabled !== false,
    welcomeEnabled: o.welcomeEnabled !== false,
    lowCreditThreshold: Math.max(0, Math.min(1_000, Number(o.lowCreditThreshold ?? 5) || 5)),
    lowCreditCooldownDays: Math.max(1, Math.min(30, Number(o.lowCreditCooldownDays ?? 7) || 7)),
    discountCtaUrl: typeof o.discountCtaUrl === "string" ? o.discountCtaUrl : "",
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
    await sendWelcomeEmailToUser(user.email, { name, credits: 0, userId: user.id });
  } catch (e) {
    console.warn("welcome email failed", e);
  }
}

/**
 * Quota tükendikten sonra nudge gönder (low-credit nudge artık quota bazlı).
 * lowCreditNudgeAt alanı kaldırıldığı için bu fonksiyon sessizce devre dışı.
 */
export async function queueLowCreditNudgeAfterConsume(_userId: string, _creditsAfter: number) {
  // lowCreditNudgeAt User modelinden kaldırıldı — nudge devre dışı
}
