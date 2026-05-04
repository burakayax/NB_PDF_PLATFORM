/**
 * Entitlement engine — geriye dönük uyumluluk stub'ı.
 * Credit sistemi kaldırıldı; tüm erişim kontrolü quota.ts üzerinden yapılır.
 * Bu dosyadaki export'lar admin paneli ve ödeme modülleriyle uyumluluk için korunur.
 */

import { prisma } from "../../lib/prisma.js";
import { checkQuota, incrementQuota, getQuotaSummary } from "../../lib/quota.js";

// ---------------------------------------------------------------------------
// Public types (geriye dönük uyumluluk)
// ---------------------------------------------------------------------------

export type AllowReason =
  | "admin_bypass"
  | "active_subscription"
  | "credit_available";

export type DenyReason =
  | "user_not_found"
  | "tool_not_registered"
  | "insufficient_credits";

export type CanReason = AllowReason | DenyReason;
export type RaceLostReason = "race_lost";

export type CanExecuteResult = {
  allowed: boolean;
  reason: CanReason;
  cost: number;
  creditsBefore: number;
  creditsAfter: number;
};

export type ConsumeResult =
  | {
      status: "ok";
      reason: AllowReason;
      transactionId: string;
      cost: number;
      creditsBefore: number;
      creditsAfter: number;
    }
  | {
      status: "denied";
      reason: DenyReason | RaceLostReason;
      transactionId: null;
      cost: number;
      creditsBefore: number;
      creditsAfter: number;
    };

export type GrantType = "bonus" | "admin_add" | "refund";

export type GrantResult = {
  transactionId: string;
  creditsBefore: number;
  creditsAfter: number;
};

export type UserBalance = {
  userId: string;
  creditBalance: number;
  plan: "FREE" | "PLUS" | "PRO" | "BUSINESS";
  role: "USER" | "ADMIN";
  subscriptionStatus: "none" | "active" | "past_due" | "canceled" | "incomplete";
  subscriptionExpiry: string | null;
  hasActiveSubscription: boolean;
};

export type CreditTransactionRecord = {
  id: string;
  type: "consume" | "bonus" | "admin_add" | "admin_subtract" | "refund";
  amount: number;
  toolId: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Public API — quota sistemi üzerinden
// ---------------------------------------------------------------------------

export async function canExecuteTool(
  userId: string,
  toolId: string,
): Promise<CanExecuteResult> {
  const result = await checkQuota(userId, toolId, 1, 0);
  return {
    allowed: result.allowed,
    reason: result.allowed ? "active_subscription" : "insufficient_credits",
    cost: 0,
    creditsBefore: 0,
    creditsAfter: 0,
  };
}

export async function consumeTool(
  userId: string,
  toolId: string,
): Promise<ConsumeResult> {
  const quotaCheck = await checkQuota(userId, toolId, 1, 0);
  if (!quotaCheck.allowed) {
    return {
      status: "denied",
      reason: "insufficient_credits",
      transactionId: null,
      cost: 0,
      creditsBefore: 0,
      creditsAfter: 0,
    };
  }
  await incrementQuota(userId, toolId, 1, 0);
  return {
    status: "ok",
    reason: "active_subscription",
    transactionId: "",
    cost: 0,
    creditsBefore: 0,
    creditsAfter: 0,
  };
}

export async function getUserBalance(userId: string): Promise<UserBalance> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, plan: true },
  });
  if (!user) {
    throw new Error(`getUserBalance: user not found: ${userId}`);
  }
  return {
    userId: user.id,
    creditBalance: 0,
    plan: user.plan as UserBalance["plan"],
    role: user.role as UserBalance["role"],
    subscriptionStatus: user.plan !== "FREE" ? "active" : "none",
    subscriptionExpiry: null,
    hasActiveSubscription: user.plan !== "FREE",
  };
}

export async function listCreditTransactions(
  _userId: string,
  _limit = 10,
): Promise<CreditTransactionRecord[]> {
  return [];
}

export async function grantCredits(
  _userId: string,
  _amount: number,
  _type: GrantType,
): Promise<GrantResult> {
  return { transactionId: "", creditsBefore: 0, creditsAfter: 0 };
}

export async function subtractCreditsByAdmin(
  _userId: string,
  _amount: number,
): Promise<GrantResult> {
  return { transactionId: "", creditsBefore: 0, creditsAfter: 0 };
}
