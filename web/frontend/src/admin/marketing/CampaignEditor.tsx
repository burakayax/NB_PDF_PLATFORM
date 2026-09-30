import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { CAMPAIGN_TEMPLATES } from "./campaignTemplates";

/**
 * ZENGİN METİN ARAÇ ÇUBUĞU — admin HİÇBİR ZAMAN `<p>`/`<strong>` gibi ham HTML
 * etiketi görmez. `contentEditable` + `document.execCommand` kullanılıyor
 * (yalnızca kalın/italik/altı çizili için yeterli, yeni bir paket gerekmez —
 * bkz. SimpleMarkdown.tsx'teki aynı "hafif, bağımlılıksız" tercih).
 *
 * `syncKey` DIŞARIDAN değişince (bir şablon seçildiğinde) içerik programatik
 * olarak yenilenir; kullanıcı yazarken bu senkron ARAYA GİRMEZ — contentEditable
 * doğası gereği kontrolsüzdür, bu yüzden yalnız `syncKey` değiştiğinde DOM'a
 * yazıyoruz, her tuş vuruşunda değil (aksi hâlde imleç sıçrar).
 */
function RichTextEditor({
  html,
  onChange,
  syncKey,
}: {
  html: string;
  onChange: (html: string) => void;
  syncKey: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = html;
    }
    // syncKey bilinçli tek bağımlılık — `html` her tuş vuruşunda değişir,
    // onu da dependency yaparsak imleç her harfte başa sıçrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  const exec = (command: string) => {
    ref.current?.focus();
    document.execCommand(command);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const isEmpty = html.trim() === "" || html === "<br>";

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.12] bg-black/20">
      <div className="flex items-center gap-1 border-b border-white/[0.08] bg-white/[0.03] px-2 py-1.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("bold")}
          title="Kalın"
          className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("italic")}
          title="İtalik"
          className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("underline")}
          title="Altı çizili"
          className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <span className="ml-2 text-[10.5px] text-slate-500">Metni seçip düğmelere basarak biçimlendir</span>
      </div>
      <div className="relative">
        {isEmpty ? (
          <p className="pointer-events-none absolute left-4 top-3 text-sm text-slate-500">
            Kampanya metnini buraya yaz, ya da aşağıdan hazır bir şablon seç…
          </p>
        ) : null}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={() => ref.current && onChange(ref.current.innerHTML)}
          className="min-h-[160px] px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none [&_a]:text-violet-300"
        />
      </div>
    </div>
  );
}

/**
 * KAMPANYA EDİTÖRÜ — şablon seçici + zengin metin editörü. `subject`/`html`
 * kontrollü prop'lar (AdminPanel'deki `bSubj`/`bHtml` state'i); bu bileşen
 * yalnız GÖRÜNÜMDEN ve şablon uygulama akışından sorumlu.
 */
export function CampaignEditor({
  subject,
  onSubjectChange,
  html,
  onHtmlChange,
}: {
  subject: string;
  onSubjectChange: (v: string) => void;
  html: string;
  onHtmlChange: (v: string) => void;
}) {
  // Editör her programatik güncellemede (şablon uygulanınca) bu sayaç artar;
  // RichTextEditor yalnız bunu izler (yukarıdaki not).
  const [syncKey, setSyncKey] = useState(0);

  const applyTemplate = (id: string) => {
    const tpl = CAMPAIGN_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    const hasContent = subject.trim() !== "" || (html.trim() !== "" && html !== "<br>");
    if (hasContent) {
      const ok = window.confirm(
        "Konu ve gövdedeki mevcut metnin üzerine yazılacak. Devam edilsin mi?",
      );
      if (!ok) return;
    }
    onSubjectChange(tpl.subject);
    onHtmlChange(tpl.bodyHtml);
    setSyncKey((k) => k + 1);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hazır şablonlar</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Birine tıkla — konu ve metin otomatik dolar, dilediğin gibi değiştirebilirsin.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CAMPAIGN_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyTemplate(tpl.id)}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-violet-400/40 hover:bg-violet-500/[0.06]"
            >
              <span className="block text-[12.5px] font-semibold text-slate-100">{tpl.title}</span>
              <span className="mt-0.5 block text-[10.5px] leading-snug text-slate-500">{tpl.useCase}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Konu</p>
        <input
          className="w-full rounded-xl border border-white/[0.12] bg-black/20 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Örn. Yeni: PDF'den Word'e artık tek tıkla"
        />
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Metin</p>
        <RichTextEditor html={html} onChange={onHtmlChange} syncKey={syncKey} />
      </div>
    </div>
  );
}
