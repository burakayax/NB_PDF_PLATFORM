// ─────────────────────────────────────────────────────────────────────────────
// MESLEĞE GÖRE CV ÖRNEĞİ REHBERLERİ — CV aracındaki meslek kütüphanesinden (cvProfessionData.mjs) üretilir.
// Aynı veri hem araçtaki "Hazır cümleler"i hem bu yazıları besler; böylece yazıdaki öneri ile araçtaki öneri
// birebir tutarlıdır. İstatistik/vaat uydurulmaz; [X] yer tutucuları kullanıcının kendi rakamıdır.
// TR ve EN metinler ayrı yazılmış (çeviri değil) kaynak verilerden kurulur.
// ─────────────────────────────────────────────────────────────────────────────

import { PROFESSIONS } from "../components/tools/cv/cvProfessionData.mjs";

const post = (meta, tr, en) => ({ ...meta, tr, en });

/** Meslek id → { TR slug, EN slug, TR başlık adı, EN başlık adı, TR yalın ad, EN yalın ad } */
export const CV_PROFESSION_SLUGS = {
  sales: ["satis-danismani-cv-ornegi", "sales-representative-cv-example", "Satış Danışmanı", "Sales Representative"],
  accounting: ["muhasebeci-cv-ornegi", "accountant-cv-example", "Muhasebeci", "Accountant"],
  software: ["yazilim-gelistirici-cv-ornegi", "software-developer-cv-example", "Yazılım Geliştirici", "Software Developer"],
  teacher: ["ogretmen-cv-ornegi", "teacher-cv-example", "Öğretmen", "Teacher"],
  health: ["hemsire-cv-ornegi", "nurse-cv-example", "Hemşire", "Nurse"],
  support: ["musteri-temsilcisi-cv-ornegi", "customer-service-cv-example", "Müşteri Temsilcisi", "Customer Service Representative"],
  hr: ["insan-kaynaklari-uzmani-cv-ornegi", "hr-specialist-cv-example", "İnsan Kaynakları Uzmanı", "HR Specialist"],
  marketing: ["dijital-pazarlama-uzmani-cv-ornegi", "digital-marketing-cv-example", "Dijital Pazarlama Uzmanı", "Digital Marketing Specialist"],
  engineer: ["muhendis-cv-ornegi", "engineer-cv-example", "Mühendis", "Engineer"],
  hospitality: ["garson-otel-restoran-cv-ornegi", "hospitality-server-cv-example", "Garson / Otel / Restoran Çalışanı", "Hospitality & Restaurant Worker"],
  logistics: ["depo-lojistik-cv-ornegi", "warehouse-logistics-cv-example", "Depo ve Lojistik Çalışanı", "Warehouse & Logistics Associate"],
  manager: ["yonetici-cv-ornegi", "manager-cv-example", "Yönetici", "Manager"],
  design: ["grafik-tasarimci-cv-ornegi", "graphic-designer-cv-example", "Grafik Tasarımcı", "Graphic Designer"],
  admin: ["ofis-asistani-cv-ornegi", "office-administrator-cv-example", "Ofis Asistanı / Sekreter", "Office Administrator"],
};

const ACCENTS = ["sky", "emerald", "violet", "amber", "blue", "cyan", "fuchsia", "rose"];

function trBlocks(p, name) {
  const lower = name.toLocaleLowerCase("tr");
  return [
    { t: "lead", x: `${name} CV'si yazarken en sık yapılan hata, görev tanımını olduğu gibi sıralamaktır. İşveren ne yaptığınızı değil, ne kadar iyi yaptığınızı görmek ister. Bu rehberde ${lower} pozisyonu için profil özeti, deneyim maddeleri ve beceri bölümünü nasıl yazacağınızı, kopyalayıp kendinize uyarlayabileceğiniz örneklerle bulacaksınız.` },
    { t: "h2", x: "CV'nin sırası ve uzunluğu" },
    { t: "p", x: "Üstte ad, unvan ve iletişim bilgileri; hemen altında kısa bir profil özeti; sonra iş deneyimi, eğitim ve beceriler gelir. Deneyiminiz azsa (yeni mezun, staj) eğitim ve projeleri deneyimin önüne alın. Çoğu başvuru için tek sayfa yeterlidir; 10 yılı aşkın deneyimde ikinci sayfa kabul edilebilir." },
    { t: "tip", x: "Başvuru sistemleri (ATS) düz, tek sütunlu ve standart başlıklı (Özet, Deneyim, Eğitim, Beceriler) CV'leri en iyi okur. İşe alımcıya gidecek tasarımlı bir sürüm için ayrı bir şablon seçebilirsiniz." },
    { t: "h2", x: `${name} için profil özeti örnekleri` },
    { t: "p", x: "Özet 2-4 cümle olmalı: kaç yıllık deneyiminiz olduğu, güçlü yanlarınız ve hedefiniz. Aşağıdaki taslaklardan birini alıp köşeli [X] yerlerine kendi bilginizi yazın:" },
    { t: "ul", items: p.summary.tr },
    { t: "h2", x: `${name} deneyim maddeleri` },
    { t: "p", x: "Her madde bir eylemle başlamalı ve mümkünse bir sayı içermelidir: kaç kişi, kaç adet, yüzde kaç, ne kadar sürede. Aşağıdaki örneklerde [X] gördüğünüz yere kendi gerçek rakamınızı yazın; rakamınızı bilmiyorsanız o maddeyi kullanmayın." },
    { t: "ul", items: p.bullets.tr },
    { t: "tip", x: "Yalnızca gerçekten yaptığınız işleri yazın. Mülakatta bir maddenin ayrıntısını anlatamıyorsanız o madde CV'nizde durmamalı." },
    { t: "cta", title: "Hazır cümlelerle CV'ni kur", x: "CV Oluştur'da mesleğinizi seçin; bu rehberdeki cümleler, özet taslakları ve beceri önerileri tek tıkla CV'nize eklensin. Ücretsiz, üyelik yeterli.", btn: "CV oluştur", tool: "/tools/cv-olustur" },
    { t: "h2", x: `${name} için beceri bölümü` },
    { t: "p", x: "Becerileri ilandaki kelimelerle eşleştirin: ilan \"Excel\" diyorsa \"ofis programları\" yerine \"Excel\" yazın. Aşağıdakiler bu meslekte sık aranan başlıklardır; yalnızca gerçekten bildiklerinizi seçin:" },
    { t: "ul", items: p.skills.tr },
    { t: "h2", x: "Göndermeden önce kontrol listesi" },
    { t: "steps", items: [
      { title: "Rakamları tamamlayın", x: "Hiçbir yerde [X] gibi doldurulmamış yer kalmasın." },
      { title: "Tarihleri kontrol edin", x: "İş tarihlerinde çakışma ya da açıklanamayan boşluk olmasın; CV Oluştur'un Analiz bölümü bunu sizin yerinize hesaplar." },
      { title: "İlana uyarlayın", x: "İlandaki kelimeler CV'nizde (doğruysa) geçsin; ilan eşleştirici hangilerinin eksik olduğunu gösterir." },
      { title: "PDF alın", x: "Metin seçilebilir bir PDF ile gönderin; fotoğraf zorunlu değilse ilan istemedikçe eklemek zorunda değilsiniz." },
    ] },
  ];
}

function enBlocks(p, name) {
  const lower = name.toLowerCase();
  return [
    { t: "lead", x: `The most common mistake in a ${lower} CV is listing duties instead of results. Employers want to see how well you did the job, not just that you were assigned it. This guide shows how to write the profile summary, work-experience bullets and skills section for a ${lower} role, with examples you can copy and adapt.` },
    { t: "h2", x: "Order and length" },
    { t: "p", x: "Put your name, title and contact details at the top, a short profile summary beneath, then work experience, education and skills. With little experience (recent graduate, internship) move education and projects ahead of work history. One page is enough for most applications; a second page is acceptable beyond roughly ten years of experience." },
    { t: "tip", x: "Applicant tracking systems (ATS) read plain, single-column CVs with standard headings (Summary, Experience, Education, Skills) best. Pick a more designed template for the version you hand to a recruiter." },
    { t: "h2", x: `Profile summary examples for a ${lower}` },
    { t: "p", x: "Keep it to two to four sentences: years of experience, strengths and goal. Take one draft below and replace each [X] with your own information:" },
    { t: "ul", items: p.summary.en },
    { t: "h2", x: `Work-experience bullets for a ${lower}` },
    { t: "p", x: "Start each bullet with an action and, where you can, include a number: how many people, items, what percentage, how fast. Wherever you see [X] below, insert your own real figure; if you don't know it, leave that bullet out." },
    { t: "ul", items: p.bullets.en },
    { t: "tip", x: "Only write what you actually did. If you couldn't explain a bullet in an interview, it shouldn't be on your CV." },
    { t: "cta", title: "Build your CV with ready-made phrases", x: "Pick your field in CV Maker and the phrases, summary drafts and skill suggestions from this guide are added with one tap. Free with an account.", btn: "Create CV", tool: "/tools/cv-olustur" },
    { t: "h2", x: `Skills section for a ${lower}` },
    { t: "p", x: "Mirror the job ad's wording: if it says \"Excel\", write \"Excel\" rather than \"office software\". These are commonly requested for this role; select only what you genuinely know:" },
    { t: "ul", items: p.skills.en },
    { t: "h2", x: "Checklist before you send it" },
    { t: "steps", items: [
      { title: "Fill in the numbers", x: "No [X] placeholder should remain anywhere." },
      { title: "Check the dates", x: "No overlaps or unexplained gaps; the Analysis tab in CV Maker calculates this for you." },
      { title: "Tailor to the ad", x: "Where true, use the ad's keywords; the job-ad matcher shows which are missing." },
      { title: "Export a PDF", x: "Send a PDF with selectable text; add a photo only if the ad or local custom expects one." },
    ] },
  ];
}

export const CV_PROFESSION_POSTS = PROFESSIONS.filter((p) => CV_PROFESSION_SLUGS[p.id]).map((p, i) => {
  const [slugTr, , nameTr, nameEn] = CV_PROFESSION_SLUGS[p.id];
  return post(
    {
      slug: slugTr,
      date: "2026-10-14",
      updated: "2026-10-14",
      readMinutes: 5,
      tags: { tr: ["CV Örneği", nameTr, "ATS"], en: ["CV Example", nameEn, "ATS"] },
      accent: ACCENTS[i % ACCENTS.length],
      tool: "/tools/cv-olustur",
    },
    {
      title: `${nameTr} CV Örneği`,
      description: `${nameTr} CV'si nasıl yazılır? Profil özeti, rakamlı deneyim maddeleri ve beceri örnekleri; kopyalayıp kendinize uyarlayın.`,
      excerpt: `${nameTr} CV'sinde görev listesi yerine sonuç yazın. Özet, deneyim maddesi ve beceri örnekleri bu rehberde.`,
      blocks: trBlocks(p, nameTr),
      faq: [],
    },
    {
      title: `${nameEn} CV Example`,
      description: `How to write a ${nameEn} CV: profile summary, number-driven bullets and key skills, with examples you can adapt.`,
      excerpt: `In a ${nameEn.toLowerCase()} CV, write results rather than a duty list. Summary, bullet and skills examples inside.`,
      blocks: enBlocks(p, nameEn),
      faq: [],
    },
  );
});

/** EN slug eşlemesi (enSlugs.mjs buradan beslenir). */
export const CV_PROFESSION_EN_SLUGS = Object.fromEntries(Object.values(CV_PROFESSION_SLUGS).map(([tr, en]) => [tr, en]));

/** Instagram kaydırmalı gönderi metni (carouselCopy.mjs kuralları: kapak ≤14 kelime, 4–6 slayt, metin 20–200 karakter). */
const clip = (t, n) => (t.length <= n ? t : t.slice(0, t.lastIndexOf(" ", n - 1)).replace(/[,;:\s]+$/, "") + "…");
const noPh = (t) => t.replace(/\[X\]/g, "X");

export const CV_PROFESSION_CAROUSELS = Object.fromEntries(
  PROFESSIONS.filter((p) => CV_PROFESSION_SLUGS[p.id]).map((p) => {
    const [slugTr, , nameTr] = CV_PROFESSION_SLUGS[p.id];
    return [slugTr, {
      hook: `${nameTr} CV'si: görev değil sonuç yazın`,
      slides: [
        ["Özetle başlayın", clip("Üstte 2–4 cümlelik özet: " + noPh(p.summary.tr[0]), 200)],
        ["Rakamla yazın", clip("Örnek madde: " + noPh(p.bullets.tr[0]) + ". X yerine kendi gerçek rakamınızı yazın.", 200)],
        ["Becerileri ilandan alın", clip("İlanın kullandığı kelimeleri yazın: " + p.skills.tr.slice(0, 4).join(", ") + " gibi. Yalnızca gerçekten bildiklerinizi ekleyin.", 200)],
        ["Uydurmayın", "Mülakatta anlatamayacağınız bir madde CV'de durmasın. Rakamınızı bilmiyorsanız o maddeyi yazmayın."],
        ["Hazır cümleler", "CV Oluştur'da mesleğinizi seçin; bu cümleler ve beceri önerileri tek tıkla CV'nize eklensin. Ücretsiz."],
      ],
    }];
  }),
);
