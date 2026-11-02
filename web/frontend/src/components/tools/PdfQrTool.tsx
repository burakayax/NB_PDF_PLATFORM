/**
 * PDF'YE QR KOD EKLE — QR içeriğini kur, sayfada istediğin yere sürükle, boyutunu ayarla.
 *
 * Her şey cihazda yapılır (pdf-lib + pdf.js); dosya sunucuya gitmez.
 * QR, PDF'ye VEKTÖR olarak çizilir — baskıda bulanıklaşmaz. Orijinal sayfa
 * içeriği (metin, bağlantılar, formlar) değiştirilmez; QR üstüne eklenir.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ImagePlus, Loader2, QrCode, X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { PdfThumbError, renderPdfPage, type PdfThumb } from "../../lib/pdfThumbs";
import {
  BOS_ALANLAR, MIN_SAFE_MM, MM, buildPayload, captionHeightPt, contrastRatio, isInverted,
  makeMatrix, qrOutputName, qrToSvg, resolvePages, stampQr,
  type PageSelection, type QrEcl, type QrFields, type QrKind,
} from "../../lib/pdfQr";

/** Kayıt gerekli mi? Karar verilince tek yerden değişir (katalogdaki free/account bayrağıyla birlikte). */
const KAYIT_GEREKLI = false;

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
    ssid: "Ağ adı", wifiPass: "Şifre", wifiType: "Şifreleme", wifiNone: "Şifresiz", wifiHidden: "Gizli ağ", text: "Metin",
    emptyErr: "QR'ın içeriğini doldur.", invalidErr: "Girdiğin bilgi geçerli görünmüyor — kontrol et.",
    pages: "Hangi sayfalara?", first: "İlk sayfa", last: "Son sayfa", all: "Tüm sayfalar", custom: "Belirli sayfalar",
    customPh: "örn. 1,3,5-7", pagesErr: "Sayfa listesi geçersiz. Belge {n} sayfa; örnek: 1,3,5-7",
    position: "Konum", tl: "Sol üst", tr: "Sağ üst", bl: "Sol alt", br: "Sağ alt", center: "Orta",
    dragHint: "QR'ı tutup istediğin yere sürükle; sağ alt köşesinden de boyutunu değiştirebilirsin.",
    previewPage: "Önizleme sayfası",
    size: "Boyut", sizeWarn: "Çok küçük QR kodlar okunamayabilir.",
    margin: "Kenar boşluğu", marginNote: "QR'ın çevresindeki boş çerçeve (modül). En az 2 önerilir.",
    fg: "QR rengi", bg: "Zemin rengi",
    contrastWarn: "Renkler birbirine çok yakın — QR okunmayabilir. Koyu renk açık zemin kullan.",
    invertedWarn: "Açık renkli QR koyu zeminde birçok telefonda okunmaz. Koyu QR + açık zemin öneririz.",
    caption: "QR altına yazı (isteğe bağlı)", captionPh: "Bizi takip edin",
    advanced: "Gelişmiş ayarlar", ecl: "Hata düzeltme",
    eclNote: "Yüksek düzey, QR'ın hasarlı ya da kirli olsa da okunmasını sağlar ama daha yoğun görünür.",
    logo: "Ortaya logo ekle", logoNote: "Logo eklenince hata düzeltme otomatik «Çok yüksek» olur.", logoRemove: "Logoyu kaldır",
    logoBad: "Logo PNG ya da JPG olmalı.",
    add: "QR'ı PDF'ye ekle", working: "Ekleniyor…", failed: "QR eklenemedi. Dosya bozuk ya da korumalı olabilir.",
    png: "QR'ı PNG indir", svg: "QR'ı SVG indir", another: "Başka dosya seç",
    linkNote: "Bu QR, PDF'te tıklanabilir bağlantı olarak da eklenir.",
    onDevice: "Dosyan cihazından çıkmaz.",
    addedTo: "sayfaya QR eklendi",
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
    ssid: "Network name", wifiPass: "Password", wifiType: "Encryption", wifiNone: "None", wifiHidden: "Hidden network", text: "Text",
    emptyErr: "Fill in the QR content.", invalidErr: "That doesn't look valid — please check it.",
    pages: "Which pages?", first: "First page", last: "Last page", all: "All pages", custom: "Specific pages",
    customPh: "e.g. 1,3,5-7", pagesErr: "Invalid page list. The document has {n} pages; example: 1,3,5-7",
    position: "Position", tl: "Top left", tr: "Top right", bl: "Bottom left", br: "Bottom right", center: "Center",
    dragHint: "Drag the QR where you want it; use its bottom-right corner to resize.",
    previewPage: "Preview page",
    size: "Size", sizeWarn: "Very small QR codes may not scan.",
    margin: "Margin", marginNote: "Blank frame around the QR (modules). 2 or more is recommended.",
    fg: "QR colour", bg: "Background colour",
    contrastWarn: "The colours are too close — the QR may not scan. Use a dark colour on a light background.",
    invertedWarn: "A light QR on a dark background fails on many phones. We recommend dark on light.",
    caption: "Text under the QR (optional)", captionPh: "Follow us",
    advanced: "Advanced settings", ecl: "Error correction",
    eclNote: "Higher levels let the QR scan even when damaged or dirty, but look denser.",
    logo: "Add a logo in the middle", logoNote: "Adding a logo sets error correction to “Highest” automatically.", logoRemove: "Remove logo",
    logoBad: "The logo must be a PNG or JPG.",
    add: "Add QR to PDF", working: "Adding…", failed: "Could not add the QR. The file may be corrupt or protected.",
    png: "Download QR as PNG", svg: "Download QR as SVG", another: "Choose another file",
    linkNote: "This QR is also added as a clickable link in the PDF.",
    onDevice: "Your file never leaves your device.",
    addedTo: "pages got a QR",
  },
} as const;

type Konum = { fx: number; fy: number };
const KONUMLAR: Record<"tl" | "tr" | "bl" | "br" | "center", Konum> = {
  tl: { fx: 0.04, fy: 0.03 }, tr: { fx: 0.96, fy: 0.03 },
  bl: { fx: 0.04, fy: 0.97 }, br: { fx: 0.96, fy: 0.97 },
  center: { fx: 0.5, fy: 0.5 },
};

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
async function svgToPng(svg: string, px: number, logo: string | null): Promise<Blob> {
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
    const side = px * 0.2;
    const pad = side * 0.12;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px / 2 - side / 2 - pad, px / 2 - side / 2 - pad, side + pad * 2, side + pad * 2);
    const k = Math.min(side / li.width, side / li.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(li, px / 2 - (li.width * k) / 2, px / 2 - (li.height * k) / 2, li.width * k, li.height * k);
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
}

const girdi =
  "w-full rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-2 text-[13px] text-white placeholder:text-slate-500";
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
  const [margin, setMargin] = useState(2);
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [caption, setCaption] = useState("");
  const [ecl, setEcl] = useState<QrEcl>("M");
  const [pos, setPos] = useState<Konum>(KONUMLAR.br);
  const [logoBytes, setLogoBytes] = useState<Uint8Array | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoHata, setLogoHata] = useState(false);

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
        const th = await renderPdfPage(b, 0, 640);
        setBytes(b);
        setFileName(f.name);
        setThumb(th);
        setPreviewPage(0);
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
    void renderPdfPage(bytes, previewPage, 640)
      .then((th) => !iptal && setThumb(th))
      .catch(() => {});
    return () => {
      iptal = true;
    };
  }, [bytes, previewPage]);

  const payload = useMemo(() => buildPayload(kind, alan), [kind, alan]);
  const etkinEcl: QrEcl = logoBytes ? "H" : ecl;

  const svg = useMemo(() => {
    if (!payload.ok) return null;
    try {
      return qrToSvg(makeMatrix(payload.text, etkinEcl), { fg, bg, marginModules: margin });
    } catch {
      return null; // çok uzun içerik
    }
  }, [payload, etkinEcl, fg, bg, margin]);
  const svgUrl = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;

  const secimNesnesi: PageSelection =
    secim === "custom" ? { mode: "custom", text: ozelSayfalar } : ({ mode: secim } as PageSelection);
  const sayfalar = thumb ? resolvePages(secimNesnesi, thumb.pageCount) : null;
  const sayfaHata = secim === "custom" && ozelSayfalar.trim() !== "" && !sayfalar;

  const kontrast = contrastRatio(fg, bg);
  const renkUyari = isInverted(fg, bg) ? t.invertedWarn : kontrast < 4 ? t.contrastWarn : null;

  const icerikHata = !payload.ok ? (payload.error === "empty" ? t.emptyErr : t.invalidErr) : svg === null ? t.invalidErr : null;

  // ── Önizleme ölçüleri (sayfa oranlı) ──
  const kutuRef = useRef<HTMLDivElement>(null);
  const [kutuW, setKutuW] = useState(320);
  useEffect(() => {
    const el = kutuRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setKutuW(el.clientWidth));
    ro.observe(el);
    setKutuW(el.clientWidth);
    return () => ro.disconnect();
  }, [thumb]);

  const sidePt = sizeMm * MM;
  const capH = captionHeightPt(caption);
  const bw = thumb ? clamp(sidePt / thumb.widthPt, 0.02, 1) : 0.1;
  const bh = thumb ? clamp((sidePt + capH) / thumb.heightPt, 0.02, 1) : 0.1;
  const maxMm = thumb ? Math.floor((Math.min(thumb.widthPt, thumb.heightPt) * 0.9) / MM) : 100;

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
      setSizeMm(clamp(Math.round(basMm + dMm), 10, maxMm));
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

  const klavye = (e: React.KeyboardEvent) => {
    const adim = e.shiftKey ? 0.1 : 0.02;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-adim, 0], ArrowRight: [adim, 0], ArrowUp: [0, -adim], ArrowDown: [0, adim],
    };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    setPos((p) => ({ fx: clamp(p.fx + m[0], 0, 1), fy: clamp(p.fy + m[1], 0, 1) }));
  };

  const logoSec = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g)$/.test(f.type)) return setLogoHata(true);
    setLogoHata(false);
    setLogoBytes(new Uint8Array(await f.arrayBuffer()));
    setLogoUrl(await dataUrlOku(f));
  };

  const ekle = async () => {
    if (!bytes || !payload.ok || !sayfalar) return;
    if (KAYIT_GEREKLI && !isSignedIn) {
      onLogin?.();
      return;
    }
    setCalisiyor(true);
    setHata(null);
    try {
      let fontBytes: Uint8Array | null = null;
      if (caption.trim()) {
        fontBytes = new Uint8Array(await (await fetch("/fonts/Roboto-Regular.ttf")).arrayBuffer());
      }
      const out = await stampQr(bytes, {
        text: payload.text, link: payload.link, ecl, pages: sayfalar, sizeMm, marginModules: margin,
        fg, bg, fx: pos.fx, fy: pos.fy, caption, logoBytes, fontBytes,
      });
      setSonuc({
        blob: new Blob([out as unknown as BlobPart], { type: "application/pdf" }),
        ad: qrOutputName(fileName),
        sayfa: sayfalar.length,
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
              const s = total * 0.2;
              const p = s * 0.12;
              const c = total / 2;
              return `<svg x="0" y="0" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}" overflow="visible"><rect x="${c - s / 2 - p}" y="${c - s / 2 - p}" width="${s + 2 * p}" height="${s + 2 * p}" fill="#fff"/><image href="${logoUrl}" x="${c - s / 2}" y="${c - s / 2}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid meet"/></svg></svg>`;
            })(),
          )
        : svg;
      indir(new Blob([logoSvg], { type: "image/svg+xml" }), `${baz}.svg`);
    } else {
      indir(await svgToPng(svg, 1200, logoUrl), `${baz}.png`);
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
      <div className="mx-auto w-full max-w-2xl">
        <div className="tool-form">
          <WorkspaceUploadField
            toolId="pdf-qr-ekle"
            language={language}
            accept="application/pdf,.pdf"
            note={t.hint}
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
  const hazir = payload.ok && !!svg && !!sayfalar;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      {/* ── Ayarlar ── */}
      <div className="order-2 space-y-5 lg:order-1">
        <section aria-label={t.content}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t.content}</p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="tablist">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                  kind === k ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                }`}
              >
                {t.kinds[k]}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                <label><span className={etiket}>{t.mailSubject}</span>
                  <input className={girdi} value={alan.mailSubject} onChange={(e) => set("mailSubject", e.target.value)} /></label>
                <label><span className={etiket}>{t.mailBody}</span>
                  <input className={girdi} value={alan.mailBody} onChange={(e) => set("mailBody", e.target.value)} /></label>
              </>
            )}
            {kind === "whatsapp" && (
              <>
                <label><span className={etiket}>{t.waPhone}</span>
                  <input className={girdi} inputMode="tel" value={alan.phone} onChange={(e) => set("phone", e.target.value)} /></label>
                <label><span className={etiket}>{t.waText}</span>
                  <input className={girdi} value={alan.waText} onChange={(e) => set("waText", e.target.value)} /></label>
                <p className="text-[12px] text-slate-400 sm:col-span-2">{t.waHelp}</p>
              </>
            )}
            {kind === "wifi" && (
              <>
                <label><span className={etiket}>{t.ssid}</span>
                  <input className={girdi} value={alan.ssid} onChange={(e) => set("ssid", e.target.value)} /></label>
                <label><span className={etiket}>{t.wifiPass}</span>
                  <input className={girdi} value={alan.wifiPassword} disabled={alan.wifiType === "nopass"} onChange={(e) => set("wifiPassword", e.target.value)} /></label>
                <label><span className={etiket}>{t.wifiType}</span>
                  <select className={girdi} value={alan.wifiType} onChange={(e) => set("wifiType", e.target.value as QrFields["wifiType"])}>
                    <option value="WPA">WPA/WPA2/WPA3</option><option value="WEP">WEP</option><option value="nopass">{t.wifiNone}</option>
                  </select></label>
                <label className="flex items-center gap-2 pt-5 text-[13px] text-slate-200">
                  <input type="checkbox" checked={alan.wifiHidden} onChange={(e) => set("wifiHidden", e.target.checked)} /> {t.wifiHidden}</label>
              </>
            )}
            {kind === "text" && (
              <label className="sm:col-span-2"><span className={etiket}>{t.text}</span>
                <textarea className={girdi} rows={3} value={alan.text} onChange={(e) => set("text", e.target.value)} /></label>
            )}
          </div>
          {icerikHata && alanDokunuldu(alan) && <p className="mt-2 text-[12px] text-amber-300" role="alert">{icerikHata}</p>}
          {payload.ok && payload.link && <p className="mt-2 text-[12px] text-slate-400">{t.linkNote}</p>}
        </section>

        <section aria-label={t.pages}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t.pages}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {(["first", "last", "all", "custom"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-[13px] text-slate-200">
                <input type="radio" name="qr-sayfa" checked={secim === m} onChange={() => setSecim(m)} /> {t[m]}
              </label>
            ))}
          </div>
          {secim === "custom" && (
            <input className={`${girdi} mt-2 max-w-xs`} value={ozelSayfalar} placeholder={t.customPh} aria-label={t.custom} onChange={(e) => setOzelSayfalar(e.target.value)} />
          )}
          {sayfaHata && <p className="mt-1 text-[12px] text-amber-300" role="alert">{t.pagesErr.replace("{n}", String(thumb.pageCount))}</p>}
        </section>

        <section aria-label={t.position}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t.position}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(["tl", "tr", "bl", "br", "center"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setPos(KONUMLAR[k])}
                className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.09]">
                {t[k]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-slate-400">{t.dragHint}</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className={etiket}>{t.size}: <b className="text-white">{sizeMm} mm</b></span>
              <input type="range" min={10} max={maxMm} value={sizeMm} onChange={(e) => setSizeMm(Number(e.target.value))} className="w-full" aria-label={t.size} />
              {sizeMm < MIN_SAFE_MM && (
                <span className="mt-1 flex items-center gap-1 text-[12px] text-amber-300" role="alert">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t.sizeWarn}
                </span>
              )}
            </label>
            <label>
              <span className={etiket}>{t.margin}: <b className="text-white">{margin}</b></span>
              <input type="range" min={0} max={8} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full" aria-label={t.margin} />
              <span className="text-[11px] text-slate-500">{t.marginNote}</span>
            </label>
            <label className="flex items-center gap-2 text-[13px] text-slate-200">
              <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} aria-label={t.fg} className="h-8 w-10 cursor-pointer rounded border border-white/15 bg-transparent" /> {t.fg}
            </label>
            <label className="flex items-center gap-2 text-[13px] text-slate-200">
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} aria-label={t.bg} className="h-8 w-10 cursor-pointer rounded border border-white/15 bg-transparent" /> {t.bg}
            </label>
          </div>
          {renkUyari && (
            <p className="mt-2 flex items-start gap-1 text-[12px] text-amber-300" role="alert">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {renkUyari}
            </p>
          )}

          <label className="mt-4 block">
            <span className={etiket}>{t.caption}</span>
            <input className={girdi} maxLength={60} value={caption} placeholder={t.captionPh} onChange={(e) => setCaption(e.target.value)} />
          </label>
        </section>

        <details className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-slate-200">{t.advanced}</summary>
          <div className="mt-3 space-y-4">
            <label className="block">
              <span className={etiket}>{t.ecl}</span>
              <select className={girdi} value={etkinEcl} disabled={!!logoBytes} onChange={(e) => setEcl(e.target.value as QrEcl)}>
                <option value="L">L (%7)</option><option value="M">M (%15)</option><option value="Q">Q (%25)</option><option value="H">H (%30)</option>
              </select>
              <span className="text-[11px] text-slate-500">{t.eclNote}</span>
            </label>
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
              <p className="mt-1 text-[11px] text-slate-500">{t.logoNote}</p>
              {logoHata && <p className="text-[12px] text-rose-300" role="alert">{t.logoBad}</p>}
            </div>
          </div>
        </details>

        {hata && <p className="text-[13px] text-rose-300" role="alert">{hata}</p>}

        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={() => { setBytes(null); setThumb(null); }}
            className="shrink-0 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-[13px] font-semibold text-slate-200">
            {t.another}
          </button>
          <button type="button" onClick={() => void ekle()} disabled={!hazir || calisiyor}
            className="flex min-w-[10rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50">
            {calisiyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            {calisiyor ? t.working : t.add}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!svg} onClick={() => void qrIndir("png")} className="rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-slate-200 disabled:opacity-40">{t.png}</button>
          <button type="button" disabled={!svg} onClick={() => void qrIndir("svg")} className="rounded-lg border border-white/15 px-3 py-2 text-[12px] font-semibold text-slate-200 disabled:opacity-40">{t.svg}</button>
        </div>
        <p className="text-[12px] text-slate-500">{t.onDevice}</p>
      </div>

      {/* ── Sayfa önizlemesi ── */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-4 lg:self-start">
        <div ref={kutuRef} className="relative mx-auto w-full max-w-sm select-none overflow-hidden rounded-lg border border-white/15 bg-white shadow-lg" style={{ aspectRatio: `${thumb.widthPt} / ${thumb.heightPt}` }}>
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
                  <img src={logoUrl} alt="" draggable={false} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white object-contain" style={{ width: "20%", height: "20%", padding: "1.5%", background: bg }} />
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
                aria-valuemin={10}
                aria-valuemax={maxMm}
                className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-cyan-500 shadow"
              />
            </div>
          )}
        </div>
        {thumb.pageCount > 1 && (
          <label className="mt-2 flex items-center justify-center gap-2 text-[12px] text-slate-400">
            {t.previewPage}
            <select className="rounded border border-white/15 bg-white/[0.06] px-2 py-1 text-white" value={previewPage} onChange={(e) => setPreviewPage(Number(e.target.value))}>
              {Array.from({ length: Math.min(thumb.pageCount, 200) }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

/** Kullanıcı henüz hiçbir şey yazmadıysa hata göstermeyiz. */
function alanDokunuldu(a: QrFields): boolean {
  return (Object.keys(BOS_ALANLAR) as (keyof QrFields)[]).some((k) => a[k] !== BOS_ALANLAR[k]);
}
