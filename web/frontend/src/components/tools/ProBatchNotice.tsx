import { Layers, Sparkles } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { localizedPath } from "../../seo/enSlugs.mjs";
import { trackGAEvent } from "../../lib/analytics";

/**
 * TOPLU İŞLEM — PRO KAZANIMI KARTI.
 *
 * Araçlarımızın çoğu cihazda çalıştığı için ücretsiz kullanıcıya doğal bir duvar
 * yoktur; aboneliğin karşılığını somut bir kazanımla göstermek gerekir. Seçilen
 * kazanım TOPLU İŞLEM: tek dosya herkese açık kalır, çok dosyayı tek seferde
 * işlemek Pro'nun getirisidir.
 *
 * Tasarım kuralları (bilerek):
 *  • ENGELLEMEZ. Kullanıcı işlemi yine yapar; yalnız ilk dosya işlenir.
 *  • ÖNCEDEN söyler. Kart düğmenin ÜSTÜNDE durur, kullanıcı basmadan önce ne
 *    olacağını bilir. "Bastım, meğer sadece biri işlenmiş" sürprizi olmaz.
 *  • Pazarlık etmez, korkutmaz, geri sayım yapmaz. Bir cümle kazanım, bir bağlantı.
 */
export function ProBatchNotice({
  language,
  fileCount,
  toolName,
  source = "batch_gate",
}: {
  language: Language;
  /** Kullanıcının eklediği dosya sayısı (1'den büyükken gösterilir). */
  fileCount: number;
  /** "20 dosyayı tek seferde" cümlesindeki araç adı — ör. "UDF dosyasını". */
  toolName?: string;
  /** GA'da hangi araçtan geldiğini ayırmak için. */
  source?: string;
}) {
  const tr = language === "tr";
  if (fileCount < 2) return null;

  const fiyatYolu = localizedPath("/pricing", tr ? "tr" : "en");

  return (
    <div className="field--full rounded-2xl border border-violet-400/25 bg-gradient-to-r from-violet-500/[0.10] to-fuchsia-500/[0.06] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30">
          <Layers className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-white">
            {tr ? "Toplu işlem Pro'da" : "Batch processing is a Pro feature"}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-300">
            {tr
              ? `${fileCount} dosya eklediniz. Şimdi ilk dosya ücretsiz işlenecek. Pro ile hepsini tek seferde işleyip sonucu tek dosyada indirirsiniz.`
              : `You added ${fileCount} files. The first one will be processed free. With Pro you process them all at once and download the result in one go.`}
          </p>
          <p className="mt-1.5 text-[12px] text-slate-400">
            {tr
              ? `${toolName ?? "Araç"} tek dosyada her zaman ücretsiz kalır — bunu kaldırmıyoruz.`
              : `${toolName ?? "The tool"} stays free for a single file — that is not going away.`}
          </p>
          <a
            href={fiyatYolu}
            onClick={() => trackGAEvent("batch_gate_click", { source })}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-2 text-[12px] font-bold text-white transition hover:from-violet-500 hover:to-fuchsia-500"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {tr ? "Pro'yu incele" : "See Pro"}
          </a>
        </div>
      </div>
    </div>
  );
}
