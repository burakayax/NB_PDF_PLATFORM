/**
 * KURAL SIRASINI DÜZELT — kural eklemeden, silmeden.
 *
 * SORUN (denetimde ölçüldü): Render kuralları liste sırasına göre değerlendirir
 * ve İLK eşleşende durur. "/*" kuralı her adrese uyduğu için ondan sonraki her
 * kural ölüdür. Canlıda "/*" 100. sıradaydı ve arkasındaki 49 kural — eski
 * adreslerin yeni adreslere yönlendirmeleri — hiç çalışmıyordu. Sonuç: eski bir
 * bağlantıya tıklayan ziyaretçi doğru sayfaya gitmiyor, arama motoru da o
 * adresleri yönlendirme olarak göremiyor.
 *
 * İKİNCİ SORUN (aynı sebep, farklı kural): Blog joker kuralı `/en/blog/:slug`
 * de her blog adresine uyuyor ve listede eski adres yönlendirmelerinden ÖNCE
 * geliyor. Yalnızca "/*" sona alınsaydı blog yönlendirmeleri yine çalışmazdı:
 * joker önce eşleşir ve artık var olmayan bir dosyaya yönlendirip BOŞ SAYFA
 * döndürür. Bu yüzden sıralama şu kurala göre yapılır:
 *
 *   1) SPESİFİK kurallar (adresi birebir yazılmış olanlar)
 *   2) JOKER kurallar (`:slug` ya da `*` içerenler)
 *   3) "/*" en sonda
 *
 * Her grubun KENDİ İÇİNDEKİ sırası korunur; hiçbir kural eklenmez/silinmez.
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

/**
 * ÖNEMLİ — SIRA "priority" ALANINDADIR, DİZİ SIRASINDA DEĞİL.
 *
 * Render'ın API'si kuralları döndürürken dizi sırası ile ÖNCELİK SIRASI aynı
 * değildir; her kaydın kendi `priority` sayısı vardır ve KÜÇÜK numara önce
 * değerlendirilir. Bu ölçüldü: canlıdaki "/*" yakala-hepsini kuralı en büyük
 * numaradaydı (159) — eğer büyük numara önce değerlendirilseydi her adres ana
 * sayfaya düşerdi ve site hiç çalışmazdı.
 *
 * BU AYRIM ATLANIRSA NE OLUR: Dizi sırasına bakan bir denetim, aslında en önde
 * olan kuralları "gölgede kalmış" sanır ve olmayan bir sorunu rapor eder
 * (bir kez yaşandı). Bu yüzden okunan liste ÖNCE önceliğe göre sıralanır.
 */
function oncelikSirala(kayitlar) {
  return [...kayitlar].sort((a, b) => {
    const x = typeof a?.priority === "number" ? a.priority : Number.MAX_SAFE_INTEGER;
    const y = typeof b?.priority === "number" ? b.priority : Number.MAX_SAFE_INTEGER;
    return x - y;
  });
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
  return oncelikSirala(hepsi);
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

  const hepsiniYakalaMi = (k) => String(k.source) === "/*";
  /** Adresinde `:param` ya da `*` geçen kural, birçok adrese birden uyar. */
  const jokerMi = (k) => /[:*]/.test(String(k.source || "")) && !hepsiniYakalaMi(k);

  const spesifik = mevcut.filter((k) => !jokerMi(k) && !hepsiniYakalaMi(k));
  const jokerler = mevcut.filter(jokerMi);
  const yakala = mevcut.filter(hepsiniYakalaMi);

  const hedef = [...spesifik, ...jokerler, ...yakala].map(sade);
  if (hedef.length !== mevcut.length) {
    throw new Error(`İç tutarlılık hatası: ${mevcut.length} → ${hedef.length}. Hiçbir şey yapılmadı.`);
  }

  // Sırası DEĞİŞEN kurallar — yani şu an gölgede kalıp çalışmayanlar.
  const eskiSira = mevcut.map((k) => `${k.type} ${k.source}`);
  const yeniSira = hedef.map((k) => `${k.type} ${k.source}`);
  const degisti = eskiSira.some((v, i) => v !== yeniSira[i]);
  if (!degisti) {
    console.log("Sıralama zaten doğru — yapılacak bir şey yok.");
    return;
  }

  // Şu an gölgede kalan kurallar: kendisinden ÖNCE gelen bir joker/"/*" varsa.
  const ilkJokerIndex = mevcut.findIndex((k) => jokerMi(k) || hepsiniYakalaMi(k));
  const golgede =
    ilkJokerIndex === -1 ? [] : mevcut.slice(ilkJokerIndex + 1).filter((k) => !jokerMi(k) && !hepsiniYakalaMi(k));

  console.log(`
Şu an gölgede kalan (çalışmayan) kural sayısı: ${golgede.length}`);
  for (const k of golgede.slice(0, 60)) console.log(`  - ${k.type} ${k.source} → ${k.destination}`);
  if (golgede.length > 60) console.log(`  … ve ${golgede.length - 60} tane daha`);

  console.log(
    `
Yeni sıra: ${spesifik.length} spesifik → ${jokerler.length} joker → ${yakala.length} yakala-hepsini`,
  );
  console.log("Joker kurallar (spesifiklerden SONRA gelecek):");
  for (const k of jokerler) console.log(`  * ${k.type} ${k.source} → ${k.destination}`);

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
  const ilkJoker = sonra.findIndex((k) => /[:*]/.test(String(k.source || "")));
  const halaGolgede = sonra
    .slice(ilkJoker + 1)
    .filter((k) => !/[:*]/.test(String(k.source || ""))).length;
  console.log(`Uygulandı. Kural sayısı: ${sonra.length}`);
  console.log(
    yeniIndex === sonra.length - 1 && halaGolgede === 0
      ? "Sıra doğru: spesifik kurallar önde, jokerler arkada, \"/*\" en sonda. Gölgede kural kalmadı."
      : `UYARI: hâlâ ${halaGolgede} kural gölgede. Yedekten geri al: --geri-al ${yedekDosya}`,
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
