import { motion } from "framer-motion";
import { AnimatedCardOptions, type CardOption } from "./animated-card-options";
import type { Language } from "../../i18n/landing";

// ─── Gerçek araç listesi (PDF PLATFORM) ───────────────────────────────────

const toolCategories = (lang: Language) => [
  {
    id: "convert",
    label: lang === "tr" ? "Dönüştür" : "Convert",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    divider: "bg-blue-500/15",
    tools: [
      { id: "c1", icon: "📄", name: "PDF → Word" },
      { id: "c2", icon: "📊", name: "PDF → Excel" },
      { id: "c3", icon: "📑", name: "PDF → PowerPoint" },
      { id: "c4", icon: "🖼️", name: "PDF → Görsel" },
      { id: "c5", icon: "🔤", name: "Word → PDF" },
      { id: "c6", icon: "📈", name: "Excel → PDF" },
      { id: "c7", icon: "🎨", name: "Görsel → PDF" },
      { id: "c8", icon: "🌐", name: "HTML → PDF" },
    ] satisfies CardOption[],
  },
  {
    id: "edit",
    label: lang === "tr" ? "Düzenle" : "Edit",
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    divider: "bg-violet-500/15",
    tools: [
      {
        id: "e1",
        icon: "🔗",
        name: lang === "tr" ? "PDF Birleştir" : "Merge PDF",
      },
      { id: "e2", icon: "✂️", name: lang === "tr" ? "PDF Böl" : "Split PDF" },
      {
        id: "e3",
        icon: "📦",
        name: lang === "tr" ? "PDF Sıkıştır" : "Compress PDF",
      },
      {
        id: "e4",
        icon: "🔄",
        name: lang === "tr" ? "PDF Döndür" : "Rotate PDF",
      },
      {
        id: "e5",
        icon: "🗑️",
        name: lang === "tr" ? "Sayfa Sil" : "Delete Pages",
      },
      {
        id: "e6",
        icon: "⇅",
        name: lang === "tr" ? "Sayfaları Düzenle" : "Organize Pages",
      },
      {
        id: "e7",
        icon: "#️⃣",
        name: lang === "tr" ? "Sayfa Numarası Ekle" : "Add Page Numbers",
      },
      {
        id: "e8",
        icon: "💧",
        name: lang === "tr" ? "Filigran Ekle" : "Add Watermark",
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
        id: "s1",
        icon: "🔒",
        name: lang === "tr" ? "PDF Şifrele" : "Encrypt PDF",
      },
      {
        id: "s2",
        icon: "🔓",
        name: lang === "tr" ? "Şifre Kaldır" : "Unlock PDF",
      },
      { id: "s3", icon: "🛠️", name: lang === "tr" ? "PDF Onar" : "Repair PDF" },
    ] satisfies CardOption[],
  },
];

interface PdfToolsSectionProps {
  language: Language;
  onUseWebApp: () => void;
}

export default function PdfToolsSection({
  language,
  onUseWebApp,
}: PdfToolsSectionProps) {
  const categories = toolCategories(language);

  return (
    <section id="tools" className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.07)_0%,transparent_60%)]" />

      <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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
              ? "20+ profesyonel PDF aracı. Web ve masaüstü. Uygulama değiştirmeden."
              : "20+ professional PDF tools. Web and desktop. No app-switching."}
          </p>
        </motion.div>

        {/* All categories rendered at once */}
        <div className="space-y-14">
          {categories.map((cat, catIdx) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
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
                onSelect={(tool) => {
                  console.debug("Tool selected:", tool.name);
                  onUseWebApp();
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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
