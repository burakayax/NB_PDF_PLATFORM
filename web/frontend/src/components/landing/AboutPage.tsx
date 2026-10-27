import { motion } from "framer-motion";
import { type Language } from "../../i18n/landing";

const copy = {
  tr: {
    title: "Hakkımızda",
    subtitle: "Belgeleriniz üzerinde çalışmak hızlı, anlaşılır ve güvenli olmalı. PDF Platform'u bunun için geliştiriyoruz.",
    story: {
      title: "Neden varız",
      paragraphs: [
        "PDF ile her gün karşılaşırız: bir belgeyi birleştirmek, sıkıştırmak, imzalamak, Word'e çevirmek, bir sözleşmeyi hızlıca anlamak. Çoğu zaman bu işler için dosyanızı tanımadığınız bir sunucuya yüklemeniz, ücretsiz denerken kırpılmış ya da filigranlı sonuç almanız ve sonunda abonelik duvarına çarpmanız gerekir.",
        "PDF Platform, bu deneyimi tersine çevirmek için NB Global Studio tarafından geliştirilen bir web platformudur. Amacımız; PDF araçlarını Türkçe ve İngilizce, sade bir arayüzle, ne yaptığını açıkça söyleyen bir ürünle sunmak.",
      ],
    },
    purpose: {
      title: "Misyon ve vizyon",
      items: [
        {
          label: "Misyonumuz",
          text: "Belge işlemlerini herkes için hızlı, anlaşılır ve güvenli hale getirmek. Kullanıcılarımızın dosyalarını gereksiz yere sunuculara taşımadan, ne yaptığını açıkça söyleyen şeffaf araçlarla zamandan tasarruf etmelerini sağlıyoruz.",
        },
        {
          label: "Vizyonumuz",
          text: "Belge çözümlerinde gizliliği, sadeliği ve şeffaflığı standart haline getiren, güvenle tercih edilen platform olmak.",
        },
      ],
    },
    principles: {
      title: "Nasıl çalışıyoruz",
      items: [
        {
          name: "Dosyanız mümkün olduğunca cihazınızda kalır",
          description:
            "Birleştirme, bölme, döndürme, sayfa silme ve sıralama, görselden PDF ve belge tarama gibi araçlar dosyanızı tarayıcınızdan çıkarmadan çalışır. Sunucuya ihtiyaç duyan araçlarda dosya işlem biter bitmez silinir. Hangi araçta ne olduğunu Gizlilik Politikası'ndaki tabloda araç araç görebilirsiniz.",
        },
        {
          name: "Yapay zekâ yalnızca siz seçtiğinizde devreye girer",
          description:
            "Özetleme, çeviri, veri çıkarma ve benzeri yapay zekâ araçlarında yalnızca belgenizden çıkarılan metin, sonucu üretmek için gönderilir; dosyanın kendisi gönderilmez ve metin modellerin eğitiminde kullanılmaz. Yapay zekâ çıktıları hata içerebilir; önemli kararlardan önce kontrol etmenizi öneririz.",
        },
        {
          name: "Sonuç ekranında sürpriz yok",
          description:
            "Çıktı dosyalarınıza görünür filigran eklemeyiz. Neyin ücretsiz, neyin üyelik gerektirdiği önceden gösterilir. Abonelikler kendiliğinden yenilenmez: süre bitmeden size haber verir, devam edip etmemeyi siz seçersiniz.",
        },
        {
          name: "Kullanıcıyı dinleriz",
          description:
            "Araçları puanlayabilir, eksik gördüğünüz şeyi bize yazabilirsiniz. Yeni araçlar ve iyileştirmeler büyük ölçüde bu geri bildirimlerle şekillenir.",
        },
      ],
    },
    offer: {
      title: "Neler sunuyoruz",
      items: [
        { name: "PDF araçları", description: "Birleştirme, bölme, sıkıştırma, döndürme, sayfa düzenleme, dönüştürme, şifreleme, imza ve daha fazlası." },
        { name: "Yapay zekâ destekli araçlar", description: "Belge özeti, belge ile sohbet, çeviri, veri çıkarma ve sözleşme denetimi." },
        { name: "Belge Tarayıcı", description: "Telefon kamerasıyla çektiğiniz belgeyi kenarlarını bularak düzeltir ve PDF'e çevirir." },
        { name: "CV ve fotoğraf araçları", description: "Şablonlarla CV hazırlama, ön yazı ve başvuru fotoğrafı düzenleme." },
      ],
    },
    contact: {
      title: "İletişim",
      description: "Soru, öneri ve geri bildirimleriniz için bize yazın:",
      email: "info@pdfplatform.app",
      legalLead: "Verilerinizin nasıl işlendiğini ve kullanım koşullarını okumak için:",
      links: [
        { href: "/privacy", label: "Gizlilik Politikası" },
        { href: "/kvkk", label: "KVKK Aydınlatma Metni" },
        { href: "/terms", label: "Hizmet Şartları" },
      ],
    },
    orgDescription: "Türkçe ve İngilizce PDF araçları, yapay zekâ destekli belge araçları ve belge tarayıcı sunan web platformu.",
  },
  en: {
    title: "About",
    subtitle: "Working on your documents should be fast, clear and safe. That is why we build PDF Platform.",
    story: {
      title: "Why we exist",
      paragraphs: [
        "We deal with PDFs every day: merging, compressing, signing, converting to Word, quickly understanding a contract. Too often that means uploading your file to a server you know nothing about, getting a cropped or watermarked result while you are still trying the tool for free, and then hitting a paywall.",
        "PDF Platform is a web platform built by NB Global Studio to turn that experience around. Our aim is to offer PDF tools in Turkish and English, with a simple interface and a product that says plainly what it does.",
      ],
    },
    purpose: {
      title: "Mission and vision",
      items: [
        {
          label: "Our mission",
          text: "To make document work fast, clear and secure for everyone. We help our users save time with transparent tools that say plainly what they do, without moving files to servers unnecessarily.",
        },
        {
          label: "Our vision",
          text: "To be the trusted document platform that makes privacy, simplicity and transparency the standard.",
        },
      ],
    },
    principles: {
      title: "How we work",
      items: [
        {
          name: "Your file stays on your device wherever possible",
          description:
            "Tools such as merge, split, rotate, delete and reorder pages, image to PDF and document scanning run without your file ever leaving your browser. For tools that need a server, the file is deleted as soon as processing ends. You can see, tool by tool, what happens where in the table in our Privacy Policy.",
        },
        {
          name: "AI only runs when you choose it",
          description:
            "In AI tools such as summarize, translate and data extraction, only the text extracted from your document is sent to produce the result; the file itself is not sent and the text is not used to train models. AI output can contain mistakes, so please check it before relying on it for important decisions.",
        },
        {
          name: "No surprises on the result screen",
          description:
            "We do not add visible watermarks to your output files. What is free and what needs an account is shown up front. Subscriptions never renew on their own: we remind you before the period ends and you decide whether to continue.",
        },
        {
          name: "We listen to users",
          description:
            "You can rate every tool and tell us what is missing. New tools and improvements are shaped largely by that feedback.",
        },
      ],
    },
    offer: {
      title: "What we offer",
      items: [
        { name: "PDF tools", description: "Merge, split, compress, rotate, organize pages, convert, protect, sign and more." },
        { name: "AI-powered tools", description: "Document summary, chat with a document, translation, data extraction and contract review." },
        { name: "Document Scanner", description: "Turns a photo of a document taken with your phone into a straightened, cropped PDF." },
        { name: "CV and photo tools", description: "Build a CV from templates, write a cover letter and prepare application photos." },
      ],
    },
    contact: {
      title: "Contact",
      description: "Write to us with questions, suggestions and feedback:",
      email: "info@pdfplatform.app",
      legalLead: "To read how your data is handled and the terms of use:",
      links: [
        { href: "/privacy", label: "Privacy Policy" },
        { href: "/kvkk", label: "KVKK Disclosure" },
        { href: "/terms", label: "Terms of Service" },
      ],
    },
    orgDescription: "A web platform with PDF tools in Turkish and English, AI-powered document tools and a document scanner.",
  },
};

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
