import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { getSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";
import { sendLowCreditNudge, sendWelcomeEmailToUser } from "../../lib/email-service.js";

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
  credit_balance: number;
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
    await sendWelcomeEmailToUser(user.email, { name, credits: user.credit_balance, userId: user.id });
  } catch (e) {
    console.warn("welcome email failed", e);
  }
}

/**
 * After credit-consuming tool use, if balance is below threshold, send a throttled nudge.
 */
export async function queueLowCreditNudgeAfterConsume(userId: string, creditsAfter: number) {
  const cfg = await readEmailAutomationConfig();
  if (!cfg.lowCreditEnabled) {
    return;
  }
  if (creditsAfter >= cfg.lowCreditThreshold) {
    return;
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      role: true,
      lowCreditNudgeAt: true,
      credit_balance: true,
    },
  });
  if (!u || u.role === "ADMIN") {
    return;
  }

  const now = new Date();
  if (u.lowCreditNudgeAt) {
    const coolMs = cfg.lowCreditCooldownDays * 86400000;
    if (now.getTime() - u.lowCreditNudgeAt.getTime() < coolMs) {
      return;
    }
  }

  const cta = cfg.discountCtaUrl.trim() || `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/workspace?panel=subscription`;
  const name = displayNameForEmail(u);
  try {
    await sendLowCreditNudge(u.email, { name, credits: creditsAfter, userId: u.id, ctaUrl: cta });
    await prisma.user.update({
      where: { id: u.id },
      data: { lowCreditNudgeAt: now },
    });
  } catch (e) {
    console.warn("low-credit nudge failed", e);
  }
}
