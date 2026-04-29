import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

/**
 * Entitlement engine — single source of truth for tool execution rights.
 *
 * This module is the ONLY place in the system allowed to decide whether a
 * user may run a tool and, if so, whether the run consumes credit. All
 * HTTP routes, background workers, CLI scripts, and admin tools must go
 * through `canExecuteTool` / `consumeTool` rather than reading
 * `user.credit_balance` / `user.plan` / `user.role` and making their own
 * decisions.
 *
 * The engine is framework-agnostic: no Express, no HTTP status codes, no
 * payment-provider coupling. Business rules only.
 *
 * Decision priority (applied in this fixed order by `evaluate`):
 *   0. `userId` does not resolve to a user  -> deny `user_not_found`
 *   1. `toolId` is not in `ToolRegistry`     -> deny `tool_not_registered`
 *      (fail-closed even for admins; an unregistered tool cannot run)
 *   2. `user.role === "ADMIN"`               -> allow `admin_bypass`, cost 0
 *   3. Active non-FREE subscription          -> allow `active_subscription`, cost 0
 *   4. `credit_balance >= tool.cost`         -> allow `credit_available`, cost = tool.cost
 *   5. Otherwise                             -> deny `insufficient_credits`
 *
 * Sign convention for `CreditTransaction.amount`:
 *   - `type === "consume"`  -> non-positive (`0` for bypass, `-cost` otherwise)
 *   - `type in (bonus|admin_add|refund)` -> strictly positive
 *
 * `SUM(amount) GROUP BY userId` equals the net credit delta since the
 * journal was introduced. The journal is append-only: the engine never
 * updates or deletes `CreditTransaction` rows.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Reasons returned when access is granted. */
export type AllowReason =
  | "admin_bypass"
  | "active_subscription"
  | "credit_available";

/** Reasons returned when access is refused, excluding race-loss (consume-only). */
export type DenyReason =
  | "user_not_found"
  | "tool_not_registered"
  | "insufficient_credits";

/** Union of every reason `canExecuteTool` can return. */
export type CanReason = AllowReason | DenyReason;

/** Consume-only deny reason raised when an atomic decrement loses its CAS. */
export type RaceLostReason = "race_lost";

/** Result of the pure, no-side-effect access check. */
export type CanExecuteResult = {
  allowed: boolean;
  reason: CanReason;
  /** `ToolRegistry.cost` for the requested tool; `0` for bypass paths. */
  cost: number;
  /** Snapshot of `User.credit_balance` observed during evaluation. */
  creditsBefore: number;
  /**
   * Predicted `credit_balance` once the matching `consumeTool` commits.
   *   - Allowed via admin_bypass / active_subscription -> equals `creditsBefore`.
   *   - Allowed via credit_available                 -> `creditsBefore - cost`.
   *   - Denied (any reason, no mutation will occur)   -> equals `creditsBefore`.
   *
   * This is intentionally a forecast — balance can drift between the check
   * and the consume call. `consumeTool`'s `ConsumeResult.creditsAfter` is the
   * authoritative post-state. Expose this so UI surfaces that gate on the
   * pre-check (e.g. upload-time friction) can render the same credit pill
   * they would show after a real consume.
   */
  creditsAfter: number;
};

/** Result of an attempted consume. `creditsAfter` is always populated. */
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
      /** For denied attempts no balance mutation occurs, so equals `creditsBefore`. */
      creditsAfter: number;
    };

/** Sources of new credits. Stripe / iyzico callbacks are upstream concerns. */
export type GrantType = "bonus" | "admin_add" | "refund";

export type GrantResult = {
  transactionId: string;
  creditsBefore: number;
  creditsAfter: number;
};

/**
 * Snapshot of the inputs the engine uses to decide access. Returned by
 * `getUserBalance` as the single canonical shape the UI and any non-UI
 * consumer should render. The engine is the only owner of this shape —
 * consumers MUST NOT reconstruct it from `user.findUnique` / the
 * subscription service / a `plan-runtime` helper. One source of truth.
 *
 * `hasActiveSubscription` mirrors the exact condition `evaluate` uses for
 * the `active_subscription` path so UI affordances (e.g. "bypass" chip)
 * cannot drift from what the engine will actually allow.
 */
export type UserBalance = {
  userId: string;
  creditBalance: number;
  plan: "FREE" | "PRO" | "BUSINESS";
  role: "USER" | "ADMIN";
  subscriptionStatus: "none" | "active" | "past_due" | "canceled" | "incomplete";
  subscriptionExpiry: string | null;
  hasActiveSubscription: boolean;
};

// ---------------------------------------------------------------------------
// Internal evaluator
// ---------------------------------------------------------------------------

/**
 * Accepts both the top-level `PrismaClient` and the `Prisma.TransactionClient`
 * handed to `$transaction` callbacks. They share the model delegate surface
 * used here (`user.findUnique`, `toolRegistry.findUnique`), so the evaluator
 * runs unchanged inside and outside of transactions.
 */
type PrismaTx = Prisma.TransactionClient;

type UserSnapshot = {
  role: "USER" | "ADMIN";
  plan: "FREE" | "PRO" | "BUSINESS";
  subscription_status: "none" | "active" | "past_due" | "canceled" | "incomplete";
  subscriptionExpiry: Date | null;
  credit_balance: number;
};

type Decision =
  | {
      allowed: true;
      reason: AllowReason;
      cost: number;
      creditsBefore: number;
    }
  | {
      allowed: false;
      reason: DenyReason;
      cost: number;
      creditsBefore: number;
    };

async function evaluate(
  client: PrismaTx,
  userId: string,
  toolId: string,
): Promise<Decision> {
  const user = (await client.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      plan: true,
      subscription_status: true,
      subscriptionExpiry: true,
      credit_balance: true,
    },
  })) as UserSnapshot | null;

  if (!user) {
    return {
      allowed: false,
      reason: "user_not_found",
      cost: 0,
      creditsBefore: 0,
    };
  }

  const tool = await client.toolRegistry.findUnique({
    where: { id: toolId },
    select: { cost: true },
  });

  if (!tool) {
    return {
      allowed: false,
      reason: "tool_not_registered",
      cost: 0,
      creditsBefore: user.credit_balance,
    };
  }

  if (user.role === "ADMIN") {
    return {
      allowed: true,
      reason: "admin_bypass",
      cost: 0,
      creditsBefore: user.credit_balance,
    };
  }

  const now = new Date();
  const hasActiveSubscription =
    user.plan !== "FREE" &&
    user.subscription_status === "active" &&
    (user.subscriptionExpiry === null || user.subscriptionExpiry > now);

  if (hasActiveSubscription) {
    return {
      allowed: true,
      reason: "active_subscription",
      cost: 0,
      creditsBefore: user.credit_balance,
    };
  }

  // One download / one consume: cost is ToolRegistry only (never pageCount/size). Sync with SIDEBAR_TOOL_CREDIT_COST / ensure-tool-registry.
  const cost = Math.max(0, Math.trunc(tool.cost));

  if (user.credit_balance >= cost) {
    return {
      allowed: true,
      reason: "credit_available",
      cost,
      creditsBefore: user.credit_balance,
    };
  }

  return {
    allowed: false,
    reason: "insufficient_credits",
    cost,
    creditsBefore: user.credit_balance,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pure access check. Runs the decision pipeline once and returns the outcome
 * without writing anything. Safe in previews, UI affordances, quota hints,
 * and any read-only surface.
 *
 * The result is a snapshot — balance and subscription state may shift
 * between this call and the subsequent `consumeTool`. Treat the answer as
 * advisory; `consumeTool` is the authoritative, serialized decision.
 */
export async function canExecuteTool(
  userId: string,
  toolId: string,
): Promise<CanExecuteResult> {
  const decision = await evaluate(prisma as unknown as PrismaTx, userId, toolId);
  const creditsAfter =
    decision.allowed && decision.reason === "credit_available"
      ? Math.max(0, decision.creditsBefore - decision.cost)
      : decision.creditsBefore;
  return {
    allowed: decision.allowed,
    reason: decision.reason,
    cost: decision.cost,
    creditsBefore: decision.creditsBefore,
    creditsAfter,
  };
}

/**
 * Authoritative execute-and-charge. Wrapped in a single Prisma transaction
 * so the journal row and any balance change commit together.
 *
 * Credit path uses a guarded `updateMany(WHERE credit_balance >= cost)` —
 * a single atomic SQL `UPDATE`. Two concurrent consumers for the same user
 * cannot both decrement below zero: the loser observes `count === 0` and
 * gets `reason: "race_lost"`. The caller may retry or surface the failure.
 *
 * Every successful consume — including bypass paths — appends a
 * `CreditTransaction { type: "consume", toolId, amount }` row so the
 * journal is a complete tool-usage log, not just a money log. Bypass rows
 * carry `amount: 0`; credit-deducting rows carry `amount: -cost`.
 */
export async function consumeTool(
  userId: string,
  toolId: string,
): Promise<ConsumeResult> {
  const result = await prisma.$transaction(async (tx) => {
    const decision = await evaluate(tx, userId, toolId);

    if (!decision.allowed) {
      return {
        status: "denied" as const,
        reason: decision.reason,
        transactionId: null,
        cost: decision.cost,
        creditsBefore: decision.creditsBefore,
        creditsAfter: decision.creditsBefore,
      };
    }

    if (
      decision.reason === "admin_bypass" ||
      decision.reason === "active_subscription"
    ) {
      const row = await tx.creditTransaction.create({
        data: { userId, type: "consume", amount: 0, toolId },
        select: { id: true },
      });
      return {
        status: "ok" as const,
        reason: decision.reason,
        transactionId: row.id,
        cost: 0,
        creditsBefore: decision.creditsBefore,
        creditsAfter: decision.creditsBefore,
      };
    }

    const cost = decision.cost;
    const updated = await tx.user.updateMany({
      where: { id: userId, credit_balance: { gte: cost } },
      data: { credit_balance: { decrement: cost } },
    });

    if (updated.count !== 1) {
      return {
        status: "denied" as const,
        reason: "race_lost" as const,
        transactionId: null,
        cost,
        creditsBefore: decision.creditsBefore,
        creditsAfter: decision.creditsBefore,
      };
    }

    const row = await tx.creditTransaction.create({
      data: { userId, type: "consume", amount: -cost, toolId },
      select: { id: true },
    });

    const after = await tx.user.findUnique({
      where: { id: userId },
      select: { credit_balance: true },
    });

    return {
      status: "ok" as const,
      reason: "credit_available" as const,
      transactionId: row.id,
      cost,
      creditsBefore: decision.creditsBefore,
      creditsAfter: after?.credit_balance ?? decision.creditsBefore - cost,
    };
  });

  if (result.status === "ok" && result.reason === "credit_available") {
    void import("../marketing/email-automation.js").then((m) =>
      m.queueLowCreditNudgeAfterConsume(userId, result.creditsAfter),
    );
  }
  return result;
}

/**
 * Read-only snapshot of the fields the engine uses to decide access.
 *
 * Intended as the UNIFIED helper for any surface that needs credit balance
 * and plan context (dashboard chips, billing admin, support tools). Use
 * this instead of hand-rolling a `user.findUnique` call — the shape MUST
 * stay consistent with the fields `evaluate` reads so UI cannot display a
 * state the engine would not honour.
 *
 * Throws for unknown `userId` so callers fail loudly rather than silently
 * rendering a zero-balance "ghost" for a deleted account.
 */
export async function getUserBalance(userId: string): Promise<UserBalance> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      plan: true,
      subscription_status: true,
      subscriptionExpiry: true,
      credit_balance: true,
    },
  });

  if (!user) {
    throw new Error(`getUserBalance: user not found: ${userId}`);
  }

  const now = new Date();
  const hasActiveSubscription =
    user.plan !== "FREE" &&
    user.subscription_status === "active" &&
    (user.subscriptionExpiry === null || user.subscriptionExpiry > now);

  return {
    userId: user.id,
    creditBalance: user.credit_balance,
    plan: user.plan as UserBalance["plan"],
    role: user.role as UserBalance["role"],
    subscriptionStatus: user.subscription_status as UserBalance["subscriptionStatus"],
    subscriptionExpiry: user.subscriptionExpiry
      ? user.subscriptionExpiry.toISOString()
      : null,
    hasActiveSubscription,
  };
}

/**
 * Single ledger row as exposed to read-only consumers (dashboard history,
 * admin panels, support tools). Mirrors the `CreditTransaction` Prisma
 * model but normalises `createdAt` to ISO-8601 so the client can render it
 * without worrying about `Date` serialisation.
 */
export type CreditTransactionRecord = {
  id: string;
  type: "consume" | "bonus" | "admin_add" | "admin_subtract" | "refund";
  amount: number;
  toolId: string | null;
  createdAt: string;
};

/**
 * Recent credit-ledger history for a user, newest first. The journal is
 * append-only so this is a stable, read-only surface — no pagination
 * cursor is needed at dashboard scale; callers that need deep history can
 * lift the limit.
 *
 * Clamps `limit` defensively so a rogue caller can't request the whole
 * ledger in one shot.
 */
export async function listCreditTransactions(
  userId: string,
  limit = 10,
): Promise<CreditTransactionRecord[]> {
  const take = Math.min(Math.max(1, Math.trunc(limit)), 100);
  const rows = await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      amount: true,
      toolId: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type as CreditTransactionRecord["type"],
    amount: row.amount,
    toolId: row.toolId,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Credit a user for `amount` with a declared source.
 *
 *   - `bonus`     -> marketing / onboarding / referral rewards.
 *   - `admin_add` -> manual top-up from the admin panel.
 *   - `refund`    -> credit returned after an upstream business decision
 *                    (e.g. failed job, support ticket). Note: this engine
 *                    does not talk to any payment provider; the caller is
 *                    responsible for upstream correctness before granting.
 *
 * Atomic increment + journal row inside a transaction. Rejects
 * non-positive or non-integer amounts and unknown `type` values so callers
 * can't silently corrupt the ledger.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  type: GrantType,
): Promise<GrantResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(
      `grantCredits: amount must be a positive integer, got ${amount}`,
    );
  }
  if (type !== "bonus" && type !== "admin_add" && type !== "refund") {
    throw new Error(`grantCredits: unsupported grant type "${String(type)}"`);
  }

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: userId },
      select: { credit_balance: true },
    });
    if (!before) {
      throw new Error(`grantCredits: user not found: ${userId}`);
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { credit_balance: { increment: amount } },
      select: { credit_balance: true },
    });

    const row = await tx.creditTransaction.create({
      data: { userId, type, amount, toolId: null },
      select: { id: true },
    });

    return {
      transactionId: row.id,
      creditsBefore: before.credit_balance,
      creditsAfter: updated.credit_balance,
    };
  });
}

/**
 * Remove up to `amount` credits from the user (balance floored at 0).
 * Journals a row with `type: "admin_subtract"` and `amount` = credits actually removed.
 */
export async function subtractCreditsByAdmin(userId: string, amount: number): Promise<GrantResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(
      `subtractCreditsByAdmin: amount must be a positive integer, got ${amount}`,
    );
  }
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: userId },
      select: { credit_balance: true },
    });
    if (!before) {
      throw new Error(`subtractCreditsByAdmin: user not found: ${userId}`);
    }
    const creditsAfter = Math.max(0, before.credit_balance - amount);
    const removed = before.credit_balance - creditsAfter;
    await tx.user.update({
      where: { id: userId },
      data: { credit_balance: creditsAfter },
    });
    if (removed <= 0) {
      return {
        transactionId: "",
        creditsBefore: before.credit_balance,
        creditsAfter,
      };
    }
    const row = await tx.creditTransaction.create({
      data: { userId, type: "admin_subtract", amount: removed, toolId: null },
      select: { id: true },
    });
    return {
      transactionId: row.id,
      creditsBefore: before.credit_balance,
      creditsAfter,
    };
  });
}
