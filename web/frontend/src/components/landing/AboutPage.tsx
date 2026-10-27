import { motion } from "framer-motion";
import { type Language } from "../../i18n/landing";
import { aboutCopy } from "../../content/aboutContent.mjs";

const copy = aboutCopy;

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
  viewport: { once: true },
} as const;

export function AboutPage({ language, onClose }: { language: Language; onClose: () => void }) {
  const tr = language === "tr";
  const t = tr ? copy.tr : copy.en;
  const backButton = (
    <button
      type="button"
      onClick={onClose}
      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white shadow-sm transition duration-200 hover:border-cyan-400/30 hover:bg-white/[0.09] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    >
      ← {tr ? "Geri dön" : "Back"}
    </button>
  );

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-white/10 to-transparent">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-8">{backButton}</div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">{t.title}</h1>
            <p className="text-lg text-gray-300 max-w-2xl">{t.subtitle}</p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        {/* Story */}
        <motion.section {...fade} className="mb-16">
          <h2 className="text-3xl font-bold mb-6">{t.story.title}</h2>
          <div className="space-y-4 max-w-3xl">
            {t.story.paragraphs.map((p) => (
              <p key={p} className="text-gray-300 text-lg leading-relaxed">{p}</p>
            ))}
          </div>
        </motion.section>

        {/* Mission & Vision */}
        <motion.section {...fade} className="mb-16">
          <h2 className="text-3xl font-bold mb-8">{t.purpose.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {t.purpose.items.map((item) => (
              <div
                key={item.label}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.04] to-transparent p-7"
              >
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{item.label}</p>
                <p className="text-gray-200 text-[17px] leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Principles */}
        <motion.section {...fade} className="mb-16">
          <h2 className="text-3xl font-bold mb-8">{t.principles.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {t.principles.items.map((item, idx) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-white/20 transition-colors"
              >
                <h3 className="text-xl font-semibold mb-2">{item.name}</h3>
                <p className="text-gray-300 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Offer */}
        <motion.section {...fade} className="mb-16">
          <h2 className="text-3xl font-bold mb-8">{t.offer.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {t.offer.items.map((item) => (
              <div key={item.name} className="p-5 rounded-xl border border-white/10 bg-white/[0.03]">
                <h3 className="text-lg font-semibold mb-1">{item.name}</h3>
                <p className="text-gray-300 text-[15px] leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Contact */}
        <motion.section {...fade}>
          <h2 className="text-3xl font-bold mb-6">{t.contact.title}</h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-2">
            {t.contact.description}{" "}
            <a href={`mailto:${t.contact.email}`} className="underline underline-offset-4 hover:text-white">
              {t.contact.email}
            </a>
          </p>
          <p className="text-gray-400 mb-3">{t.contact.legalLead}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {t.contact.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="underline underline-offset-4 text-gray-200 hover:text-white">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </motion.section>

        <div className="mt-16 flex justify-center">{backButton}</div>
      </div>

      {/* SEO Metadata */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "PDF Platform",
          url: "https://pdfplatform.app",
          logo: "https://pdfplatform.app/logo.png",
          description: t.orgDescription,
        })}
      </script>
    </div>
  );
}
