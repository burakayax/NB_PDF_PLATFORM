import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import {
  TOOLS,
  TOOL_HUE,
  HUES,
  type Tool,
  type CategoryId,
} from "../../lib/toolCatalog";
import type { Language } from "../../i18n/landing";
import type { FeatureKey } from "../../api/subscription";

/**
 * ARAÇLAR BÖLÜMÜ (ana sayfa, misafir) — tüm araç kataloğu.
 *
 * Tasarım kararları:
 *  • Tek tip çizgi ikon (emoji YOK) → kurumsal, tutarlı bir görünüm.
 *  • Her karta bir satır açıklama → kullanıcı adı anlamasa bile ne yaptığını görür.
 *  • Arama + kategori süzgeci → 38 araç tek tek okunmak zorunda kalmaz.
 *  • Rozet SADECE gerçek bir ayrıcalık anlatıyorsa (üyeliksiz / yapay zekâ);
 *    her kartta rozet olursa hiçbiri fark edilmez.
 */

// FeatureKey OLMAYAN araçlar (AI/özel SEO sayfaları) → /tools/<slug>'a gider.
// FeatureKey araçları (merge, split…) uygulama içinde açılır.
const SEO_SLUG_TOOLS = new Set<string>([
  "pdf-ozetle",
  "pdf-sohbet",
  "pdf-ceviri",
  "pdf-karsilastir",
  "pdf-veri-cikar",
  "ai-toplu-islem",
  "pdf-duzenle",
  "pdf-imzala",
  "pdf-yorumla",
  "hassas-veri-gizle",
  "taranmis-pdf-ocr",
  "aranabilir-pdf",
  "belge-tara",
  "gorsel-sikistir",
  "gorsel-boyutlandir",
  "pdf-kesit-al",
  "udf-to-pdf",
]);






const CATEGORY_META: Record<
  CategoryId,
  { tr: string; en: string; ring: string; tint: string; text: string; glow: string }
> = {
  ai: {
    tr: "Yapay Zekâ", en: "AI",
    ring: "group-hover:border-fuchsia-400/40",
    tint: "bg-fuchsia-500/10 ring-fuchsia-400/20",
    text: "text-fuchsia-300",
    glow: "group-hover:shadow-[0_18px_40px_-20px_rgba(217,70,239,0.55)]",
  },
  edit: {
    tr: "Düzenle", en: "Edit",
    ring: "group-hover:border-violet-400/40",
    tint: "bg-violet-500/10 ring-violet-400/20",
    text: "text-violet-300",
    glow: "group-hover:shadow-[0_18px_40px_-20px_rgba(139,92,246,0.55)]",
  },
  convert: {
    tr: "Dönüştür", en: "Convert",
    ring: "group-hover:border-sky-400/40",
    tint: "bg-sky-500/10 ring-sky-400/20",
    text: "text-sky-300",
    glow: "group-hover:shadow-[0_18px_40px_-20px_rgba(56,189,248,0.55)]",
  },
  scan: {
    tr: "Tara & Metin Tanıma", en: "Scan & OCR",
    ring: "group-hover:border-cyan-400/45",
    tint: "bg-cyan-500/10 ring-cyan-400/20",
    text: "text-cyan-300",
    glow: "group-hover:shadow-[0_18px_40px_-20px_rgba(34,211,238,0.55)]",
  },
  security: {
    tr: "Güvenlik", en: "Security",
    ring: "group-hover:border-emerald-400/40",
    tint: "bg-emerald-500/10 ring-emerald-400/20",
    text: "text-emerald-300",
    glow: "group-hover:shadow-[0_18px_40px_-20px_rgba(16,185,129,0.55)]",
  },
};

const CATEGORY_ORDER: CategoryId[] = ["ai", "edit", "scan", "convert", "security"];

/** Arama için: Türkçe karakterleri sadeleştirip küçük harfe indirger. */
function norm(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .trim();
}

interface PdfToolsSectionProps {
  language: Language;
  onUseWebApp: () => void;
  onOpenTool: (id: FeatureKey) => void;
  /** Ziyaretçi giriş yapmış mı — kayıt çağrısı yalnız misafire gösterilir. */
  isAuthenticated?: boolean;
  onRegister?: () => void;
}

export default function PdfToolsSection({
  language,
  onUseWebApp,
  onOpenTool,
  isAuthenticated,
  onRegister,
}: PdfToolsSectionProps) {
  const tr = language === "tr";
  /** Ücretsiz üyelikle açılan araç sayısı — listeden hesaplanır. */
  const hesapAracSayisi = useMemo(() => TOOLS.filter((t) => t.account).length, []);
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = norm(query);
    return TOOLS.filter((t) => {
      if (filter !== "all" && t.cat !== filter) return false;
      if (!q) return true;
      return norm(`${t[language].name} ${t[language].desc} ${t.id}`).includes(q);
    });
  }, [filter, query, language]);

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        cat,
        items: visible.filter((t) => t.cat === cat),
      })).filter((g) => g.items.length > 0),
    [visible],
  );

  function openTool(t: Tool) {
    if (SEO_SLUG_TOOLS.has(t.id)) {
      if (typeof window !== "undefined") window.location.assign(`/tools/${t.id}`);
      return;
    }
    onOpenTool(t.id as FeatureKey);
  }

  return (
    <section id="tools" className="relative overflow-hidden py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.10)_0%,transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8">
        {/* Başlık */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-semibold tracking-wide text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            {tr ? `${TOOLS.length} PDF ARACI` : `${TOOLS.length} PDF TOOLS`}
          </span>
          <h2
            className="mt-5 text-4xl font-extrabold tracking-tight text-white md:text-5xl"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {tr ? "Her İhtiyaç İçin Doğru Araç" : "The Right Tool for Every Need"}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            {tr
              ? "Aradığınızı yazın ya da bir kategori seçin. «Üyeliksiz» işaretli araçlar kayıt olmadan, dosyanız cihazınızdan çıkmadan çalışır."
              : "Search, or pick a category. Tools marked «No sign-up» run without an account and never upload your file."}
          </p>
        </motion.div>

        {/* Arama + kategori süzgeci */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr ? "Araç ara — örn. birleştir, Word, imza" : "Search tools — e.g. merge, Word, sign"}
              aria-label={tr ? "Araç ara" : "Search tools"}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-violet-400/40 focus:bg-white/[0.06]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {(["all", ...CATEGORY_ORDER] as const).map((c) => {
              const active = filter === c;
              const label =
                c === "all"
                  ? tr ? "Tümü" : "All"
                  : tr ? CATEGORY_META[c].tr : CATEGORY_META[c].en;
              const count =
                c === "all" ? TOOLS.length : TOOLS.filter((t) => t.cat === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
                    active
                      ? "border-violet-400/40 bg-violet-500/15 text-white"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200"
                  }`}
                >
                  {label}
                  <span className={`ml-1.5 text-[11px] ${active ? "text-violet-200/80" : "text-slate-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/*
          ÜCRETSİZ ÜYELİK ŞERİDİ — araçların TAM ÜSTÜNDE.
          Aynı çağrı sayfanın en altındayken kullanıcı araçlara bakarken
          görmüyordu; kayıt kararı araçları incelerken veriliyor, sayfa
          sonunda değil. Şerit kısa tutuldu: burada iş, aracı kullanmaya
          gelen kişiyi durdurmak değil, "bunlar da var" demek.
        */}
        {!isAuthenticated && (
          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-sky-400/25 bg-sky-500/[0.07] px-5 py-4 text-center sm:flex-row sm:text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <p className="flex-1 text-[13px] leading-relaxed text-slate-300">
              {tr ? (
                <>
                  <strong className="text-white">Mavi işaretli {hesapAracSayisi} araç</strong> ücretsiz
                  üyelikle açılıyor — taranmış belgeyi metne çevirme, form doldurma, üstveri temizleme.
                  Kart bilgisi istenmez.
                </>
              ) : (
                <>
                  <strong className="text-white">{hesapAracSayisi} tools marked in blue</strong> unlock
                  with a free account — scanned-document OCR, form filling, metadata removal. No card required.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => (onRegister ? onRegister() : onUseWebApp())}
              className="shrink-0 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-5 py-2.5 text-[13px] font-bold text-slate-950 transition hover:brightness-110"
            >
              {tr ? "Ücretsiz üye ol" : "Create free account"}
            </button>
          </div>
        )}

        {/* Kategoriler + kartlar */}
        <div className="mt-12 space-y-12">
          {grouped.map(({ cat, items }) => {
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat}>
                <div className="mb-5 flex items-center gap-3">
                  <h3 className={`text-[13px] font-bold uppercase tracking-[0.14em] ${meta.text}`}>
                    {tr ? meta.tr : meta.en}
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((t, i) => {
                    const { Icon } = t;
                    const copy = t[language];
                    const hue = HUES[TOOL_HUE[t.id] ?? "violet"];
                    return (
                      <motion.button
                        key={t.id}
                        type="button"
                        onClick={() => openTool(t)}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.2) }}
                        className={`group relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.055] ${hue.ring} ${hue.glow}`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl shadow-inner shadow-black/20 ring-1 transition duration-200 group-hover:scale-[1.06] ${hue.tile} ${hue.icon}`}
                          >
                            <Icon className="h-5 w-5" strokeWidth={2} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-semibold text-white/90 transition group-hover:text-white">
                              {copy.name}
                            </span>
                            {(t.free || t.account || t.ai) && (
                              <span
                                className={`mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide ${
                                  t.free
                                    ? "text-emerald-300/90"
                                    : t.account
                                      ? "text-sky-300/90"
                                      : "text-fuchsia-300/90"
                                }`}
                              >
                                <span
                                  className={`h-1 w-1 rounded-full ${
                                    t.free ? "bg-emerald-400" : t.account ? "bg-sky-400" : "bg-fuchsia-400"
                                  }`}
                                />
                                {t.free
                                  ? tr ? "Üyeliksiz" : "No sign-up"
                                  : t.account
                                    ? tr ? "Ücretsiz üyelik" : "Free account"
                                    : tr ? "Yapay zekâ" : "AI"}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400 transition group-hover:text-slate-300">
                          {copy.desc}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {grouped.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-14 text-center">
              <p className="text-sm text-slate-400">
                {tr ? "Bu aramaya uyan araç bulunamadı." : "No tool matches that search."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="mt-3 text-[13px] font-semibold text-violet-300 underline underline-offset-4 transition hover:text-violet-200"
              >
                {tr ? "Tüm araçları göster" : "Show all tools"}
              </button>
            </div>
          )}
        </div>

        {/* Alt eylem */}
        <div className="mt-14 text-center">
          <p className="text-[13px] text-slate-400">
            {tr
              ? "Aradığınızı bulamadınız mı? Sürekli yeni araçlar ekliyoruz."
              : "Can't find what you need? We're constantly adding new tools."}
          </p>
          <button
            onClick={onUseWebApp}
            className="mt-4 rounded-xl border border-white/15 bg-white/[0.03] px-6 py-2.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.07]"
          >
            {tr ? "Çalışma alanını aç →" : "Open the workspace →"}
          </button>
        </div>

      </div>
    </section>
  );
}
