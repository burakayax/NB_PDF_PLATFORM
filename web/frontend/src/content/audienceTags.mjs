/**
 * Ana sayfa hedef kitle şeridi — TEK KAYNAK: ekrandaki şerit de, arama motorlarına giden hazır sayfa
 * metni (scripts/generate-seo-files.mjs) de buradan okur.
 * `blog` ya da `tool`: Türkçe sitedeki (dil öneksiz) yazı / araç kısa adı. Adres `localizedPath` ile dile göre kurulur.
 * Her etiket ayrı bir sayfaya gider; eşlemeye SEO oturumu karar verir.
 */
/** Etiketin gittiği dil-öneksiz yol. */
export const audiencePath = (tag) => (tag.tool ? `/tools/${tag.tool}` : `/blog/${tag.blog}`);

export const AUDIENCE_TAGS = {
  tr: [
    { label: "Ofis Ekipleri", blog: "en-iyi-ucretsiz-pdf-araclari" },
    { label: "Avukatlar", blog: "uyap-belge-yukleme-boyut-hatasi" },
    { label: "Öğrenciler", blog: "universite-kayit-evraklarini-hazirlama" },
    { label: "İnsan Kaynakları", blog: "bordro-sayfalarini-ayirma" },
    { label: "KOBİ'ler", blog: "faturalari-toplu-muhasebeye-hazirlama" },
    { label: "Muhasebeciler", blog: "banka-ekstresi-excele-aktarma" },
    { label: "Öğretmenler", blog: "ogretmen-cv-ornegi" },
    { label: "İhale Birimleri", blog: "ihale-dosyasi-pdf-hazirlama" },
    { label: "Mühendisler", tool: "pdf-karsilastir" },
    { label: "İş Başvurusu Yapanlar", blog: "cv-nasil-hazirlanir" },
    { label: "Kamu Çalışanları", blog: "edevlet-belgelerini-tek-pdf-yapma" },
    { label: "E-Ticaret Satıcıları", tool: "gorsel-boyutlandir" },
    { label: "İdari Personel", blog: "iki-pdf-birlestirme-ucretsiz" },
    { label: "Mali Müşavirler", blog: "faturadan-excele-veri-aktarma" },
    { label: "Akademisyenler", blog: "akademik-makale-ozetleme-literatur" },
    { label: "Emlak Danışmanları", blog: "kira-kontrati-dikkat-edilecek-maddeler" },
    { label: "Serbest Çalışanlar", blog: "pdf-e-imza-atma-nasil-yapilir" },
    { label: "Operasyon Yöneticileri", blog: "pdf-boyutu-kucultme-sikistirma" },
    { label: "Mimarlar", tool: "resize-pdf" },
  ],
  en: [
    { label: "Office teams", blog: "en-iyi-ucretsiz-pdf-araclari" },
    { label: "Lawyers", blog: "uyap-belge-yukleme-boyut-hatasi" },
    { label: "Students", blog: "universite-kayit-evraklarini-hazirlama" },
    { label: "HR teams", blog: "bordro-sayfalarini-ayirma" },
    { label: "Small businesses", blog: "faturalari-toplu-muhasebeye-hazirlama" },
    { label: "Accountants", blog: "banka-ekstresi-excele-aktarma" },
    { label: "Teachers", blog: "ogretmen-cv-ornegi" },
    { label: "Tender departments", blog: "ihale-dosyasi-pdf-hazirlama" },
    { label: "Engineers", tool: "pdf-karsilastir" },
    { label: "Job applicants", blog: "cv-nasil-hazirlanir" },
    { label: "Public sector staff", blog: "edevlet-belgelerini-tek-pdf-yapma" },
    { label: "Online sellers", tool: "gorsel-boyutlandir" },
    { label: "Administrative staff", blog: "iki-pdf-birlestirme-ucretsiz" },
    { label: "Tax advisors", blog: "faturadan-excele-veri-aktarma" },
    { label: "Academics", blog: "akademik-makale-ozetleme-literatur" },
    { label: "Real estate agents", blog: "kira-kontrati-dikkat-edilecek-maddeler" },
    { label: "Freelancers", blog: "pdf-e-imza-atma-nasil-yapilir" },
    { label: "Operations leads", blog: "pdf-boyutu-kucultme-sikistirma" },
    { label: "Architects", tool: "resize-pdf" },
  ],
};
