/**
 * BAŞARI ŞERİDİ — bir araç işini bitirdiğinde ekranın altında görünen,
 * indirme / paylaşma / önizleme eylemlerini taşıyan durum şeridi.
 *
 * Ana uygulama dosyasının içinde duruyordu. Kendi durumu yok; yalnızca aldığı
 * değerleri gösterir ve tıklamaları çağırana geri iletir. Ayrı durması hem o
 * dosyayı küçültür hem de sonuç ekranını değiştirirken tek yere bakmayı sağlar.
 *
 * Görünürlük kararı ÇAĞIRANDA kalır: bileşen render edildiyse gösterilir.
 */
import type { FeatureKey } from "../../api/subscription";
import type { ws } from "../../i18n/workspace";
import type { Language } from "../../i18n/landing";
import type { SaaSGating } from "../../lib/saasGating";
import { SaasGatedPreview } from "../SaasGatedPreview";
import { isShareApiAvailable } from "../../lib/shareFile";

/** Tamamlanan işin ekranda gösterilecek özeti. */
export type ToolProgressSuccessState = {
  filename: string;
  featureTitle: string;
  replay?: () => void;
  /**
   * Erişim kontrollü önizleme. Varsa şerit, indirme düğmesi yerine
   * önizleme kartını (varsa küçük görselle) çizer.
   */
  gatedDownload?: {
    /** Çıktıyı üreten araç — indirme kaydı ve bakiye tazeleme için. */
    toolId: FeatureKey;
    /** Sonuç deposundaki kayıt. */
    resultId?: string;
    /** Birleştirme akışının iş kaydı. */
    mergeJobId?: string;
    fallbackName: string;
    thumbnailBlobUrl: string | null;
    /**
     * Hak sahipliği kararı. Varsa kilit/bulanıklık/yükseltme akışı çizilir;
     * yoksa eski 402 tabanlı akışa düşülür.
     */
    saasGating?: SaaSGating | null;
  };
};

export type ToolSuccessBarProps = {
  W: ReturnType<typeof ws>;
  language: Language;
  success: ToolProgressSuccessState;
  /** Tam ekran önizlemeyi açar (birleştirme işi ya da sonuç kaydı için). */
  onOpenFullPreview: (target: {
    mergeJobId?: string;
    resultId?: string;
  }) => void;
  onDownloadResult: (
    resultId: string,
    fallbackName: string,
    toolId: FeatureKey,
  ) => void;
  onDownloadMergeJob: (mergeJobId: string, fallbackName: string) => void;
  onShare: (target: {
    jobId?: string;
    resultId?: string;
    defaultName: string;
  }) => void;
  onUpgrade: () => void;
  onInsufficientCredits: () => void;
  onDismiss: () => void;
};

export function ToolSuccessBar({
  W,
  language,
  success,
  onOpenFullPreview,
  onDownloadResult,
  onDownloadMergeJob,
  onShare,
  onUpgrade,
  onInsufficientCredits,
  onDismiss,
}: ToolSuccessBarProps) {
  return (
    <div
      className="merge-progress-fixed merge-progress-fixed--success tool-success-shell"
      role="status"
      aria-live="polite"
    >
      <div className="merge-progress-fixed__inner tool-success-shell__card">
        <div className="tool-success-shell__row">
          <div
            className="tool-success-shell__mark"
            aria-hidden="true"
          />
          <div className="tool-success-shell__text">
            <strong className="tool-success-shell__title">
              {W.toolProgressSuccessTitle}
            </strong>
            <p className="tool-success-shell__subtitle">
              {success.featureTitle} ·{" "}
              {success.filename}
            </p>
          </div>
          <span className="tool-success-shell__pill" aria-hidden="true">
            %100
          </span>
        </div>
        <div
          className="tool-success-shell__meter"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={100}
          aria-label={W.toolProgressSuccessTitle}
        >
          <span className="tool-success-shell__meter-fill" />
        </div>
        {success?.gatedDownload ? (
          <SaasGatedPreview
            gating={
              success.gatedDownload.saasGating ?? null
            }
            language={language}
            filename={success.filename}
            thumbnailUrl={
              success.gatedDownload.thumbnailBlobUrl
            }
            onOpenFullPreview={() => {
              const gd = success.gatedDownload;
              if (!gd) {
                return;
              }
              onOpenFullPreview({
                mergeJobId: gd.mergeJobId,
                resultId: gd.resultId,
              });
            }}
            onDownload={() => {
              const gd = success.gatedDownload;
              if (!gd) {
                return;
              }
              if (gd.mergeJobId) {
                onDownloadMergeJob(gd.mergeJobId, gd.fallbackName);
                return;
              }
              if (gd.resultId) {
                onDownloadResult(gd.resultId, gd.fallbackName, gd.toolId);
              }
            }}
            onShare={
              isShareApiAvailable() &&
              (success.gatedDownload.mergeJobId ||
                success.gatedDownload.resultId)
                ? () => {
                    const gd = success.gatedDownload;
                    if (!gd) return;
                    if (gd.mergeJobId) {
                      onShare({
                        jobId: gd.mergeJobId,
                        defaultName: gd.fallbackName,
                      });
                    } else if (gd.resultId) {
                      onShare({
                        resultId: gd.resultId,
                        defaultName: gd.fallbackName,
                      });
                    }
                  }
                : undefined
            }
            onUpgrade={onUpgrade}
            onInsufficientCredits={onInsufficientCredits}
            onRetry={() => {
              const gd = success.gatedDownload;
              if (!gd) return;
              if (gd.mergeJobId) {
                onDownloadMergeJob(gd.mergeJobId, gd.fallbackName);
                return;
              }
              if (gd.resultId) {
                onDownloadResult(gd.resultId, gd.fallbackName, gd.toolId);
              }
            }}
            onDismiss={onDismiss}
            dismissLabel={W.toolProgressDismiss}
          />
        ) : (
          <div className="merge-progress-fixed__success-actions">
            {success.replay ? (
              <button
                type="button"
                className="merge-progress-fixed__download"
                onClick={() => success.replay?.()}
              >
                {W.toolDownloadAgain}
              </button>
            ) : (
              <p className="merge-progress-fixed__native-hint">
                {W.toolProgressNativeDownloadHint}
              </p>
            )}
            <button
              type="button"
              className="merge-progress-fixed__dismiss"
              onClick={onDismiss}
            >
              {W.toolProgressDismiss}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

