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

/**
 * SIKIŞTIRMA BEKLENTİSİ — bu dosyadan gerçekte ne kadar kazanılacağı.
 *
 * Kazanç neredeyse tamamen GÖRÜNTÜLERDEN gelir: metin akışları PDF'in içinde
 * zaten sıkıştırılmış durumda gelir, onları yeniden sıkıştırınca çok az yer
 * kazanılır. Bu yüzden tahmin, dosyanın ne kadarının görüntü olduğuna bakar
 * (sunucu ön kontrolü bu oranı ölçüp gönderiyor).
 *
 * Aralık iki gerçek ölçümle doğrulandı: metin ağırlıklı 45 sayfalık bir belge
 * (görüntü oranı %8) → %27 kazanç; görüntü ağırlıklı bir belge (oran %100) →
 * kalite kademesine göre %75-%91 kazanç.
 *
 * Görüntü oranı bilinmiyorsa (ön kontrol yapılamadıysa) `null` döner; arayüz o
 * zaman sayı vermek yerine hiçbir şey söylemez — yanlış söz vermekten iyidir.
 */
export type CompressQuality = "auto" | "low" | "medium" | "high";

/** Kalite kademesinin görüntülerde sağladığı küçülme aralığı (ölçülmüş). */
const IMAGE_GAIN: Record<CompressQuality, { min: number; max: number }> = {
  low: { min: 0.82, max: 0.94 },
  auto: { min: 0.74, max: 0.87 },
  medium: { min: 0.66, max: 0.81 },
  high: { min: 0.56, max: 0.77 },
};

/** Metin/vektör kısmından beklenen küçülme — kalite kademesinden bağımsız. */
const TEXT_GAIN = { min: 0.05, max: 0.25 };

export function compressGainPercentRange(
  imageRatio: number | null | undefined,
  quality: CompressQuality,
): { min: number; max: number } | null {
  if (typeof imageRatio !== "number" || !Number.isFinite(imageRatio)) {
    return null;
  }
  const r = Math.max(0, Math.min(1, imageRatio));
  const img = IMAGE_GAIN[quality] ?? IMAGE_GAIN.auto;
  const min = r * img.min + (1 - r) * TEXT_GAIN.min;
  const max = r * img.max + (1 - r) * TEXT_GAIN.max;
  return { min: Math.round(min * 100), max: Math.round(max * 100) };
}

/** Görüntü oranı bu değerin altındaysa dosya "metin ağırlıklı" sayılır. */
export const COMPRESS_TEXT_HEAVY_RATIO = 0.15;

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
