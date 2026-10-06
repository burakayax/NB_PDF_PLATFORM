import { TriangleAlert } from "lucide-react";
import type { Language } from "../../i18n/landing";

/**
 * Yapay zekâ sonuç ekranlarında kalıcı uyarı: sonuç hata/eksik içerebilir, kullanmadan önce
 * kullanıcı kontrol eder. (Hizmet Şartları "Çıktı dosyaları ve yapay zekâ sonuçları" maddesiyle uyumlu.)
 * `redact`: gizleme aracı — kaçırılan bilgi KVKK/gizlilik riski taşıdığından daha açık uyarı.
 */
export function AiResultNotice({ language, variant = "default" }: { language: Language; variant?: "default" | "redact" }) {
  const tr = language === "tr";
  const text =
    variant === "redact"
      ? tr
        ? "Otomatik tespit her bilgiyi bulamayabilir. Dosyayı paylaşmadan önce çıktıyı mutlaka kendiniz kontrol edin; gizlenmemiş bilgi kalmış olabilir."
        : "Automatic detection may miss some information. Review the output yourself before sharing it; some data may remain unredacted."
      : tr
        ? "Yapay zekâ sonuçları hata veya eksiklik içerebilir. Kullanmadan veya paylaşmadan önce sonucu kendiniz kontrol edin."
        : "AI results may contain errors or omissions. Review the result yourself before using or sharing it.";
  return (
    <p
      role="note"
      className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2 text-[12px] leading-relaxed text-amber-200/90"
    >
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
}
