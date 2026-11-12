import { useEffect, type ReactNode } from "react";
import { AlertTriangle, Info, Loader2, ShieldAlert } from "lucide-react";

/**
 * Sayfanın ortasında açılan ikinci onay penceresi (para/fatura gibi geri alınması zor işlemler için).
 * Esc ve boş alana tıklama = vazgeç. Onay düğmesi vazgeç düğmesinden ayrı ve tonuna göre renklidir.
 */
export type ConfirmTone = "danger" | "warning" | "info";

const TONES: Record<ConfirmTone, { ring: string; icon: string; btn: string; Icon: typeof Info }> = {
  danger: {
    ring: "border-rose-400/30 bg-rose-500/10 text-rose-300",
    icon: "shadow-[0_0_40px_-8px_rgba(244,63,94,0.55)]",
    btn: "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-900/40 hover:from-rose-400 hover:to-rose-500",
    Icon: ShieldAlert,
  },
  warning: {
    ring: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    icon: "shadow-[0_0_40px_-8px_rgba(245,158,11,0.5)]",
    btn: "bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-900/30 hover:from-amber-300 hover:to-amber-400",
    Icon: AlertTriangle,
  },
  info: {
    ring: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
    icon: "shadow-[0_0_40px_-8px_rgba(34,211,238,0.45)]",
    btn: "bg-gradient-to-b from-cyan-400 to-cyan-500 text-slate-950 shadow-lg shadow-cyan-900/30 hover:from-cyan-300 hover:to-cyan-400",
    Icon: Info,
  },
};

export function ConfirmDialog({
  tone = "warning",
  title,
  subtitle,
  points,
  confirmLabel,
  cancelLabel = "Vazgeç",
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  tone?: ConfirmTone;
  title: string;
  /** Başlığın altındaki kısa bağlam satırı (ör. müşteri e-postası). */
  subtitle?: string;
  /** Madde madde uyarılar. */
  points?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const t = TONES[tone];
  const Icon = t.Icon;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      data-testid="confirm-dialog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-white/[0.1] bg-slate-900/95 p-6 shadow-2xl ring-1 ring-black/40">
        <div className="flex flex-col items-center text-center">
          <span className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${t.ring} ${t.icon}`}>
            <Icon className="h-7 w-7" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-bold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-[12px] text-slate-400">{subtitle}</p>}
        </div>

        {points && points.length > 0 && (
          <ul className="mt-4 space-y-2 rounded-2xl border border-white/[0.07] bg-black/25 p-3.5 text-left">
            {points.map((p) => (
              <li key={p} className="flex gap-2.5 text-[12.5px] leading-snug text-slate-200">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
        {children}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="confirm-cancel"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-slate-100 transition hover:bg-white/[0.09] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid="confirm-ok"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition disabled:opacity-60 ${t.btn}`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
