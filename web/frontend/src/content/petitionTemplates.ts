/**
 * DİLEKÇE / FORM ŞABLONLARI — metinlerin TEK KAYNAĞI.
 *
 * ÖNEMLİ: Buradaki metinler hukuki danışmanlık değildir ve KULLANICI (site sahibi) onayı
 * bekler. Hepsi `HUKUKI_METINLER_ONAY.md` dosyasında tek tek listelenir
 * (`npm run sablon-metinleri` ile bu dosyadan üretilir). Yeni şablon eklemek ya da bir
 * cümleyi değiştirmek için yalnız bu dosya düzenlenir.
 *
 * Yer tutucular: {{alan}}. Boş bırakılan isteğe bağlı alanın geçtiği SATIR belgeden çıkarılır.
 */

export type PetitionField = {
  key: string;
  tr: string;
  en: string;
  multiline?: boolean;
  optional?: boolean;
  /** "today" → bugünün tarihi (gg.aa.yyyy). */
  initial?: "today";
};

export type PetitionTemplate = {
  id: string;
  tr: { name: string; desc: string };
  en: { name: string; desc: string };
  /** Makam satırı (ortalı, kalın). */
  recipient: string;
  /** KONU satırı. */
  subject: string;
  /** Gövde paragrafları (iki yana yaslı). */
  body: string[];
  /** Şablona özgü alanlar; ortak kimlik alanları ayrıca eklenir. */
  fields: PetitionField[];
};

/** Her şablonda bulunan ortak alanlar. */
export const COMMON_FIELDS: PetitionField[] = [
  { key: "adSoyad", tr: "Ad Soyad", en: "Full name" },
  { key: "tcKimlik", tr: "T.C. Kimlik No", en: "National ID no.", optional: true },
  { key: "adres", tr: "Adres", en: "Address", multiline: true },
  { key: "telefon", tr: "Telefon", en: "Phone", optional: true },
  { key: "tarih", tr: "Tarih", en: "Date", initial: "today" },
];

export const PETITION_TEMPLATES: PetitionTemplate[] = [
  {
    id: "genel-dilekce",
    tr: { name: "Genel Dilekçe", desc: "Herhangi bir kuruma yazılacak başvuru dilekçesi." },
    en: { name: "General petition", desc: "A general application letter to any institution." },
    recipient: "{{kurum}} MAKAMINA",
    subject: "{{konu}}",
    body: [
      "{{aciklama}}",
      "Yukarıda arz ve izah edilen nedenlerle; {{talep}}",
      "Gereğini saygılarımla arz ederim.",
    ],
    fields: [
      { key: "kurum", tr: "Başvurulan kurum", en: "Institution" },
      { key: "konu", tr: "Konu", en: "Subject" },
      { key: "aciklama", tr: "Açıklama", en: "Explanation", multiline: true },
      { key: "talep", tr: "Talebiniz", en: "Your request", multiline: true },
    ],
  },
  {
    id: "bilgi-edinme",
    tr: { name: "Bilgi Edinme Başvurusu", desc: "Bir kurumdan bilgi veya belge talebi." },
    en: { name: "Freedom-of-information request", desc: "Request information or documents from an institution." },
    recipient: "{{kurum}} MAKAMINA",
    subject: "Bilgi edinme talebi",
    body: [
      "4982 sayılı Bilgi Edinme Hakkı Kanunu kapsamında, aşağıda belirtilen bilgi ve/veya belgelerin tarafıma verilmesini talep ediyorum.",
      "İstenen bilgi/belge: {{bilgi}}",
      "Talebimin kanunda öngörülen süre içinde cevaplandırılmasını ve cevabın yukarıdaki adresime/iletişim bilgilerime gönderilmesini arz ederim.",
    ],
    fields: [
      { key: "kurum", tr: "Başvurulan kurum", en: "Institution" },
      { key: "bilgi", tr: "İstenen bilgi veya belge", en: "Information/documents requested", multiline: true },
    ],
  },
  {
    id: "istifa",
    tr: { name: "İstifa Dilekçesi", desc: "İşten ayrılma bildirimi." },
    en: { name: "Resignation letter", desc: "Notice of leaving a job." },
    recipient: "{{isyeri}} İNSAN KAYNAKLARI MÜDÜRLÜĞÜNE",
    subject: "İstifa bildirimi",
    body: [
      "{{gorev}} olarak yürüttüğüm görevimden {{istifaTarihi}} tarihi itibarıyla kendi isteğimle ayrılıyorum.",
      "Bugüne kadar gösterilen ilgi ve destek için teşekkür eder, işbu istifa dilekçemin işleme alınmasını arz ederim.",
    ],
    fields: [
      { key: "isyeri", tr: "İşyeri adı", en: "Employer" },
      { key: "gorev", tr: "Göreviniz / unvanınız", en: "Your position" },
      { key: "istifaTarihi", tr: "Ayrılış tarihi", en: "Last day" },
    ],
  },
  {
    id: "iade-talebi",
    tr: { name: "Ürün İade / Bedel İadesi Talebi", desc: "Satıcıya yazılı iade talebi." },
    en: { name: "Refund / return request", desc: "Written refund request to a seller." },
    recipient: "{{satici}}'NE",
    subject: "Ürün iadesi ve bedel iadesi talebi",
    body: [
      "{{siparisTarihi}} tarihinde sipariş ettiğim, {{siparisNo}} sipariş numaralı \"{{urun}}\" ürününe ilişkin olarak iade talebimi bildiriyorum.",
      "İade nedenim: {{neden}}",
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun'dan doğan haklarım saklı kalmak kaydıyla, ürünün iadesi karşılığında ödediğim bedelin tarafıma iade edilmesini talep ederim.",
    ],
    fields: [
      { key: "satici", tr: "Satıcı / firma adı", en: "Seller" },
      { key: "urun", tr: "Ürün adı", en: "Product" },
      { key: "siparisTarihi", tr: "Sipariş tarihi", en: "Order date" },
      { key: "siparisNo", tr: "Sipariş numarası", en: "Order no.", optional: true },
      { key: "neden", tr: "İade nedeni", en: "Reason", multiline: true },
    ],
  },
  {
    id: "abonelik-iptal",
    tr: { name: "Abonelik İptal Talebi", desc: "Abonelik veya hizmeti sonlandırma bildirimi." },
    en: { name: "Subscription cancellation", desc: "Notice to end a subscription or service." },
    recipient: "{{firma}}'YA",
    subject: "Abonelik iptal talebi",
    body: [
      "{{abonelikNo}} numaralı aboneliğimi/hizmetimi {{iptalTarihi}} tarihi itibarıyla sonlandırmak istiyorum.",
      "Bu tarihten sonra tarafımdan ücret tahsil edilmemesini ve iptal işleminin yazılı olarak teyit edilmesini arz ederim.",
    ],
    fields: [
      { key: "firma", tr: "Firma adı", en: "Company" },
      { key: "abonelikNo", tr: "Abonelik / müşteri numarası", en: "Subscription no." },
      { key: "iptalTarihi", tr: "İptal tarihi", en: "Cancellation date" },
    ],
  },
  {
    id: "tahliye-bildirimi",
    tr: { name: "Kiracı Tahliye Bildirimi", desc: "Kiralanan yeri boşaltacağınızı bildirme." },
    en: { name: "Tenant move-out notice", desc: "Notify the landlord you are vacating the property." },
    recipient: "SAYIN {{kiralayan}}'A",
    subject: "Kiralanan taşınmazın tahliyesi",
    body: [
      "{{tasinmaz}} adresindeki taşınmazı kiracı sıfatıyla kullanmaktayım.",
      "Kira ilişkisini {{tahliyeTarihi}} tarihi itibarıyla sona erdirerek taşınmazı bu tarihte tahliye edeceğimi bildiririm.",
      "Taşınmazın teslimi ve depozitonun iadesi konusunda iletişime geçilmesini arz ederim.",
    ],
    fields: [
      { key: "kiralayan", tr: "Kiralayanın (ev sahibinin) adı", en: "Landlord's name" },
      { key: "tasinmaz", tr: "Kiralanan taşınmazın adresi", en: "Property address", multiline: true },
      { key: "tahliyeTarihi", tr: "Tahliye tarihi", en: "Move-out date" },
    ],
  },
];
