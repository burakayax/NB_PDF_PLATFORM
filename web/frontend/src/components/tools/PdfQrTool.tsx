/**
 * PDF'YE QR KOD EKLE — QR içeriğini kur, sayfada istediğin yere sürükle, boyutunu ayarla.
 *
 * Her şey cihazda yapılır (pdf-lib + pdf.js); dosya sunucuya gitmez.
 * QR, PDF'ye VEKTÖR olarak çizilir — baskıda bulanıklaşmaz. Orijinal sayfa
 * içeriği (metin, bağlantılar, formlar) değiştirilmez; QR üstüne eklenir.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ChevronLeft, ChevronRight, FileText, ImagePlus, Loader2, QrCode, Sliders, Trash2, Plus, X, ZoomIn, ZoomOut } from "lucide-react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useToolPageContext } from "../common/toolPageContext";
import type { Language } from "../../i18n/landing";
import { MemberGateModal } from "../common/MemberGateModal";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { PdfThumbError, renderPdfPage, type PdfThumb } from "../../lib/pdfThumbs";
import {
  BOS_ALANLAR, MIN_SAFE_MM, MM, buildPayload, captionHeightPt, contrastRatio, isInverted,
  captionMaxChars, makeMatrix, minSizeMm, parseBatchLines, qrOutputName, qrToSvg, resolvePages, stampQr, stampQrBatch,
  type PageSelection, type PayloadResult, type QrEcl, type QrFields, type QrKind,
} from "../../lib/pdfQr";

/** Yalnızca üyelere açık mı? Ücret kararı verilince tek yerden değişir (katalogdaki account/free bayrağıyla birlikte). */
const KAYIT_GEREKLI = true;

const T = {
  tr: {
    hint: "PDF'i seç — QR kodu sonraki adımda yerleştirirsin.",
    reading: "Belge okunuyor…",
    encrypted: "Bu dosya şifreli. Lütfen şifresini kaldırıp tekrar yükleyin.",
    broken: "Dosya okunamadı. Bozuk olabilir; başka bir PDF dene.",
    tooBig: "Dosya 50 MB'dan büyük. Önce sıkıştırıp tekrar dene.",
    kinds: { url: "Web sitesi", vcard: "Kişi kartı", phone: "Telefon", email: "E-posta", whatsapp: "WhatsApp", wifi: "Wi-Fi", text: "Metin" },
    content: "QR içeriği",
    url: "Web sitesi adresi", urlPh: "ornek.com",
    firstName: "Ad", lastName: "Soyad", org: "Firma", title: "Unvan", phone: "Telefon", email: "E-posta",
    website: "Web sitesi", address: "Adres",
    mailSubject: "Konu (isteğe bağlı)", mailBody: "Mesaj (isteğe bağlı)",
    waPhone: "WhatsApp numarası", waHelp: "Başına 0 ya da +90 yazmana gerek yok; boşluk ve tireler temizlenir.", waText: "Hazır mesaj (isteğe bağlı)",
    ssid: "Ağ adı", wifiPass: "Şifre", wifiType: "Şifreleme", wifiNone: "Şifresiz", text: "Metin",
    emptyErr: "QR'ın içeriğini doldur.", invalidErr: "Girdiğin bilgi geçerli görünmüyor — kontrol et.",
    pages: "Hangi sayfalara?", first: "İlk sayfa", last: "Son sayfa", all: "Tüm sayfalar", custom: "Belirli sayfalar",
    customPh: "örn. 1,3,5-7", pagesErr: "Sayfa listesi geçersiz. Belge {n} sayfa; örnek: 1,3,5-7",
    position: "Konum", tl: "Sol üst", tr: "Sağ üst", bl: "Sol alt", br: "Sağ alt", center: "Orta",
    dragHint: "QR'ı tutup istediğin yere sürükle; sağ alt köşesinden de boyutunu değiştirebilirsin.",
    previewPage: "Önizleme sayfası",
    size: "Boyut", sizeMin: "Okunabilirlik için bu içerikte en az {n} mm gerekir.", tooLong: "İçerik bu sayfaya okunur boyutta sığmayacak kadar uzun. Metni kısalt ya da kenar boşluğunu azalt.",
    margin: "Kenar boşluğu", marginNote: "QR'ın etrafındaki boş çerçeve. Telefon kamerası QR'ı bu boşluk sayesinde sayfadan ayırır; ne kadar genişse zemin o kadar rahat ayrılır. Standart yeterlidir.",
    fg: "QR rengi", bg: "Zemin rengi",
    contrastWarn: "Renkler birbirine çok yakın; QR okunmaz. QR koyu, zemin açık olmalı. Bu renklerle PDF'ye eklenemez.",
    invertedWarn: "Açık renkli QR koyu zeminde telefonlarda okunmaz. QR koyu, zemin açık olmalı. Bu renklerle PDF'ye eklenemez.",
    caption: "QR altına yazı (isteğe bağlı)", captionPh: "Bizi takip edin",
    advanced: "Gelişmiş ayarlar", ecl: "Dayanıklılık",
    eclNames: { L: "Sade", M: "Standart", Q: "Güçlü", H: "En güçlü" },
    eclDesc: { L: "Temiz ekranda ya da yeni basılmış kağıtta kullanılır. En sade görünür ama en kolay bozulur.", M: "Günlük kullanım için yeterli. Çoğu belgede bunu bırakman yeterli.", Q: "Kağıt buruşabilir ya da hafif kirlenebilirse (broşür, etiket) bunu seç.", H: "Yıpranacak yerlerde (tabela, ürün etiketi, dışarıda) bunu seç. QR biraz daha sık görünür." },
    logo: "Ortaya logo ekle", logoNote: "Logo QR'ın bir kısmını kapatır; bu yüzden dayanıklılık otomatik «En güçlü» olur. Okunurluğu korumak için logo en fazla «Büyük» boyutuna kadar büyütülebilir.", logoRemove: "Logoyu kaldır",
    logoBad: "Logo PNG ya da JPG olmalı.",
    add: "QR'ı PDF'ye ekle", working: "Ekleniyor…", failed: "QR eklenemedi. Dosya bozuk ya da korumalı olabilir.",
    png: "QR'ı PNG indir", svg: "QR'ı SVG indir", another: "Başka dosya seç", close: "Kapat", remove: "Kaldır", modalTitle: "QR kod yerleştir", editEditor: "QR ayarlarını düzenle", pageWord: "sayfa", summaryLabel: "QR",
    linkNote: "Bu QR, PDF'te tıklanabilir bağlantı olarak da eklenir.",
    onDevice: "Dosyan cihazından çıkmaz.",
    addedTo: "sayfaya QR eklendi",
    templates: "Hazır şablon", tplNames: { card: "Kartvizit", menu: "Menü", invoice: "Fatura" },
    suggest: "Boş yer öner", suggestNone: "Bu sayfada QR için yeterince boş yer bulunamadı; kendin yerleştir.",
    bulk: "Her sayfaya farklı QR", bulkHelp: "Her satıra «sayfalar | içerik» yaz. Örnek: 1 | ornek.com/a — 2,4-6 | ornek.com/b",
    bulkUrl: "Web adresi", bulkText: "Metin",
    bulkErrFormat: "{n}. satır: «sayfalar | içerik» biçiminde yaz.", bulkErrPages: "{n}. satır: sayfa listesi geçersiz (belge {p} sayfa).",
    bulkErrContent: "{n}. satır: içerik boş ya da geçerli bir web adresi değil.", bulkErrEmpty: "En az bir satır yaz.",
    bulkPlaceholder: "1 | ornek.com/ilk\n2,3 | ornek.com/ikinci",
    tabContent: "İçerik", tabLayout: "Yerleşim", tabStyle: "Görünüm", prev: "Önceki sayfa", next: "Sonraki sayfa", zoomIn: "Yakınlaştır", zoomOut: "Uzaklaştır", zoomFit: "Sığdır", zoomHint: "Alt + tekerlek: yakınlaştır · ← → : sayfa değiştir",
    modeSingle: "Tek QR", modeMulti: "Her sayfaya farklı QR",
    bulkIntro: "Her satıra hangi sayfalara hangi QR'ın konacağını yaz. Örneğin 1. sayfaya bir adres, 2 ve 3. sayfalara başka bir adres.",
    bulkPagesCol: "Sayfalar", bulkAdd: "Satır ekle",
    bulkHelp2: "Sayfaları virgül ya da aralıkla yaz: 1, 3-5. Her QR aynı yerde ve aynı boyutta durur; yerini ve boyutunu «Yerleşim» sekmesinden ayarlarsın.",
    sameWarn: "QR ile zemin aynı renk; QR görünmez olur. Bu renklerle PDF'ye eklenemez.",
    colorHint: "Okunması için QR koyu, zemin açık renk olmalı. Uygun olmayan bir eşleşmede uyarı çıkar ve ekleme kapanır.",
    captionLimit: "QR genişliğine sığacak kadar yazı yazılabilir.",
    autoSize: "Metin uzadığı için okunabilirlik adına boyut {n} mm'ye çıkarıldı.",
    marginNames: ["Standart", "Geniş", "Çok geniş"],
    logoSize: "Logo boyutu", logoSizes: ["Küçük", "Orta", "Büyük"],
    confirmTitle: "QR boyutu değişecek",
    confirmEcl: "«{x}» dayanıklılık, QR'a daha fazla yedek bilgi ekler ve QR'ın deseni sıklaşır.",
    confirmMargin: "Daha geniş kenar boşluğu, QR'ın içindeki deseni küçültür.",
    confirmLogo: "Logo QR'ın bir kısmını kapatır; bunu telafi etmek için dayanıklılık «En güçlü»ye çıkar ve desen sıklaşır.",
    confirmSize: "Telefonların okuyabilmesi için QR boyutu {a} mm'den {b} mm'ye büyütülecek. Onaylıyor musun?",
    confirmYes: "Onayla ve uygula", confirmNo: "Vazgeç",
  },
  en: {
    hint: "Choose the PDF — you'll place the QR code in the next step.",
    reading: "Reading the document…",
    encrypted: "This file is password-protected. Remove the password and upload it again.",
    broken: "The file could not be read. It may be corrupt; try another PDF.",
    tooBig: "The file is larger than 50 MB. Compress it first and try again.",
    kinds: { url: "Website", vcard: "Contact card", phone: "Phone", email: "Email", whatsapp: "WhatsApp", wifi: "Wi-Fi", text: "Text" },
    content: "QR content",
    url: "Website address", urlPh: "example.com",
    firstName: "First name", lastName: "Last name", org: "Company", title: "Job title", phone: "Phone", email: "Email",
    website: "Website", address: "Address",
    mailSubject: "Subject (optional)", mailBody: "Message (optional)",
    waPhone: "WhatsApp number", waHelp: "No need for a leading 0 or +90; spaces and dashes are cleaned.", waText: "Preset message (optional)",
    ssid: "Network name", wifiPass: "Password", wifiType: "Encryption", wifiNone: "None", text: "Text",
    emptyErr: "Fill in the QR content.", invalidErr: "That doesn't look valid — please check it.",
    pages: "Which pages?", first: "First page", last: "Last page", all: "All pages", custom: "Specific pages",
    customPh: "e.g. 1,3,5-7", pagesErr: "Invalid page list. The document has {n} pages; example: 1,3,5-7",
    position: "Position", tl: "Top left", tr: "Top right", bl: "Bottom left", br: "Bottom right", center: "Center",
    dragHint: "Drag the QR where you want it; use its bottom-right corner to resize.",
    previewPage: "Preview page",
    size: "Size", sizeMin: "For reliable scanning this content needs at least {n} mm.", tooLong: "The content is too long to fit on this page at a scannable size. Shorten it or reduce the margin.",
    margin: "Margin", marginNote: "The blank frame around the QR. It helps the phone camera separate the QR from the page. Standard is enough.",
    fg: "QR colour", bg: "Background colour",
    contrastWarn: "The colours are too close — the QR may not scan. Use a dark colour on a light background.",
    invertedWarn: "A light QR on a dark background fails on many phones. We recommend dark on light.",
    caption: "Text under the QR (optional)", captionPh: "Follow us",
    advanced: "Advanced settings", ecl: "Durability",
    eclNames: { L: "Basic", M: "Standard", Q: "Strong", H: "Strongest" },
    eclDesc: { L: "For clean screens or fresh prints. Looks simplest but breaks most easily.", M: "Enough for everyday use. Leave it here for most documents.", Q: "Pick this if the paper may crumple or get slightly dirty (flyers, labels).", H: "Pick this for places that wear out (signs, product labels, outdoors). The QR looks a bit denser." },
    logo: "Add a logo in the middle", logoNote: "A logo covers part of the QR, so durability is set to “Strongest” automatically. To stay scannable, the logo can only grow up to “Large”.", logoRemove: "Remove logo",
    logoBad: "The logo must be a PNG or JPG.",
    add: "Add QR to PDF", working: "Adding…", failed: "Could not add the QR. The file may be corrupt or protected.",
    png: "Download QR as PNG", svg: "Download QR as SVG", another: "Choose another file", close: "Close", remove: "Remove", modalTitle: "Place QR code", editEditor: "Edit QR settings", pageWord: "pages", summaryLabel: "QR",
    linkNote: "This QR is also added as a clickable link in the PDF.",
    onDevice: "Your file never leaves your device.",
    addedTo: "pages got a QR",
    templates: "Ready-made template", tplNames: { card: "Business card", menu: "Menu", invoice: "Invoice" },
    suggest: "Suggest free spot", suggestNone: "No spot on this page is empty enough for the QR; place it yourself.",
    bulk: "A different QR on each page", bulkHelp: "Write «pages | content» on each line. Example: 1 | example.com/a — 2,4-6 | example.com/b",
    bulkUrl: "Web address", bulkText: "Text",
    bulkErrFormat: "Line {n}: use the form «pages | content».", bulkErrPages: "Line {n}: invalid page list (the document has {p} pages).",
    bulkErrContent: "Line {n}: the content is empty or not a valid web address.", bulkErrEmpty: "Write at least one line.",
    bulkPlaceholder: "1 | example.com/first\n2,3 | example.com/second",
    tabContent: "Content", tabLayout: "Placement", tabStyle: "Style", prev: "Previous page", next: "Next page", zoomIn: "Zoom in", zoomOut: "Zoom out", zoomFit: "Fit", zoomHint: "Alt + wheel: zoom · ← → : change page",
    modeSingle: "Single QR", modeMulti: "A different QR per page",
    bulkIntro: "On each row, write which pages get which QR. For example one address on page 1 and another on pages 2 and 3.",
    bulkPagesCol: "Pages", bulkAdd: "Add row",
    bulkHelp2: "Write pages with commas or ranges: 1, 3-5. Every QR sits in the same place at the same size; set that in the “Placement” tab.",
    sameWarn: "The QR and background are the same colour, so the QR would be invisible. It cannot be added with these colours.",
    colorHint: "For scanning, the QR must be dark on a light background. A bad pairing shows a warning and blocks adding.",
    captionLimit: "Only as much text as fits the QR width.",
    autoSize: "The content grew, so the size was raised to {n} mm to stay scannable.",
    marginNames: ["Standard", "Wide", "Extra wide"],
    logoSize: "Logo size", logoSizes: ["Small", "Medium", "Large"],
    confirmTitle: "The QR size will change",
    confirmEcl: "“{x}” durability adds more backup data, so the QR pattern gets denser.",
    confirmMargin: "A wider margin makes the pattern inside the QR smaller.",
    confirmLogo: "A logo covers part of the QR; to make up for it durability becomes “Strongest” and the pattern gets denser.",
    confirmSize: "To keep it scannable on phones, the QR will be enlarged from {a} mm to {b} mm. Do you confirm?",
    confirmYes: "Confirm and apply", confirmNo: "Cancel",
  },
} as const;

type Konum = { fx: number; fy: number };
const KONUMLAR: Record<"tl" | "tr" | "bl" | "br" | "center", Konum> = {
  tl: { fx: 0.04, fy: 0.03 }, tr: { fx: 0.96, fy: 0.03 },
  bl: { fx: 0.04, fy: 0.97 }, br: { fx: 0.96, fy: 0.97 },
  center: { fx: 0.5, fy: 0.5 },
};

const PREVIEW_PX = 1600;
const MAX_BYTES = 50 * 1024 * 1024;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function indir(blob: Blob, ad: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ad;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function dataUrlOku(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

/** SVG'yi (isteğe bağlı logoyla) yüksek çözünürlüklü PNG'ye çevirir. */
async function svgToPng(svg: string, px: number, logo: string | null, ratio: number): Promise<Blob> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("svg"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, px, px);
  if (logo) {
    const li = new Image();
    await new Promise<void>((res, rej) => {
      li.onload = () => res();
      li.onerror = () => rej(new Error("logo"));
      li.src = logo;
    });
    const side = px * ratio;
    const pad = side * 0.08;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px / 2 - side / 2 - pad, px / 2 - side / 2 - pad, side + pad * 2, side + pad * 2);
    const k = Math.min(side / li.width, side / li.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(li, px / 2 - (li.width * k) / 2, px / 2 - (li.height * k) / 2, li.width * k, li.height * k);
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
}

const girdi =
  "w-full rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-2 text-[13px] text-white [color-scheme:dark] placeholder:text-slate-500";
const RENKLER = [
  { hex: "#000000", tr: "Siyah", en: "Black" },
  { hex: "#0b2a5b", tr: "Lacivert", en: "Navy" },
  { hex: "#14532d", tr: "Koyu yeşil", en: "Dark green" },
  { hex: "#7f1d1d", tr: "Bordo", en: "Maroon" },
  { hex: "#ffffff", tr: "Beyaz", en: "White" },
  { hex: "#fef9e7", tr: "Krem", en: "Cream" },
  { hex: "#f1f5f9", tr: "Açık gri", en: "Light grey" },
  { hex: "#e0f2fe", tr: "Açık mavi", en: "Light blue" },
] as const;
const etiket = "mb-1 block text-[12px] text-slate-400";

export function PdfQrTool({
  language,
  isSignedIn,
  onLogin,
}: {
  language: Language;
  accessToken?: string | null;
  initialFile?: File | null;
  isSignedIn?: boolean;
  onLogin?: () => void;
}) {
  const dil = language === "tr" ? "tr" : "en";
  const t = T[dil];
  const { describesTool } = useToolPageContext();
  const [modalAcik, setModalAcik] = useState(false);
  useBodyScrollLock(modalAcik);

  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("belge.pdf");
  const [thumb, setThumb] = useState<PdfThumb | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [okuyor, setOkuyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const [kind, setKind] = useState<QrKind>("url");
  const [alan, setAlan] = useState<QrFields>(BOS_ALANLAR);
  const set = <K extends keyof QrFields>(k: K, v: QrFields[K]) => setAlan((a) => ({ ...a, [k]: v }));

  const [secim, setSecim] = useState<PageSelection["mode"]>("first");
  const [ozelSayfalar, setOzelSayfalar] = useState("");
  const [sizeMm, setSizeMm] = useState(25);
  const margin = 4; // QR standardının istediği en az sessiz bölge; sayfa beyazsa görünmez, kullanıcıya seçtirilmez
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [caption, setCaption] = useState("");
  const [ecl, setEcl] = useState<QrEcl>("M");
  const [pos, setPos] = useState<Konum>(KONUMLAR.br);
  const [logoBytes, setLogoBytes] = useState<Uint8Array | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPct, setLogoPct] = useState(16);
  const [bekleyen, setBekleyen] = useState<{ neden: "ecl" | "margin" | "logo"; ad?: string; eski: number; yeni: number; uygula: () => void } | null>(null);
  const [otoNot, setOtoNot] = useState<number | null>(null);
  const [logoHata, setLogoHata] = useState(false);
  const [toplu, setToplu] = useState(false);
  const [topluTur, setTopluTur] = useState<"url" | "text">("url");
  const [satirlar, setSatirlar] = useState<Array<{ pages: string; content: string }>>([{ pages: "1", content: "" }]);
  const [kapi, setKapi] = useState(false);

  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState<{ blob: Blob; ad: string; sayfa: number } | null>(null);

  const dosyaYukle = useCallback(
    async (f: File | undefined) => {
      if (!f) return;
      setHata(null);
      if (f.size > MAX_BYTES) return setHata(t.tooBig);
      setOkuyor(true);
      try {
        const b = new Uint8Array(await f.arrayBuffer());
        const th = await renderPdfPage(b, 0, PREVIEW_PX);
        setBytes(b);
        setFileName(f.name);
        setThumb(th);
        setPreviewPage(0);
        setModalAcik(true); // dosya yüklenince ayar penceresi açılır (diğer sayfa araçlarıyla aynı)
      } catch (e) {
        setHata(e instanceof PdfThumbError && e.kind === "encrypted" ? t.encrypted : t.broken);
      } finally {
        setOkuyor(false);
      }
    },
    [t],
  );

  // Önizleme sayfası değişince yeniden çiz
  useEffect(() => {
    if (!bytes || previewPage === 0) return;
    let iptal = false;
    void renderPdfPage(bytes, previewPage, PREVIEW_PX)
      .then((th) => !iptal && setThumb(th))
      .catch(() => {});
    return () => {
      iptal = true;
    };
  }, [bytes, previewPage]);

  const topluMetin = useMemo(
    () => satirlar.filter((r) => r.pages.trim() || r.content.trim()).map((r) => `${r.pages.trim()} | ${r.content.trim()}`).join("\n"),
    [satirlar],
  );
  const batch = useMemo(
    () => (toplu && thumb ? parseBatchLines(topluMetin, thumb.pageCount, topluTur) : null),
    [toplu, thumb, topluMetin, topluTur],
  );
  const payload: PayloadResult = useMemo(() => {
    if (toplu) {
      if (batch?.ok) {
        const r = batch.rules.find((x) => x.pages.includes(previewPage)) ?? batch.rules[0]!;
        return { ok: true, text: r.text, link: r.link };
      }
      return { ok: false, error: "empty" };
    }
    return buildPayload(kind, alan);
  }, [toplu, batch, previewPage, kind, alan]);
  const etkinEcl: QrEcl = logoBytes ? "H" : ecl;

  const matris = useMemo(() => {
    if (!payload.ok) return null;
    try {
      return makeMatrix(payload.text, etkinEcl);
    } catch {
      return null; // çok uzun içerik
    }
  }, [payload, etkinEcl]);
  const svg = useMemo(
    () => (matris ? qrToSvg(matris, { fg, bg, marginModules: margin }) : null),
    [matris, fg, bg, margin],
  );
  // Tek modülün basılı boyutu 0,33 mm'nin altına inerse QR okunmaz: bu boyutun altına inilemez.
  const metinler = useMemo(
    () => (toplu && batch?.ok ? batch.rules.map((r) => r.text) : payload.ok ? [payload.text] : []),
    [toplu, batch, payload],
  );
  const minFor = (e: QrEcl, m: number) => minSizeMm(metinler, e, m);
  const minMm = useMemo(() => minFor(etkinEcl, margin), [metinler, etkinEcl, margin]); // eslint-disable-line react-hooks/exhaustive-deps
  // Logo oranı QR deseninin genişliğine göredir; çizimlerde tüm kutuya (kenar boşluğu dahil) çevrilir.
  const logoKutu = matris ? (logoPct / 100) * (matris.size / (matris.size + margin * 2)) : logoPct / 100;
  const svgUrl = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;

  const secimNesnesi: PageSelection =
    secim === "custom" ? { mode: "custom", text: ozelSayfalar } : ({ mode: secim } as PageSelection);
  const sayfalar = thumb ? resolvePages(secimNesnesi, thumb.pageCount) : null;
  const sayfaHata = secim === "custom" && ozelSayfalar.trim() !== "" && !sayfalar;

  const kontrast = contrastRatio(fg, bg);
  const renkUyari = fg.toLowerCase() === bg.toLowerCase() ? t.sameWarn : isInverted(fg, bg) ? t.invertedWarn : kontrast < 4 ? t.contrastWarn : null;

  const icerikHata = !payload.ok ? (payload.error === "empty" ? t.emptyErr : t.invalidErr) : svg === null ? t.invalidErr : null;

  // ── Önizleme ölçüleri (sayfa oranlı; alanı doldurur, yakınlaştırılabilir) ──
  const kutuRef = useRef<HTMLDivElement>(null);
  const [kutuW, setKutuW] = useState(320);
  useEffect(() => {
    const el = kutuRef.current;
    if (!el) return;
    const ol = () => el.clientWidth > 0 && setKutuW(el.clientWidth);
    const ro = new ResizeObserver(ol);
    ro.observe(el);
    ol();
    return () => ro.disconnect();
  }, [thumb, modalAcik, sonuc]);

  const gorRef = useRef<HTMLDivElement>(null);
  const [gor, setGor] = useState({ w: 600, h: 700 });
  const [zoom, setZoom] = useState(1);
  const [sekme, setSekme] = useState<"content" | "layout" | "style">("content");
  useEffect(() => {
    const el = gorRef.current;
    if (!el) return;
    // Sonuç ekranına geçince öğe yok edilir; 0 ölçüyü yok say (yoksa sayfa minik kalır)
    const ol = () => el.clientWidth > 0 && el.clientHeight > 0 && setGor({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(ol);
    ro.observe(el);
    ol();
    // Alt (ya da Ctrl) + tekerlek: yakınlaştır
    const wheel = (e: WheelEvent) => {
      if (!e.altKey && !e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => clamp(Math.round(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12) * 100) / 100, 1, 5));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", wheel);
    };
  }, [thumb, modalAcik, sonuc]);

  // Ok tuşları: sayfa değiştir (form alanlarında yazarken devre dışı)
  const sayfaSayisi = thumb?.pageCount ?? 1;
  useEffect(() => {
    if (!modalAcik) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      const yon = e.key === "ArrowLeft" || e.key === "PageUp" ? -1 : e.key === "ArrowRight" || e.key === "PageDown" ? 1 : 0;
      if (!yon) return;
      e.preventDefault();
      setPreviewPage((p) => clamp(p + yon, 0, sayfaSayisi - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalAcik, sayfaSayisi]);

  const sidePt = sizeMm * MM;
  const capH = captionHeightPt(caption);
  const bw = thumb ? clamp(sidePt / thumb.widthPt, 0.02, 1) : 0.1;
  const bh = thumb ? clamp((sidePt + capH) / thumb.heightPt, 0.02, 1) : 0.1;
  const maxMm = thumb ? Math.floor((Math.min(thumb.widthPt, thumb.heightPt) * 0.9) / MM) : 100;
  const altYaziMax = captionMaxChars(sizeMm);
  useEffect(() => {
    if (caption.length > altYaziMax) setCaption(caption.slice(0, altYaziMax));
  }, [caption, altYaziMax]);
  const sigmaz = minMm > maxMm; // içerik bu sayfaya okunur boyutta sığmaz
  // İçerik/kenar boşluğu değişince boyut alt sınırın altında kalmasın
  useEffect(() => {
    if (sizeMm < minMm && !sigmaz) {
      setSizeMm(minMm);
      setOtoNot(minMm);
    }
  }, [sizeMm, minMm, sigmaz]);

  const surukle = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!kutuRef.current || !thumb) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const r = kutuRef.current.getBoundingClientRect();
    const bas = { x: e.clientX, y: e.clientY, fx: pos.fx, fy: pos.fy };
    const hareket = (ev: PointerEvent) => {
      const bosX = (1 - bw) * r.width;
      const bosY = (1 - bh) * r.height;
      setPos({
        fx: bosX > 1 ? clamp(bas.fx + (ev.clientX - bas.x) / bosX, 0, 1) : 0,
        fy: bosY > 1 ? clamp(bas.fy + (ev.clientY - bas.y) / bosY, 0, 1) : 0,
      });
    };
    const bitir = () => {
      el.removeEventListener("pointermove", hareket);
      el.removeEventListener("pointerup", bitir);
      el.removeEventListener("pointercancel", bitir);
    };
    el.addEventListener("pointermove", hareket);
    el.addEventListener("pointerup", bitir);
    el.addEventListener("pointercancel", bitir);
  };

  const boyutla = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!kutuRef.current || !thumb) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const r = kutuRef.current.getBoundingClientRect();
    const basX = e.clientX;
    const basMm = sizeMm;
    const hareket = (ev: PointerEvent) => {
      const dMm = ((ev.clientX - basX) / r.width) * (thumb.widthPt / MM);
      setSizeMm(clamp(Math.round(basMm + dMm), Math.min(minMm, maxMm), maxMm));
    };
    const bitir = () => {
      el.removeEventListener("pointermove", hareket);
      el.removeEventListener("pointerup", bitir);
      el.removeEventListener("pointercancel", bitir);
    };
    el.addEventListener("pointermove", hareket);
    el.addEventListener("pointerup", bitir);
    el.addEventListener("pointercancel", bitir);
  };

  // Yakınlaştırılmış sayfayı boş yerinden tutup her yöne kaydırma (QR'a basılırsa QR taşınır)
  const [tutuyor, setTutuyor] = useState(false);
  const kaydir = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = gorRef.current;
    if (!el || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[role="group"]')) return;
    if (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    setTutuyor(true);
    const bas = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
    const hareket = (ev: PointerEvent) => {
      el.scrollLeft = bas.l - (ev.clientX - bas.x);
      el.scrollTop = bas.t - (ev.clientY - bas.y);
    };
    const bitir = () => {
      setTutuyor(false);
      el.removeEventListener("pointermove", hareket);
      el.removeEventListener("pointerup", bitir);
      el.removeEventListener("pointercancel", bitir);
    };
    el.addEventListener("pointermove", hareket);
    el.addEventListener("pointerup", bitir);
    el.addEventListener("pointercancel", bitir);
  };

  const klavye = (e: React.KeyboardEvent) => {
    if (!e.shiftKey) return; // Shift'siz oklar sayfa değiştirir; QR'ı Shift + ok kaydırır
    const adim = e.altKey ? 0.1 : 0.02;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-adim, 0], ArrowRight: [adim, 0], ArrowUp: [0, -adim], ArrowDown: [0, adim],
    };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    setPos((p) => ({ fx: clamp(p.fx + m[0], 0, 1), fy: clamp(p.fy + m[1], 0, 1) }));
  };

  // Ayar değişikliği QR'ı sıklaştırıp boyutu zorunlu büyütecekse önce kullanıcıdan onay al.
  const onayliDegis = (e: QrEcl, m: number, neden: "ecl" | "margin" | "logo", ad: string | undefined, uygula: () => void) => {
    const yeni = minFor(e, m);
    if (sizeMm >= yeni || yeni > maxMm) {
      uygula();
      return;
    }
    setBekleyen({ neden, ad, eski: sizeMm, yeni, uygula: () => { uygula(); setSizeMm(yeni); } });
  };

  const logoSec = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g)$/.test(f.type)) return setLogoHata(true);
    setLogoHata(false);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const url = await dataUrlOku(f);
    onayliDegis("H", margin, "logo", undefined, () => {
      setLogoBytes(bytes);
      setLogoUrl(url);
    });
  };

  const ekle = async () => {
    if (!bytes || !payload.ok) return;
    if (!toplu && !sayfalar) return;
    if (KAYIT_GEREKLI && !isSignedIn) {
      setKapi(true);
      return;
    }
    setCalisiyor(true);
    setHata(null);
    try {
      let fontBytes: Uint8Array | null = null;
      if (caption.trim()) {
        fontBytes = new Uint8Array(await (await fetch("/fonts/Roboto-Regular.ttf")).arrayBuffer());
      }
      const ortak = { ecl, logoRatio: logoPct / 100, sizeMm, marginModules: margin, fg, bg, fx: pos.fx, fy: pos.fy, caption, logoBytes, fontBytes };
      let out: Uint8Array;
      let adet: number;
      if (toplu && batch?.ok) {
        out = await stampQrBatch(bytes, batch.rules, ortak);
        adet = new Set(batch.rules.flatMap((r) => r.pages)).size;
      } else {
        out = await stampQr(bytes, { ...ortak, text: payload.text, link: payload.link, pages: sayfalar! });
        adet = sayfalar!.length;
      }
      setSonuc({
        blob: new Blob([out as unknown as BlobPart], { type: "application/pdf" }),
        ad: qrOutputName(fileName),
        sayfa: adet,
      });
    } catch {
      setHata(t.failed);
    } finally {
      setCalisiyor(false);
    }
  };

  const qrIndir = async (tur: "png" | "svg") => {
    if (!svg) return;
    const baz = fileName.replace(/\.pdf$/i, "") + "_qr";
    if (tur === "svg") {
      const logoSvg = logoUrl
        ? svg.replace(
            "</svg>",
            (() => {
              const total = 100;
              const s = total * logoKutu;
              const p = s * 0.08;
              const c = total / 2;
              return `<svg x="0" y="0" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}" overflow="visible"><rect x="${c - s / 2 - p}" y="${c - s / 2 - p}" width="${s + 2 * p}" height="${s + 2 * p}" fill="#fff"/><image href="${logoUrl}" x="${c - s / 2}" y="${c - s / 2}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid meet"/></svg></svg>`;
            })(),
          )
        : svg;
      indir(new Blob([logoSvg], { type: "image/svg+xml" }), `${baz}.svg`);
    } else {
      indir(await svgToPng(svg, 1200, logoUrl, logoKutu), `${baz}.png`);
    }
  };

  if (sonuc) {
    return (
      <ToolResultPanel
        ratingToolSlug="pdf-qr-ekle"
        blob={sonuc.blob}
        filename={sonuc.ad}
        language={language}
        processedOnDevice
        subtitle={`${sonuc.sayfa} ${t.addedTo}`}
        onClose={() => setSonuc(null)}
      />
    );
  }

  if (!bytes || !thumb) {
    return (
      <div className="w-full">
        <div className="tool-form">
          <WorkspaceUploadField
            toolId="pdf-qr-ekle"
            language={language}
            accept="application/pdf,.pdf"
            note={t.hint}
            hideHeader={describesTool}
            onFiles={(files) => void dosyaYukle(files[0])}
          />
        </div>
        {okuyor && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-slate-300" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> {t.reading}
          </p>
        )}
        {hata && <p className="mt-3 text-[13px] text-rose-300" role="alert">{hata}</p>}
      </div>
    );
  }

  const kinds: QrKind[] = ["url", "vcard", "phone", "email", "whatsapp", "wifi", "text"];
  const hazir = payload.ok && !!svg && !sigmaz && !renkUyari && (toplu ? !!batch?.ok : !!sayfalar);
  const batchHata =
    toplu && batch && !batch.ok && topluMetin.trim()
      ? (batch.error === "format" ? t.bulkErrFormat
        : batch.error === "pages" ? t.bulkErrPages
        : batch.error === "content" ? t.bulkErrContent
        : t.bulkErrEmpty)
          .replace("{n}", String(batch.line))
          .replace("{p}", String(thumb.pageCount))
      : null;

  const bolumBaslik = "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";
  const sekmeler = [["content", t.tabContent], ["layout", t.tabLayout], ["style", t.tabStyle]] as const;
  const sayfaGit = (n: number) => setPreviewPage(clamp(n, 0, thumb.pageCount - 1));
  const oran = thumb.widthPt / thumb.heightPt;
  const sigW = Math.max(120, Math.min(gor.w - 32, (gor.h - 32) * oran));
  const sayfaW = sigW * zoom;
  const pil = (aktif: boolean) =>
    `rounded-lg border px-3 py-2 text-[12.5px] font-medium transition ${
      aktif ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/[0.09]"
    }`;
  const segBtn = (aktif: boolean) =>
    `rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition ${
      aktif ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/50" : "text-slate-300 hover:bg-white/[0.07]"
    }`;

  const modalIcerik = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      {/* ── Ayarlar ── */}
      <div className="flex shrink-0 flex-col border-b border-white/[0.08] sm:max-h-[46%] md:max-h-none md:w-[24rem] md:border-b-0 md:border-r">
        <div className="flex shrink-0 gap-1 border-b border-white/[0.08] p-2" role="tablist">
          {sekmeler.map(([id, ad]) => (
            <button key={id} type="button" role="tab" aria-selected={sekme === id} onClick={() => setSekme(id)}
              className={`flex-1 ${segBtn(sekme === id)}`}>
              {ad}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {sekme === "content" && (
            <>
              <section className="space-y-2.5" aria-label={t.content}>
                <p className={bolumBaslik}>{t.content}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" aria-pressed={!toplu} onClick={() => setToplu(false)} className={`${pil(!toplu)} text-center`}>{t.modeSingle}</button>
                  <button type="button" aria-pressed={toplu} onClick={() => setToplu(true)} className={`${pil(toplu)} text-center`}>{t.modeMulti}</button>
                </div>
                {toplu && (
                  <div className="space-y-2.5 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[12px] leading-relaxed text-slate-400">{t.bulkIntro}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button type="button" aria-pressed={topluTur === "url"} onClick={() => setTopluTur("url")} className={`${pil(topluTur === "url")} text-center`}>{t.bulkUrl}</button>
                      <button type="button" aria-pressed={topluTur === "text"} onClick={() => setTopluTur("text")} className={`${pil(topluTur === "text")} text-center`}>{t.bulkText}</button>
                    </div>
                    <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-2 gap-y-2">
                      <span className="text-[11.5px] font-semibold text-slate-400">{t.bulkPagesCol}</span>
                      <span className="text-[11.5px] font-semibold text-slate-400">{topluTur === "url" ? t.bulkUrl : t.bulkText}</span>
                      <span />
                      {satirlar.map((r, i) => (
                        <div key={i} className="contents">
                          <input className={girdi} value={r.pages} placeholder="1, 3-5" aria-label={t.bulkPagesCol}
                            onChange={(e) => setSatirlar((x) => x.map((y, j) => (j === i ? { ...y, pages: e.target.value } : y)))} />
                          <input className={girdi} value={r.content} placeholder={topluTur === "url" ? t.urlPh : t.text} aria-label={t.bulkUrl}
                            onChange={(e) => setSatirlar((x) => x.map((y, j) => (j === i ? { ...y, content: e.target.value } : y)))} />
                          <button type="button" aria-label={t.remove} disabled={satirlar.length === 1}
                            onClick={() => setSatirlar((x) => x.filter((_, j) => j !== i))}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setSatirlar((x) => [...x, { pages: "", content: "" }])}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.07]">
                      <Plus className="h-3.5 w-3.5" /> {t.bulkAdd}
                    </button>
                    <p className="text-[11.5px] leading-relaxed text-slate-500">{t.bulkHelp2}</p>
                    {batchHata && <p className="text-[12px] text-amber-300" role="alert">{batchHata}</p>}
                  </div>
                )}
                <div className={`flex flex-wrap gap-1.5 ${toplu ? "hidden" : ""}`} role="tablist">
                  {kinds.map((k) => (
                    <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
                      className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${kind === k ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/[0.09]"}`}>
                      {t.kinds[k]}
                    </button>
                  ))}
                </div>

                <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${toplu ? "hidden" : ""}`}>
                  {kind === "url" && (
                    <label className="sm:col-span-2"><span className={etiket}>{t.url}</span>
                      <input className={girdi} inputMode="url" value={alan.url} placeholder={t.urlPh} onChange={(e) => set("url", e.target.value)} /></label>
                  )}
                  {kind === "vcard" && (
                    <>
                      {([["firstName", t.firstName], ["lastName", t.lastName], ["org", t.org], ["title", t.title], ["phone", t.phone], ["email", t.email], ["website", t.website]] as const).map(([k, l]) => (
                        <label key={k}><span className={etiket}>{l}</span>
                          <input className={girdi} value={alan[k]} onChange={(e) => set(k, e.target.value)} /></label>
                      ))}
                      <label className="sm:col-span-2"><span className={etiket}>{t.address}</span>
                        <input className={girdi} value={alan.address} onChange={(e) => set("address", e.target.value)} /></label>
                    </>
                  )}
                  {kind === "phone" && (
                    <label className="sm:col-span-2"><span className={etiket}>{t.phone}</span>
                      <input className={girdi} inputMode="tel" value={alan.phone} onChange={(e) => set("phone", e.target.value)} /></label>
                  )}
                  {kind === "email" && (
                    <>
                      <label className="sm:col-span-2"><span className={etiket}>{t.email}</span>
                        <input className={girdi} inputMode="email" value={alan.email} onChange={(e) => set("email", e.target.value)} /></label>
                      <label className="sm:col-span-2"><span className={etiket}>{t.mailSubject}</span>
                        <input className={girdi} value={alan.mailSubject} onChange={(e) => set("mailSubject", e.target.value)} /></label>
                      <label className="sm:col-span-2"><span className={etiket}>{t.mailBody}</span>
                        <input className={girdi} value={alan.mailBody} onChange={(e) => set("mailBody", e.target.value)} /></label>
                    </>
                  )}
                  {kind === "whatsapp" && (
                    <>
                      <label className="sm:col-span-2"><span className={etiket}>{t.waPhone}</span>
                        <input className={girdi} inputMode="tel" value={alan.phone} onChange={(e) => set("phone", e.target.value)} />
                        <span className="mt-1 block text-[11.5px] text-slate-500">{t.waHelp}</span></label>
                      <label className="sm:col-span-2"><span className={etiket}>{t.waText}</span>
                        <input className={girdi} value={alan.waText} onChange={(e) => set("waText", e.target.value)} /></label>
                    </>
                  )}
                  {kind === "wifi" && (
                    <>
                      <label className="sm:col-span-2"><span className={etiket}>{t.ssid}</span>
                        <input className={girdi} value={alan.ssid} onChange={(e) => set("ssid", e.target.value)} /></label>
                      <label><span className={etiket}>{t.wifiType}</span>
                        <select className={girdi} value={alan.wifiType} onChange={(e) => set("wifiType", e.target.value as QrFields["wifiType"])}>
                          <option className="bg-slate-900 text-slate-100" value="WPA">WPA/WPA2/WPA3</option><option className="bg-slate-900 text-slate-100" value="WEP">WEP</option><option className="bg-slate-900 text-slate-100" value="nopass">{t.wifiNone}</option>
                        </select></label>
                      <label><span className={etiket}>{t.wifiPass}</span>
                        <input className={`${girdi} disabled:opacity-40`} value={alan.wifiPassword} disabled={alan.wifiType === "nopass"} onChange={(e) => set("wifiPassword", e.target.value)} /></label>
                    </>
                  )}
                  {kind === "text" && (
                    <label className="sm:col-span-2"><span className={etiket}>{t.text}</span>
                      <textarea className={girdi} rows={4} value={alan.text} onChange={(e) => set("text", e.target.value)} /></label>
                  )}
                </div>
                {!toplu && icerikHata && alanDokunuldu(alan) && <p className="text-[12px] text-amber-300" role="alert">{icerikHata}</p>}
                {!toplu && payload.ok && payload.link && <p className="text-[12px] text-slate-500">{t.linkNote}</p>}
              </section>


            </>
          )}

          {sekme === "layout" && (
            <>
              <section className={`space-y-2 ${toplu ? "hidden" : ""}`} aria-label={t.pages}>
                <p className={bolumBaslik}>{t.pages}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["first", "last", "all", "custom"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setSecim(m)} className={`${pil(secim === m)} text-center`}>{t[m]}</button>
                  ))}
                </div>
                {secim === "custom" && (
                  <input className={girdi} value={ozelSayfalar} placeholder={t.customPh} aria-label={t.custom} onChange={(e) => setOzelSayfalar(e.target.value)} />
                )}
                {sayfaHata && <p className="text-[12px] text-amber-300" role="alert">{t.pagesErr.replace("{n}", String(thumb.pageCount))}</p>}
              </section>

              <section className={`space-y-3 ${toplu ? "" : "border-t border-white/[0.08] pt-4"}`} aria-label={t.position}>
                <p className={bolumBaslik}>{t.position}</p>
                <div className="flex items-start gap-4">
                  <div className="relative h-28 w-[5.25rem] shrink-0 rounded-md border border-white/20 bg-white/[0.04]">
                    {(["tl", "tr", "center", "bl", "br"] as const).map((k) => {
                      const p = KONUMLAR[k];
                      const aktif = Math.abs(pos.fx - p.fx) < 0.01 && Math.abs(pos.fy - p.fy) < 0.01;
                      return (
                        <button key={k} type="button" title={t[k]} aria-label={t[k]} onClick={() => setPos(p)}
                          className={`absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-sm border transition ${aktif ? "border-cyan-300 bg-cyan-400" : "border-white/30 bg-white/10 hover:bg-white/25"}`}
                          style={{ left: `${10 + p.fx * 80}%`, top: `${10 + p.fy * 80}%` }} />
                      );
                    })}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-[12px] leading-relaxed text-slate-400">{t.dragHint}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-2 border-t border-white/[0.08] pt-4">
                <label className="block">
                  <span className="flex items-baseline justify-between text-[13px] text-slate-200">{t.size}<b className="text-white">{sizeMm} mm</b></span>
                  <input type="range" min={Math.min(minMm, maxMm)} max={maxMm} value={sizeMm} onChange={(e) => { setSizeMm(Number(e.target.value)); setOtoNot(null); }} className="mt-1 w-full" aria-label={t.size} />
                </label>
                <p className="text-[11.5px] text-slate-500">{t.sizeMin.replace("{n}", String(minMm))}</p>
                {otoNot !== null && <p className="text-[12px] text-cyan-200" role="status">{t.autoSize.replace("{n}", String(otoNot))}</p>}
                {sigmaz && (
                  <p className="flex items-start gap-1 text-[12px] text-rose-300" role="alert">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t.tooLong}
                  </p>
                )}
              </section>

            </>
          )}

          {sekme === "style" && (
            <>
              <section className="space-y-4" aria-label={t.fg}>
                {([[t.fg, fg, setFg], [t.bg, bg, setBg]] as const).map(([baslik, deger, ayarla]) => (
                  <div key={baslik}>
                    <p className={bolumBaslik}>{baslik}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {RENKLER.map((r) => (
                        <button key={r.hex} type="button" aria-pressed={deger.toLowerCase() === r.hex} onClick={() => ayarla(r.hex)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${deger.toLowerCase() === r.hex ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-100" : "border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/[0.09]"}`}>
                          <span className="h-4 w-4 shrink-0 rounded-full border border-white/40" style={{ background: r.hex }} />
                          {dil === "tr" ? r.tr : r.en}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-white/20" style={{ background: bg }}>
                    <QrCode className="h-8 w-8" style={{ color: fg }} />
                  </div>
                  <p className="text-[12px] leading-relaxed text-slate-400">{t.colorHint}</p>
                </div>
                {renkUyari && (
                  <p className="flex items-start gap-1 text-[12px] text-rose-300" role="alert">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {renkUyari}
                  </p>
                )}
              </section>


              <section className="border-t border-white/[0.08] pt-4">
                <label className="block">
                  <span className={etiket}>{t.caption}</span>
                  <input className={girdi} maxLength={altYaziMax} value={caption} placeholder={t.captionPh} onChange={(e) => setCaption(e.target.value)} />
                  <span className="mt-1 flex justify-between text-[11.5px] text-slate-500"><span>{t.captionLimit}</span><span className="tabular-nums">{caption.length}/{altYaziMax}</span></span>
                </label>
              </section>

              <section className="space-y-3 border-t border-white/[0.08] pt-4">
                <p className={bolumBaslik}>{t.advanced}</p>
                <div>
                  <span className={etiket}>{t.ecl}</span>
                  <div className={`grid grid-cols-2 gap-1.5 ${logoBytes ? "pointer-events-none opacity-60" : ""}`}>
                    {(["L", "M", "Q", "H"] as const).map((k) => (
                      <button key={k} type="button" aria-pressed={etkinEcl === k} className={`${pil(etkinEcl === k)} text-center`}
                        onClick={() => k !== etkinEcl && onayliDegis(k, margin, "ecl", t.eclNames[k], () => setEcl(k))}>
                        {t.eclNames[k]}
                      </button>
                    ))}
                  </div>
                  <span className="mt-1.5 block text-[11.5px] leading-relaxed text-slate-400">{t.eclDesc[etkinEcl]}</span>
                </div>
                <div>
                  <span className={etiket}>{t.logo}</span>
                  {logoUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={logoUrl} alt="" className="h-10 w-10 rounded border border-white/15 bg-white object-contain" />
                      <button type="button" onClick={() => { setLogoBytes(null); setLogoUrl(null); }} className="flex items-center gap-1 text-[12px] font-semibold text-rose-300">
                        <X className="h-3.5 w-3.5" /> {t.logoRemove}
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-[13px] text-slate-200 hover:bg-white/[0.09]">
                      <ImagePlus className="h-4 w-4" /> PNG / JPG
                      <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => void logoSec(e.target.files?.[0])} />
                    </label>
                  )}
                  {logoUrl && (
                    <div className="mt-3">
                      <span className={etiket}>{t.logoSize}</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([[12, t.logoSizes[0]], [16, t.logoSizes[1]], [20, t.logoSizes[2]]] as const).map(([v, ad]) => (
                          <button key={v} type="button" aria-pressed={logoPct === v} onClick={() => setLogoPct(v)} className={`${pil(logoPct === v)} text-center`}>{ad}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">{t.logoNote}</p>
                  {logoHata && <p className="text-[12px] text-rose-300" role="alert">{t.logoBad}</p>}
                </div>
              </section>
            </>
          )}
        </div>

        {bekleyen && (
          <div className="shrink-0 space-y-2 border-t border-amber-400/30 bg-amber-500/10 p-3" role="alertdialog" aria-label={t.confirmTitle}>
            <p className="text-[13px] font-semibold text-amber-100">{t.confirmTitle}</p>
            <p className="text-[12.5px] leading-relaxed text-amber-50/90">
              {(bekleyen.neden === "ecl" ? t.confirmEcl.replace("{x}", bekleyen.ad ?? "") : bekleyen.neden === "margin" ? t.confirmMargin : t.confirmLogo)}{" "}
              {t.confirmSize.replace("{a}", String(bekleyen.eski)).replace("{b}", String(bekleyen.yeni))}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { bekleyen.uygula(); setOtoNot(null); setBekleyen(null); }} className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-[12.5px] font-bold text-slate-900 hover:bg-amber-400">{t.confirmYes}</button>
              <button type="button" onClick={() => setBekleyen(null)} className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-[12.5px] font-semibold text-slate-200 hover:bg-white/[0.07]">{t.confirmNo}</button>
            </div>
          </div>
        )}
        <div className="shrink-0 space-y-2 border-t border-white/[0.08] p-3">
          {hata && <p className="text-[13px] text-rose-300" role="alert">{hata}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={!svg} onClick={() => void qrIndir("png")} className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.06] disabled:opacity-40">{t.png}</button>
            <button type="button" disabled={!svg} onClick={() => void qrIndir("svg")} className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.06] disabled:opacity-40">{t.svg}</button>
          </div>
          <p className="text-[11.5px] text-slate-500">{t.onDevice}</p>
        </div>
      </div>

      {/* ── Sayfa önizlemesi ── */}
      <div className="flex min-h-[260px] min-w-0 flex-1 flex-col bg-slate-950/40">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] px-3 py-1.5">
          <div className="flex items-center gap-1">
            <button type="button" aria-label={t.prev} title={t.prev} disabled={previewPage <= 0} onClick={() => sayfaGit(previewPage - 1)}
              className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <span className="flex items-center gap-1 text-[12.5px] text-slate-300">
              <input type="number" min={1} max={thumb.pageCount} value={previewPage + 1} aria-label={t.previewPage}
                onChange={(e) => e.target.value !== "" && sayfaGit(Number(e.target.value) - 1)}
                className="w-12 rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-center text-white" />
              / {thumb.pageCount}
            </span>
            <button type="button" aria-label={t.next} title={t.next} disabled={previewPage >= thumb.pageCount - 1} onClick={() => sayfaGit(previewPage + 1)}
              className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label={t.zoomOut} title={t.zoomOut} disabled={zoom <= 1} onClick={() => setZoom((z) => clamp(Math.round((z - 0.25) * 100) / 100, 1, 5))}
              className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-30"><ZoomOut className="h-4 w-4" /></button>
            <button type="button" title={t.zoomFit} onClick={() => setZoom(1)} className="min-w-[3.25rem] rounded-md px-1.5 py-1 text-center text-[12px] font-semibold tabular-nums text-slate-200 hover:bg-white/10">{Math.round(zoom * 100)}%</button>
            <button type="button" aria-label={t.zoomIn} title={t.zoomIn} disabled={zoom >= 5} onClick={() => setZoom((z) => clamp(Math.round((z + 0.25) * 100) / 100, 1, 5))}
              className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-30"><ZoomIn className="h-4 w-4" /></button>
          </div>
        </div>

        <div ref={gorRef} onPointerDown={kaydir} className={`min-h-0 flex-1 overflow-auto ${zoom > 1 ? (tutuyor ? "cursor-grabbing" : "cursor-grab") : ""}`}>
          <div className="flex min-h-full min-w-full items-center justify-center p-4">
            <div ref={kutuRef} className="relative shrink-0 select-none overflow-hidden rounded-sm border border-white/15 bg-white shadow-xl" style={{ width: sayfaW, aspectRatio: `${thumb.widthPt} / ${thumb.heightPt}` }}>
              <img src={thumb.dataUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
              {svgUrl && (
                <div
                  role="group"
                  tabIndex={0}
                  aria-label={t.dragHint}
                  onPointerDown={surukle}
                  onKeyDown={klavye}
                  className="absolute cursor-grab touch-none outline-none ring-2 ring-cyan-400 focus-visible:ring-4 active:cursor-grabbing"
                  style={{ left: `${pos.fx * (1 - bw) * 100}%`, top: `${pos.fy * (1 - bh) * 100}%`, width: `${bw * 100}%`, height: `${bh * 100}%` }}
                >
                  <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
                    <img src={svgUrl} alt="" draggable={false} className="h-full w-full" style={{ imageRendering: "pixelated" }} />
                    {logoUrl && (
                      <img src={logoUrl} alt="" draggable={false} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white object-contain" style={{ width: `${logoKutu * 100}%`, height: `${logoKutu * 100}%`, padding: `${logoKutu * 8}%`, background: bg }} />
                    )}
                  </div>
                  {caption.trim() && (
                    <div className="w-full truncate text-center" style={{ color: fg, fontSize: Math.max(6, (9 / thumb.widthPt) * kutuW), lineHeight: 1.6 }}>
                      {caption}
                    </div>
                  )}
                  <div
                    onPointerDown={boyutla}
                    role="slider"
                    aria-label={t.size}
                    aria-valuenow={sizeMm}
                    aria-valuemin={minMm}
                    aria-valuemax={maxMm}
                    className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-cyan-500 shadow"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="shrink-0 border-t border-white/[0.08] px-3 py-1.5 text-center text-[11.5px] text-slate-500">{t.zoomHint}</p>
      </div>
    </div>
  );

  const ozetMetin = `${thumb.pageCount} ${t.pageWord} · ${sizeMm} mm`;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-cyan-300">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-slate-100">{fileName}</p>
          <p className="text-[12px] text-slate-400">{thumb.pageCount} {t.pageWord}</p>
        </div>
        <button
          type="button"
          onClick={() => { setBytes(null); setThumb(null); setModalAcik(false); }}
          className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
          aria-label={t.remove}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.07] px-4 py-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-cyan-300/80">{t.summaryLabel}</p>
        <p className="mt-0.5 text-sm font-semibold text-cyan-50">{ozetMetin}</p>
      </div>

      {hata && <p className="mt-3 text-[13px] text-rose-300" role="alert">{hata}</p>}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => setModalAcik(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
        >
          <Sliders className="h-4 w-4" />
          {t.editEditor}
        </button>
        <button
          type="button"
          onClick={() => void ekle()}
          disabled={!hazir || calisiyor}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.7)] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
        >
          {calisiyor ? (<><Loader2 className="h-5 w-5 animate-spin" />{t.working}</>) : (<>{t.add} →</>)}
        </button>
      </div>
      <p className="mt-3 text-[12px] text-slate-500">{t.onDevice}</p>

      {modalAcik &&
        createPortal(
          <div className="fixed inset-0 z-[11000] flex items-center justify-center p-1 sm:p-1.5" role="presentation">
            <button type="button" aria-label={t.close} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setModalAcik(false)} />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t.modalTitle}
              className="relative z-10 flex h-[min(94vh,100dvh)] w-[min(96vw,100vw)] max-w-[96vw] flex-col overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-b from-slate-900/[0.98] via-slate-950/[0.99] to-[#070b12] shadow-[0_25px_80px_-20px_rgba(0,0,0,0.85)]"
            >
              <div className="flex shrink-0 items-center gap-3 border-b border-cyan-500/15 bg-slate-950/50 px-3 py-2 sm:py-2.5">
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-50 sm:text-base">
                  {t.modalTitle} <span className="font-normal text-slate-400">· {fileName}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setModalAcik(false)}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/[0.12] sm:min-h-0 sm:px-2.5"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  {t.close}
                </button>
              </div>
              {modalIcerik}
              <div className="flex shrink-0 flex-col gap-2 border-t border-cyan-500/15 bg-slate-950/60 px-3 py-2.5 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 text-[12.5px] font-medium text-slate-300">{ozetMetin}</p>
                {hata && <p className="text-[12px] text-rose-300">{hata}</p>}
                <button
                  type="button"
                  onClick={() => void ekle()}
                  disabled={!hazir || calisiyor}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
                >
                  {calisiyor ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {calisiyor ? t.working : `${t.add} →`}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {kapi && !isSignedIn && (
        <MemberGateModal language={language} icon={<QrCode className="h-7 w-7" />} toolName={dil === "tr" ? "PDF'ye QR Kod Ekle" : "Add QR Code to PDF"} onClose={() => setKapi(false)} onLogin={onLogin} />
      )}
    </div>
  );
}

/** Kullanıcı henüz hiçbir şey yazmadıysa hata göstermeyiz. */
function alanDokunuldu(a: QrFields): boolean {
  return (Object.keys(BOS_ALANLAR) as (keyof QrFields)[]).some((k) => a[k] !== BOS_ALANLAR[k]);
}
