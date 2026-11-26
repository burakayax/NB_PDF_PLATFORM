/**
 * Ana sayfa hedef kitle şeridi — TEK KAYNAK: ekrandaki şerit de, arama motorlarına giden hazır sayfa
 * metni (scripts/generate-seo-files.mjs) de buradan okur.
 * `blog`: Türkçe (dil öneksiz) yazı kısa adı. Adres `localizedPath` ile dile göre kurulur.
 * O kitleye gerçekten hitap eden bir yazı yoksa etiket bağlantısız bırakılır.
 */
export const AUDIENCE_TAGS = {
  tr: [
    { label: "Ofis Ekipleri" },
    { label: "Avukatlar", blog: "uyap-belge-yukleme-boyut-hatasi" },
    { label: "Öğrenciler" },
    { label: "İnsan Kaynakları" },
    { label: "KOBİ'ler" },
    { label: "Muhasebeciler", blog: "faturalari-toplu-muhasebeye-hazirlama" },
    { label: "Öğretmenler", blog: "ogretmen-cv-ornegi" },
    { label: "İhale Birimleri", blog: "ihale-dosyasi-pdf-hazirlama" },
    { label: "Mühendisler" },
    { label: "İş Başvurusu Yapanlar", blog: "cv-nasil-hazirlanir" },
    { label: "Kamu Çalışanları", blog: "edevlet-belgelerini-tek-pdf-yapma" },
    { label: "E-Ticaret Satıcıları" },
    { label: "İdari Personel", blog: "edevlet-belgelerini-tek-pdf-yapma" },
    { label: "Mali Müşavirler", blog: "faturadan-excele-veri-aktarma" },
    { label: "Akademisyenler", blog: "akademik-makale-ozetleme-literatur" },
    { label: "Emlak Danışmanları" },
    { label: "Serbest Çalışanlar" },
    { label: "Operasyon Yöneticileri" },
    { label: "Mimarlar" },
  ],
  en: [
    { label: "Office teams" },
    { label: "Lawyers", blog: "uyap-belge-yukleme-boyut-hatasi" },
    { label: "Students" },
    { label: "HR teams" },
    { label: "Small businesses" },
    { label: "Accountants", blog: "faturalari-toplu-muhasebeye-hazirlama" },
    { label: "Teachers", blog: "ogretmen-cv-ornegi" },
    { label: "Tender departments", blog: "ihale-dosyasi-pdf-hazirlama" },
    { label: "Engineers" },
    { label: "Job applicants", blog: "cv-nasil-hazirlanir" },
    { label: "Public sector staff", blog: "edevlet-belgelerini-tek-pdf-yapma" },
    { label: "Online sellers" },
    { label: "Administrative staff", blog: "edevlet-belgelerini-tek-pdf-yapma" },
    { label: "Tax advisors", blog: "faturadan-excele-veri-aktarma" },
    { label: "Academics", blog: "akademik-makale-ozetleme-literatur" },
    { label: "Real estate agents" },
    { label: "Freelancers" },
    { label: "Operations leads" },
    { label: "Architects" },
  ],
};
