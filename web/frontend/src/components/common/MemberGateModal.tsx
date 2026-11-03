/**
 * ÜYELİK KAPISI — yalnızca üyelere açık (ücretsiz hesap) cihazda çalışan araçlar için.
 * Araç kendi içinde çalışır; işlem anında giriş istenir. Dosya yine cihazdan çıkmaz.
 */
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import type { Language } from "../../i18n/landing";

export function MemberGateModal({
  language,
  icon,
  toolName,
  onClose,
  onLogin,
}: {
  language: Language;
  icon: ReactNode;
  toolName: string;
  onClose: () => void;
  onLogin?: () => void;
}) {
  const tr = language === "tr";
  return (
    <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/65 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-violet-400/30 bg-[#0f1424] p-6 shadow-2xl"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 text-fuchsia-300 ring-1 ring-fuchsia-400/30">
          {icon}
        </div>
        <p className="mt-4 text-center text-lg font-bold text-white">
          {tr ? `${toolName} — üyelere özel` : `${toolName} — members only`}
        </p>
        <p className="mt-1 text-center text-[13px] leading-relaxed text-slate-400">
          {tr
            ? "Bu aracı kullanmak için ücretsiz üye olman yeterli. Dosyan yine cihazından çıkmaz."
            : "A free account is all it takes to use this tool. Your file still never leaves your device."}
        </p>
        <button
          type="button"
          onClick={() => {
            onClose();
            onLogin?.();
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3.5 text-sm font-bold text-white transition hover:from-violet-500 hover:to-fuchsia-500"
        >
          <Sparkles className="h-4 w-4" />
          {tr ? "Ücretsiz üye ol" : "Create a free account"}
        </button>
        <button type="button" onClick={onClose} className="mt-2 w-full rounded-2xl px-6 py-2.5 text-[13px] font-semibold text-slate-400 hover:text-slate-200">
          {tr ? "Daha sonra" : "Later"}
        </button>
      </div>
    </div>
  );
}
