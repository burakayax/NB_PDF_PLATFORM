/**
 * GENEL ARAÇ İLERLEME ÇUBUĞU — sunucuda işlenen araçlarda ekranın altında
 * görünen durum şeridi.
 *
 * Ana uygulama dosyasının içinde duruyordu. Yalnızca aldığı değerlere bakar,
 * kendi durumu yoktur; bu yüzden ayrı bir bileşen olarak durması hem o dosyayı
 * küçültür hem de çubuğun görünümünü değiştirirken tek yere bakmayı sağlar.
 *
 * Görünürlük kararı ÇAĞIRANDA kalır: bileşen render edildiyse gösterilir.
 */
import type { WorkspaceFeatureUi } from "../../lib/workspaceFeatures";
import type { MergeJobStatus } from "../../api";
import type { ws } from "../../i18n/workspace";
import { genericToolPhaseLabel } from "./toolProgressUi";

export type GenericToolProgressBarProps = {
  W: ReturnType<typeof ws>;
  selectedFeature: WorkspaceFeatureUi;
  selectedFeatureId: Parameters<typeof genericToolPhaseLabel>[0];
  /** Sunucudan gelen GERÇEK ilerleme; yoksa süre tahminine düşülür. */
  toolJobProgress: MergeJobStatus | null;
  percent: number;
  indeterminate: boolean;
  elapsedSec: number;
  remainingSec: number;
  fileMb: number;
  premiumLane: boolean;
  showCancel: boolean;
  onCancel: () => void;
};

export function GenericToolProgressBar({
  W,
  selectedFeature,
  selectedFeatureId,
  toolJobProgress,
  percent,
  indeterminate,
  elapsedSec,
  remainingSec,
  fileMb,
  premiumLane,
  showCancel,
  onCancel,
}: GenericToolProgressBarProps) {
  return (
    <div
      className="merge-progress-fixed merge-progress-fixed--generic"
      role="status"
      aria-live="polite"
    >
      <div className="merge-progress-fixed__inner">
        <div className="merge-progress-fixed__head">
          <div className="merge-progress-fixed__titles">
            <strong className="merge-progress-fixed__title">
              {selectedFeature.title}
            </strong>
            <p className="merge-progress-fixed__phase">
              {/* Arka plan işinde sunucunun bildirdiği GERÇEK konum
                  gösterilir (ör. "Sayfa 23/45"); kullanıcı işlemin
                  gerçekten ilerlediğini görür. */}
              {toolJobProgress?.where
                ? toolJobProgress.where
                : genericToolPhaseLabel(
                    selectedFeatureId,
                    percent,
                    indeterminate,
                    W,
                    false,
                  )}
            </p>
          </div>
          {showCancel ? (
            <button
              type="button"
              className="nb-transition shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-400 hover:border-red-500/70 hover:bg-red-500/20 hover:text-red-300"
              onClick={onCancel}
            >
              {W.toolRunCancel}
            </button>
          ) : null}
          <span className="merge-progress-fixed__pct">
            {indeterminate
              ? "…"
              : `%${percent}`}
          </span>
        </div>
        <div
          className={`progress-bar progress-bar--merge progress-bar--gradient ${indeterminate ? "progress-bar--indeterminate" : ""}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={
            indeterminate
              ? undefined
              : percent
          }
          aria-label={genericToolPhaseLabel(
            selectedFeatureId,
            percent,
            indeterminate,
            W,
            false,
          )}
        >
          {indeterminate ? (
            <div className="progress-bar__fill progress-bar__fill--indeterminate" />
          ) : (
            <div
              className="progress-bar__fill progress-bar__fill--gradient"
              style={{ width: `${percent}%` }}
            />
          )}
        </div>
        <div className="merge-progress-fixed__meta merge-progress-fixed__meta--generic">
          <span>
            {premiumLane
              ? W.toolProgressSubPremium
              : W.toolProgressSub}
          </span>
          {fileMb >= 5 ? (
            <span className="merge-progress-fixed__eta">
              {W.toolProgressLargeFileHint(fileMb)}
            </span>
          ) : null}
          {elapsedSec >= 1 ? (
            <span className="merge-progress-fixed__eta">
              {W.toolProgressElapsed(elapsedSec)}
            </span>
          ) : null}
          {remainingSec > 0 && elapsedSec >= 4 ? (
            <span className="merge-progress-fixed__eta">
              {W.mergeEtaLine(remainingSec)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

