/**
 * BİRLEŞTİRME İLERLEME ÇUBUĞU — dosya birleştirme sürerken ekranın altında
 * görünen durum şeridi.
 *
 * Ana uygulama dosyasının içinde duruyordu. Kendi durumu yok, yalnızca aldığı
 * değerleri gösterir; ayrı durması hem o dosyayı küçültür hem de çubuğun
 * görünümünü değiştirirken tek bir yere bakmayı sağlar.
 *
 * Görünürlük kararı ÇAĞIRANDA kalır: bileşen render edildiyse gösterilir.
 */
import type { WorkspaceFeatureUi } from "../../lib/workspaceFeatures";
import type { MergeJobStatus } from "../../api";
import type { ws } from "../../i18n/workspace";
import type { Language } from "../../i18n/landing";
import { MERGE_JOB_PENDING_ID } from "../../lib/appNavigation";
import { friendlyOperationFailedMessage } from "../../lib/userFacingErrors";
import { mergeToolPhaseLabel } from "./toolProgressUi";

export type MergeProgressBarProps = {
  W: ReturnType<typeof ws>;
  language: Language;
  selectedFeature: WorkspaceFeatureUi;
  mergeJob: MergeJobStatus;
  /** Sunucu yüzde vermiyorsa çubuk belirsiz (kayan) modda çizilir. */
  indeterminate: boolean;
  /** Kalan süre tahmini; yoksa satır hiç gösterilmez. */
  etaSeconds: number | null;
  premiumLane: boolean;
  showCancel: boolean;
  onCancel: () => void;
};

export function MergeProgressBar({
  W,
  language,
  selectedFeature,
  mergeJob,
  indeterminate,
  etaSeconds,
  premiumLane,
  showCancel,
  onCancel,
}: MergeProgressBarProps) {
  return (
    <div
      className="merge-progress-fixed"
      role="status"
      aria-live="polite"
    >
      <div className="merge-progress-fixed__inner">
        <div className="merge-progress-fixed__head">
          <div className="merge-progress-fixed__titles">
            <strong className="merge-progress-fixed__title">
              {mergeJob.status === "failed"
                ? language === "tr"
                  ? "Birleştirme başarısız"
                  : "Merge failed"
                : selectedFeature.title}
            </strong>
            {mergeJob.status !== "failed" ? (
              <p className="merge-progress-fixed__phase">
                {mergeJob.id === MERGE_JOB_PENDING_ID
                  ? premiumLane
                    ? W.mergeProgressQueuePremium
                    : W.mergeProgressStarting
                  : mergeToolPhaseLabel(
                      mergeJob,
                      indeterminate,
                      W,
                    )}
              </p>
            ) : null}
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
            {indeterminate ? "…" : `%${mergeJob.percent}`}
          </span>
        </div>
        <div
          className={`progress-bar progress-bar--merge progress-bar--gradient ${indeterminate ? "progress-bar--indeterminate" : ""} ${mergeJob.status === "failed" ? "progress-bar--failed" : ""}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={
            indeterminate
              ? undefined
              : mergeJob.status === "failed"
                ? 100
                : mergeJob.percent
          }
          aria-label={
            mergeToolPhaseLabel(
              mergeJob,
              indeterminate,
              W,
            ) || selectedFeature.title
          }
        >
          {indeterminate ? (
            <div className="progress-bar__fill progress-bar__fill--indeterminate" />
          ) : (
            <div
              className="progress-bar__fill progress-bar__fill--gradient"
              style={{
                width: `${mergeJob.status === "failed" ? 100 : Math.max(mergeJob.percent, 2)}%`,
              }}
            />
          )}
        </div>
        <div className="merge-progress-fixed__meta">
          <span>
            {mergeJob.total > 1
              ? W.mergeFileProgress(
                  mergeJob.current,
                  mergeJob.total,
                  mergeJob.where,
                )
              : `${W.mergeStatus}: ${mergeJob.current}/${mergeJob.total}${
                  mergeJob.where ? ` · ${mergeJob.where}` : ""
                }`}
          </span>
          {etaSeconds !== null &&
          mergeJob.status === "running" &&
          !indeterminate ? (
            <span className="merge-progress-fixed__eta">
              {W.mergeEtaLine(etaSeconds)}
            </span>
          ) : null}
        </div>
        {mergeJob.status === "failed" ? (
          <p className="merge-progress-fixed__err">
            {friendlyOperationFailedMessage(language)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

