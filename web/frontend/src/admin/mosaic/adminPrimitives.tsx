import type { ReactNode } from "react";

export const mosaicInputClass =
  "w-full rounded-xl border border-slate-600/50 bg-slate-900/50 px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] placeholder:text-slate-600 outline-none transition focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20";

export const adminInputClass = mosaicInputClass;

/** Tailwind UI tarzı anahtar (switch). */
export function AdminToggle({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border border-slate-600/50 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500/50 ${
          checked ? "bg-cyan-600" : "bg-slate-800"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <div>
        <span className="text-sm font-medium text-slate-200">{label}</span>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
    </div>
  );
}

export function AdminField({
  label,
  description,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  description?: string;
  /** Kısa ipucu; (i) ile gösterilir. */
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-200">
          {label}
        </label>
        {hint ? (
          <button
            type="button"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-600/50 bg-slate-800/80 text-[10px] font-bold text-slate-400 hover:border-slate-500 hover:text-slate-200"
            title={hint}
            aria-label={hint}
          >
            i
          </button>
        ) : null}
      </div>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

export type AdminSaveStripState = "idle" | "saving" | "saved" | "error";

export function AdminSaveStrip({ state, detail }: { state: AdminSaveStripState; detail?: string | null }) {
  if (state === "idle" && !detail) {
    return null;
  }
  const s =
    state === "saving"
      ? "border-cyan-500/30 bg-cyan-500/10"
      : state === "saved"
        ? "border-emerald-500/30 bg-emerald-500/10"
        : state === "error"
          ? "border-rose-500/30 bg-rose-500/10"
          : "border-slate-700 bg-slate-800/50";
  return (
    <div className={`rounded-xl border px-4 py-2.5 text-sm ${s} text-slate-200`} role="status">
      {state === "saving" ? "Kaydediliyor…" : null}
      {state === "saved" ? "Kaydedildi" : null}
      {state === "error" ? "Hata" : null}
      {detail ? <p className="text-xs text-slate-400">{detail}</p> : null}
    </div>
  );
}

const sectionBase = "rounded-2xl border p-5 shadow-sm";

const sectionVariantClass: Record<
  "default" | "sky" | "emerald" | "violet" | "amber" | "danger",
  string
> = {
  default: "border-slate-700/50 bg-slate-800/30",
  sky: "border-cyan-500/20 bg-cyan-950/25",
  emerald: "border-emerald-500/20 bg-emerald-950/20",
  violet: "border-violet-500/20 bg-violet-950/25",
  amber: "border-amber-500/25 bg-amber-950/20",
  danger: "border-rose-500/30 bg-rose-950/25",
};

export function AdminSection({
  title,
  description,
  children,
  variant = "default",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  variant?: keyof typeof sectionVariantClass;
}) {
  return (
    <section className={`${sectionBase} ${sectionVariantClass[variant]}`}>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function AdminImpactCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200/90">{title}</p>
      <div className="mt-2 text-sm leading-relaxed text-slate-300">{children}</div>
    </aside>
  );
}

export function AdminMutedBox({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-sm text-slate-400">{children}</div>;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  variant = "default",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={busy ? undefined : onClose} aria-label="Kapat" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-3 text-sm text-slate-300">{message}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
              variant === "danger" ? "bg-rose-600 text-white hover:bg-rose-500" : "bg-cyan-600 text-white hover:bg-cyan-500"
            }`}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
