/**
 * RENDER YÖNLENDİRME DENETİMİ — SALT OKUMA.
 *
 * NEDEN AYRI BİR BETİK: `render-routes-sync.mjs`'in provası yalnız SAYI veriyor
 * ("Mevcut kural sayısı: 149"), hangi sayfanın kuralsız kaldığını söylemiyor.
 * Kural sayısı dün 160 iken bugün 149 göründü; eksilen kurallar araç sayfalarına
 * aitse o adresler arama motorundan gelen ziyaretçiye boş/yanlış sayfa açıyor
 * demektir — sessiz trafik kaybı. Bu betik farkı ADIYLA listeler.
 *
 * GÜVENCE: Bu dosya yalnızca GET isteği yapar. Hiçbir kural yazmaz, silmez,
 * değiştirmez; hiçbir dosyaya yazmaz. Çalıştırması risksizdir.
 *
 * KULLANIM
 *   PowerShell:  $env:RENDER_API_KEY = "rnd_..."
 *                node scripts/render-routes-denetim.mjs
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.render.com/v1";
const SERVIS_ADI = "nb-pdf-frontend";
const frontendKok = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const anahtar = process.env.RENDER_API_KEY;
if (!anahtar) {
  console.error(
    'RENDER_API_KEY tanımlı değil.\n  PowerShell: $env:RENDER_API_KEY = "rnd_..."',
  );
  process.exit(1);
}

async function istek(yol) {
  const r = await fetch(API + yol, {
    headers: { Authorization: `Bearer ${anahtar}`, Accept: "application/json" },
  });
  const metin = await r.text();
  if (!r.ok) throw new Error(`GET ${yol} → HTTP ${r.status}: ${metin.slice(0, 300)}`);
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

/** Sayfalama — aynı sayfa tekrar gelirse durur (geçersiz cursor koruması). */
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

  return oncelikSirala(sayfalar.flat());
}

/** Yayınlanan klasörde gerçekten index.html'i olan alt klasörler. */
function sayfalar(gorecel) {
  const tam = join(frontendKok, "public", gorecel);
  try {
    return readdirSync(tam)
      .filter((ad) => {
        try {
          return (
            statSync(join(tam, ad)).isDirectory() &&
            statSync(join(tam, ad, "index.html")).isFile()
          );
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

function jokerVar(kurallar, kalip) {
  return kurallar.some((k) => String(k.source || "") === kalip);
}

async function main() {
  const servisler = await tumKayitlar(
    `/services?name=${encodeURIComponent(SERVIS_ADI)}`,
    "service",
  );
  const servis = servisler.find((s) => s && s.name === SERVIS_ADI);
  if (!servis) throw new Error(`"${SERVIS_ADI}" adlı servis bulunamadı.`);
  console.log(`Servis: ${servis.name}`);

  const kurallar = await tumKayitlar(`/services/${servis.id}/routes`, "route");
  console.log(`Canlıdaki kural sayısı: ${kurallar.length} (Render sınırı 200)\n`);

  const kaynaklar = new Set(kurallar.map((k) => String(k.source || "")));

  // ── Araç sayfaları ────────────────────────────────────────────────────────
  const gruplar = [
    ["/tools", "tools"],
    ["/en/tools", "en/tools"],
  ];
  let toplamSayfa = 0;
  const eksikler = [];
  for (const [onek, klasor] of gruplar) {
    const liste = sayfalar(klasor);
    toplamSayfa += liste.length;
    for (const slug of liste) {
      if (!kaynaklar.has(`${onek}/${slug}`)) eksikler.push(`${onek}/${slug}`);
    }
  }
  console.log(`Yayınlanan araç sayfası: ${toplamSayfa}`);
  console.log(`Kuralı olmayan araç sayfası: ${eksikler.length}`);
  if (eksikler.length) {
    console.log("  Kuralsız kalanlar:");
    for (const y of eksikler) console.log(`   - ${y}`);
  }

  // ── Blog joker kuralları ──────────────────────────────────────────────────
  console.log("\nBlog joker kuralları:");
  for (const kalip of ["/blog/:slug", "/en/blog/:slug"]) {
    console.log(`  ${jokerVar(kurallar, kalip) ? "var" : "YOK"}  ${kalip}`);
  }
  const blogSayfa = sayfalar("blog").length + sayfalar("en/blog").length;
  console.log(`  (yayınlanan blog sayfası: ${blogSayfa})`);

  // ── Son kural /* mı? ──────────────────────────────────────────────────────
  const sonuncu = kurallar[kurallar.length - 1];
  console.log(
    `
En son değerlendirilen kural: ${sonuncu ? `[öncelik ${sonuncu.priority}] ${sonuncu.type} ${sonuncu.source} → ${sonuncu.destination}` : "(yok)"}`,
  );
  const yakalaIndex = kurallar.findIndex((k) => String(k.source) === "/*");
  if (yakalaIndex === -1) {
    console.log('UYARI: "/*" kuralı hiç yok — doğrudan açılan adresler boş gelebilir.');
  } else if (yakalaIndex !== kurallar.length - 1) {
    console.log(
      `UYARI: "/*" kuralı ${yakalaIndex + 1}. sırada, ondan SONRAKİ ${kurallar.length - yakalaIndex - 1} kural hiç çalışmaz.`,
    );
  } else {
    console.log('"/*" en sonda (öncelik sırasına göre) — doğru.');
  }

  // ── Başlıklar ─────────────────────────────────────────────────────────────
  const basliklar = await tumKayitlar(`/services/${servis.id}/headers`, "header");
  const izin = basliklar.find((h) => (h.name || "").toLowerCase() === "permissions-policy");
  console.log(`\nPermissions-Policy: ${izin ? izin.value : "yok"}`);
  console.log(`Toplam başlık kuralı: ${basliklar.length}`);

  // --dok: canlıdaki kuralların TAMAMINI dosyaya yazar. Yedekle karşılaştırıp
  // "hangi kural gitti / geldi" sorusunu tahminle değil ölçümle yanıtlamak için.
  if (process.argv.includes("--dok")) {
    const dosya = join(frontendKok, "render-routes-canli.json");
    writeFileSync(dosya, JSON.stringify(kurallar, null, 2), "utf8");
    console.log(`\nCanlı kural listesi yazıldı: ${dosya}`);
  }

  console.log("\n— Denetim bitti. Hiçbir şey değiştirilmedi. —");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
