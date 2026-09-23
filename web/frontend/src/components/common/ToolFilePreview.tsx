import { useState } from "react";
import { FileText, Maximize2, X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { PdfPageVisualGrid } from "../split/PdfPageVisualGrid";
import PdfErrorBoundary from "../split/PdfErrorBoundary";

/**
 * SEÇİLEN BELGENİN SAYFA ÖNİZLEMESİ.
 *
 * Çalışma alanındaki araçların çoğunda dosya seçildikten sonra ekranda yalnızca
 * dosyanın adı ve boyutu yazıyordu; Sayfa Sırala gibi birkaç araçta ise belgenin
 * sayfaları kart kart görünüyordu. Kullanıcı doğru dosyayı yükleyip yüklemediğini
 * ancak işlemi çalıştırıp indirdikten sonra anlıyordu.
 *
 * Bu bileşen o görseli sayfa seçtirmeyen araçlara da taşır: ızgara "preview"
 * kipinde çalışır, hiçbir etkileşim sunmaz. "Büyüt" düğmesi aynı ızgarayı tam
 * ekranda açar — çok sayfalı belgeyi form içinde incelemek zor.
 *
 * Yalnızca TEK ve PDF dosya için anlamlıdır; çağıran taraf bunu kontrol eder
 * (birden çok dosyada sıralanabilir liste daha yararlıdır).
 */

type Props = {
  file: File;
  /** Şifreli belgelerde açma parolası — ızgara sayfaları bununla çizer. */
  password: string;
  pageCount: number | null;
  language: Language;
};

const NOOP = () => {};

export function ToolFilePreview({ file, password, pageCount, language }: Props) {
  const tr = language === "tr";
  const [expanded, setExpanded] = useState(false);
  /** Izgaranın bildirdiği gerçek sayfa sayısı — sunucu ön kontrolü gecikse de gelir. */
  const [gridPages, setGridPages] = useState(0);

  const pages = pageCount ?? gridPages;
  /**
   * Kutu yüksekliği sayfa sayısına göre: iki sayfalık belge için 360 piksellik
   * bir alan açmak ekranın yarısını boş bırakıyordu. Izgara sanal kaydırma
   * kullandığı için yükseklik "auto" olamaz, bu yüzden satır sayısından
   * hesaplanır ve bir tavanla sınırlanır.
   */
  const satir = pages > 0 ? Math.ceil(pages / 6) : 1;
  const yukseklik = Math.min(360, 44 + satir * 116);

  const grid = (zoom: number) => (
    <PdfErrorBoundary>
      <PdfPageVisualGrid
        file={file}
        password={password}
        maxPage={pageCount}
        language={language}
        mode="preview"
        pagesText=""
        onPagesTextChange={NOOP}
        onPagesErrorClear={NOOP}
        pageRotations={{}}
        onPageRotationsChange={NOOP}
        pageOrder={[]}
        onPageOrderChange={NOOP}
        zoomPercent={zoom}
        onStatsChange={(st) => setGridPages(st.totalPages)}
      />
    </PdfErrorBoundary>
  );

  return (
    <>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
        <div className="mb-2.5 flex flex-wrap items-center gap-2 px-1">
          <FileText className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
            {file.name}
          </span>
          {pages > 0 ? (
            <span className="shrink-0 text-[12px] font-medium tabular-nums text-slate-400">
              {pages} {tr ? "sayfa" : "pages"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:text-white"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            {tr ? "Büyüt" : "Expand"}
          </button>
        </div>
        {/* Belge görünür ama sayfayı aşağı itip işlem düğmesini ekrandan
            çıkarmaz; çok sayfalı belgede ızgara kendi içinde kayar. */}
        <div className="overflow-hidden rounded-xl" style={{ height: yukseklik }}>
          {grid(25)}
        </div>
      </div>

      {expanded ? (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#0b1020]/97 backdrop-blur-sm">
          <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
            <FileText className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
              {file.name}
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[13px] font-bold text-white transition hover:bg-white/[0.12]"
            >
              <X className="h-4 w-4" aria-hidden />
              {tr ? "Kapat" : "Close"}
            </button>
          </div>
          <div className="min-h-0 flex-1 p-3">{grid(50)}</div>
        </div>
      ) : null}
    </>
  );
}
