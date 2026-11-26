import { useState } from "react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import type { Language } from "../../i18n/landing";
import type { AudienceTag } from "../../content/audienceTags.mjs";
import { localizedPath } from "../../seo/enSlugs.mjs";

/**
 * Hedef kitle şeridi: etiketler ekranın tüm genişliğinde, sağdan sola kesintisiz akar.
 * - Yalnız `transform` canlandırılır (sayfa hızını ve düzeni etkilemez).
 * - Döngü için liste iki kez yazılır; ikinci kopya ekran okuyuculardan gizlidir.
 * - Hareketi rahatsız edici bulan ziyaretçi düğmeyle durdurabilir; cihazında "hareketi azalt"
 *   seçili olanlarda şerit hiç akmaz, etiketler sabit ve tam liste olarak görünür.
 * - Uygun yazısı olan etiketler o yazıya bağlantıdır; tıklanabilsin diye fare üstüne gelince ya da
 *   klavyeyle odaklanınca şerit durur.
 */
const CSS = `
@keyframes lp-audience-flow { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
.lp-audience-window { overflow: hidden; padding: 3px 0; -webkit-mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent); }
.lp-audience-track { display: flex; width: max-content; animation: lp-audience-flow 110s linear infinite; }
.lp-audience-track[data-paused="true"], .lp-audience-window:focus-within .lp-audience-track { animation-play-state: paused; }
@media (hover: hover) { .lp-audience-window:hover .lp-audience-track { animation-play-state: paused; } }
.lp-audience-group { display: flex; flex-shrink: 0; gap: 0.75rem; padding-right: 0.75rem; }
@media (prefers-reduced-motion: reduce) {
  .lp-audience-window { -webkit-mask-image: none; mask-image: none; }
  .lp-audience-track { width: auto; animation: none; justify-content: center; }
  .lp-audience-group { flex-shrink: 1; flex-wrap: wrap; justify-content: center; padding: 0 1rem; gap: 0.5rem; }
  .lp-audience-group[aria-hidden="true"], .lp-audience-toggle { display: none; }
}
`;

const PILL =
  "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300";

export function AudienceMarquee({ tags, language }: { tags: AudienceTag[]; language: Language }) {
  const tr = language === "tr";
  const [paused, setPaused] = useState(false);
  const label = paused
    ? tr ? "Kayan yazıyı devam ettir" : "Resume scrolling text"
    : tr ? "Kayan yazıyı durdur" : "Pause scrolling text";

  return (
    <div>
      <style>{CSS}</style>
      <div
        className="lp-audience-window"
        onBlur={(e) => {
          // Klavyeyle gezerken tarayıcı kutuyu kaydırabilir; odak şeritten çıkınca hizayı geri al.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.scrollLeft = 0;
        }}
      >
        <div className="lp-audience-track" data-paused={paused}>
          {[false, true].map((copy) => (
            <ul key={String(copy)} className="lp-audience-group" aria-hidden={copy || undefined}>
              {tags.map(({ label: text, blog }) => {
                const inner = (
                  <>
                    <span className="w-1 h-1 rounded-full bg-blue-400" aria-hidden="true" />
                    {text}
                  </>
                );
                return (
                  <li key={text} className="flex">
                    {blog ? (
                      // İkinci kopya da tıklanır (ekranda o da görünür); klavye sırasına girmez.
                      <a
                        href={localizedPath(`/blog/${blog}`, language)}
                        tabIndex={copy ? -1 : undefined}
                        className={`${PILL} transition-colors hover:border-blue-400/70 hover:bg-blue-500/25`}
                      >
                        {inner}
                        <ArrowUpRight className="h-3 w-3 opacity-70" aria-hidden />
                      </a>
                    ) : (
                      <span className={PILL}>{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={label}
        title={label}
        className="lp-audience-toggle ml-5 mt-1.5 flex h-5 w-5 items-center justify-center rounded-full text-blue-300 opacity-40 transition hover:bg-blue-500/20 hover:opacity-100 focus-visible:opacity-100"
      >
        {paused ? <Play className="h-3 w-3" aria-hidden /> : <Pause className="h-3 w-3" aria-hidden />}
      </button>
    </div>
  );
}
