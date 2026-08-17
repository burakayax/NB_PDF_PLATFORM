import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Copy,
  Download,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Share2,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  Wand2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { imagesToPdf, pdfBytesToBlob } from "../../lib/clientPdfWorker";
import { zipStore } from "../../lib/zipStore";
import { uploadScanToLibrary } from "../../api/scans";
import { saveScanForAccount, takeScanForAccount } from "../../lib/pendingScan";
// Ağır OCR yolu (pdf-lib + tesseract) doğrudan çekirdek motordan; bu bileşen lazy
// yüklendiği için pdf-lib ana pakete değil, bu aracın kendi chunk'ına düşer.
import { imagesToSearchablePdf } from "../../lib/clientPdf";
import { ocrImagesToWords } from "../../lib/ocr";
import { PdfHub } from "./PdfHub";
import {
  canvasToJpegBlob,
  cropQuadFallback,
  detectDocumentQuad,
  fullFrameQuad,
  warpDocument,
  type EnhanceMode,
  type Pt,
  type Quad,
} from "../../lib/documentScan";

type Phase = "camera" | "review" | "pages" | "result";
// Kaydetme formatı: PDF (belge standardı, çok sayfa), JPG (paylaşım/küçük boyut),
// PNG (kayıpsız/keskin). Çok sayfalı JPG/PNG → sayfa başına görsel içeren ZIP.
type ScanFormat = "pdf" | "jpg" | "png";
const FORMAT_EXT: Record<ScanFormat, string> = { pdf: "pdf", jpg: "jpg", png: "png" };
const FORMAT_MIME: Record<ScanFormat, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png" };

// Boyut/kalite: JPEG yeniden kodlama kalitesi (PNG kayıpsız → uygulanmaz).
type ScanQuality = "small" | "normal" | "high";
const QUALITY_Q: Record<ScanQuality, number> = { small: 0.6, normal: 0.82, high: 0.95 };

/** JPEG blob'unu verilen kalitede yeniden kodla (dosya boyutunu ayarlamak için). */
async function reencodeJpeg(blob: Blob, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const cnv = document.createElement("canvas");
  cnv.width = bmp.width;
  cnv.height = bmp.height;
  const ctx = cnv.getContext("2d");
  if (!ctx) { bmp.close?.(); return blob; }
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  return await new Promise<Blob>((resolve) => cnv.toBlob((b) => resolve(b || blob), "image/jpeg", quality));
}

/** Tarih tabanlı akıllı varsayılan dosya adı (ör. Tarama-2026-08-04). */
function defaultScanName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `Tarama-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Bir görsel blob'unu 90° saat yönünde döndürüp JPEG döndür. */
async function rotateBlob90(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const cnv = document.createElement("canvas");
  cnv.width = bmp.height;
  cnv.height = bmp.width;
  const ctx = cnv.getContext("2d");
  if (!ctx) { bmp.close?.(); throw new Error("no ctx"); }
  ctx.translate(cnv.width / 2, cnv.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  bmp.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    cnv.toBlob((b) => (b ? resolve(b) : reject(new Error("rotate"))), "image/jpeg", 0.92),
  );
}

/** JPEG blob'unu PNG'ye çevir (kayıpsız çıktı için). */
async function blobToPng(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const cnv = document.createElement("canvas");
  cnv.width = bmp.width;
  cnv.height = bmp.height;
  const ctx = cnv.getContext("2d");
  if (!ctx) { bmp.close?.(); throw new Error("no ctx"); }
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    cnv.toBlob((b) => (b ? resolve(b) : reject(new Error("png encode"))), "image/png"),
  );
}
type ScannedPage = { url: string; blob: Blob };

type Props = {
  open: boolean;
  language: Language;
  onClose: () => void;
  /** "PDF Araçları" seçilince taranan PDF File'ı + seçilen araç id'sini üst bileşene verir. */
  onUseInTools?: (file: File, toolId: string) => void;
  /** Ücretli plan (STARTER/PLUS/PRO/BUSINESS veya admin) → Pro tarama özellikleri açık. */
  isPro?: boolean;
  /** Pro'ya yükseltme akışını başlatır (upsell butonu). */
  onUpgrade?: () => void;
  /** Masaüstü/web (arka kamera yok) → "telefonda açın" bilgi ekranı gösterilir. */
  isDesktop?: boolean;
  /** Oturum açıksa → "Hesabıma kaydet" (bulut taramalar) etkin. */
  accessToken?: string | null;
  /** Misafirde "Hesabıma kaydet" kilitli görünür; tıklanınca giriş akışını açar. */
  onLogin?: () => void;
};

/** Dosya adını güvenli hale getirir (geçersiz karakterleri temizler, boşsa varsayılan). */
function sanitizeFileName(name: string): string {
  return (name.trim() || "taranan-belge").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 100);
}
/** Ücretsiz planda tek taramada izin verilen sayfa sayısı (Pro: sınırsız). */
const FREE_PAGE_LIMIT = 3;

/** İki dörtgenin ortalama köşe kayması (kararlılık ölçümü için). */
function quadDiff(a: Quad, b: Quad): number {
  let s = 0;
  for (let i = 0; i < 4; i++) s += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return s / 4;
}
// Belge kaç ardışık kararlı karede otomatik yakalanır (~220ms/kare → ~1.3sn).
const STABLE_FRAMES = 6;

/**
 * BELGE TARAYICI — mobil kamerayla belge fotoğrafı çekip cihazda otomatik kenar
 * tespiti + perspektif düzeltmesiyle PDF üretir. Görüntü SUNUCUYA GİTMEZ.
 * Sonuçta kullanıcıya "Kaydet / Paylaş / PDF Araçları" seçenekleri sunulur.
 */
export function DocumentScanner({ open, language, onClose, onUseInTools, isPro, onUpgrade, isDesktop, accessToken, onLogin }: Props) {
  const tr = language === "tr";
  const [phase, setPhase] = useState<Phase>("camera");
  // Pro upsell paneli: hangi tetikleyiciyle açıldı (filtre / sayfa limiti / OCR).
  const [upsell, setUpsell] = useState<null | "auto" | "pages" | "ocr">(null);
  // Aranabilir PDF (OCR) durumu: ilerleme (0..1) ve tamamlandı bayrağı.
  const [ocrPct, setOcrPct] = useState<number | null>(null);
  const [searchable, setSearchable] = useState(false);
  const [captured, setCaptured] = useState<HTMLCanvasElement | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [enhance, setEnhance] = useState<EnhanceMode>("color");
  // Manuel köşe ayarında sürüklenen köşe indeksi → büyüteç (loupe) önizlemesi.
  const [activeCorner, setActiveCorner] = useState<number | null>(null);
  // "PDF Araçlarında aç" → hangi araçta açılacağını soran seçici.
  const [toolPicker, setToolPicker] = useState(false);
  // Kullanıcının belirlediği PDF adı (sayfalar ekranında girilir, her yerde kullanılır).
  const [fileName, setFileName] = useState(defaultScanName);
  const [format, setFormat] = useState<ScanFormat>("pdf");
  const [quality, setQuality] = useState<ScanQuality>("normal");
  const [copied, setCopied] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [rotatingAll, setRotatingAll] = useState(false);
  const [savedAcct, setSavedAcct] = useState(false);
  const [savingAcct, setSavingAcct] = useState(false);
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; filename: string; saved?: "picker" | "download" } | null>(null);
  // Canlı (gerçek zamanlı) kenar tespiti + otomatik yakalama
  const [autoCapture, setAutoCapture] = useState(true);
  const [liveQuad, setLiveQuad] = useState<Quad | null>(null);
  const [videoDims, setVideoDims] = useState<{ w: number; h: number } | null>(null);
  const [holdPct, setHoldPct] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragIdx = useRef<number | null>(null);
  const saveHandleRef = useRef<FileSystemFileHandle | null>(null);
  // Canlı tespit döngüsü yardımcı ref'leri
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const autoCaptureRef = useRef(true);
  autoCaptureRef.current = autoCapture;
  const stableRef = useRef(0);
  const prevLiveRef = useRef<Quad | null>(null);
  const capturingRef = useRef(false);
  /** Misafir "Hesabıma kaydet"e bastı → giriş yapılır yapılmaz otomatik yükle. */
  const pendingAcctSaveRef = useRef(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Kamerayı yalnız "camera" fazında ve modal açıkken çalıştır (mobil kaynağı boşa tutma).
  // Masaüstünde (arka kamera yok) kamerayı hiç açma → "telefonda açın" ekranı gösterilir.
  useEffect(() => {
    if (!open || phase !== "camera" || isDesktop) return;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError(true);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraError(false);
      } catch {
        if (!cancelled) setCameraError(true);
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, phase, stopStream, isDesktop]);

  // Sayfa kaydırmasını kilitle + kapanınca her şeyi sıfırla.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const capturedRef = useRef<HTMLCanvasElement | null>(null);
  capturedRef.current = captured;

  const resetAll = useCallback(() => {
    stopStream();
    setPhase("camera");
    setCaptured(null);
    setCapturedUrl(null);
    setQuad(null);
    setEnhance("color");
    setPages((p) => {
      p.forEach((x) => URL.revokeObjectURL(x.url));
      return [];
    });
    setDetecting(false);
    setBusy(false);
    setError(null);
    setResult(null);
    setUpsell(null);
    setOcrPct(null);
    setSearchable(false);
    setToolPicker(false);
    setActiveCorner(null);
    setFileName(defaultScanName());
    setFormat("pdf");
    setQuality("normal");
    setCopied(false);
    setPreviewIdx(null);
    setRotatingAll(false);
    setSavedAcct(false);
    setSavingAcct(false);
    saveHandleRef.current = null;
  }, [stopStream]);

  // Modal kapandığında temizle.
  useEffect(() => {
    if (!open) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Çekilen kareyi (canvas) al → önizleme URL'i üret → otomatik kenar tespiti.
  const handleCaptured = useCallback(
    async (cnv: HTMLCanvasElement) => {
      setCaptured(cnv);
      setCapturedUrl(cnv.toDataURL("image/jpeg", 0.85));
      setQuad(null);
      setError(null);
      setPhase("review");
      stopStream();
      // Perspektif düzeltme OpenCV GEREKTİRMEZ → kenarları HEMEN tam-kare ver;
      // kullanıcı beklemeden köşeleri ayarlayabilir.
      setQuad(fullFrameQuad(cnv.width, cnv.height));
      setDetecting(true);
      // Otomatik kenar tespiti OPSİYONEL (OpenCV). Yüklenemezse (ör. tarayıcı
      // güvenlik ayarı) SESSİZCE manuel moda düşer — hata/yeniden-yükleme YOK.
      try {
        // Çekimde ML (nöral) dedektör — daha isabetli otomatik kenar (self-host, gizli).
        const q = await detectDocumentQuad(cnv, true);
        if (q) setQuad(q);
        else
          setError(
            tr
              ? "Otomatik kenar bulunamadı — köşeleri elle ayarlayabilirsin."
              : "Couldn't auto-detect edges — adjust the corners manually.",
          );
      } catch {
        setError(
          tr
            ? "Otomatik kenar kullanılamıyor — köşeleri elle ayarlayabilirsin."
            : "Auto edge detection unavailable — adjust the corners manually.",
        );
      } finally {
        setDetecting(false);
      }
    },
    [stopStream, tr],
  );

  const doCapture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const cnv = document.createElement("canvas");
    cnv.width = v.videoWidth;
    cnv.height = v.videoHeight;
    const ctx = cnv.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    void handleCaptured(cnv);
  }, [handleCaptured]);

  // Otomatik yakalama: canlıda bulunan kenarla tam çözünürlüklü kareyi doğrudan al
  // (yeniden tespit YOK — kullanıcı hiçbir köşe seçmez). Onay için incele fazına geçer.
  const autoShot = useCallback(
    (quad: Quad) => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) {
        capturingRef.current = false;
        return;
      }
      const cnv = document.createElement("canvas");
      cnv.width = v.videoWidth;
      cnv.height = v.videoHeight;
      cnv.getContext("2d")?.drawImage(v, 0, 0);
      stopStream();
      setCaptured(cnv);
      setCapturedUrl(cnv.toDataURL("image/jpeg", 0.85));
      setQuad(quad);
      setError(null);
      setDetecting(false);
      setLiveQuad(null);
      setHoldPct(0);
      setPhase("review");
    },
    [stopStream],
  );

  // ── CANLI kenar tespiti döngüsü (yalnız kamera fazında) ──
  useEffect(() => {
    if (!open || phase !== "camera" || cameraError || isDesktop) return;
    // Kameraya her girişte temiz başla.
    capturingRef.current = false;
    stableRef.current = 0;
    prevLiveRef.current = null;
    setLiveQuad(null);
    setHoldPct(0);

    let cancelled = false;
    let timer = 0;
    let running = false;

    const tick = async () => {
      if (cancelled) return;
      const v = videoRef.current;
      if (v && v.videoWidth && !running && !capturingRef.current) {
        running = true;
        try {
          const vw = v.videoWidth;
          const vh = v.videoHeight;
          const off = offscreenRef.current ?? (offscreenRef.current = document.createElement("canvas"));
          const ow = Math.min(vw, 640);
          const oh = Math.max(1, Math.round(vh * (ow / vw)));
          off.width = ow;
          off.height = oh;
          off.getContext("2d")?.drawImage(v, 0, 0, ow, oh);
          const q = await detectDocumentQuad(off);
          if (!cancelled && !capturingRef.current) {
            if (q) {
              const s = vw / ow;
              const scaled = q.map((p) => ({ x: p.x * s, y: p.y * s })) as Quad;
              setLiveQuad(scaled);
              const prev = prevLiveRef.current;
              const moved = prev ? quadDiff(prev, scaled) : Infinity;
              stableRef.current = moved < vw * 0.03 ? stableRef.current + 1 : 0;
              prevLiveRef.current = scaled;
              if (autoCaptureRef.current) {
                setHoldPct(Math.min(1, stableRef.current / STABLE_FRAMES));
                if (stableRef.current >= STABLE_FRAMES) {
                  capturingRef.current = true;
                  autoShot(scaled);
                }
              } else {
                setHoldPct(0);
              }
            } else {
              setLiveQuad(null);
              stableRef.current = 0;
              prevLiveRef.current = null;
              setHoldPct(0);
            }
          }
        } catch {
          // OpenCV yüklenemedi → canlı tespit kapanır; manuel deklanşör yine çalışır.
          cancelled = true;
        } finally {
          running = false;
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, 220);
    };
    timer = window.setTimeout(tick, 500); // kamera ısınması için kısa gecikme
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, cameraError, autoShot]);

  const onPickFile = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const cnv = document.createElement("canvas");
        cnv.width = img.naturalWidth;
        cnv.height = img.naturalHeight;
        cnv.getContext("2d")?.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        void handleCaptured(cnv);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setError(tr ? "Görsel okunamadı." : "Could not read the image.");
      };
      img.src = url;
    },
    [handleCaptured, tr],
  );

  // ── Köşe sürükleme (SVG viewBox = görsel pikselleri) ──
  function clientToSvg(clientX: number, clientY: number): Pt {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
  const startDrag = (e: React.PointerEvent, i: number) => {
    e.preventDefault();
    dragIdx.current = i;
    setActiveCorner(i);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragIdx.current == null) return;
    const c = capturedRef.current;
    if (!c) return;
    const p = clientToSvg(e.clientX, e.clientY);
    const x = Math.max(0, Math.min(c.width, p.x));
    const y = Math.max(0, Math.min(c.height, p.y));
    const idx = dragIdx.current;
    setQuad((q) => (q ? (q.map((pp, k) => (k === idx ? { x, y } : pp)) as Quad) : q));
  };
  const endDrag = () => {
    dragIdx.current = null;
    setActiveCorner(null);
  };

  // Bu sayfayı işle (perspektif + iyileştirme) → sayfa listesine ekle.
  const commitPage = useCallback(async () => {
    const c = capturedRef.current;
    if (!c || !quad) return;
    // Ücretsiz plan sayfa limiti — dolduysa işlemeden Pro'ya yönlendir.
    if (!isPro && pages.length >= FREE_PAGE_LIMIT) {
      setUpsell("pages");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let out: HTMLCanvasElement;
      try {
        out = await warpDocument(c, quad, enhance);
      } catch {
        // OpenCV yüklenemediyse en azından dörtgeni KIRP (perspektifsiz) —
        // orijinali işlemektense kırpılmış belge işlensin.
        out = cropQuadFallback(c, quad, enhance);
      }
      const blob = await canvasToJpegBlob(out);
      const url = URL.createObjectURL(blob);
      setPages((p) => [...p, { url, blob }]);
      setCaptured(null);
      setCapturedUrl(null);
      setQuad(null);
      setPhase("pages");
    } catch {
      setError(tr ? "Sayfa işlenemedi, tekrar dene." : "Could not process the page.");
    } finally {
      setBusy(false);
    }
  }, [quad, enhance, tr, isPro, pages.length]);

  const removePage = (i: number) =>
    setPages((p) => {
      const t = p[i];
      if (t) URL.revokeObjectURL(t.url);
      return p.filter((_, k) => k !== i);
    });

  // Sayfayı 90° döndür (yan/ters taranmış sayfa için) — cihazda.
  const rotatePage = async (i: number) => {
    const pg = pages[i];
    if (!pg) return;
    try {
      const blob = await rotateBlob90(pg.blob);
      const url = URL.createObjectURL(blob);
      const oldUrl = pg.url;
      setPages((prev) => prev.map((x, k) => (k === i ? { url, blob } : x)));
      URL.revokeObjectURL(oldUrl);
    } catch {
      setError(tr ? "Sayfa döndürülemedi." : "Could not rotate the page.");
    }
  };

  // Sayfa sırasını değiştir (sola/sağa taşı).
  const movePage = (i: number, dir: -1 | 1) =>
    setPages((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const retake = () => {
    setCaptured(null);
    setCapturedUrl(null);
    setQuad(null);
    setError(null);
    setPhase("camera");
  };

  const buildResult = useCallback(async () => {
    if (pages.length === 0) return;
    setBusy(true);
    setError(null);
    const base = sanitizeFileName(fileName);
    const q = QUALITY_Q[quality];
    try {
      if (format === "pdf") {
        // Kalite/boyut: sayfaları seçilen JPEG kalitesinde yeniden kodla → PDF boyutu ayarlanır.
        const encoded = await Promise.all(pages.map((p) => reencodeJpeg(p.blob, q)));
        const imgs = await Promise.all(
          encoded.map(async (b) => ({ bytes: await b.arrayBuffer(), mime: "image/jpeg" })),
        );
        const bytes = await imagesToPdf(imgs);
        setResult({ blob: pdfBytesToBlob(bytes), filename: `${base}.pdf` });
      } else {
        const ext = FORMAT_EXT[format];
        // PNG kayıpsız (kalite yok); JPG seçilen kalitede yeniden kodlanır.
        const pageBlobs = await Promise.all(
          pages.map((p) => (format === "png" ? blobToPng(p.blob) : reencodeJpeg(p.blob, q))),
        );
        if (pageBlobs.length === 1) {
          setResult({ blob: pageBlobs[0], filename: `${base}.${ext}` });
        } else {
          // Çok sayfa → tek görsel olamaz; sayfa başına görsel içeren ZIP.
          const entries = await Promise.all(
            pageBlobs.map(async (b, i) => ({
              name: `${base}-${String(i + 1).padStart(2, "0")}.${ext}`,
              data: new Uint8Array(await b.arrayBuffer()),
            })),
          );
          const zipBytes = new Uint8Array(zipStore(entries));
          setResult({ blob: new Blob([zipBytes], { type: "application/zip" }), filename: `${base}.zip` });
        }
      }
      setSearchable(false);
      saveHandleRef.current = null;
      setPhase("result");
    } catch {
      setError(tr ? "Dosya oluşturulamadı." : "Could not build the file.");
    } finally {
      setBusy(false);
    }
  }, [pages, tr, fileName, format, quality]);

  // Tüm sayfaları 90° döndür (toplu).
  const rotateAllPages = async () => {
    if (pages.length === 0 || rotatingAll) return;
    setRotatingAll(true);
    try {
      const rotated = await Promise.all(pages.map((p) => rotateBlob90(p.blob)));
      const oldUrls = pages.map((p) => p.url);
      setPages(rotated.map((blob) => ({ blob, url: URL.createObjectURL(blob) })));
      oldUrls.forEach((u) => URL.revokeObjectURL(u));
    } catch {
      setError(tr ? "Sayfalar döndürülemedi." : "Could not rotate the pages.");
    } finally {
      setRotatingAll(false);
    }
  };

  // ARANABİLİR PDF (Pro): sayfaları cihazda OCR'lar (Türkçe+İngilizce) ve görünmez
  // metin katmanı gömer → Ctrl+F ile aranabilir, kopyalanabilir PDF. Dosya cihazdan çıkmaz.
  const makeSearchable = useCallback(async () => {
    if (pages.length === 0 || ocrPct !== null) return;
    setOcrPct(0);
    setError(null);
    try {
      const [fontBytes, pageBufs] = await Promise.all([
        fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer()),
        Promise.all(pages.map((p) => p.blob.arrayBuffer())),
      ]);
      const wordsPerPage = await ocrImagesToWords(
        pages.map((p) => p.blob),
        (pr) => setOcrPct(pr.ratio),
      );
      const searchablePages = pageBufs.map((bytes, i) => ({
        bytes,
        mime: "image/jpeg",
        words: wordsPerPage[i] ?? [],
      }));
      const bytes = await imagesToSearchablePdf(searchablePages, fontBytes);
      saveHandleRef.current = null; // içerik değişti → "aynı yere yaz" sıfırla
      setResult({ blob: pdfBytesToBlob(bytes), filename: `${sanitizeFileName(fileName)}-aranabilir.pdf` });
      setSearchable(true);
    } catch {
      setError(tr ? "Aranabilir PDF oluşturulamadı." : "Could not create searchable PDF.");
    } finally {
      setOcrPct(null);
    }
  }, [pages, ocrPct, tr, fileName]);

  // PRO/BUSINESS: PDF hazır olur olmaz otomatik ARANABİLİR PDF (OCR) üret —
  // ücretli kullanıcı her şeye erişir, tarama otomatik aranabilir gelir.
  // Free kullanıcı sonuç ekranındaki butonla kendi tetikler.
  useEffect(() => {
    // Aranabilir metin katmanı yalnız PDF'e gömülür; JPG/PNG'de atla.
    if (phase === "result" && isPro && result && !searchable && ocrPct === null && format === "pdf") {
      void makeSearchable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isPro, result?.filename]);

  // Belge içeriği değişince (yeni sayfa / OCR sonrası / yeni tarama) "hesaba kaydedildi"
  // durumunu sıfırla — böylece güncel hali yeniden kaydedilebilir; aynı belge ise buton
  // "Kaydedildi" olarak KİLİTLİ kalır (mükerrer yükleme yok).
  useEffect(() => {
    setSavedAcct(false);
  }, [result?.blob]);

  // ── Sonuç aksiyonları ──
  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  async function saveResult() {
    if (!result) return;
    const win = window as unknown as {
      showSaveFilePicker?: (o: {
        suggestedName?: string;
        types?: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<FileSystemFileHandle>;
    };
    if (typeof win.showSaveFilePicker === "function") {
      try {
        const _ext = result.filename.split(".").pop() || "pdf";
        const _mime = result.blob.type || "application/octet-stream";
        const handle = await win.showSaveFilePicker({
          suggestedName: result.filename,
          types: [{ description: _ext.toUpperCase(), accept: { [_mime]: [`.${_ext}`] } }],
        });
        const w = await handle.createWritable();
        await w.write(result.blob);
        await w.close();
        saveHandleRef.current = handle;
        setResult({ ...result, saved: "picker" });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    downloadBlob(result.blob, result.filename);
    setResult({ ...result, saved: "download" });
  }

  // Tek görsel sonucu panoya kopyala (clipboard image/png ister → gerekirse PNG'ye çevir).
  async function copyResultImage() {
    if (!result || !result.blob.type.startsWith("image/")) return;
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return;
      const png = result.blob.type === "image/png" ? result.blob : await blobToPng(result.blob);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* izin yok / desteklenmiyor */
    }
  }

  // Hesaba kaydet: taramayı buluta yükle → bilgisayardan Dashboard "Son Taratılanlar"da eriş.
  // Kaydedince buton KALICI "Kaydedildi" durumunda kalır; aynı belge tekrar tekrar
  // yüklenmez. Belge değişirse (yeni sayfa / OCR / yeni tarama) savedAcct sıfırlanır
  // (aşağıdaki effect) ve güncel hali yeniden kaydedilebilir.
  async function saveToAccount() {
    if (!result || !accessToken || savingAcct || savedAcct) return;
    setSavingAcct(true);
    setError(null);
    try {
      await uploadScanToLibrary(accessToken, result.blob, result.filename);
      setSavedAcct(true);
      // Bekleyen kopya artık gereksiz (giriş sonrası ikinci kez yüklenmesin).
      pendingAcctSaveRef.current = false;
      try {
        sessionStorage.removeItem("nb_scan_return");
      } catch {
        /* yoksay */
      }
      void takeScanForAccount();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr ? "Hesaba kaydedilemedi." : "Could not save to account.");
    } finally {
      setSavingAcct(false);
    }
  }

  // Giriş sonrası (aynı sayfada açılan giriş ekranı) sonuç ekranına dönülür →
  // kullanıcı tekrar butona basmasın diye kaydetme otomatik tamamlanır ve
  // "Hesabına kaydedildi" bilgilendirmesi görünür.
  useEffect(() => {
    if (!accessToken || !result || savedAcct || savingAcct) return;
    if (!pendingAcctSaveRef.current) return;
    void saveToAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, result, savedAcct, savingAcct]);

  /**
   * Misafir: "Hesabıma kaydet — giriş yap". Belgeyi KAYBETMEMEK için önce
   * IndexedDB'ye bırakır + niyeti işaretler, sonra giriş ekranını açar.
   * - Aynı sayfada giriş (e-posta/şifre): bileşen mount kalır → aşağıdaki effect
   *   accessToken gelir gelmez yüklemeyi kendisi yapar.
   * - Google (tam sayfa yönlendirme): App, dönüşte tarama sayfasına geri getirir
   *   ve bekleyen belgeyi yükleyip "Hesabınıza kaydedildi" bildirimi gösterir.
   */
  async function requestAccountSaveLogin() {
    if (result) {
      pendingAcctSaveRef.current = true;
      try {
        sessionStorage.setItem("nb_scan_return", "1");
      } catch {
        /* private mode */
      }
      try {
        await saveScanForAccount(
          new File([result.blob], result.filename, {
            type: result.blob.type || "application/pdf",
          }),
        );
      } catch {
        /* IndexedDB yoksa: aynı sayfada giriş akışı yine de çalışır */
      }
    }
    onLogin?.();
  }

  async function shareResult() {
    if (!result) return;
    const file = new File([result.blob], result.filename, { type: result.blob.type || "application/pdf" });
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
    };
    try {
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: result.filename });
      }
    } catch {
      /* iptal / desteklenmiyor */
    }
  }

  function pickToolAndUse(toolId: string) {
    if (!result || !onUseInTools) return;
    onUseInTools(new File([result.blob], result.filename, { type: result.blob.type || "application/pdf" }), toolId);
    onClose();
  }

  const canShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === "function";

  if (!open) return null;

  const strokeW = captured ? Math.max(2, captured.width / 320) : 3;
  const cornerR = captured ? Math.max(10, captured.width / 42) : 14;
  // Canlı filtre önizlemesi (Renkli/Gri/S-B/Oto) — CSS ile yaklaşık; gerçek çıktı
  // işlemede OpenCV ile üretilir. Kullanıcı butona basınca görüntü anında değişir.
  const previewFilter =
    enhance === "gray"
      ? "grayscale(1)"
      : enhance === "bw"
        ? "grayscale(1) contrast(1.7) brightness(1.05)"
        : enhance === "auto"
          ? "grayscale(0.15) contrast(1.25) brightness(1.12)"
          : "none";

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-[#070b14] text-white"
    >
      {/* Başlık */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
            <Camera className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">{tr ? "Belge Tara" : "Scan document"}</p>
            <p className="text-[11px] text-slate-400">
              {tr ? "Cihazında işlenir · gizli" : "Processed on-device · private"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          aria-label={tr ? "Kapat" : "Close"}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0] ?? undefined);
          e.target.value = "";
        }}
      />

      <div className="relative flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* ── KAMERA ── */}
          {phase === "camera" && (
            <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full flex-col">
              {isDesktop ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30">
                    <Smartphone className="h-8 w-8" />
                  </span>
                  <div>
                    <p className="text-lg font-bold">
                      {tr ? "Bu araç telefonda kullanılır" : "Use this tool on your phone"}
                    </p>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
                      {tr
                        ? "Belge Tara, telefonunuzun arka kamerasıyla belgeyi çekip cihazınızda PDF'e çevirir. Bilgisayarda kamera tarama çalışmaz — telefonunuzdan pdfplatform.app adresine girip Belge Tara'yı açın."
                        : "Scan Document uses your phone's rear camera to capture a document and turn it into a PDF on-device. Camera scanning isn't available on desktop — open pdfplatform.app on your phone and start Scan Document."}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.1]"
                    >
                      <ImageIcon className="h-4 w-4" />
                      {tr ? "Bilgisayardan görsel yükle" : "Upload an image instead"}
                    </button>
                    <p className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                      <Smartphone className="h-3.5 w-3.5" />
                      {tr ? "En iyi sonuç: telefonun arka kamerası" : "Best result: phone rear camera"}
                    </p>
                  </div>
                </div>
              ) : cameraError ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] text-cyan-300">
                    <Camera className="h-7 w-7" />
                  </span>
                  <p className="max-w-xs text-sm text-slate-300">
                    {tr
                      ? "Kameraya erişilemedi. Telefonun kamerasıyla fotoğraf çekmek için aşağıdaki düğmeye dokun."
                      : "Camera unavailable. Tap below to take a photo with your phone camera."}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3.5 text-sm font-bold text-white"
                  >
                    <Camera className="h-4 w-4" />
                    {tr ? "Kamerayı Aç" : "Open camera"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative flex-1 overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      onLoadedMetadata={(e) =>
                        setVideoDims({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })
                      }
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    {/* CANLI kenar overlay'i — sistemin bulduğu belge kenarları */}
                    {videoDims && liveQuad && (
                      <svg
                        viewBox={`0 0 ${videoDims.w} ${videoDims.h}`}
                        preserveAspectRatio="xMidYMid meet"
                        className="pointer-events-none absolute inset-0 h-full w-full"
                      >
                        <polygon
                          points={liveQuad.map((p) => `${p.x},${p.y}`).join(" ")}
                          fill={`rgba(52,211,153,${0.10 + holdPct * 0.2})`}
                          stroke="#34d399"
                          strokeWidth={videoDims.w / (holdPct >= 1 ? 130 : 220)}
                          strokeLinejoin="round"
                        />
                        {liveQuad.map((p, i) => (
                          <circle key={i} cx={p.x} cy={p.y} r={videoDims.w / 90} fill="#34d399" />
                        ))}
                      </svg>
                    )}
                    {/* Çerçeveleme kılavuzu (kenar bulunmadıkça) */}
                    {!liveQuad && (
                      <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-white/25" />
                    )}
                    <p className="pointer-events-none absolute inset-x-0 top-5 text-center text-[13px] font-medium text-white/85 drop-shadow">
                      {!autoCapture
                        ? tr ? "Hazır olunca çek" : "Tap to capture when ready"
                        : liveQuad
                          ? holdPct >= 1
                            ? tr ? "Yakalanıyor…" : "Capturing…"
                            : tr ? "Belge bulundu — sabit tut" : "Document found — hold steady"
                          : tr ? "Belgeyi kameraya göster" : "Point at the document"}
                    </p>
                    {/* Otomatik yakalama ilerleme çubuğu */}
                    {autoCapture && holdPct > 0 && (
                      <div className="pointer-events-none absolute inset-x-10 top-12 h-1 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-[width] duration-200"
                          style={{ width: `${Math.round(holdPct * 100)}%` }}
                        />
                      </div>
                    )}
                    {/* Otomatik yakalama aç/kapa */}
                    <button
                      type="button"
                      onClick={() => setAutoCapture((v) => !v)}
                      className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold backdrop-blur transition ${
                        autoCapture
                          ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40"
                          : "bg-black/40 text-slate-300 ring-1 ring-white/15"
                      }`}
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {tr ? "Otomatik" : "Auto"} {autoCapture ? (tr ? "Açık" : "On") : (tr ? "Kapalı" : "Off")}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-white/[0.08] px-8 py-5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-16 flex-col items-center gap-1 text-[11px] text-slate-300 transition hover:text-white"
                      aria-label={tr ? "Galeriden seç" : "Pick from gallery"}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04]">
                        <ImageIcon className="h-5 w-5" />
                      </span>
                      {tr ? "Galeri" : "Gallery"}
                    </button>
                    <button
                      type="button"
                      onClick={doCapture}
                      className="flex items-center justify-center rounded-full bg-white ring-4 ring-white/30 transition active:scale-95"
                      style={{ height: 72, width: 72 }}
                      aria-label={tr ? "Fotoğraf çek" : "Capture"}
                    >
                      <span className="rounded-full bg-cyan-500" style={{ height: 56, width: 56 }} />
                    </button>
                    <div className="flex w-16 flex-col items-center gap-1 text-center text-[11px] text-slate-400">
                      <Zap className={`h-4 w-4 ${autoCapture ? "text-emerald-400" : "text-slate-500"}`} />
                      {autoCapture ? (tr ? "Otomatik" : "Auto") : (tr ? "Manuel" : "Manual")}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ── İNCELE / KÖŞE AYARI ── */}
          {phase === "review" && capturedUrl && (
            <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col p-4">
              <div className="relative mx-auto w-full max-w-md select-none">
                <img
                  src={capturedUrl}
                  alt=""
                  className="block w-full rounded-xl"
                  style={{ filter: previewFilter === "none" ? undefined : previewFilter }}
                  draggable={false}
                />
                {/* Büyüteç (loupe) — sürüklenen köşenin altını kalmadan tam konumu göster */}
                {activeCorner != null && captured && quad && capturedUrl && (() => {
                  const ap = quad[activeCorner]!;
                  const ZOOM = 2;
                  const SZ = 150;
                  const onLeft = ap.x < captured.width / 2;
                  return (
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        [onLeft ? "right" : "left"]: 10,
                        width: SZ,
                        height: SZ,
                        borderRadius: 9999,
                        overflow: "hidden",
                        border: "3px solid #38bdf8",
                        boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                        backgroundColor: "#000",
                        backgroundImage: `url(${capturedUrl})`,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: `${captured.width * ZOOM}px ${captured.height * ZOOM}px`,
                        backgroundPosition: `${SZ / 2 - ap.x * ZOOM}px ${SZ / 2 - ap.y * ZOOM}px`,
                        filter: previewFilter === "none" ? undefined : previewFilter,
                        pointerEvents: "none",
                        zIndex: 20,
                      }}
                    >
                      <div style={{ position: "absolute", left: "50%", top: "50%", width: 2, height: 26, transform: "translate(-50%,-50%)", background: "#38bdf8", boxShadow: "0 0 0 1px rgba(255,255,255,0.7)" }} />
                      <div style={{ position: "absolute", left: "50%", top: "50%", width: 26, height: 2, transform: "translate(-50%,-50%)", background: "#38bdf8", boxShadow: "0 0 0 1px rgba(255,255,255,0.7)" }} />
                    </div>
                  );
                })()}
                {captured && quad && (
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${captured.width} ${captured.height}`}
                    className="absolute inset-0 h-full w-full touch-none"
                    onPointerMove={onMove}
                    onPointerUp={endDrag}
                    onPointerLeave={endDrag}
                  >
                    <polygon
                      points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="rgba(56,189,248,0.14)"
                      stroke="#38bdf8"
                      strokeWidth={strokeW}
                    />
                    {quad.map((p, i) => (
                      <g key={i} onPointerDown={(e) => startDrag(e, i)} style={{ cursor: "grab" }}>
                        {/* Geniş dokunma hedefi — parmağı tam köşeye getirmek gerekmesin */}
                        <circle cx={p.x} cy={p.y} r={cornerR * 2.6} fill="rgba(56,189,248,0.16)" stroke="rgba(56,189,248,0.45)" strokeWidth={strokeW} />
                        {/* Görünür tutamak */}
                        <circle cx={p.x} cy={p.y} r={cornerR} fill="#38bdf8" stroke="#fff" strokeWidth={strokeW} />
                      </g>
                    ))}
                  </svg>
                )}
                {detecting && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tr ? "Kenarlar bulunuyor…" : "Detecting edges…"}
                    </span>
                  </div>
                )}
              </div>

              {/* İyileştirme modu — "Oto" Pro (gölge temizleme + kontrast) */}
              <div className="mx-auto mt-4 flex w-full max-w-md items-center gap-2">
                <Wand2 className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="grid flex-1 grid-cols-4 gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-1.5">
                  <button
                    type="button"
                    onClick={() => (isPro ? setEnhance("auto") : setUpsell("auto"))}
                    className={`inline-flex items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[13px] font-semibold transition ${
                      enhance === "auto" && isPro
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                        : "text-violet-200 hover:bg-white/[0.06]"
                    }`}
                  >
                    {isPro ? <Sparkles className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {tr ? "Oto" : "Auto"}
                  </button>
                  {([
                    ["color", tr ? "Renkli" : "Color"],
                    ["gray", tr ? "Gri" : "Gray"],
                    ["bw", tr ? "S-B" : "B&W"],
                  ] as [EnhanceMode, string][]).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEnhance(m)}
                      className={`rounded-xl px-2 py-2 text-[13px] font-semibold transition ${
                        enhance === m ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white" : "text-slate-300 hover:bg-white/[0.06]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {!isPro && (
                <button
                  type="button"
                  onClick={() => setUpsell("auto")}
                  className="mx-auto mt-2 flex w-full max-w-md items-center justify-center gap-1.5 text-[12px] font-medium text-violet-300/90 transition hover:text-violet-200"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {tr ? "Pro: otomatik gölge temizleme & keskin kalite →" : "Pro: auto shadow removal & sharp quality →"}
                </button>
              )}

              {error && (
                <p className="mx-auto mt-3 w-full max-w-md rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-2.5 text-[12px] text-amber-200">
                  {error}
                </p>
              )}

              <div className="mx-auto mt-4 flex w-full max-w-md gap-3">
                <button
                  type="button"
                  onClick={retake}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                >
                  <RotateCcw className="h-4 w-4" />
                  {tr ? "Yeniden çek" : "Retake"}
                </button>
                <button
                  type="button"
                  onClick={() => void commitPage()}
                  disabled={busy || detecting || !quad}
                  className="flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:pointer-events-none disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {tr ? "Bu sayfayı kullan" : "Use this page"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── SAYFALAR ── */}
          {phase === "pages" && (
            <motion.div key="pages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
              <div className="mx-auto mb-3 flex max-w-md items-center justify-between gap-2">
                <p className="text-sm text-slate-300">
                  {pages.length}{" "}
                  {tr ? "sayfa tarandı" : pages.length === 1 ? "page scanned" : "pages scanned"}
                  {!isPro && (
                    <span className="ml-1.5 text-[12px] text-slate-500">
                      ({pages.length}/{FREE_PAGE_LIMIT} {tr ? "ücretsiz" : "free"})
                    </span>
                  )}
                </p>
                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void rotateAllPages()}
                    disabled={rotatingAll}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    {rotatingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                    {tr ? "Tümünü döndür" : "Rotate all"}
                  </button>
                )}
              </div>
              <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
                {pages.map((p, i) => (
                  <div key={p.url} className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                    <button
                      type="button"
                      onClick={() => setPreviewIdx(i)}
                      className="block w-full"
                      aria-label={tr ? "Büyük önizleme" : "Large preview"}
                    >
                      <img src={p.url} alt="" className="aspect-[3/4] w-full object-cover" />
                    </button>
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePage(i)}
                      className="absolute right-1.5 top-1.5 rounded-md bg-black/70 p-1 text-red-300 transition hover:bg-red-500/80 hover:text-white"
                      aria-label={tr ? "Sayfayı sil" : "Remove page"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {/* Sayfa düzenleme: sola taşı · döndür · sağa taşı */}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/75 to-transparent px-1 py-1">
                      <button
                        type="button"
                        onClick={() => movePage(i, -1)}
                        disabled={i === 0}
                        className="rounded-md p-1 text-white/90 transition hover:bg-white/20 disabled:opacity-30"
                        aria-label={tr ? "Sola taşı" : "Move left"}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void rotatePage(i)}
                        className="rounded-md p-1 text-white/90 transition hover:bg-white/20"
                        aria-label={tr ? "Döndür" : "Rotate"}
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePage(i, 1)}
                        disabled={i === pages.length - 1}
                        className="rounded-md p-1 text-white/90 transition hover:bg-white/20 disabled:opacity-30"
                        aria-label={tr ? "Sağa taşı" : "Move right"}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {!isPro && pages.length >= FREE_PAGE_LIMIT ? (
                  <button
                    type="button"
                    onClick={() => setUpsell("pages")}
                    className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-violet-400/30 bg-violet-500/[0.06] text-violet-300 transition hover:border-violet-400/50"
                  >
                    <Lock className="h-5 w-5" />
                    <span className="px-1 text-center text-[11px] font-semibold">
                      {tr ? "Sınırsız için Pro" : "Pro for unlimited"}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPhase("camera")}
                    className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-white/15 text-slate-400 transition hover:border-cyan-400/40 hover:text-cyan-300"
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-[12px] font-semibold">{tr ? "Sayfa ekle" : "Add page"}</span>
                  </button>
                )}
              </div>

              {error && (
                <p className="mx-auto mt-4 w-full max-w-md rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">
                  {error}
                </p>
              )}

              {/* Kaydetme formatı — PDF / JPG / PNG. Çok sayfa + JPG/PNG → ZIP. */}
              <div className="mx-auto mt-5 w-full max-w-md">
                <label className="mb-1.5 block text-[12px] font-medium text-slate-400">
                  {tr ? "Format" : "Format"}
                </label>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                  {([
                    ["pdf", "PDF", tr ? "Belge · çok sayfa" : "Document · multi-page"],
                    ["jpg", "JPG", tr ? "Paylaşım · küçük" : "Share · small"],
                    ["png", "PNG", tr ? "Kayıpsız · keskin" : "Lossless · sharp"],
                  ] as [ScanFormat, string, string][]).map(([f, lbl, hint]) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`flex flex-col items-center rounded-lg px-2 py-2 transition ${format === f ? "bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow" : "text-slate-300 hover:bg-white/[0.06]"}`}
                    >
                      <span className="text-[13px] font-bold">{lbl}</span>
                      <span className={`text-[10px] ${format === f ? "text-white/80" : "text-slate-500"}`}>{hint}</span>
                    </button>
                  ))}
                </div>
                {format !== "pdf" && pages.length > 1 && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {tr ? `${pages.length} sayfa → her sayfa ayrı görsel, tek ZIP olarak.` : `${pages.length} pages → one image per page, in a single ZIP.`}
                  </p>
                )}
              </div>

              {/* Boyut / kalite — PDF ve JPG için (PNG kayıpsızdır, uygulanmaz). */}
              {format !== "png" && (
                <div className="mx-auto mt-4 w-full max-w-md">
                  <label className="mb-1.5 block text-[12px] font-medium text-slate-400">
                    {tr ? "Boyut / kalite" : "Size / quality"}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                    {([
                      ["small", tr ? "Küçük" : "Small", tr ? "en küçük dosya" : "smallest file"],
                      ["normal", tr ? "Normal" : "Normal", tr ? "dengeli" : "balanced"],
                      ["high", tr ? "Yüksek" : "High", tr ? "en iyi kalite" : "best quality"],
                    ] as [ScanQuality, string, string][]).map(([qk, lbl, hint]) => (
                      <button
                        key={qk}
                        type="button"
                        onClick={() => setQuality(qk)}
                        className={`flex flex-col items-center rounded-lg px-2 py-2 transition ${quality === qk ? "bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow" : "text-slate-300 hover:bg-white/[0.06]"}`}
                      >
                        <span className="text-[13px] font-bold">{lbl}</span>
                        <span className={`text-[10px] ${quality === qk ? "text-white/80" : "text-slate-500"}`}>{hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dosya adı — kaydet/paylaş/araçlar hep bu adı kullanır */}
              <div className="mx-auto mt-4 w-full max-w-md">
                <label className="mb-1.5 block text-[12px] font-medium text-slate-400">
                  {tr ? "Dosya adı" : "File name"}
                </label>
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 focus-within:border-cyan-400/40">
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="taranan-belge"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
                  />
                  <span className="shrink-0 text-sm text-slate-500">
                    .{format === "pdf" ? "pdf" : pages.length > 1 ? "zip" : FORMAT_EXT[format]}
                  </span>
                </div>
              </div>

              <div className="mx-auto mt-3 w-full max-w-md">
                <button
                  type="button"
                  onClick={() => void buildResult()}
                  disabled={busy || pages.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.7)] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-40"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {tr ? "Oluşturuluyor…" : "Building…"}
                    </>
                  ) : (
                    <>{tr ? `Oluştur (${pages.length})` : `Create (${pages.length})`} →</>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── SONUÇ ── */}
          {phase === "result" && result && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="p-4">
              <div className="mx-auto max-w-md rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-7 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                  <Check className="h-8 w-8" />
                </div>
                <p className="mt-4 text-xl font-bold">
                  {tr ? "Belgen hazır! 🎉" : "Your document is ready! 🎉"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {tr
                    ? `${pages.length} sayfa · ${(result.filename.split(".").pop() || "pdf").toUpperCase()} · cihazından hiç çıkmadı.`
                    : `${pages.length} page(s) · ${(result.filename.split(".").pop() || "pdf").toUpperCase()} · never left your device.`}
                </p>

                <p className="mt-6 text-[13px] font-semibold text-slate-300">
                  {tr ? "Ne yapmak istersin?" : "What would you like to do?"}
                </p>
                <div className="mt-3 grid gap-2.5">
                  {/* Aranabilir PDF (OCR) — yalnız PDF formatında (JPG/PNG'de metin katmanı yok) */}
                  {format === "pdf" && (searchable ? (
                    <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-6 py-3.5 text-sm font-bold text-emerald-200">
                      <Check className="h-4 w-4" />
                      {tr ? "🔍 Aranabilir PDF hazır — metni ara & kopyala" : "🔍 Searchable PDF ready — search & copy text"}
                    </div>
                  ) : ocrPct !== null ? (
                    <div className="rounded-2xl border border-violet-400/25 bg-violet-500/[0.08] px-5 py-3.5">
                      <p className="flex items-center gap-2 text-[13px] font-semibold text-violet-100">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {tr ? "Metin taranıyor (OCR)…" : "Recognizing text (OCR)…"}
                        <span className="ml-auto tabular-nums">{Math.round(ocrPct * 100)}%</span>
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-violet-400 transition-[width] duration-300"
                          style={{ width: `${Math.round(ocrPct * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : isPro ? (
                    <button
                      type="button"
                      onClick={() => void makeSearchable()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3.5 text-sm font-bold text-white transition hover:from-violet-500 hover:to-fuchsia-500"
                    >
                      <Sparkles className="h-4 w-4" />
                      {tr ? "🔍 Aranabilir PDF yap (OCR)" : "🔍 Make searchable (OCR)"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUpsell("ocr")}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-500/[0.08] px-6 py-3.5 text-sm font-bold text-violet-200 transition hover:bg-violet-500/[0.14]"
                    >
                      <Lock className="h-4 w-4" />
                      {tr ? "Aranabilir PDF (OCR) — Pro" : "Searchable PDF (OCR) — Pro"}
                    </button>
                  ))}
                  {/* Hesaba kaydet — PC'de kamera yoksa bile: Dashboard "Son Taratılanlar"dan eriş */}
                  {!accessToken && onLogin && (
                    /* Misafir: kilitli görünür — tıklayınca giriş ekranı açılır (tarama kaybolmaz). */
                    <button
                      type="button"
                      onClick={() => void requestAccountSaveLogin()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.08] px-6 py-3.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/[0.16]"
                    >
                      <Lock className="h-4 w-4" />
                      {tr ? "Hesabıma kaydet — giriş yap" : "Save to my account — sign in"}
                    </button>
                  )}
                  {accessToken && (
                    <button
                      type="button"
                      onClick={() => void saveToAccount()}
                      disabled={savingAcct || savedAcct}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-white transition ${
                        savedAcct
                          ? "cursor-default bg-emerald-600/90 ring-1 ring-emerald-300/40"
                          : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
                      }`}
                    >
                      {savingAcct ? <Loader2 className="h-4 w-4 animate-spin" /> : savedAcct ? <Check className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                      {savedAcct
                        ? (tr ? "Hesabına kaydedildi ✓" : "Saved to your account ✓")
                        : (tr ? "Hesabıma kaydet (her yerden eriş)" : "Save to my account (access anywhere)")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void saveResult()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white transition hover:from-blue-500 hover:to-indigo-500"
                  >
                    <Download className="h-4 w-4" />
                    {tr ? `${(result.filename.split(".").pop() || "pdf").toUpperCase()} olarak kaydet` : `Save as ${(result.filename.split(".").pop() || "pdf").toUpperCase()}`}
                  </button>
                  {onUseInTools && (
                    <button
                      type="button"
                      onClick={() => setToolPicker(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/[0.1]"
                    >
                      <Wrench className="h-4 w-4 text-cyan-300" />
                      {tr ? "Araçlarda aç" : "Open in tools"}
                    </button>
                  )}
                  {canShare && (
                    <button
                      type="button"
                      onClick={() => void shareResult()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/[0.08]"
                    >
                      <Share2 className="h-4 w-4" />
                      {tr ? "Paylaş" : "Share"}
                    </button>
                  )}
                  {/* Tek görsel (JPG/PNG) sonucu panoya kopyala */}
                  {result.blob.type.startsWith("image/") && typeof ClipboardItem !== "undefined" && (
                    <button
                      type="button"
                      onClick={() => void copyResultImage()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/[0.08]"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      {copied ? (tr ? "Kopyalandı" : "Copied") : (tr ? "Panoya kopyala" : "Copy to clipboard")}
                    </button>
                  )}
                </div>

                {result.saved && (
                  <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-1.5 text-[12px] font-medium text-emerald-200">
                    <Check className="h-3.5 w-3.5" />
                    {result.saved === "picker"
                      ? tr ? "Seçtiğin konuma kaydedildi" : "Saved to your chosen location"
                      : tr ? "İndirilenler'e kaydedildi" : "Saved to Downloads"}
                  </p>
                )}

                {savedAcct && (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.1] px-4 py-3.5 text-left">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                      <Cloud className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-emerald-100">
                        {tr ? "Hesabına kaydedildi" : "Saved to your account"}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-emerald-200/80">
                        {tr
                          ? "Erişmek için bilgisayardan veya diğer cihazlardan oturum aç → «Taramalarım»dan indir, paylaş ya da bir araçta aç."
                          : "To access it, sign in on your computer or another device → open «My scans» to download, share or open in a tool."}
                      </p>
                    </div>
                  </div>
                )}

                {!isPro && (
                  <button
                    type="button"
                    onClick={() => setUpsell("auto")}
                    className="mt-5 w-full rounded-2xl border border-violet-400/25 bg-violet-500/[0.07] p-3.5 text-left transition hover:bg-violet-500/[0.12]"
                  >
                    <p className="flex items-center gap-1.5 text-[13px] font-bold text-violet-200">
                      <Sparkles className="h-4 w-4" />
                      {tr ? "Pro ile daha profesyonel taramalar" : "More professional scans with Pro"}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-slate-400">
                      {tr
                        ? "Otomatik gölge temizleme, sınırsız sayfa ve en yüksek kalite →"
                        : "Auto shadow removal, unlimited pages and top quality →"}
                    </p>
                  </button>
                )}

                <button
                  type="button"
                  onClick={resetAll}
                  className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold text-cyan-300 transition hover:text-cyan-200"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  {tr ? "Yeni belge tara" : "Scan a new document"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── PRO UPSELL ── ikna edici, faydaları net söyleyen alt-sayfa */}
      <AnimatePresence>
        {upsell && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-end justify-center bg-black/65 p-4 sm:items-center"
            onClick={() => setUpsell(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border border-violet-400/30 bg-[#0f1424] p-6 shadow-2xl"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 text-fuchsia-300 ring-1 ring-fuchsia-400/30">
                <Sparkles className="h-7 w-7" />
              </div>
              <p className="mt-4 text-center text-lg font-bold">
                {upsell === "pages"
                  ? tr ? `Ücretsiz ${FREE_PAGE_LIMIT} sayfa doldu` : `Free ${FREE_PAGE_LIMIT}-page limit reached`
                  : upsell === "ocr"
                    ? tr ? "Aranabilir PDF (OCR) — Pro" : "Searchable PDF (OCR) — Pro"
                    : tr ? "Otomatik İyileştirme — Pro" : "Auto Enhance — Pro"}
              </p>
              <p className="mt-1 text-center text-[13px] text-slate-400">
                {tr
                  ? "Pro ile tarama, gerçek bir tarayıcı gibi çalışır:"
                  : "With Pro, scanning works like a real scanner:"}
              </p>
              <ul className="mt-4 space-y-2.5">
                {[
                  {
                    icon: <Sparkles className="h-4 w-4" />,
                    t: tr
                      ? "Otomatik gölge temizleme — dümdüz beyaz zemin, keskin metin"
                      : "Auto shadow removal — clean white background, crisp text",
                  },
                  {
                    icon: <InfinityIcon className="h-4 w-4" />,
                    t: tr
                      ? "Sınırsız sayfa — kalın belgeleri tek seferde tara"
                      : "Unlimited pages — scan thick documents in one go",
                  },
                  {
                    icon: <Search className="h-4 w-4" />,
                    t: tr
                      ? "Aranabilir PDF (OCR) — metni Ctrl+F ile ara & kopyala"
                      : "Searchable PDF (OCR) — find & copy text with Ctrl+F",
                  },
                  {
                    icon: <Layers className="h-4 w-4" />,
                    t: tr ? "Tüm profesyonel filtreler ve en yüksek kalite" : "All pro filters and top quality",
                  },
                ].map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-200">
                    <span className="mt-0.5 shrink-0 text-fuchsia-300">{b.icon}</span>
                    {b.t}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setUpsell(null);
                  onUpgrade?.();
                }}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3.5 text-sm font-bold text-white transition hover:from-violet-500 hover:to-fuchsia-500"
              >
                <Sparkles className="h-4 w-4" />
                {tr ? "Pro'ya Geç" : "Upgrade to Pro"}
              </button>
              <button
                type="button"
                onClick={() => setUpsell(null)}
                className="mt-2 w-full py-1 text-[13px] font-medium text-slate-400 transition hover:text-slate-200"
              >
                {tr ? "Şimdilik ücretsiz devam et" : "Continue free for now"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PDF MERKEZİ ── "PDF Araçlarında aç" → önizleme + araçlar */}
      <AnimatePresence>
        {toolPicker && result && (
          <PdfHub
            file={new File([result.blob], result.filename, { type: result.blob.type || "application/pdf" })}
            language={language}
            isPro={isPro}
            onClose={() => setToolPicker(false)}
            onPickTool={(toolId) => pickToolAndUse(toolId)}
          />
        )}
      </AnimatePresence>

      {/* Büyük önizleme — sayfa küçük resmine dokununca tam ekran (döndür/sil hızlı erişim). */}
      {previewIdx !== null && pages[previewIdx] && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreviewIdx(null)}
        >
          <img src={pages[previewIdx].url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setPreviewIdx(null)}
            aria-label={tr ? "Kapat" : "Close"}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => void rotatePage(previewIdx)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <RotateCw className="h-4 w-4" /> {tr ? "Döndür" : "Rotate"}
            </button>
            <button
              type="button"
              onClick={() => { removePage(previewIdx); setPreviewIdx(null); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/30"
            >
              <Trash2 className="h-4 w-4" /> {tr ? "Sil" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
