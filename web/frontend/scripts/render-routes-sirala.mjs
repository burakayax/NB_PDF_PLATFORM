/**
 * "/*" KURALINI EN SONA AL — başka hiçbir şeye dokunmadan.
 *
 * SORUN (denetimde ölçüldü): Render kuralları liste sırasına göre değerlendirir
 * ve İLK eşleşende durur. "/*" kuralı her adrese uyduğu için ondan sonraki her
 * kural ölüdür. Canlıda "/*" 100. sıradaydı ve arkasındaki 49 kural — eski
 * adreslerin yeni adreslere yönlendirmeleri — hiç çalışmıyordu. Sonuç: eski bir
 * bağlantıya tıklayan ziyaretçi doğru sayfaya gitmiyor, arama motoru da o
 * adresleri yönlendirme olarak göremiyor.
 *
 * NEDEN AYRI BETİK: `render-routes-sync.mjs` listeyi yeniden KURAR (araç
 * sayfalarını yeniden üretir) ve mevcut kurallarla birlikte 200 sınırını aşar.
 * Burada tek yapılan SIRALAMA: kuralların kendisi, sayısı ve içeriği aynı kalır,
 * yalnız "/*" listenin sonuna taşınır.
 *
 * KULLANIM
 *   1) Önce prova (hiçbir şey değişmez, ne yapacağını gösterir):
 *        node scripts/render-routes-sirala.mjs
 *   2) Sonuç doğruysa uygula (önce yedek dosyası yazılır):
 *        node scripts/render-routes-sirala.mjs --uygula
 *   3) Geri almak için:
 *        node scripts/render-routes-sirala.mjs --geri-al <yedek-dosyası>
 */
import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.render.com/v1";
const SERVIS_ADI = "nb-pdf-frontend";
const frontendKok = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const anahtar = process.env.RENDER_API_KEY;
if (!anahtar) {
  console.error('RENDER_API_KEY tanımlı değil.\n  PowerShell: $env:RENDER_API_KEY = "rnd_..."');
  process.exit(1);
}

async function istek(yol, secenekler = {}) {
  const r = await fetch(API + yol, {
    ...secenekler,
    headers: {
      Authorization: `Bearer ${anahtar}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(secenekler.headers || {}),
    },
  });
  const metin = await r.text();
  if (!r.ok) {
    throw new Error(`${secenekler.method || "GET"} ${yol} → HTTP ${r.status}: ${metin.slice(0, 300)}`);
  }
  return metin ? JSON.parse(metin) : null;
}

async function tumKayitlar(yol, anahtarAd) {
  const hepsi = [];
  const gorulen = new Set();
  let cursor = null;
  for (let tur = 0; tur < 50; tur++) {
    const ayrac = yol.includes("?") ? "&" : "?";
    const sayfa = await istek(`${yol}${ayrac}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    const liste = Array.isArray(sayfa) ? sayfa : [];
    if (!liste.length) break;
    let yeni = 0;
    for (const satir of liste) {
      const kayit = satir?.[anahtarAd] ?? satir;
      const kimlik = kayit?.id ?? JSON.stringify(kayit);
      if (gorulen.has(kimlik)) continue;
      gorulen.add(kimlik);
      hepsi.push(kayit);
      yeni += 1;
    }
    if (!yeni) break;
    const sonraki = liste[liste.length - 1]?.cursor ?? null;
    if (!sonraki || sonraki === cursor || liste.length < 100) break;
    cursor = sonraki;
  }
  return hepsi;
}

const sade = ({ type, source, destination }) => ({ type, source, destination });

async function main() {
  const uygula = process.argv.includes("--uygula");
  const geriAlIndex = process.argv.indexOf("--geri-al");

  const servisler = await tumKayitlar(`/services?name=${encodeURIComponent(SERVIS_ADI)}`, "service");
  const servis = servisler.find((s) => s && s.name === SERVIS_ADI);
  if (!servis) throw new Error(`"${SERVIS_ADI}" adlı servis bulunamadı.`);
  console.log(`Servis: ${servis.name}`);

  const mevcut = await tumKayitlar(`/services/${servis.id}/routes`, "route");
  console.log(`Mevcut kural sayısı: ${mevcut.length}`);

  if (geriAlIndex !== -1) {
    const dosya = process.argv[geriAlIndex + 1];
    if (!dosya) throw new Error("--geri-al <yedek-dosyası> gerekli");
    const yedek = JSON.parse(readFileSync(dosya, "utf8")).map(sade);
    await istek(`/services/${servis.id}/routes`, { method: "PUT", body: JSON.stringify(yedek) });
    console.log(`Geri alındı: ${yedek.length} kural yazıldı (${dosya}).`);
    return;
  }

  // GÜVENLİK AĞI: Okuma beklenen biçimde değilse eksik kayıtlarla yazmak TÜM
  // kuralları bozardı. Her kaydın üç alanı da dolu olmalı.
  const bozuk = mevcut.filter((k) => !k?.type || !k?.source || !k?.destination);
  if (bozuk.length) {
    throw new Error(
      `Kural listesi beklenen biçimde değil (${bozuk.length}/${mevcut.length} kayıt eksik). Hiçbir şey yapılmadı.`,
    );
  }

  const yakalaIndex = mevcut.findIndex((k) => String(k.source) === "/*");
  if (yakalaIndex === -1) {
    console.log('"/*" kuralı yok — sıralanacak bir şey yok.');
    return;
  }
  if (yakalaIndex === mevcut.length - 1) {
    console.log('"/*" zaten en sonda — yapılacak bir şey yok.');
    return;
  }

  const oluKurallar = mevcut.slice(yakalaIndex + 1);
  console.log(
    `\n"/*" ${yakalaIndex + 1}. sırada; ARKASINDAKİ ${oluKurallar.length} kural hiç çalışmıyor:`,
  );
  for (const k of oluKurallar) console.log(`  - ${k.type} ${k.source} → ${k.destination}`);

  // Sıra korunur, yalnız "/*" sona alınır. Kural sayısı ve içeriği DEĞİŞMEZ.
  const hedef = [
    ...mevcut.slice(0, yakalaIndex).map(sade),
    ...oluKurallar.map(sade),
    sade(mevcut[yakalaIndex]),
  ];
  if (hedef.length !== mevcut.length) {
    throw new Error(`İç tutarlılık hatası: ${mevcut.length} → ${hedef.length}. Hiçbir şey yapılmadı.`);
  }

  if (!uygula) {
    console.log(
      `\nPROVA — hiçbir şey değiştirilmedi. Yeni sırada ${hedef.length} kural olacak ` +
        `(aynı kurallar, "/*" en sonda). Uygulamak için: --uygula`,
    );
    return;
  }

  const damga = new Date().toISOString().replace(/[:.]/g, "-");
  const yedekDosya = join(frontendKok, `render-routes-yedek-${damga}.json`);
  writeFileSync(yedekDosya, JSON.stringify(mevcut, null, 2), "utf8");
  console.log(`\nYedek yazıldı: ${yedekDosya}`);

  await istek(`/services/${servis.id}/routes`, { method: "PUT", body: JSON.stringify(hedef) });

  const sonra = await tumKayitlar(`/services/${servis.id}/routes`, "route");
  const yeniIndex = sonra.findIndex((k) => String(k.source) === "/*");
  console.log(`Uygulandı. Kural sayısı: ${sonra.length}`);
  console.log(
    yeniIndex === sonra.length - 1
      ? '"/*" artık EN SONDA — arkasındaki kurallar yeniden çalışıyor.'
      : `UYARI: "/*" hâlâ ${yeniIndex + 1}. sırada. Yedekten geri al: --geri-al ${yedekDosya}`,
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
