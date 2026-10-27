import { useEffect } from "react";
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
  kind = "tool",
}: {
  language: Language;
  onGoHome: () => void;
  /** "tool": bulunamayan araç adresi; "page": bilinmeyen herhangi bir adres. */
  kind?: "tool" | "page";
}) {
  const tr = language === "tr";
  const page = kind === "page";

  // Bu ekran, sunucunun "200 + ana sayfa HTML'i" döndürdüğü adreslerde açılıyor:
  // baş etiketleri hâlâ ana sayfanın (canonical = ana sayfa, robots = index).
  // Google bunu "soft 404 / ana sayfanın kopyası" diye raporluyordu. Burada
  // sayfa kendisi "dizine alma" der ve ana sayfayı gösteren canonical/hreflang kalkar.
  useEffect(() => {
    const bas = document.head;
    const eskiBaslik = document.title;
    const eskiDil = document.documentElement.lang;
    document.title = tr ? "Sayfa bulunamadı | PDF Platform" : "Page not found | PDF Platform";
    document.documentElement.lang = tr ? "tr" : "en";
    let robots = bas.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      bas.appendChild(robots);
    }
    const eskiRobots = robots.getAttribute("content");
    robots.setAttribute("content", "noindex, nofollow");
    const kaldirilan = Array.from(
      bas.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang]'),
    );
    kaldirilan.forEach((n) => n.remove());
    return () => {
      document.title = eskiBaslik;
      document.documentElement.lang = eskiDil;
      robots.setAttribute("content", eskiRobots ?? "index, follow");
      kaldirilan.forEach((n) => bas.appendChild(n));
    };
  }, [tr]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-800/60 text-slate-300 ring-1 ring-white/10">
        <FileQuestion className="h-9 w-9" />
      </div>

      <h1 className="mt-6 text-2xl font-bold text-white sm:text-3xl">
        {page
          ? tr ? "Sayfa bulunamadı" : "Page not found"
          : tr ? "Böyle bir araç bulunamadı" : "This tool doesn’t exist"}
      </h1>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
        {page
          ? tr
            ? "Adres yanlış yazılmış ya da bu sayfa taşınmış olabilir. Ana sayfadan tüm araçlara ulaşabilirsin."
            : "The address may be mistyped, or this page may have moved. You can reach every tool from the home page."
          : tr
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
        className="mt-4 text-xs text-slate-400 underline-offset-4 transition hover:text-slate-300 hover:underline"
      >
        {tr ? "Tüm PDF araçları" : "All PDF tools"}
      </a>
    </main>
  );
}
