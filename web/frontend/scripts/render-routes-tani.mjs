/**
 * SAYFALAMA TANISI — SALT OKUMA.
 *
 * NEDEN: Kural listesini okuyan kodumuz, sunucudaki kayıtların bir kısmını
 * SESSİZCE atlıyor. Ölçüldü: canlıda 159 kural varken okuma 149 döndürdü ve
 * eksik olanlar öncelik sırasının EN BAŞINDAKİ 10 kayıttı (/pricing, /terms,
 * /privacy, /kvkk, /pdf-api, /blog ve 4 eski araç yönlendirmesi).
 *
 * BU NEDEN TEHLİKELİ: "Hepsini değiştir" ucu, OKUNAN listeyi geri yazar.
 * Görülmeyen kayıtlar yazılan listeye girmediği için bir sonraki uygulamada
 * SİLİNİRLER. Yani okuma hatası, sessiz kural kaybına dönüşür.
 *
 * Bu betik hiçbir şey yazmaz; yalnızca sayfalamanın gerçekte nasıl davrandığını
 * gösterir: her sayfanın boyutu, öncelik aralığı ve cursor değerleri.
 */
const API = "https://api.render.com/v1";
const SERVIS_ADI = "nb-pdf-frontend";
const anahtar = process.env.RENDER_API_KEY;

if (!anahtar) {
  console.error('RENDER_API_KEY tanımlı değil.\n  PowerShell: $env:RENDER_API_KEY = "rnd_..."');
  process.exit(1);
}

async function istek(yol) {
  const r = await fetch(API + yol, {
    headers: { Authorization: `Bearer ${anahtar}`, Accept: "application/json" },
  });
  const metin = await r.text();
  if (!r.ok) throw new Error(`GET ${yol} → HTTP ${r.status}: ${metin.slice(0, 200)}`);
  return metin ? JSON.parse(metin) : null;
}

function ozet(liste) {
  const oncelikler = liste
    .map((s) => (s.route ?? s)?.priority)
    .filter((p) => typeof p === "number")
    .sort((a, b) => a - b);
  return oncelikler.length
    ? `öncelik ${oncelikler[0]}…${oncelikler[oncelikler.length - 1]}`
    : "öncelik bilgisi yok";
}

async function sayfalariGez(limit) {
  console.log(`\n── limit=${limit} ile sayfalama ──`);
  const servisler = await istek(`/services?name=${encodeURIComponent(SERVIS_ADI)}&limit=20`);
  const servis = (servisler ?? [])
    .map((s) => s.service ?? s)
    .find((s) => s && s.name === SERVIS_ADI);
  if (!servis) throw new Error("Servis bulunamadı.");

  let cursor = null;
  let toplam = 0;
  const gorulenOncelikler = new Set();
  for (let sayfa = 1; sayfa <= 20; sayfa++) {
    const yol =
      `/services/${servis.id}/routes?limit=${limit}` +
      (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
    const liste = await istek(yol);
    if (!Array.isArray(liste) || liste.length === 0) {
      console.log(`  sayfa ${sayfa}: boş → bitti`);
      break;
    }
    for (const satir of liste) {
      const p = (satir.route ?? satir)?.priority;
      if (typeof p === "number") gorulenOncelikler.add(p);
    }
    toplam += liste.length;
    const sonuncu = liste[liste.length - 1];
    const yeniCursor = sonuncu?.cursor ?? null;
    console.log(
      `  sayfa ${sayfa}: ${liste.length} kayıt · ${ozet(liste)} · cursor ${
        yeniCursor ? `${String(yeniCursor).slice(0, 14)}…` : "YOK"
      }`,
    );
    if (!yeniCursor || yeniCursor === cursor) break;
    cursor = yeniCursor;
    if (liste.length < limit) break;
  }

  const sirali = [...gorulenOncelikler].sort((a, b) => a - b);
  const eksik = [];
  for (let p = 0; p <= (sirali[sirali.length - 1] ?? 0); p++) {
    if (!gorulenOncelikler.has(p)) eksik.push(p);
  }
  console.log(`  TOPLAM: ${toplam} kayıt, farklı öncelik: ${sirali.length}`);
  console.log(`  görülen öncelik aralığı: ${sirali[0]}…${sirali[sirali.length - 1]}`);
  console.log(
    `  GÖRÜLMEYEN öncelik numaraları: ${eksik.length ? eksik.join(", ") : "yok"}`,
  );
  return { toplam, eksik };
}

async function main() {
  // Aynı liste üç farklı sayfa boyutuyla okunur. Sonuçlar birbirini tutmuyorsa
  // sorun sayfalamadadır; hepsi aynı eksik kaydı veriyorsa sunucu o kayıtları
  // listelemiyor demektir.
  for (const limit of [100, 50, 20]) {
    try {
      await sayfalariGez(limit);
    } catch (e) {
      console.error(`  HATA: ${e.message}`);
    }
  }
  console.log("\n— Tanı bitti. Hiçbir şey değiştirilmedi. —");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
