// 4 haftalık paylaşım takvimini CSV olarak üretir. Kullanım: node "sosyal medya/yayin-takvimi-uret.mjs" 2026-10-28
// Haftalık düzen: 2 video (Pzt, Per), 2 LinkedIn CV ipucu (Sal, Cum), 2 kaydırmalı Instagram (Sal, Cum),
// 1 Facebook yazısı (Çar), 3 Pinterest pini (Sal, Çar, Cmt), X her gün (kısa). Metinler Türkçe, sonda yorum sorusu.
import { writeFileSync } from "node:fs";

const start = new Date(`${process.argv[2] ?? "2026-10-28"}T12:00:00Z`);
const DAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

const videos = [
  ["compress", "PDF Sıkıştır"], ["merge", "PDF Birleştir"], ["pdf-to-word", "PDF → Word"], ["cv-olustur", "CV Oluştur"],
  ["word-to-pdf", "Word → PDF"], ["taranmis-pdf-ocr", "Taranmış PDF → OCR"], ["encrypt", "PDF Şifrele"], ["image-to-pdf", "Görsel → PDF"],
];
const linkedin = [
  "cv-nasil-hazirlanir", "ats-uyumlu-cv-nasil-yazilir", "cv-is-ilanina-gore-nasil-uyarlanir", "cv-on-yazi-nasil-yazilir",
  "cv-fotografi-nasil-olmali", "cv-ozgecmis-word-pdf-cevirme", "europass-tarzi-cv-nasil-hazirlanir", "yonetici-cv-ornegi",
];
const carousel = [
  "pdf-kucultme-eposta-whatsapp", "ats-uyumlu-cv-nasil-yazilir", "edevlet-belgelerini-tek-pdf-yapma", "cv-nasil-hazirlanir",
  "belge-fotografini-kaliteli-pdf-yapma", "cv-fotografi-nasil-olmali", "en-iyi-ucretsiz-pdf-araclari", "bozuk-pdf-onarma",
];
const facebook = ["pdf-kucultme-eposta-whatsapp", "edevlet-belgelerini-tek-pdf-yapma", "cv-nasil-hazirlanir", "bozuk-pdf-onarma"];
const pins = [
  "cv-nasil-hazirlanir", "ats-uyumlu-cv-nasil-yazilir", "pdf-kucultme-eposta-whatsapp", "ofis-asistani-cv-ornegi",
  "yazilim-gelistirici-cv-ornegi", "edevlet-belgelerini-tek-pdf-yapma", "muhasebeci-cv-ornegi", "en-iyi-ucretsiz-pdf-araclari",
  "hemsire-cv-ornegi", "ogretmen-cv-ornegi", "bozuk-pdf-onarma", "cv-fotografi-nasil-olmali",
];

const rows = [["Tarih", "Gün", "Saat", "Ağ", "Tür", "İçerik", "Nasıl yayınlanır", "Not"]];
const n = { v: 0, li: 0, ca: 0, fb: 0, pin: 0, x: 0 };
const take = (arr, key) => arr[n[key]++ % arr.length];
const bp = (slug) => `Blog: ${slug}`;

for (let d = 0; d < 28; d++) {
  const date = new Date(start.getTime() + d * 86400000);
  const iso = date.toISOString().slice(0, 10);
  const dow = date.getUTCDay();
  const day = DAYS[dow];
  const add = (t, net, kind, content, how, note = "") => rows.push([iso, day, t, net, kind, content, how, note]);

  if (dow === 1 || dow === 4) {
    const [id, name] = take(videos, "v");
    for (const net of ["Instagram", "Facebook", "YouTube"]) add("10:00", net, "Video (Reels/Shorts)", `${name} (${id})`, "Otomatik (panel)", "Araç videoları sıklığı panelde 3 gün");
    add("19:00", "TikTok", "Video", `${name} (${id})`, "Elle (yayin-paketi/tiktok)", "Biyografi bağlantısı pdfplatform.app olmalı");
  }
  if (dow === 2 || dow === 5) {
    add("09:00", "LinkedIn", "CV ipucu", bp(take(linkedin, "li")), "Otomatik (anahtar varsa) / elle", "Profesyonel ton, 'siz' hitabı, sonda meslek sorusu");
    add("10:00", "Instagram", "Kaydırmalı gönderi", bp(take(carousel, "ca")), "Otomatik (panel)");
  }
  if (dow === 3) add("10:00", "Facebook", "Yazı + ilk yorumda bağlantı", bp(take(facebook, "fb")), "Otomatik (panel)");
  if (dow === 2 || dow === 3 || dow === 6) add("12:00", "Pinterest", "Pin (2:3)", bp(take(pins, "pin")), "Otomatik (panel)", "Arama odaklı açıklama; aynı pin tekrar edilmez");
  if (dow !== 0) add("13:00", "X", "Kısa gönderi", `Blog/araç ipucu #${++n.x}`, "Otomatik (panel)", "280 karakter, sonda soru");
  if (dow === 0) add("11:00", "Tüm ağlar", "Etkileşim", "Haftanın yorumlarını yanıtla", "Elle", "Yorumlara 1 saat içinde cevap erişimi artırır");
}
writeFileSync(new URL("10-Dort-Haftalik-Takvim.csv", import.meta.url), "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\r\n"), "utf8");
console.log(`${rows.length - 1} satır yazıldı.`);
