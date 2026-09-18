/**
 * İMZALI BELGENİN ÜRETİMİ — imza gömme + denetim sertifikası.
 *
 * NEDEN SUNUCUDA: İmzalayanın tarayıcısında üretilmiş bir PDF kabul edilseydi,
 * o kişi belgenin METNİNİ değiştirip öyle imzalayabilirdi. Burada imza, sunucuda
 * saklanan ÖZGÜN belgeye gömülür; imzalayandan yalnızca imza görüntüsü ve rıza
 * bilgisi alınır. Böylece "imzalanan belge, gönderilen belgedir" güvencesi
 * yapısal olarak sağlanır.
 *
 * DENETİM SERTİFİKASI: Elektronik imzanın hukuki dayanağı, imzalayanın NİYETİ,
 * RIZASI, imzanın KİME ait olduğu ve belgenin BÜTÜNLÜĞÜ kanıtlanabildiği sürece
 * kurulur. Bu yüzden imzalı belgenin sonuna, olayların zaman damgalı dökümünü ve
 * belgenin imzadan önceki/sonraki parmak izlerini taşıyan bir sayfa eklenir.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const buradan = dirname(fileURLToPath(import.meta.url));

/** Türkçe harfler için Unicode yazı tipi; bulunamazsa standart yazı tipine düşülür. */
function fontBaytlari(ad: string): Uint8Array | null {
  const adaylar = [
    join(buradan, "..", "..", "..", "assets", "fonts", ad),
    join(process.cwd(), "assets", "fonts", ad),
  ];
  for (const yol of adaylar) {
    try {
      return new Uint8Array(readFileSync(yol));
    } catch {
      /* sıradaki yolu dene */
    }
  }
  return null;
}

export function sha256(veri: Uint8Array | Buffer): string {
  return createHash("sha256").update(veri).digest("hex");
}

export type ImzaYerlesimi = {
  /** 1'den başlayan sayfa numarası. */
  sayfa: number;
  /** Sayfa genişliğine ORANLA konum (0-1) — sayfa boyutundan bağımsız olsun. */
  xOran: number;
  yOran: number;
  genislikOran: number;
};

export type DenetimOlayi = {
  type: string;
  at: Date;
  detail?: string | null;
  actor?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
};

export type ImzaGommeGirdisi = {
  ozgunPdf: Uint8Array;
  /** İmza görüntüsü (PNG veri URL'i ya da ham baytlar). */
  imzaPng: Uint8Array;
  yerlesim: ImzaYerlesimi;
  imzalayanAd: string;
  imzalayanEposta: string;
  isteyenAd: string;
  isteyenEposta: string;
  belgeAdi: string;
  ozgunOzet: string;
  olaylar: DenetimOlayi[];
  imzaZamani: Date;
};

const OLAY_ADI: Record<string, string> = {
  created: "İmza isteği oluşturuldu",
  sent: "İmza bağlantısı gönderildi",
  viewed: "Belge imzalayan tarafından açıldı",
  signed: "Belge imzalandı",
  declined: "İmza reddedildi",
  cancelled: "İstek iptal edildi",
  downloaded: "İmzalı belge indirildi",
};

function tarihMetni(t: Date): string {
  // Sabit biçim: sunucunun yerel ayarına göre değişmesin (denetim kaydı).
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${p(t.getUTCDate())}.${p(t.getUTCMonth() + 1)}.${t.getUTCFullYear()} ` +
    `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())} UTC`
  );
}

/**
 * İmzayı özgün belgeye gömer ve sonuna denetim sertifikası sayfası ekler.
 *
 * @returns imzalı PDF baytları
 */
export async function imzaliBelgeUret(girdi: ImzaGommeGirdisi): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(girdi.ozgunPdf, { ignoreEncryption: true });

  const unicode = fontBaytlari("Roboto-Regular.ttf");
  const unicodeKalin = fontBaytlari("Roboto-Bold.ttf");
  let font: PDFFont;
  let kalin: PDFFont;
  if (unicode && unicodeKalin) {
    pdf.registerFontkit(fontkit);
    font = await pdf.embedFont(unicode, { subset: true });
    kalin = await pdf.embedFont(unicodeKalin, { subset: true });
  } else {
    font = await pdf.embedFont(StandardFonts.Helvetica);
    kalin = await pdf.embedFont(StandardFonts.HelveticaBold);
  }

  // ── 1) İmzayı yerleştir ────────────────────────────────────────────────────
  const sayfalar = pdf.getPages();
  const indeks = Math.min(Math.max(girdi.yerlesim.sayfa, 1), sayfalar.length) - 1;
  const sayfa = sayfalar[indeks]!;
  const { width: sEn, height: sBoy } = sayfa.getSize();

  const imza = await pdf.embedPng(girdi.imzaPng);
  const imzaEn = Math.max(40, sEn * girdi.yerlesim.genislikOran);
  const imzaBoy = (imza.height / imza.width) * imzaEn;
  const imzaX = Math.min(Math.max(0, sEn * girdi.yerlesim.xOran), sEn - imzaEn);
  // Oran üstten ölçülür; pdf-lib'in başlangıç noktası sol-alt olduğu için çevrilir.
  const imzaY = Math.min(Math.max(0, sBoy - sBoy * girdi.yerlesim.yOran - imzaBoy), sBoy - imzaBoy);
  sayfa.drawImage(imza, { x: imzaX, y: imzaY, width: imzaEn, height: imzaBoy });

  // İmzanın altına kim, ne zaman imzaladı bilgisi (belgenin üstünde de görünsün).
  sayfa.drawText(`${girdi.imzalayanAd} · ${tarihMetni(girdi.imzaZamani)}`, {
    x: imzaX,
    y: Math.max(4, imzaY - 10),
    size: 7,
    font,
    color: rgb(0.35, 0.4, 0.48),
  });

  // ── 2) Denetim sertifikası sayfası ─────────────────────────────────────────
  const sert = pdf.addPage([595.28, 841.89]); // A4
  let y = 790;
  const sol = 50;

  const yaz = (metin: string, boyut = 10, yaziTipi: PDFFont = font, renk = rgb(0.15, 0.2, 0.28)) => {
    sert.drawText(metin, { x: sol, y, size: boyut, font: yaziTipi, color: renk });
    y -= boyut + 6;
  };
  const satirAtla = (n = 8) => {
    y -= n;
  };

  yaz("İMZA DENETİM SERTİFİKASI", 16, kalin, rgb(0.06, 0.09, 0.16));
  yaz("Bu sayfa, imzalama sürecinin kaydıdır ve imzalı belgenin ayrılmaz parçasıdır.", 9, font, rgb(0.42, 0.47, 0.55));
  satirAtla(10);
  sert.drawLine({
    start: { x: sol, y: y + 6 },
    end: { x: 545, y: y + 6 },
    thickness: 1,
    color: rgb(0.85, 0.87, 0.9),
  });
  satirAtla(6);

  yaz("BELGE", 11, kalin);
  yaz(`Ad: ${girdi.belgeAdi}`);
  yaz(`İmzadan önceki parmak izi (SHA-256):`, 9, font, rgb(0.42, 0.47, 0.55));
  yaz(girdi.ozgunOzet, 8);
  satirAtla(6);

  yaz("TARAFLAR", 11, kalin);
  yaz(`İsteyen: ${girdi.isteyenAd || girdi.isteyenEposta} <${girdi.isteyenEposta}>`);
  yaz(`İmzalayan: ${girdi.imzalayanAd} <${girdi.imzalayanEposta}>`);
  yaz("Kimlik doğrulama yöntemi: e-posta ile gönderilen tek kullanımlık bağlantı", 9, font, rgb(0.42, 0.47, 0.55));
  satirAtla(6);

  yaz("OLAY KAYDI", 11, kalin);
  for (const olay of girdi.olaylar) {
    const ad = OLAY_ADI[olay.type] ?? olay.type;
    yaz(`${tarihMetni(olay.at)} — ${ad}`, 9);
    const alt: string[] = [];
    if (olay.actor) alt.push(olay.actor);
    if (olay.ipHash) alt.push(`ağ özeti ${olay.ipHash.slice(0, 12)}…`);
    if (olay.detail) alt.push(olay.detail);
    if (alt.length) {
      sert.drawText(`      ${alt.join(" · ")}`, {
        x: sol,
        y: y + 4,
        size: 8,
        font,
        color: rgb(0.5, 0.55, 0.62),
      });
      y -= 12;
    }
    if (y < 90) break; // sayfa taşmasın; kayıt zaten veritabanında tam duruyor
  }

  satirAtla(8);
  sert.drawText(
    "Ağ adresleri açık saklanmaz; yalnız karşılaştırılabilir özetleri tutulur (KVKK).",
    { x: sol, y: 60, size: 8, font, color: rgb(0.5, 0.55, 0.62) },
  );
  sert.drawText("PDF Platform · pdfplatform.app", {
    x: sol,
    y: 46,
    size: 8,
    font,
    color: rgb(0.5, 0.55, 0.62),
  });

  return pdf.save({ useObjectStreams: false });
}
