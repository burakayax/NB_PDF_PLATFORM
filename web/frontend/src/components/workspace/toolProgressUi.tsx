/**
 * İŞLEM İLERLEMESİ ARAYÜZÜ — dosya boyutu metni, aşama etiketleri ve
 * işlem sırasında gösterilen yükseltme kartı.
 *
 * Hepsi yalnızca aldığı değerlere bakan (durum tutmayan) parçalar; ana uygulama
 * dosyasında durmaları için bir sebep yoktu.
 */
import type { FeatureKey } from "../../api/subscription";
import type { MergeJobStatus } from "../../api";
import type { ws } from "../../i18n/workspace";

type FeatureId = FeatureKey;

export function formatFileSize(bytes: number): string {
  const n = Math.max(0, bytes);
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

/** UI-only heuristic for typical PDF recompression bands (not a server guarantee). */
export function compressEstimateMBRange(bytes: number): {
  min: number;
  max: number;
} {
  const mb = bytes / (1024 * 1024);
  // Tahmini sıkıştırılmış boyut aralığı (min = en agresif, max = otomatik)
  if (bytes < 80 * 1024)
    return { min: +(mb * 0.05).toFixed(2), max: +(mb * 0.2).toFixed(2) };
  if (bytes < 512 * 1024)
    return { min: +(mb * 0.1).toFixed(2), max: +(mb * 0.3).toFixed(2) };
  if (bytes < 5 * 1024 * 1024)
    return { min: +(mb * 0.15).toFixed(2), max: +(mb * 0.4).toFixed(2) };
  return { min: +(mb * 0.2).toFixed(2), max: +(mb * 0.5).toFixed(2) };
}

export function genericToolPhaseLabel(
  featureId: FeatureId,
  percent: number,
  indeterminate: boolean,
  W: ReturnType<typeof ws>,
  standardLanePhase: boolean,
): string {
  if (standardLanePhase) {
    if (indeterminate) {
      return W.toolProgressPhaseQueueFree;
    }
    if (percent < 22) {
      return W.toolProgressPhaseHandoff;
    }
  }
  if (indeterminate) {
    return W.toolProgressPhaseAnalyzing;
  }
  if (percent < 30) {
    return W.toolProgressPhaseAnalyzing;
  }
  if (percent < 82) {
    if (featureId === "compress") {
      return W.toolProgressPhaseCompressing;
    }
    return W.toolProgressPhaseProcessing;
  }
  return W.toolProgressPhaseFinishing;
}

export function UpgradeNudgeInline({
  tier,
  W,
  onContinueFree,
  onUpgrade,
}: {
  tier: 1 | 2 | 3;
  W: ReturnType<typeof ws>;
  onContinueFree: () => void;
  onUpgrade: () => void;
}) {
  return (
    <div
      className="mt-3 rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/45 to-nb-bg-elevated/35 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      role="region"
      aria-label={W.upgradeNudgeAria}
    >
      <p className="text-[12px] font-medium leading-relaxed text-cyan-100/90">
        {W.upgradeNudgeTierBody(tier)}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="nb-transition rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-nb-muted hover:border-cyan-500/35 hover:bg-cyan-500/10 hover:text-cyan-100"
          onClick={onContinueFree}
        >
          {W.upgradeNudgeContinueFree}
        </button>
        <button
          type="button"
          className="nb-transition rounded-lg border border-cyan-400/40 bg-cyan-500/12 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-cyan-50 hover:bg-cyan-500/22"
          onClick={onUpgrade}
        >
          {W.upgradeNudgeUpgradeInstant}
        </button>
      </div>
    </div>
  );
}

export function mergeToolPhaseLabel(
  job: MergeJobStatus,
  indeterminate: boolean,
  W: ReturnType<typeof ws>,
): string {
  if (job.status === "failed" || job.status === "cancelled") {
    return "";
  }
  if (indeterminate) {
    return W.toolProgressPhaseAnalyzing;
  }
  const p = job.percent;
  if (p < 32) {
    return W.toolProgressPhaseAnalyzing;
  }
  if (p < 78) {
    return W.toolProgressPhaseMerging;
  }
  return W.toolProgressPhaseFinishing;
}
