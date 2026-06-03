import { motion } from "framer-motion";
import { type Language } from "../../i18n/landing";

const copy = {
  tr: {
    title: "Hakkımızda",
    subtitle: "PDF araçlarında mükemmellik ve yenilikçiliği hedefleyen takım",
    vision: {
      title: "Vizyon",
      description: "PDF yönetimini herkes için basit, hızlı ve güvenli hale getirmek. Kurumsal ve bireysel kullanıcılara profesyonel düzeyde araçlar sunarak dijital dünyada işlerini kolaylaştırmak.",
    },
    mission: {
      title: "Misyon",
      description: "Yüksek performanslı, kullanıcı dostu PDF işleme çözümleri geliştirmek. Her gün daha iyi hizmet sunarak müşteri memnuniyetini en üst seviyede tutmak ve teknolojide öncü olmak.",
    },
    values: {
      title: "Değerlerimiz",
      items: [
        { name: "Kalite", description: "Her ürünü en yüksek standartlarda sunmak" },
        { name: "Güvenlik", description: "Kullanıcı verilerini en önemli varlık olarak korumak" },
        { name: "İnovasyon", description: "Teknolojide sürekli iyileşme ve yenilik yapmak" },
        { name: "Müşteri Odaklılık", description: "Kullanıcı geri bildirimini dinlemek ve uygulamak" },
      ],
    },
    team: {
      title: "Takımımız",
      description: "NB Global Studio tarafından geliştirilen PDF Platform, dünya standartlarında bir ekibin ürünüdür. Yazılım geliştirme, tasarım ve müşteri hizmetleri alanında uzmanlar bir araya gelerek en iyi deneyimi sunmak için çalışmaktadır.",
    },
  },
  en: {
    title: "About",
    subtitle: "Team dedicated to excellence and innovation in PDF tools",
    vision: {
      title: "Vision",
      description: "Make PDF management simple, fast, and secure for everyone. Provide professional-grade tools to corporate and individual users to simplify their work in the digital world.",
    },
    mission: {
      title: "Mission",
      description: "Develop high-performance, user-friendly PDF processing solutions. Deliver improved service every day, maintain the highest level of customer satisfaction, and be a leader in technology.",
    },
    values: {
      title: "Our Values",
      items: [
        { name: "Quality", description: "Deliver every product at the highest standards" },
        { name: "Security", description: "Protect user data as our most important asset" },
        { name: "Innovation", description: "Continuously improve and innovate in technology" },
        { name: "Customer Focus", description: "Listen to and implement user feedback" },
      ],
    },
    team: {
      title: "Our Team",
      description: "PDF Platform, developed by NB Global Studio, is the product of a world-class team. Software developers, designers, and customer service experts work together to deliver the best experience.",
    },
  },
};

export function AboutPage({ language, onClose }: { language: Language; onClose: () => void }) {
  const tr = language === "tr";
  const t = tr ? copy.tr : copy.en;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-white/10 to-transparent">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">{t.title}</h1>
            <p className="text-lg text-gray-300 max-w-2xl">{t.subtitle}</p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        {/* Vision */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">{t.vision.title}</h2>
          <p className="text-gray-300 text-lg leading-relaxed">{t.vision.description}</p>
        </motion.section>

        {/* Mission */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-6">{t.mission.title}</h2>
          <p className="text-gray-300 text-lg leading-relaxed">{t.mission.description}</p>
        </motion.section>

        {/* Values */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold mb-8">{t.values.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {t.values.items.map((value, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-white/20 transition-colors"
              >
                <h3 className="text-xl font-semibold mb-2">{value.name}</h3>
                <p className="text-gray-300">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Team */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-bold mb-6">{t.team.title}</h2>
          <p className="text-gray-300 text-lg leading-relaxed">{t.team.description}</p>
        </motion.section>
      </div>

      {/* SEO Metadata */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "PDF PLATFORM",
          url: "https://pdfplatform.app",
          logo: "https://pdfplatform.app/logo.png",
          description: tr
            ? "PDF araçlarında mükemmellik ve yenilikçiliği hedefleyen takım"
            : "Team dedicated to excellence and innovation in PDF tools",
        })}
      </script>
    </div>
  );
}
