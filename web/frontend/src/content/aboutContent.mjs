// Hakkımızda sayfasının metni — TEK KAYNAK.
// React sayfası (AboutPage.tsx) ve prerender betiği (scripts/generate-seo-files.mjs) aynı
// dosyayı okur; böylece arama motorunun gördüğü ham HTML ile ekrandaki metin ayrışmaz.

export const aboutCopy = {
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
