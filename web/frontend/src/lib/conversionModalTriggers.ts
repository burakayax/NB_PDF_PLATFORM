/**
 * Local-storage-backed frequency caps for the upgrade CTA modal.
 *
 * Historically this module also computed *who* should see the modal by
 * reading `subscriptionSummary.usage.postLimitThrottleEventsToday`,
 * `behaviorMonetization`, and a freshly-received server-side "friction
 * signal". That entire signal pipeline belonged to the retired daily-limit
 * system. The modal is now driven purely by the credit-based entitlement
 * engine: the UI opens it when the user hits a 402 or when their credit
 * balance is zero, and this module only keeps the "don't spam" frequency
 * caps and the stats counters used for analytics.
 */

export const CONV_MODAL_MIN_MINUTES_BETWEEN = 45;

export const CONV_MODAL_MAX_SHOWS_PER_DAY = 3;

const STATS_KEY = "nb_conv_modal_stats_v2";
const LEGACY_STATS_KEY = "nb_conv_modal_stats_v1";

export const CONV_MODAL_SNOOZE_UNTIL_KEY = "nb_conv_upgrade_snooze_until";

/** “Maybe later” — additional backoff beyond minute/daily caps. */
export const CONV_MODAL_SNOOZE_MS = 24 * 60 * 60 * 1000;

function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type ConversionModalStatsV1 = {
  v: 2;
  shownTotal: number;
  primaryClicksTotal: number;
  dismissTotal: number;
  /** Last time the modal was shown (any trigger). */
  lastShownAt: number;
  /** Last auto-triggered show — drives min gap between auto opens. */
  lastAutoShownAt: number;
  dayKey: string;
  /** Auto opens today only (manual CTAs are not capped by this). */
  autoShowsToday: number;
};

function emptyStats(dk: string): ConversionModalStatsV1 {
  return {
    v: 2,
    shownTotal: 0,
    primaryClicksTotal: 0,
    dismissTotal: 0,
    lastShownAt: 0,
    lastAutoShownAt: 0,
    dayKey: dk,
    autoShowsToday: 0,
  };
}

type LegacyStatsV1 = {
  v?: number;
  shownTotal?: number;
  primaryClicksTotal?: number;
  dismissTotal?: number;
  lastShownAt?: number;
  dayKey?: string;
  showsToday?: number;
};

function migrateLegacyV1(raw: string, dk: string): ConversionModalStatsV1 | null {
  try {
    const p = JSON.parse(raw) as LegacyStatsV1;
    if (p.v !== 1) {
      return null;
    }
    const storedDay = typeof p.dayKey === "string" ? p.dayKey : dk;
    const autoShowsToday = storedDay === dk ? (p.showsToday ?? 0) : 0;
    const last = p.lastShownAt ?? 0;
    return {
      v: 2,
      shownTotal: p.shownTotal ?? 0,
      primaryClicksTotal: p.primaryClicksTotal ?? 0,
      dismissTotal: p.dismissTotal ?? 0,
      lastShownAt: last,
      lastAutoShownAt: last,
      dayKey: dk,
      autoShowsToday,
    };
  } catch {
    return null;
  }
}

export function readConversionModalStats(nowMs: number = Date.now()): ConversionModalStatsV1 {
  const dk = localDateKey(new Date(nowMs));
  try {
    let raw = localStorage.getItem(STATS_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STATS_KEY);
      if (raw) {
        const migrated = migrateLegacyV1(raw, dk);
        if (migrated) {
          writeConversionModalStats(migrated);
          try {
            localStorage.removeItem(LEGACY_STATS_KEY);
          } catch {
            /* ignore */
          }
          return migrated;
        }
      }
      return emptyStats(dk);
    }
    const p = JSON.parse(raw) as Partial<ConversionModalStatsV1>;
    if (p.v !== 2) {
      return emptyStats(dk);
    }
    const storedDay = typeof p.dayKey === "string" ? p.dayKey : dk;
    const autoShowsToday = storedDay === dk ? (p.autoShowsToday ?? 0) : 0;
    return {
      v: 2,
      shownTotal: p.shownTotal ?? 0,
      primaryClicksTotal: p.primaryClicksTotal ?? 0,
      dismissTotal: p.dismissTotal ?? 0,
      lastShownAt: p.lastShownAt ?? 0,
      lastAutoShownAt: p.lastAutoShownAt ?? 0,
      dayKey: dk,
      autoShowsToday,
    };
  } catch {
    return emptyStats(dk);
  }
}

export function writeConversionModalStats(s: ConversionModalStatsV1) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

export type ConversionModalShowSource = "auto" | "manual";

export function recordConversionModalShown(
  source: ConversionModalShowSource,
  nowMs: number = Date.now(),
): ConversionModalStatsV1 {
  const cur = readConversionModalStats(nowMs);
  const dk = localDateKey(new Date(nowMs));
  const autoShowsToday = source === "auto" ? cur.autoShowsToday + 1 : cur.autoShowsToday;
  const next: ConversionModalStatsV1 = {
    v: 2,
    shownTotal: cur.shownTotal + 1,
    primaryClicksTotal: cur.primaryClicksTotal,
    dismissTotal: cur.dismissTotal,
    lastShownAt: nowMs,
    lastAutoShownAt: source === "auto" ? nowMs : cur.lastAutoShownAt,
    dayKey: dk,
    autoShowsToday,
  };
  writeConversionModalStats(next);
  return next;
}

export function recordConversionModalPrimaryClick(): ConversionModalStatsV1 {
  const cur = readConversionModalStats();
  const next: ConversionModalStatsV1 = { ...cur, primaryClicksTotal: cur.primaryClicksTotal + 1 };
  writeConversionModalStats(next);
  return next;
}

export function recordConversionModalDismiss(): ConversionModalStatsV1 {
  const cur = readConversionModalStats();
  const next: ConversionModalStatsV1 = { ...cur, dismissTotal: cur.dismissTotal + 1 };
  writeConversionModalStats(next);
  return next;
}

/** Primary CTA clicks / modal impressions (all-time), as percentage with two decimals. */
export function conversionModalClickThroughRate(stats: ConversionModalStatsV1): number {
  if (stats.shownTotal <= 0) {
    return 0;
  }
  return Math.round((10000 * stats.primaryClicksTotal) / stats.shownTotal) / 100;
}

export function canAutoShowConversionModal(nowMs: number = Date.now()): boolean {
  const stats = readConversionModalStats(nowMs);
  let snoozeUntil = 0;
  try {
    snoozeUntil = parseInt(localStorage.getItem(CONV_MODAL_SNOOZE_UNTIL_KEY) || "0", 10);
  } catch {
    /* ignore */
  }
  if (Number.isFinite(snoozeUntil) && nowMs < snoozeUntil) {
    return false;
  }
  if (stats.autoShowsToday >= CONV_MODAL_MAX_SHOWS_PER_DAY) {
    return false;
  }
  const gapMs = CONV_MODAL_MIN_MINUTES_BETWEEN * 60 * 1000;
  if (stats.lastAutoShownAt > 0 && nowMs - stats.lastAutoShownAt < gapMs) {
    return false;
  }
  return true;
}

export function pushConversionModalAnalytics(event: string, payload: Record<string, unknown>) {
  try {
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
    if (w.dataLayer && Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event, ...payload });
    }
  } catch {
    /* ignore */
  }
}
