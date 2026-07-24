import { motion } from "framer-motion";
import { Crop } from "lucide-react";
import { AnimatedCardOptions, type CardOption } from "./animated-card-options";
import type { Language } from "../../i18n/landing";
import type { FeatureKey } from "../../api/subscription";

// ─── Gerçek araç listesi (PDF Platform) ───────────────────────────────────
// NOT: `id` alanları GERÇEK featureId'dir → karta tıklayınca /tools/<slug>'a
// gidilir (misafir client-capable araçta login'siz kullanır). 🆓 = client-side,
// üyeliksiz anında çalışan araçlar.

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
  "crop-pdf",
]);

const toolCategories = (lang: Language) => [
  {
    id: "ai",
    label: lang === "tr" ? "Yapay Zekâ & Düzenleme" : "AI & Editing",
    badge: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
    divider: "bg-fuchsia-500/15",
    tools: [
      {
        id: "pdf-ozetle",
        icon: "✨",
        name: lang === "tr" ? "PDF Özetle" : "Summarize PDF",
        badge: lang === "tr" ? "Yapay Zekâ" : "AI",
      },
      {
        id: "pdf-sohbet",
        icon: "💬",
        name: lang === "tr" ? "PDF ile Sohbet" : "Chat with PDF",
        badge: lang === "tr" ? "Yapay Zekâ" : "AI",
      },
      {
        id: "pdf-ceviri",
        icon: "🌍",
        name: lang === "tr" ? "PDF Çeviri" : "Translate PDF",
        badge: lang === "tr" ? "Yapay Zekâ" : "AI",
      },
      {
        id: "pdf-karsilastir",
        icon: "⚖️",
        name: lang === "tr" ? "PDF Karşılaştır" : "Compare PDFs",
        badge: lang === "tr" ? "Yapay Zekâ" : "AI",
      },
      {
        id: "pdf-veri-cikar",
        icon: "📋",
        name: lang === "tr" ? "PDF Veri Çıkar" : "Extract Data",
        badge: lang === "tr" ? "Yapay Zekâ" : "AI",
      },
      {
        id: "ai-toplu-islem",
        icon: "📚",
        name: lang === "tr" ? "Toplu İşle" : "Batch Process",
        badge: lang === "tr" ? "Yapay Zekâ" : "AI",
      },
      {
        id: "pdf-duzenle",
        icon: "✏️",
        name: lang === "tr" ? "PDF Düzenle" : "Edit PDF",
        badge: lang === "tr" ? "Üyeliksiz" : "No sign-up",
      },
      {
        id: "pdf-imzala",
        icon: "🖋️",
        name: lang === "tr" ? "PDF İmzala" : "Sign PDF",
        badge: lang === "tr" ? "Üyeliksiz" : "No sign-up",
      },
      {
        id: "pdf-yorumla",
        icon: "🖍️",
        name: lang === "tr" ? "PDF İşaretle" : "Markup PDF",
        badge: lang === "tr" ? "Üyeliksiz" : "No sign-up",
      },
      {
        id: "hassas-veri-gizle",
        icon: "🛡️",
        name: lang === "tr" ? "Hassas Veri Gizle" : "Redact PDF",
        badge: "Pro",
      },
      {
        id: "taranmis-pdf-ocr",
        icon: "🔎",
        name: lang === "tr" ? "Taranmış PDF (OCR)" : "Scanned PDF (OCR)",
        badge: lang === "tr" ? "Üyeliksiz" : "No sign-up",
      },
    ],
  },
  {
    id: "edit",
    label: lang === "tr" ? "Düzenle" : "Edit",
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    divider: "bg-violet-500/15",
    tools: [
      {
        id: "merge",
        icon: "🔗",
        name: lang === "tr" ? "PDF Birleştir" : "Merge PDF",
        badge: lang === "tr" ? "Üyeliksiz" : "No sign-up",
      },
      {
        id: "split",
        icon: "✂️",
        name: lang === "tr" ? "PDF Böl" : "Split PDF",
        badge: lang === "tr" ? "Üyeliksiz" : "No sign-up",
      },
      {
        id: "compress",
        icon: "📦",
        name: lang === "tr" ? "PDF Sıkıştır" : "Compress PDF",
      },
      {
        id: "flatten-pdf",
        icon: "📃",
        name: lang === "tr" ? "PDF Düzleştir" : "Flatten PDF",
      },
      {
        id: "extract-images",
        icon: "🖼️",
        name: lang === "tr" ? "PDF'ten Görsel Çıkar" : "Extract Images",
      },
      {
        id: "rotate-pdf",
        icon: "🔄",
        name: lang === "tr" ? "PDF Döndür" : "Rotate PDF",
        badge: lang === "tr" ? "Üyeliksiz" : "No sign-up",
      },
      {
        id: "delete-pages",
        icon: "🗑️",
        name: lang === "tr" ? "Sayfa Sil" : "Delete Pages",
        badge: lang === "tr" ? "Üyeliksiz" : "No sign-up",
      },
      {
        id: "organize-pdf",
        icon: "⇅",
        name: lang === "tr" ? "Sayfaları Düzenle" : "Organize Pages",
        badge: lang === "tr" ? "Üyeliksiz" : "No sign-up",
      },
      {
        id: "crop-pdf",
        icon: <Crop className="h-6 w-6 text-cyan-300" strokeWidth={2} />,
        name: lang === "tr" ? "PDF Kırp" : "Crop PDF",
        badge: lang === "tr" ? "Üyeliksiz" : "No sign-up",
      },
      {
        id: "page-numbers",
        icon: "#️⃣",
        name: lang === "tr" ? "Sayfa Numarası Ekle" : "Add Page Numbers",
      },
      {
        id: "watermark",
        icon: "💧",
        name: lang === "tr" ? "Filigran Ekle" : "Add Watermark",
      },
    ] satisfies CardOption[],
  },
  {
    id: "convert",
    label: lang === "tr" ? "Dönüştür" : "Convert",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    divider: "bg-blue-500/15",
    tools: [
      {
        id: "image-to-pdf",
        icon: "🎨",
        name: lang === "tr" ? "Görsel → PDF" : "Image → PDF",
        badge: lang === "tr" ? "Üyeliksiz" : "No sign-up",
      },
      { id: "pdf-to-word", icon: "📄", name: "PDF → Word" },
      { id: "pdf-to-excel", icon: "📊", name: "PDF → Excel" },
      { id: "pdf-to-ppt", icon: "📑", name: "PDF → PowerPoint" },
      { id: "ppt-to-pdf", icon: "📽️", name: "PowerPoint → PDF" },
      { id: "pdf-to-image", icon: "🖼️", name: "PDF → Görsel" },
      { id: "word-to-pdf", icon: "🔤", name: "Word → PDF" },
      { id: "excel-to-pdf", icon: "📈", name: "Excel → PDF" },
      { id: "html-to-pdf", icon: "🌐", name: "HTML → PDF" },
      {
        id: "pdf-to-text",
        icon: "📝",
        name: lang === "tr" ? "PDF → Metin" : "PDF → Text",
      },
    ] satisfies CardOption[],
  },
  {
    id: "security",
    label: lang === "tr" ? "Güvenlik" : "Security",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    divider: "bg-emerald-500/15",
    tools: [
      {
        id: "encrypt",
        icon: "🔒",
        name: lang === "tr" ? "PDF Şifrele" : "Encrypt PDF",
      },
      {
        id: "unlock-pdf",
        icon: "🔓",
        name: lang === "tr" ? "Şifre Kaldır" : "Unlock PDF",
      },
      { id: "repair-pdf", icon: "🛠️", name: lang === "tr" ? "PDF Onar" : "Repair PDF" },
    ] satisfies CardOption[],
  },
];

interface PdfToolsSectionProps {
  language: Language;
  onUseWebApp: () => void;
  onOpenTool: (id: FeatureKey) => void;
}

export default function PdfToolsSection({
  language,
  onUseWebApp,
  onOpenTool,
}: PdfToolsSectionProps) {
  const categories = toolCategories(language);

  return (
    <section id="tools" className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.07)_0%,transparent_60%)]" />

      <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-6">
            ⚡ {language === "tr" ? "Tüm PDF Araçları" : "All PDF Tools"}
          </span>
          <h2
            className="text-4xl md:text-5xl font-extrabold text-white mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {language === "tr"
              ? "Her İhtiyaç İçin Doğru Araç"
              : "The Right Tool for Every Need"}
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {language === "tr"
              ? "25+ profesyonel PDF aracı. Web ve masaüstü. Uygulama değiştirmeden."
              : "25+ professional PDF tools. Web and desktop. No app-switching."}
          </p>
        </motion.div>

        {/* All categories rendered at once */}
        <div className="space-y-14">
          {categories.map((cat, catIdx) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: catIdx * 0.1 }}
            >
              {/* Category header */}
              <div className="flex items-center gap-4 mb-6">
                <span
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${cat.badge}`}
                >
                  {cat.label}
                </span>
                <div className={`flex-1 h-px ${cat.divider}`} />
              </div>

              <AnimatedCardOptions
                options={cat.tools}
                columns={4}
                onSelect={(opt) => {
                  // AI/Editör/OCR araçları FeatureKey değil → özel SEO sayfasına git.
                  if (SEO_SLUG_TOOLS.has(opt.id)) {
                    if (typeof window !== "undefined") {
                      window.location.href = `/tools/${opt.id}`;
                    }
                    return;
                  }
                  onOpenTool(opt.id as FeatureKey);
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-14"
        >
          <p className="text-gray-500 text-sm mb-4">
            {language === "tr"
              ? "Aradığınızı bulamadınız mı? Sürekli yeni araçlar ekliyoruz."
              : "Can't find what you need? We're constantly adding new tools."}
          </p>
          <button
            onClick={onUseWebApp}
            className="px-6 py-2.5 rounded-xl border border-white/15 text-white text-sm font-medium hover:bg-white/5 transition-all"
          >
            {language === "tr" ? "Tümünü Gör →" : "View All Tools →"}
          </button>
        </motion.div>
      </div>
    </section>
  );
}
