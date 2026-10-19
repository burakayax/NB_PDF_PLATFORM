/**
 * Araç videosu kapaklarının (Reels/Shorts) araç başına metni ve tasarım yönü.
 *
 * Tasarım dilleri `scripts/lib/cover-designs.mjs` içinde: poster, steps, dark, grid, split. Dağılım
 * bilerek karışık tutulur: profil ızgarasında yan yana duran kapaklar birbirine benzemesin.
 *
 * KELİME OYUNU KURALI: büyük harfli iri yazı + küçük harfli, daha küçük anahtar kelime ("BÜYÜK PDF'İ" / küçült).
 * İÇERİK KURALI: yalnızca aracın gerçek yaptığını söyle (araç kataloğu ve senaryo metinleri). Rakam örnekse "Örnek" yazılır.
 *
 * YENİ ARAÇ: buraya bir satır ekle; eklenmezse `generate-reel-covers.mjs` senaryo başlığından sade bir poster üretir.
 */

const step = (a, b, c) => [a, b, c];

export const COVER_SPECS = {
  // ── Poster ──
  compress: { design: "poster", lines: ["BÜYÜK", "PDF'İ"], word: "küçült", ba: ["48 MB", "6 MB"] },
  merge: { design: "poster", lines: ["ÇOK", "PDF"], word: "tek dosya yap", icon: "merge", sub: "Birden çok PDF'i tek dosyada topla" },
  "flatten-pdf": { design: "poster", lines: ["KAYAN", "FORM"], word: "sabitle", icon: "layers", sub: "Formu sabitle, değiştirilemez yap" },
  "pdf-to-text": { design: "poster", lines: ["PDF'TEKİ", "YAZI"], word: "düz metin", icon: "text", sub: "Belgedeki yazıyı düz metin olarak al" },
  "resize-pdf": { design: "poster", lines: ["SAYFA", "BOYUTU"], word: "sen seç", icon: "resize", sub: "Sayfaları A4, A5 ya da Letter yap" },
  "flip-pdf": { design: "poster", lines: ["SAYFAYI", "ÇEVİR"], word: "ayna gibi", icon: "flip", sub: "Sayfaları ayna gibi çevir" },
  encrypt: { design: "poster", lines: ["GİZLİ", "BELGE"], word: "parolayla koru", icon: "lock", sub: "Belgeyi parolayla koru" },
  "repair-pdf": { design: "poster", lines: ["AÇILMAYAN", "PDF"], word: "kurtar", icon: "tool", sub: "Açılmayan dosyayı kurtar" },
  "extract-images": { design: "poster", lines: ["PDF'TEKİ", "GÖRSEL"], word: "çıkar", icon: "image", sub: "Belgedeki fotoğrafları ayrı dosya yap" },
  "html-to-pdf": { design: "poster", lines: ["WEB", "SAYFASI"], word: "PDF'e al", icon: "globe", sub: "Web sayfasını olduğu gibi PDF'e al" },
  "gorsel-boyutlandir": { design: "poster", lines: ["FOTOĞRAF", "BOYUTU"], word: "ölçüye getir", icon: "resize", sub: "Fotoğrafı istediğin ölçüye getir" },

  // ── Koyu premium ──
  "pdf-to-word": { design: "dark", l1: "PDF'i", l2: "Word'e çevir", from: "PDF", to: "W", caption: "Düzenlenebilir Word belgesine çevir" },
  "pdf-to-excel": { design: "dark", l1: "Tablo", l2: "Excel'e geçsin", from: "PDF", to: "X", caption: "Tabloları hesaplanabilir Excel'e aktar" },
  "pdf-to-ppt": { design: "dark", l1: "Sayfalar", l2: "slayt olsun", from: "PDF", to: "P", caption: "Sayfaları düzenlenebilir slaytlara çevir" },
  "word-to-pdf": { design: "dark", l1: "Word'ü", l2: "PDF yap", from: "W", to: "PDF", caption: "Herkesin açabildiği PDF yap" },
  "excel-to-pdf": { design: "dark", l1: "Tabloyu", l2: "PDF yap", from: "X", to: "PDF", caption: "Tabloyu bozmadan PDF yap" },
  "ppt-to-pdf": { design: "dark", l1: "Sunumu", l2: "PDF yap", from: "P", to: "PDF", caption: "Her cihazda aynı görünen PDF" },
  "pdf-to-pdfa": { design: "dark", l1: "Arşive", l2: "uygun PDF", from: "PDF", to: "PDF/A", caption: "Kurumların istediği arşiv biçimi" },
  "udf-to-pdf": { design: "dark", l1: "UYAP belgesi", l2: "PDF olsun", from: "UDF", to: "PDF", caption: "Program kurmadan PDF yap" },

  // ── Adım adım ──
  "cv-olustur": {
    design: "steps", top: "3 adımda", hl: "CV'n hazır",
    steps: [step("Şablon seç", "30 hazır şablondan birini seç", "list"), step("Bilgilerini gir", "CV'n yanında canlı oluşsun", "edit"), step("Kontrol et, indir", "ATS röntgeni + PDF olarak indir", "check")],
  },
  "image-to-pdf": {
    design: "steps", top: "Fotoğrafları", hl: "tek PDF yap",
    steps: [step("Görselleri seç", "Birden çok fotoğraf ekleyebilirsin", "image"), step("PDF'e çevir", "Hepsi tek dosyada toplanır", "layers"), step("Dosyayı indir", "Hazır PDF'i kaydet ya da paylaş", "check")],
  },
  "form-doldur": {
    design: "steps", top: "Çıktı almadan", hl: "formu doldur",
    steps: [step("Formu aç", "PDF formunu seç", "word"), step("Alanları doldur", "Bilgisayarında yaz", "edit"), step("PDF'i indir", "Doldurulmuş hâlini kaydet", "check")],
  },
  "taranmis-pdf-ocr": {
    design: "steps", top: "Taranmış sayfa", hl: "metne dönsün",
    steps: [step("Taranmış PDF'i seç", "Yazısı resim olan belge", "scan"), step("Yazı okunsun", "OCR ile metin tanınır", "search"), step("Metni al", "Seçilebilir, kopyalanabilir yazı", "text")],
  },
  "aranabilir-pdf": {
    design: "steps", top: "Taranmış belgede", hl: "Ctrl+F çalışsın",
    steps: [step("Taranmış PDF'i seç", "Aranamayan belgeni yükle", "scan"), step("Yazı tanınsın", "Sayfalardaki metin okunur", "search"), step("Aranabilir PDF'i indir", "Artık Ctrl+F ile ara", "check")],
  },
  "alternate-mix-pdf": {
    design: "steps", top: "İki PDF'i", hl: "sırayla karıştır",
    steps: [step("İki PDF seç", "Sayfaları serpiştirilecek belgeler", "word"), step("Sırayla birleşsin", "Birinden bir, ötekinden bir sayfa", "shuffle"), step("Tek PDF indir", "Sonuç tek dosyada", "check")],
  },
  "gorsel-sikistir": {
    design: "steps", top: "Fotoğrafı", hl: "küçült",
    steps: [step("Fotoğrafı seç", "Birden çok görsel olabilir", "image"), step("Boyutu küçült", "Kaliteyi koruyarak sıkıştır", "compress"), step("İndir", "Küçülmüş hâlini kaydet", "check")],
  },

  // ── Özellik ızgarası (aracı vurgular) ──
  "unlock-pdf": { design: "grid", l1: "Parolasını bildiğin", l2: "PDF'in kilidini aç", toolIcon: "unlock", toolLabel: "Şifre Kaldır" },
  "ustveri-temizle": { design: "grid", l1: "Belgenin gizli", l2: "izlerini sil", toolIcon: "eraser", toolLabel: "Üstveri Temizle" },
  "deskew-pdf": { design: "grid", l1: "Eğri taranmış", l2: "sayfayı düzelt", toolIcon: "rotate", toolLabel: "Eğri Düzelt" },
  "pdf-to-image": { design: "grid", l1: "Her sayfa", l2: "bir fotoğraf olsun", toolIcon: "image", toolLabel: "PDF'den Görsel" },

  // ── Henüz video senaryosu olmayan araçlar ──
  // Kimlik = site araç sayfası adı. Video eklenirken katalog kimliği farklıysa (ör. merge / merge-pdf) satır kopyalanır.
  // Metinler aracın adından ve bilinen davranışından türetildi; yapay zekâ araçlarında iddia kasıtlı olarak genel tutuldu.
  "split-pdf": { design: "poster", lines: ["UZUN", "PDF"], word: "böl", icon: "split", sub: "İstediğin sayfaları ayır" },
  "delete-pages": { design: "poster", lines: ["FAZLA", "SAYFA"], word: "sil", icon: "trash", sub: "Gereksiz sayfaları PDF'ten çıkar" },
  "rotate-pdf": { design: "poster", lines: ["YAN", "SAYFA"], word: "döndür", icon: "rotate", sub: "Sayfaları istediğin yöne çevir" },
  "organize-pdf": { design: "poster", lines: ["KARIŞIK", "SAYFA"], word: "sırala", icon: "list", sub: "Sayfaları yeniden düzenle" },
  "page-numbers": { design: "poster", lines: ["SAYFA", "NUMARASI"], word: "ekle", icon: "hash", sub: "PDF sayfalarına numara ekle" },
  watermark: { design: "poster", lines: ["BELGEYE", "FİLİGRAN"], word: "ekle", icon: "drop", sub: "PDF'e metin filigranı ekle" },
  "pdf-imzala": { design: "poster", lines: ["PDF'E", "İMZA"], word: "at", icon: "edit", sub: "Belgeyi cihazında imzala" },
  "imza-iste": { design: "poster", lines: ["İMZA", "İSTE"], word: "e-postayla", icon: "mail", sub: "Karşı tarafa imza isteği gönder" },
  "pdf-yorumla": { design: "poster", lines: ["PDF'E", "NOT"], word: "düş", icon: "message", sub: "Belgeyi işaretle, yorum ekle" },
  "pdf-kesit-al": { design: "poster", lines: ["SAYFADAN", "KESİT"], word: "al", icon: "crop", sub: "Sayfanın istediğin bölümünü kırp" },
  "pdf-duzenle": { design: "poster", lines: ["PDF'TEKİ", "YAZI"], word: "düzenle", icon: "edit", sub: "Belgedeki metni düzenle" },
  "hassas-veri-gizle": { design: "poster", lines: ["HASSAS", "VERİ"], word: "gizle", icon: "eyeoff", sub: "Belgedeki hassas bilgileri gizle" },
  "pdf-veri-cikar": { design: "poster", lines: ["PDF'TEN", "VERİ"], word: "çıkar", icon: "table", sub: "Belgedeki verileri al" },
  "belge-tara": {
    design: "steps", top: "Telefonunla", hl: "belge tara",
    steps: [step("Kamerayı aç", "Belgeyi çerçeveye al", "scan"), step("Kenarlar bulunsun", "Eğri çekim düzelir", "crop"), step("PDF'i kaydet", "Kaydet ya da paylaş", "check")],
  },
  "ai-fotograf-studyosu": {
    design: "steps", top: "Fotoğrafını", hl: "hazırla",
    steps: [step("Fotoğrafı seç", "Fotoğrafın tarayıcıdan çıkmaz", "image"), step("Düzenle", "Yapay zekâ cihazında çalışır", "edit"), step("İndir", "Hazır fotoğrafı kaydet", "check")],
  },
  "pdf-ozetle": { design: "dark", l1: "Uzun PDF'i", l2: "özetle", from: "PDF", to: "Özet", caption: "Yapay zekâ ile belgenin özetini al" },
  "pdf-sohbet": { design: "dark", l1: "PDF'inle", l2: "sohbet et", from: "PDF", to: "Soru", caption: "Belgene soru sor, yanıt al" },
  "pdf-ceviri": { design: "dark", l1: "PDF'i", l2: "çevir", from: "PDF", to: "Çeviri", caption: "Belgeyi başka bir dile çevir" },
  "pdf-karsilastir": { design: "dark", l1: "İki PDF'i", l2: "karşılaştır", from: "PDF 1", to: "PDF 2", caption: "Farkları tek bakışta gör" },
  "sozlesme-denetci": { design: "dark", l1: "Sözleşmeyi", l2: "denetle", from: "Sözleşme", to: "Rapor", caption: "Riskli maddeleri belgede işaretle" },
  "sayfa-duzeni": { design: "grid", l1: "Sayfa düzenini", l2: "sen belirle", toolIcon: "columns", toolLabel: "Sayfa Düzeni" },
  "ai-toplu-islem": { design: "grid", l1: "Çok dosya", l2: "tek seferde", toolIcon: "layers", toolLabel: "Toplu İşlem" },

  // ── Önce / sonra ──
  "grayscale-pdf": { design: "split", l1: "Renkliden", l2: "siyah-beyaza" },
};

/** Spec'i olmayan araç için sade poster: başlığın son kelimesi küçük harfli bant olur. */
export function fallbackSpec(scenario) {
  const words = String(scenario.title).replace(/\s*→\s*/g, " ").split(/\s+/).filter(Boolean);
  const word = (words.length > 1 ? words.pop() : "dene").toLocaleLowerCase("tr");
  const head = words.join(" ");
  const half = Math.ceil(words.length / 2);
  return {
    design: "poster",
    lines: [words.slice(0, half).join(" ") || head, words.slice(half).join(" ") || "PDF"],
    word,
    icon: "tool",
    sub: scenario.sub || "",
  };
}
