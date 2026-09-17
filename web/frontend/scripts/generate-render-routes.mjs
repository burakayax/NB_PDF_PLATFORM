/**
 * render.yaml içindeki "prerender sayfası → index.html" yönlendirmelerini üretir.
 *
 * NEDEN VAR: Yönlendirmeler eskiden joker (`/tools/:slug`) yazılmıştı. Render
 * statik sunucusunda joker bir kural EŞLEŞİP hedef dosya yoksa istek SPA'ya
 * düşmez; sunucu SIFIR BAYTLIK boş bir 200 döndürür. Sonuç: yanlış ya da eski
 * bir araç/blog adresine giren kullanıcı bomboş beyaz bir ekran görüyordu —
 * uygulama hiç yüklenmediği için uygulama içindeki "sayfa bulunamadı" ekranı da
 * devreye giremiyordu. Arama motoru da içeriksiz sayfa görüyordu.
 *
 * ÇÖZÜM: Gerçekten VAR OLAN sayfalar tek tek yazılır. Listede olmayan her adres
 * en sondaki `/*` kuralına düşer, index.html yüklenir ve uygulama kendi
 * "sayfa bulunamadı" ekranını gösterir.
 *
 * KULLANIM: Yeni araç/blog yazısı eklediğinde SEO dosyalarını üret, sonra:
 *     node scripts/generate-render-routes.mjs
 * Değişen render.yaml'ı commit'le (Render dosyayı depodan okur, derleme anında
 * üretilen bir şey işe yaramaz).
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const buradan = dirname(fileURLToPath(import.meta.url));
const frontendKok = resolve(buradan, "..");
const renderYaml = resolve(frontendKok, "..", "..", "render.yaml");

const BASLANGIC = "      # ↓↓↓ OTOMATİK ÜRETİLEN YÖNLENDİRMELER — elle düzenleme (generate-render-routes.mjs)";
const BITIS = "      # ↑↑↑ OTOMATİK ÜRETİLEN YÖNLENDİRMELER SONU";

/** Bir klasördeki, içinde index.html olan alt klasörlerin adları. */
function sayfaKlasorleri(gorecelYol) {
  const tam = join(frontendKok, "public", gorecelYol);
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

const gruplar = [
  { baslik: "Araç sayfaları (TR)", onek: "/tools", klasor: "tools" },
  { baslik: "Araç sayfaları (EN)", onek: "/en/tools", klasor: "en/tools" },
  { baslik: "Blog yazıları (TR)", onek: "/blog", klasor: "blog" },
  { baslik: "Blog yazıları (EN)", onek: "/en/blog", klasor: "en/blog" },
];

const satirlar = [BASLANGIC];
let toplam = 0;
for (const { baslik, onek, klasor } of gruplar) {
  const sayfalar = sayfaKlasorleri(klasor);
  if (sayfalar.length === 0) continue;
  satirlar.push(`      # ${baslik} — ${sayfalar.length} sayfa`);
  for (const slug of sayfalar) {
    satirlar.push("      - type: rewrite");
    satirlar.push(`        source: "${onek}/${slug}"`);
    satirlar.push(`        destination: "${onek}/${slug}/index.html"`);
    toplam += 1;
  }
}
satirlar.push(BITIS);

const mevcut = readFileSync(renderYaml, "utf8");
const bas = mevcut.indexOf(BASLANGIC);
const son = mevcut.indexOf(BITIS);

if (bas === -1 || son === -1) {
  console.error(
    "render.yaml içinde işaretçiler bulunamadı. Şu iki satırın dosyada olması gerekir:\n" +
      BASLANGIC +
      "\n" +
      BITIS,
  );
  process.exit(1);
}

const yeni = mevcut.slice(0, bas) + satirlar.join("\n") + mevcut.slice(son + BITIS.length);
writeFileSync(renderYaml, yeni, "utf8");
console.log(`render.yaml güncellendi: ${toplam} sayfa yönlendirmesi yazıldı.`);
