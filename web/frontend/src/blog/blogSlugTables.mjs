// Blog adres (slug) tabloları — KÜÇÜK ve bağımsız. Ana pakete (enSlugs.mjs üzerinden) girdiği için ağır
// blog içerik dosyalarını (blogContentCv3 / blogContentYatay ve onların veri dosyaları) çekmez.
// Yeni meslek/yazı eklerken adres burada, metin ilgili blogContent*.mjs dosyasında tutulur.

/** Meslek id → { TR slug, EN slug, TR başlık adı, EN başlık adı, TR yalın ad, EN yalın ad } */
export const CV_PROFESSION_SLUGS = {
  sales: ["satis-danismani-cv-ornegi", "sales-representative-cv-example", "Satış Danışmanı", "Sales Representative"],
  accounting: ["muhasebeci-cv-ornegi", "accountant-cv-example", "Muhasebeci", "Accountant"],
  software: ["yazilim-gelistirici-cv-ornegi", "software-developer-cv-example", "Yazılımcı", "Software Developer"],
  teacher: ["ogretmen-cv-ornegi", "teacher-cv-example", "Öğretmen", "Teacher"],
  health: ["hemsire-cv-ornegi", "nurse-cv-example", "Hemşire", "Nurse"],
  support: ["musteri-temsilcisi-cv-ornegi", "customer-service-cv-example", "Müşteri Temsilcisi", "Customer Service Representative"],
  hr: ["insan-kaynaklari-uzmani-cv-ornegi", "hr-specialist-cv-example", "İnsan Kaynakları Uzmanı", "HR Specialist"],
  marketing: ["dijital-pazarlama-uzmani-cv-ornegi", "digital-marketing-cv-example", "Dijital Pazarlama Uzmanı", "Digital Marketing Specialist"],
  engineer: ["muhendis-cv-ornegi", "engineer-cv-example", "Mühendis", "Engineer"],
  hospitality: ["garson-otel-restoran-cv-ornegi", "hospitality-server-cv-example", "Garson / Otel / Restoran Çalışanı", "Hospitality & Restaurant Worker"],
  logistics: ["depo-lojistik-cv-ornegi", "warehouse-logistics-cv-example", "Lojistik ve Depo Çalışanı", "Warehouse & Logistics Associate"],
  manager: ["yonetici-cv-ornegi", "manager-cv-example", "Yönetici", "Manager"],
  design: ["grafik-tasarimci-cv-ornegi", "graphic-designer-cv-example", "Grafik Tasarımcı", "Graphic Designer"],
  admin: ["ofis-asistani-cv-ornegi", "office-administrator-cv-example", "Ofis Asistanı / Sekreter", "Office Administrator"],
};

/** EN slug eşlemesi (enSlugs.mjs buradan beslenir). */
export const CV_PROFESSION_EN_SLUGS = Object.fromEntries(Object.values(CV_PROFESSION_SLUGS).map(([tr, en]) => [tr, en]));

export const YATAY_EN_SLUGS = {
  "pdf-yatay-yapma-dikey-pdf-yatay-sayfa": "make-pdf-landscape-without-rotating",
  "dikey-sayfada-kucuk-kalan-tablo-yatay-pdf": "wide-table-tiny-in-portrait-pdf",
  "dikey-yatay-karisik-pdf-sayfa-yonu": "fix-mixed-orientation-pdf-pages",
};

export const QR_TOC_EN_SLUGS = {
  "pdf-ye-qr-kod-ekleme-rehberi": "add-qr-code-to-pdf-guide",
  "kartvizit-qr-kod-vcard-nasil-yapilir": "business-card-vcard-qr-code",
  "dava-dosyasi-ihale-icindekiler-yer-imi": "case-file-tender-table-of-contents-bookmarks",
};

export const TIFF_EN_SLUGS = {
  "tiff-pdf-cevirme-cok-sayfali-tif": "convert-multi-page-tiff-to-pdf",
};

export const PDF_HEDEF_EN_SLUGS = {
  "pdf-1-mb-alti-kucultme-hedef-boyut": "compress-pdf-under-1-mb-target-size",
};
