/**
 * SEO "yapıldı listesi" (scripts/agents/yapilanlar.txt) için saf fonksiyonlar (ağ/dosya yok; test edilebilir).
 * Satır biçimi: "YYYY-MM-DD | sayfa | ne yapıldı". "#" ile başlayan ve boş satırlar yok sayılır.
 */
export function parseYapilanlar(text) {
  const out = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith("#")) continue;
    const m = /^(\d{4}-\d{2}-\d{2})\s*\|\s*([^|]+?)\s*\|\s*(.+)$/.exec(l);
    if (m && !Number.isNaN(Date.parse(m[1]))) out.push({ tarih: m[1], sayfa: m[2], aciklama: m[3] });
  }
  return out;
}

/** Son `gun` günde yapılanlar ("sonuç bekleniyor"). */
export function bekleyenler(items, now = Date.now(), gun = 21) {
  return items.filter((i) => {
    const yas = (now - Date.parse(i.tarih)) / 86400000;
    return yas >= 0 && yas <= gun;
  });
}

/** SEO ajanının girdisine eklenecek blok. */
export function seoBlok(items) {
  if (!items.length) return "";
  return "\n\nZATEN YAPILAN DEĞİŞİKLİKLER (bu sayfalar için aynı öneriyi TEKRAR YAZMA; Google'ın işlemesi 2-3 hafta sürer, sonuç bekleniyor):\n"
    + items.map((i) => `- ${i.tarih} · ${i.sayfa}: ${i.aciklama}`).join("\n");
}

/** E-posta için kısa satırlar. */
export function mailSatirlari(items) {
  return items.map((i) => `${i.sayfa} (${i.tarih.slice(8, 10)}.${i.tarih.slice(5, 7)})`);
}
