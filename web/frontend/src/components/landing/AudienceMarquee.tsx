import { useState } from "react";
import { Pause, Play } from "lucide-react";
import type { Language } from "../../i18n/landing";

/**
 * Hedef kitle şeridi: etiketler ekranın tüm genişliğinde, sağdan sola kesintisiz akar.
 * - Yalnız `transform` canlandırılır (sayfa hızını ve düzeni etkilemez).
 * - Döngü için liste iki kez yazılır; ikinci kopya ekran okuyuculardan gizlidir.
 * - Hareketi rahatsız edici bulan ziyaretçi düğmeyle durdurabilir; cihazında "hareketi azalt"
 *   seçili olanlarda şerit hiç akmaz, etiketler sabit ve tam liste olarak görünür.
 * - Etiketler tıklanmadığı için fare üstüne gelince durmaz.
 */
const CSS = `
@keyframes lp-audience-flow { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
.lp-audience-window { overflow: hidden; -webkit-mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent); }
.lp-audience-track { display: flex; width: max-content; animation: lp-audience-flow 95s linear infinite; }
.lp-audience-track[data-paused="true"] { animation-play-state: paused; }
.lp-audience-group { display: flex; flex-shrink: 0; gap: 0.75rem; padding-right: 0.75rem; }
@media (prefers-reduced-motion: reduce) {
  .lp-audience-window { -webkit-mask-image: none; mask-image: none; }
  .lp-audience-track { width: auto; animation: none; justify-content: center; }
  .lp-audience-group { flex-shrink: 1; flex-wrap: wrap; justify-content: center; padding: 0 1rem; gap: 0.5rem; }
  .lp-audience-group[aria-hidden="true"], .lp-audience-toggle { display: none; }
}
`;

export function AudienceMarquee({ tags, language }: { tags: string[]; language: Language }) {
  const tr = language === "tr";
  const [paused, setPaused] = useState(false);
  const label = paused
    ? tr ? "Kayan yazıyı devam ettir" : "Resume scrolling text"
    : tr ? "Kayan yazıyı durdur" : "Pause scrolling text";

  return (
    <div>
      <style>{CSS}</style>
      <div className="lp-audience-window">
        <div className="lp-audience-track" data-paused={paused}>
          {[false, true].map((copy) => (
            <ul key={String(copy)} className="lp-audience-group" aria-hidden={copy || undefined}>
              {tags.map((tag) => (
                <li
                  key={tag}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300"
                >
                  <span className="w-1 h-1 rounded-full bg-blue-400" aria-hidden="true" />
                  {tag}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={label}
        title={label}
        className="lp-audience-toggle mt-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 transition hover:bg-blue-500/20"
      >
        {paused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
      </button>
    </div>
  );
}
