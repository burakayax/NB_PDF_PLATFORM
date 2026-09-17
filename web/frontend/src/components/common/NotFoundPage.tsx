import { ArrowLeft, FileQuestion } from "lucide-react";
import type { Language } from "../../i18n/landing";

/**
 * Bulunamayan araç adresleri için sayfa.
 *
 * NEDEN VAR: Tanınmayan bir `/tools/<slug>` adresi eskiden BOMBOŞ BEYAZ SAYFA
 * veriyordu — ne hata, ne menü, ne de geri dönüş yolu. Eski bir bağlantıya
 * tıklayan kullanıcı sitenin çöktüğünü sanıyordu; arama motoru da içeriksiz
 * sayfa görüp "değersiz sayfa" olarak işaretliyordu. Burada kullanıcıya ne
 * olduğu söylenir ve en az bir çıkış yolu verilir.
 */
export function NotFoundPage({
  language,
  onGoHome,
}: {
  language: Language;
  onGoHome: () => void;
}) {
  const tr = language === "tr";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-800/60 text-slate-300 ring-1 ring-white/10">
        <FileQuestion className="h-9 w-9" />
      </div>

      <h1 className="mt-6 text-2xl font-bold text-white sm:text-3xl">
        {tr ? "Böyle bir araç bulunamadı" : "This tool doesn’t exist"}
      </h1>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
        {tr
          ? "Adres yanlış yazılmış ya da bu araç artık başka bir adreste olabilir. Ana sayfadan tüm araçlara ulaşabilirsin."
          : "The address may be mistyped, or this tool may have moved. You can reach every tool from the home page."}
      </p>

      <button
        type="button"
        onClick={onGoHome}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
      >
        <ArrowLeft className="h-4 w-4" />
        {tr ? "Ana sayfaya dön" : "Back to home"}
      </button>

      <a
        href="/"
        className="mt-4 text-xs text-slate-500 underline-offset-4 transition hover:text-slate-300 hover:underline"
      >
        {tr ? "Tüm PDF araçları" : "All PDF tools"}
      </a>
    </main>
  );
}
