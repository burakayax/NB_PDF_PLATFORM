/**
 * Render statik site yönlendirme kurallarını tek seferde yazar.
 *
 * NEDEN BU BETİK VAR
 * ------------------
 * Prerender edilmiş SEO sayfaları (`/tools/<araç>`, `/blog/<yazı>`) Render'da
 * kural olmadan açılmıyor: Render eğik çizgisiz yolu dosya saymıyor. Bunun için
 * uzun süre JOKER kural kullanıldı (`/tools/:slug` → `/tools/:slug/index.html`).
 * Joker kuralın bedeli şu: hedef dosya YOKSA Render isteği uygulamaya düşürmüyor,
 * SIFIR BAYTLIK boş bir 200 döndürüyor. Yani yanlış/eski bir adrese giren
 * kullanıcı bomboş beyaz ekran görüyor ve uygulamanın "sayfa bulunamadı" ekranı
 * hiç devreye giremiyor. Joker kuralı "redirect"e çevirmek de çözmüyor: sondaki
 * eğik çizgili adres kuralı yeniden tetikleyip SONSUZ YÖNLENDİRME üretiyor
 * (canlıda ölçüldü).
 *
 * Tek doğru çözüm: GERÇEKTEN VAR OLAN her sayfa için tek tek kural. Listede
 * olmayan adres en sondaki `/*` kuralına düşer, uygulama yüklenir ve kendi
 * "sayfa bulunamadı" ekranını gösterir.
 *
 * render.yaml'daki `routes` alanı bu iş için YETMİYOR: blueprint kuralları mevcut
 * kurallarla birleşiyor, eskiler silinmiyor ve sıralama garanti edilmiyor
 * (canlıda denendi, kurallar hiç devreye girmedi). Render API'sindeki
 * "replace all" ucu ise listeyi olduğu gibi yazıyor ve ÖNCELİĞİ liste sırasına
 * göre veriyor — bu yüzden API kullanılıyor.
 *
 * KULLANIM
 *   1) Render panelinde API anahtarı üret: Account Settings → API Keys
 *   2) Anahtarı ortam değişkenine koy (ekrana yazdırma, depoya koyma):
 *        PowerShell:  $env:RENDER_API_KEY = "rnd_..."
 *        bash:        export RENDER_API_KEY=rnd_...
 *   3) Önce provayı çalıştır (hiçbir şey değiştirmez, ne yapacağını gösterir):
 *        node scripts/render-routes-sync.mjs
 *   4) Sonuç doğruysa uygula:
 *        node scripts/render-routes-sync.mjs --uygula
 *
 *   Yalnızca yanıt başlıklarını düzeltmek (yönlendirme kurallarına dokunmadan):
 *        node scripts/render-routes-sync.mjs --sadece-baslik --uygula
 *
 * Uygulamadan önce mevcut kuralların yedeği `render-routes-yedek-<tarih>.json`
 * olarak yazılır; geri almak için:
 *        node scripts/render-routes-sync.mjs --geri-al <yedek-dosyası>
 */

import { readdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.render.com/v1";
const SERVIS_ADI = "nb-pdf-frontend";
const frontendKok = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const anahtar = process.env.RENDER_API_KEY;
if (!anahtar) {
  console.error(
    "RENDER_API_KEY tanımlı değil.\n" +
      "  PowerShell: $env:RENDER_API_KEY = \"rnd_...\"\n" +
      "  bash:       export RENDER_API_KEY=rnd_...",
  );
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
 * Sayfalama ile TÜM kayıtları çeker.
 *
 * Render `limit` için üst sınır koyuyor (500 reddedildi: "invalid limit: too
 * large"), ayrıca yanıt `{ route, cursor }` sarmalı içinde geliyor. Son kaydın
 * cursor'ı bir sonraki sayfanın başlangıcı olarak veriliyor.
 */
async function tumKayitlar(yol, anahtarAd) {
  /**
   * SAYFALAMA — ÖLÇÜLDÜ, TAHMİN DEĞİL.
   *
   * Render'ın `cursor` değeri "BU KAYDIN ÖNCESİNDEKİ N kayıt" anlamına geliyor
   * ve liste varsayılan olarak SON N kaydı (en yüksek öncelikleri) döndürüyor.
   * Eski kod her sayfada SON kaydın cursor'ını gönderiyordu; bu yüzden pencere
   * yalnız 1 kayıt geriye kayıyor, baştaki kayıtlara hiç ulaşılamıyordu:
   * canlıda 159 kural varken okuma 149 döndürüyordu (ölçüldü).
   *
   * BUNUN BEDELİ: "hepsini değiştir" ucu OKUNAN listeyi geri yazıyor; görünmeyen
   * kayıtlar yazılan listede olmadığı için siliniyorlardı. Yani okuma hatası
   * sessiz kural kaybına dönüşüyordu.
   *
   * DOĞRUSU: bir önceki pencereye gitmek için İLK kaydın cursor'ı gönderilir ve
   * sayfalar BAŞA eklenir (liste öncelik sırasında kalsın).
   */
  const sayfalar = [];
  const gorulenKimlikler = new Set();
  let cursor = null;

  for (let tur = 0; tur < 60; tur++) {
    const ayrac = yol.includes("?") ? "&" : "?";
    const sayfa = await istek(
      `${yol}${ayrac}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    const liste = Array.isArray(sayfa) ? sayfa : [];
    if (liste.length === 0) break;

    const bu = [];
    let yeniEklendi = 0;
    for (const satir of liste) {
      const kayit = satir?.[anahtarAd] ?? satir;
      const kimlik = kayit?.id ?? JSON.stringify(kayit);
      if (gorulenKimlikler.has(kimlik)) continue;
      gorulenKimlikler.add(kimlik);
      bu.push(kayit);
      yeniEklendi += 1;
    }
    if (yeniEklendi === 0) break; // aynı pencere tekrar geldi
    sayfalar.unshift(bu);

    // Bir önceki pencere: BU sayfanın İLK kaydının cursor'ı.
    const ilk = liste[0];
    const oncekiCursor = ilk?.cursor ?? null;
    if (!oncekiCursor || oncekiCursor === cursor || liste.length < 100) break;
    cursor = oncekiCursor;
  }

  return sayfalar.flat();
}

/** Yayınlanan klasörde gerçekten index.html'i olan alt klasörler. */
function sayfalar(gorecel) {
  const tam = join(frontendKok, "public", gorecel);
  try {
    return readdirSync(tam)
      .filter((ad) => {
        try {
          return statSync(join(tam, ad)).isDirectory() && statSync(join(tam, ad, "index.html")).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

/** Kaldırılacak joker kurallar — yerlerini sayfa başına kurallar alıyor. */
function jokerMi(kural) {
  const s = String(kural.source || "");
  return (
    /^\/(en\/)?(tools|blog)\/(:[a-zA-Z]+|\*)$/.test(s) ||
    s === "/tools/*" ||
    s === "/blog/*"
  );
}

const hepsiniYakala = (k) => String(k.source) === "/*";

/**
 * Betiğin KENDİ ürettiği araç sayfası kuralı mı?
 *
 * Bu ayrım olmadan liste her çalıştırmada şişiyordu: önceki turda yazılan araç
 * kuralları "korunan" sayılıp aynen tutuluyor, sonra 2. adım aynı kuralları
 * sıfırdan yeniden üretiyordu. 46 araç × 2 dil = 92 kural listeye İKİ KEZ
 * giriyor, 200'lük Render sınırı aşılıyor ve hiçbir şey uygulanamıyordu
 * (ölçüldü: hedef 270 kural).
 *
 * Eşleşme bilerek DAR tutuldu — yalnız `/tools/<slug>` → `/tools/<slug>/index.html`
 * biçimindeki REWRITE'lar. Aynı yolu hedefleyen 301 YÖNLENDİRMELER (ör.
 * `/en/tools/gorsel-sikistir` → `/en/tools/compress-image`) buraya GİRMEZ ve
 * korunur; onlar eski adreslerin indeks değerini taşıyor, silinirse kaybolur.
 *
 * Yan kazanç: kaldırılan bir araca ait eski kural da artık kendiliğinden düşer.
 */
function uretilenAracKuraliMi(kural) {
  if (String(kural.type) !== "rewrite") return false;
  const s = String(kural.source || "");
  if (!/^\/(en\/)?tools\/[^/:*]+$/.test(s)) return false;
  return String(kural.destination || "") === `${s}/index.html`;
}

async function main() {
  const uygula = process.argv.includes("--uygula");
  const geriAlIndex = process.argv.indexOf("--geri-al");

  const servisler = await tumKayitlar(`/services?name=${encodeURIComponent(SERVIS_ADI)}`, "service");
  const servis = servisler.find((s) => s && s.name === SERVIS_ADI);
  if (!servis) throw new Error(`"${SERVIS_ADI}" adlı servis bulunamadı.`);
  console.log(`Servis: ${servis.name} (${servis.id})`);

  const mevcutKurallar = await tumKayitlar(`/services/${servis.id}/routes`, "route");
  console.log(`Mevcut kural sayısı: ${mevcutKurallar.length}`);

  // ── Geri alma ───────────────────────────────────────────────────────────────
  if (geriAlIndex !== -1) {
    const dosya = process.argv[geriAlIndex + 1];
    if (!dosya) throw new Error("--geri-al <yedek-dosyası> gerekli");
    const yedek = JSON.parse(readFileSync(dosya, "utf8")).map(({ type, source, destination }) => ({
      type,
      source,
      destination,
    }));
    await istek(`/services/${servis.id}/routes`, { method: "PUT", body: JSON.stringify(yedek) });
    console.log(`Geri alındı: ${yedek.length} kural yazıldı (${dosya}).`);
    return;
  }

  // ── YANIT BAŞLIKLARI: kamera iznini kendi sitemize aç ───────────────────────
  //
  // NEDEN: Canlıda `Permissions-Policy: camera=()` gönderiliyordu. Bu "kamerayı
  // hiçbir kaynağa, kendi sitene bile kapat" demek; tarayıcı kamera isteğini hiç
  // işleme almıyor, kullanıcıya izin sorulmuyor ve site ayarlarında kamera satırı
  // bile görünmüyor (ölçüldü). Belge Tarayıcı bu yüzden kamerayı hiç açamıyordu.
  // Mikrofon ve konum kapalı kalır — hiçbir aracımız kullanmıyor.
  const DOGRU_IZIN = "camera=(self), microphone=(), geolocation=(), interest-cohort=()";
  const basliklar = await tumKayitlar(`/services/${servis.id}/headers`, "header");
  const izinBasligi = basliklar.find((h) => (h.name || "").toLowerCase() === "permissions-policy");
  const izinGuncelMi = izinBasligi && izinBasligi.value === DOGRU_IZIN;
  console.log(
    `Permissions-Policy: ${izinBasligi ? (izinGuncelMi ? "zaten doğru" : `düzeltilecek → "${izinBasligi.value}"`) : "yok, eklenecek"}`,
  );

  if (uygula && !izinGuncelMi) {
    // GÜVENLİK AĞI: Okuma yanlış giderse (alan adı değişmiş, sarmal farklı)
    // eksik kayıtlarla PUT atmak TÜM başlıkları silerdi. Her kaydın üç alanı da
    // dolu değilse hiçbir şey yazma.
    const bozuk = basliklar.filter((h) => !h?.path || !h?.name || !h?.value);
    if (bozuk.length > 0) {
      throw new Error(
        `Başlık listesi beklenen biçimde değil (${bozuk.length}/${basliklar.length} kayıt eksik). ` +
          `Güvenlik için hiçbir değişiklik yapılmadı.`,
      );
    }
    const yeniBasliklar = basliklar
      .filter((h) => (h.name || "").toLowerCase() !== "permissions-policy")
      .map(({ path, name, value }) => ({ path, name, value }));
    yeniBasliklar.push({ path: "/*", name: "Permissions-Policy", value: DOGRU_IZIN });
    writeFileSync(
      join(frontendKok, `render-headers-yedek-${new Date().toISOString().replace(/[:.]/g, "-")}.json`),
      JSON.stringify(basliklar, null, 2),
      "utf8",
    );
    await istek(`/services/${servis.id}/headers`, { method: "PUT", body: JSON.stringify(yeniBasliklar) });
    console.log(`Başlıklar güncellendi (${yeniBasliklar.length} kural). Kamera artık kendi sitemize açık.`);
  }

  if (process.argv.includes("--sadece-baslik")) {
    console.log("Yalnızca başlık kipi — yönlendirme kurallarına dokunulmadı.");
    return;
  }

  // ── Hedef liste ─────────────────────────────────────────────────────────────
  // 1) Mevcut kurallardan joker ve /* dışındakiler (eski slug yönlendirmeleri,
  //    /pricing gibi düz sayfalar) OLDUĞU SIRAYLA korunur.
  const korunan = mevcutKurallar
    .filter((k) => !jokerMi(k) && !hepsiniYakala(k) && !uretilenAracKuraliMi(k))
    .map(({ type, source, destination }) => ({ type, source, destination }));

  const yinelenenAracKurali = mevcutKurallar.filter(uretilenAracKuraliMi).length;
  if (yinelenenAracKurali) {
    console.log(
      `Önceki turdan kalan ${yinelenenAracKurali} araç kuralı yeniden üretilecek ` +
        `(listeye iki kez girmesin diye korunanlardan çıkarıldı).`,
    );
  }

  // 2) Sayfa başına kurallar — YALNIZCA ARAÇ SAYFALARI.
  //
  // NEDEN HEPSİ DEĞİL: Render bir serviste EN FAZLA 200 kurala izin veriyor
  // ("new redirect rule would exceed maximum limit of 200" — canlıda ölçüldü).
  // Araç + blog için sayfa başına kural 184 ediyor; korunan 77 kuralla birlikte
  // 262 oluyor ve sınırı aşıyor. Öncelik araç sayfalarında: kullanıcı ve arama
  // motoru en çok oralara giriyor, yanlış/eski araç adresleri de en sık oralarda.
  // Blog için joker kural korunuyor (bilinen tek bedeli: olmayan bir blog
  // adresinde boş sayfa — nadir bir durum, slug'lar sabit).
  const gruplar = [
    ["/tools", "tools"],
    ["/en/tools", "en/tools"],
  ];
  const sayfaKurallari = [];
  for (const [onek, klasor] of gruplar) {
    for (const slug of sayfalar(klasor)) {
      sayfaKurallari.push({
        type: "rewrite",
        source: `${onek}/${slug}`,
        destination: `${onek}/${slug}/index.html`,
      });
    }
  }

  // 3) Blog joker kuralları (sayfa kurallarından SONRA, /*'tan ÖNCE).
  const blogJoker = [
    { type: "rewrite", source: "/blog/:slug", destination: "/blog/:slug/index.html" },
    { type: "rewrite", source: "/en/blog/:slug", destination: "/en/blog/:slug/index.html" },
  ];

  // 4) En sonda uygulama yedeği.
  const ham = [
    ...korunan,
    ...sayfaKurallari,
    ...blogJoker,
    { type: "rewrite", source: "/*", destination: "/index.html" },
  ];

  // EMNİYET AĞI: aynı kaynak yolu iki kez yazılmasın. Render kuralları SIRAYLA
  // işliyor; ikinci kopya zaten hiç çalışmaz ama 200'lük kotadan yer yer. İlk
  // görülen korunur, böylece "korunan" kuralların önceliği bozulmaz.
  const gorulen = new Set();
  const hedef = [];
  for (const k of ham) {
    const anahtarYol = `${k.type} ${k.source}`;
    if (gorulen.has(anahtarYol)) continue;
    gorulen.add(anahtarYol);
    hedef.push(k);
  }
  if (hedef.length !== ham.length) {
    console.log(`Yinelenen ${ham.length - hedef.length} kural ayıklandı.`);
  }

  const SINIR = 200;
  if (hedef.length > SINIR) {
    throw new Error(
      `Hedef liste ${hedef.length} kural — Render sınırı ${SINIR}. ` +
        `Korunan kuralları azaltmadan uygulanamaz.`,
    );
  }

  console.log(
    `Hedef liste: ${hedef.length} kural ` +
      `(korunan ${korunan.length} + araç sayfası ${sayfaKurallari.length} + blog joker ${blogJoker.length} + /* 1) — sınır ${SINIR}`,
  );
  const kaldirilan = mevcutKurallar.filter((k) => jokerMi(k));
  if (kaldirilan.length) {
    console.log("Kaldırılacak joker kurallar:");
    for (const k of kaldirilan) console.log(`  - ${k.type} ${k.source} → ${k.destination}`);
  }
  console.log("İlk 3 sayfa kuralı örnek:");
  for (const k of sayfaKurallari.slice(0, 3)) console.log(`  + ${k.source} → ${k.destination}`);

  if (!uygula) {
    console.log("\nPROVA — hiçbir şey değiştirilmedi. Uygulamak için: --uygula");
    return;
  }

  const damga = new Date().toISOString().replace(/[:.]/g, "-");
  const yedekDosya = join(frontendKok, `render-routes-yedek-${damga}.json`);
  writeFileSync(yedekDosya, JSON.stringify(mevcutKurallar, null, 2), "utf8");
  console.log(`Yedek yazıldı: ${yedekDosya}`);

  await istek(`/services/${servis.id}/routes`, { method: "PUT", body: JSON.stringify(hedef) });

  const sonra = await tumKayitlar(`/services/${servis.id}/routes`, "route");
  console.log(`Uygulandı. Yeni kural sayısı: ${sonra.length}`);
  console.log(`Son kural (en düşük öncelik): ${sonra[sonra.length - 1]?.source}`);
}

main().catch((e) => {
  console.error("HATA:", e.message);
  process.exit(1);
});
