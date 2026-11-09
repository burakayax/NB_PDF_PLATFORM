/**
 * İMZALAYAN SAYFASI — e-postadaki bağlantıyla açılır, hesap gerektirmez.
 *
 * Kullanıcı belgeyi görür, adını yazar, imzasını çizer (ya da yazar), rıza
 * kutusunu işaretler ve gönderir. İmzayı SUNUCU, saklanan özgün belgeye gömer;
 * buradan yalnızca imza görüntüsü ve onay gider — belgenin kendisi geri
 * yüklenmez, aksi hâlde metin imzalanmadan önce değiştirilebilirdi.
 *
 * Rıza kutusu ayrı ve zorunludur: elektronik imzanın hukuki dayanağı,
 * imzalayanın bilerek ve isteyerek attığı bir eylemin kanıtlanmasına dayanır.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Loader2, PenLine, RotateCcw, ShieldCheck, Upload, X } from "lucide-react";
import { LegalDocumentBody, type LegalDocKey } from "../legal/LegalPage";
import {
  imzaSayfasiniGetir,
  imzayiGonder,
  imzayiReddetGonder,
  type ImzaSayfasi,
} from "../../api/signatures";

type Kip = "ciz" | "yukle" | "yaz";

/** Tuvalin boş kenarlarını kırpar; imza yerleştirilirken köşeye tam yaslanabilsin. */
function kirpilmisPng(kaynak: HTMLCanvasElement): string | null {
  const ctx = kaynak.getContext("2d");
  if (!ctx) return null;
  const { width, height } = kaynak;
  const d = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (d[(y * width + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const pay = 6;
  x0 = Math.max(0, x0 - pay); y0 = Math.max(0, y0 - pay);
  x1 = Math.min(width - 1, x1 + pay); y1 = Math.min(height - 1, y1 + pay);
  const c = document.createElement("canvas");
  c.width = x1 - x0 + 1;
  c.height = y1 - y0 + 1;
  c.getContext("2d")?.drawImage(kaynak, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

/** Base64 PDF -> tarayicinin guvenle gosterebilecegi blob adresi (data: adresleri engelleniyor). */
function pdfBlobUrl(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

export function SignDocumentPage({ token }: { token: string }) {
  const [sayfa, setSayfa] = useState<ImzaSayfasi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kip, setKip] = useState<Kip>("ciz");
  const [ad, setAd] = useState("");
  const [riza, setRiza] = useState(false);
  const [gonderiyor, setGonderiyor] = useState(false);
  const [bitti, setBitti] = useState(false);
  const [reddet, setReddet] = useState(false);
  const [redSebep, setRedSebep] = useState("");
  const tuvalRef = useRef<HTMLCanvasElement | null>(null);
  const cizdiRef = useRef(false);
  const [yuklenenImza, setYuklenenImza] = useState<string | null>(null);
  const [yukleHata, setYukleHata] = useState<string | null>(null);
  const [yasalAcik, setYasalAcik] = useState<LegalDocKey | null>(null);
  const [belgeUrl, setBelgeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sayfa?.belgeBase64) return;
    let url: string | null = null;
    try {
      url = pdfBlobUrl(sayfa.belgeBase64);
      setBelgeUrl(url);
    } catch {
      setBelgeUrl(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [sayfa?.belgeBase64]);

  useEffect(() => {
    if (!yasalAcik) return;
    const kapat = (e: KeyboardEvent) => {
      if (e.key === "Escape") setYasalAcik(null);
    };
    window.addEventListener("keydown", kapat);
    return () => window.removeEventListener("keydown", kapat);
  }, [yasalAcik]);

  /**
   * Yüklenen imza görüntüsünü hazırlar: küçültür, kâğıt/arka planı şeffaflaştırır,
   * boş kenarları kırpar ve sunucunun veri sınırının (2 MB) altında kalmasını sağlar.
   */
  const imzaDosyasiSec = (f: File | undefined) => {
    if (!f) return;
    setYukleHata(null);
    if (!f.type.startsWith("image/") || f.type === "image/svg+xml") {
      setYukleHata("Lütfen PNG, JPG veya WebP türünde bir görüntü seçin.");
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setYukleHata("Görüntü çok büyük (en fazla 12 MB).");
      return;
    }
    const adres = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(adres);
      try {
        let hedefEn = Math.min(img.width, 800);
        for (let deneme = 0; deneme < 5; deneme++) {
          const oran = hedefEn / img.width;
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * oran));
          c.height = Math.max(1, Math.round(img.height * oran));
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) throw new Error("tuval");
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const veri = ctx.getImageData(0, 0, c.width, c.height);
          const d = veri.data;
          // Zaten şeffaf bir PNG ise (imza çizimi) arka plan temizliğine gerek yok.
          let seffaf = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] < 128) seffaf++;
          if (seffaf / (d.length / 4) < 0.02) {
            // Kâğıt rengi: kenar piksellerinin ortancası. Yalnızca AÇIK renkli bir zemin
            // (beyaz kâğıt, beyaz logo zemini) temizlenir; koyu/renkli zemine dokunulmaz.
            const kr: number[] = [], kg: number[] = [], kb: number[] = [];
            const W = c.width, H = c.height;
            const al = (x: number, y: number) => {
              const i = (y * W + x) * 4;
              kr.push(d[i]); kg.push(d[i + 1]); kb.push(d[i + 2]);
            };
            for (let x = 0; x < W; x += Math.max(1, Math.floor(W / 40))) { al(x, 0); al(x, H - 1); }
            for (let y = 0; y < H; y += Math.max(1, Math.floor(H / 40))) { al(0, y); al(W - 1, y); }
            const orta = (v: number[]) => v.slice().sort((x, y) => x - y)[Math.floor(v.length / 2)] ?? 255;
            const br = orta(kr), bg = orta(kg), bb = orta(kb);
            if ((br * 299 + bg * 587 + bb * 114) / 1000 > 185) {
              for (let i = 0; i < d.length; i += 4) {
                const fark = Math.max(Math.abs(d[i] - br), Math.abs(d[i + 1] - bg), Math.abs(d[i + 2] - bb));
                // Zeminden yeterince farklı piksel imza/logodur; geçiş yumuşatılır.
                d[i + 3] = Math.max(0, Math.min(255, (fark - 22) * 7));
              }
            }
          }
          ctx.putImageData(veri, 0, 0);
          const sonuc = kirpilmisPng(c);
          if (!sonuc) {
            setYukleHata("Görüntüde imza bulunamadı. Beyaz kâğıda atılmış, net bir imza fotoğrafı yükleyin.");
            return;
          }
          // Veri adresinin bayt karşılığı yaklaşık 3/4'üdür.
          if ((sonuc.length * 3) / 4 <= 1.0 * 1024 * 1024) {
            setYuklenenImza(sonuc);
            return;
          }
          hedefEn = Math.round(hedefEn * 0.7);
        }
        setYukleHata("Görüntü çok ayrıntılı; daha küçük veya daha sade bir görüntü deneyin.");
      } catch {
        setYukleHata("Görüntü işlenemedi. Başka bir dosya deneyin.");
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(adres);
      setYukleHata("Bu görüntü okunamadı. PNG veya JPG olarak kaydedip tekrar deneyin.");
    };
    img.src = adres;
  };

  useEffect(() => {
    let birakildi = false;
    void (async () => {
      try {
        const s = await imzaSayfasiniGetir(token);
        if (birakildi) return;
        setSayfa(s);
        setAd(s.signerName ?? "");
        setBitti(s.imzalandiMi);
      } catch (e) {
        if (!birakildi) setHata(e instanceof Error ? e.message : "Bağlantı açılamadı.");
      } finally {
        if (!birakildi) setYukleniyor(false);
      }
    })();
    return () => {
      birakildi = true;
    };
  }, [token]);

  /* ── İmza tuvali ── */
  const tuvaliHazirla = useCallback((c: HTMLCanvasElement | null) => {
    tuvalRef.current = c;
    if (!c) return;
    const oran = window.devicePixelRatio || 1;
    c.width = c.clientWidth * oran;
    c.height = c.clientHeight * oran;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(oran, oran);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b2447";
  }, []);

  const noktaAl = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = tuvalRef.current!;
    const k = c.getBoundingClientRect();
    return { x: e.clientX - k.left, y: e.clientY - k.top };
  };

  const basla = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = tuvalRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = noktaAl(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    cizdiRef.current = true;
  };

  const ciz = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!cizdiRef.current || e.buttons === 0) return;
    const ctx = tuvalRef.current?.getContext("2d");
    if (!ctx) return;
    const p = noktaAl(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const temizle = () => {
    const c = tuvalRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    cizdiRef.current = false;
  };

  /** Yazılan adı el yazısı görünümlü bir imza görüntüsüne çevirir. */
  const yazidanImza = (metin: string): string => {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 260;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0b2447";
    ctx.font = "italic 92px 'Segoe Script', 'Brush Script MT', cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(metin, 20, 130);
    return kirpilmisPng(c) ?? c.toDataURL("image/png");
  };

  const imzaGorseli = (): string | null => {
    if (kip === "yukle") return yuklenenImza;
    if (kip === "yaz") {
      return ad.trim().length >= 2 ? yazidanImza(ad.trim()) : null;
    }
    if (!cizdiRef.current || !tuvalRef.current) return null;
    return kirpilmisPng(tuvalRef.current);
  };

  const gonder = async () => {
    const png = imzaGorseli();
    if (!png) {
      setHata(kip === "ciz" ? "Önce imzanı çiz." : kip === "yukle" ? "Önce imza görüntünü yükle." : "Adını yaz.");
      return;
    }
    setGonderiyor(true);
    setHata(null);
    try {
      await imzayiGonder(token, {
        signaturePng: png,
        signerName: ad.trim(),
        consent: riza,
      });
      setBitti(true);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "İmza gönderilemedi.");
    } finally {
      setGonderiyor(false);
    }
  };

  const reddetGonder = async () => {
    setGonderiyor(true);
    try {
      await imzayiReddetGonder(token, redSebep);
      setSayfa((s) => (s ? { ...s, status: "DECLINED" } : s));
      setReddet(false);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setGonderiyor(false);
    }
  };

  if (yukleniyor) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#070b14] text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (hata && !sayfa) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#070b14] px-5">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
          <p className="text-sm text-rose-300">{hata}</p>
          <a href="/" className="mt-4 inline-block text-[13px] font-semibold text-cyan-300">
            pdfplatform.app
          </a>
        </div>
      </div>
    );
  }

  if (!sayfa) return null;


  return (
    <div className="min-h-dvh bg-[#070b14] px-4 py-6 text-slate-200">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
            PDF Platform
          </p>
          <div className="mt-3 rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/[0.12] to-violet-500/[0.08] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">İmzalanacak belge</p>
            <h1 className="mt-1 break-words text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{sayfa.title}</h1>
          </div>
          <p className="mt-1 text-[13px] text-slate-400">
            <strong className="text-slate-200">{sayfa.isteyen}</strong> ({sayfa.isteyenEposta}) imzanı
            bekliyor.
          </p>
          {sayfa.message && (
            <div className="mt-4 overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-white shadow-[0_0_28px_-12px_rgba(251,191,36,0.6)]">
              <div className="flex flex-wrap items-center gap-2 border-b border-amber-300/60 bg-amber-400/90 px-4 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-amber-950">
                <span aria-hidden>📝</span>
                <span>
                  {sayfa.isteyen} size not bıraktı
                </span>
                <span className="ml-auto text-[11px] font-semibold normal-case tracking-normal text-amber-900/80">
                  İmzalamadan önce okuyun
                </span>
              </div>
              {/* Not, sunucuda beyaz listeyle temizlenmiş biçimli HTML'dir (kalın/italik/renk). */}
              <div
                className="px-4 py-3.5 text-[15px] leading-relaxed text-slate-800"
                dangerouslySetInnerHTML={{ __html: sayfa.message }}
              />
            </div>
          )}
        </header>

        {belgeUrl && (
          <object
            data={belgeUrl}
            type="application/pdf"
            className="h-[60vh] w-full rounded-2xl border border-white/[0.08] bg-white"
          >
            <p className="p-4 text-[13px] text-slate-600">
              Tarayıcınız belgeyi burada gösteremiyor. Okumak için indirin.
            </p>
          </object>
        )}
        {belgeUrl && (
          <a
            href={belgeUrl}
            download={sayfa.filename || "belge.pdf"}
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-cyan-300 hover:text-cyan-200"
          >
            <Download className="h-3.5 w-3.5" />
            Belgeyi indir
          </a>
        )}

        {bitti || sayfa.status === "SIGNED" ? (
          <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] p-5 text-center">
            <Check className="mx-auto h-6 w-6 text-emerald-300" />
            <p className="mt-2 text-sm font-semibold text-emerald-100">Belge imzalandı.</p>
            <p className="mt-1 text-[12px] text-emerald-200/80">
              İmzalı belge, imzalama sürecinin zaman damgalı kaydını taşıyan bir denetim
              sertifikasıyla birlikte hazırlandı ve isteği gönderen tarafa iletildi.
            </p>
            <p className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-2.5 text-[13px] font-semibold text-emerald-100">
              İmzalı kopyanız <span className="break-all">{sayfa.signerEmail}</span> adresine e-posta eki olarak gönderildi.
            </p>
          </div>
        ) : sayfa.status === "DECLINED" ? (
          <p className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-500/[0.08] p-5 text-center text-sm text-rose-200">
            Bu imza isteğini reddettin. İsteği gönderen tarafa bildirildi.
          </p>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Ad soyad</span>
              <input
                type="text"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                className="w-full rounded-xl border border-white/[0.1] bg-[#0b1220] px-3 py-2.5 text-sm text-white"
              />
            </label>

            <div className="mt-4 flex gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
              {([
                { id: "ciz" as Kip, ad: "İmzanı çiz" },
                { id: "yukle" as Kip, ad: "İmza ekle" },
                { id: "yaz" as Kip, ad: "Adını yaz" },
              ]).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setKip(m.id)}
                  className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition ${
                    kip === m.id ? "bg-cyan-600 text-white" : "text-slate-300"
                  }`}
                >
                  {m.ad}
                </button>
              ))}
            </div>

            {kip === "ciz" ? (
              <div className="mt-3">
                <canvas
                  ref={tuvaliHazirla}
                  onPointerDown={basla}
                  onPointerMove={ciz}
                  onPointerUp={() => {
                    /* çizgi biter */
                  }}
                  className="h-40 w-full touch-none rounded-xl border border-white/[0.12] bg-white"
                />
                <button
                  type="button"
                  onClick={temizle}
                  className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-slate-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Temizle
                </button>
              </div>
            ) : kip === "yukle" ? (
              <div className="mt-3">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.2] bg-white/[0.02] px-4 py-6 text-center text-[13px] text-slate-300 hover:border-cyan-400/50">
                  <Upload className="h-5 w-5 text-cyan-300" />
                  <span>{yuklenenImza ? "Başka bir görüntü seç" : "İmza görüntünü yükle (PNG, JPG, WebP)"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      imzaDosyasiSec(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {yukleHata && <p className="mt-2 text-[13px] text-rose-300">{yukleHata}</p>}
                {yuklenenImza && (
                  <div className="mt-2 rounded-xl border border-white/[0.12] bg-white p-3">
                    <img src={yuklenenImza} alt="Yüklenen imza" className="mx-auto max-h-32" />
                  </div>
                )}
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-3 text-[13.5px] font-semibold leading-relaxed text-amber-200">
                  <span aria-hidden>💡</span>
                  <span>
                    Beyaz kâğıda atılmış imzanın net bir fotoğrafı en iyi sonucu verir; açık renkli arka plan otomatik temizlenir.
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-white/[0.1] bg-white px-4 py-6 text-center text-3xl italic text-[#0b2447]" style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}>
                {ad.trim() || "Adınız"}
              </p>
            )}

            {sayfa.yerlesimOzeti && (
              <p className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] px-3.5 py-2.5 text-[13px] leading-relaxed text-cyan-100">
                <strong className="font-semibold">İmza yeri, belgeyi gönderen kişinin tercihidir.</strong>{" "}
                {sayfa.yerlesimOzeti}
              </p>
            )}

            <label className="mt-4 flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={riza}
                onChange={(e) => setRiza(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent"
              />
              <span className="text-[13px] leading-relaxed text-slate-200">
                Bu belgeyi okudum; elektronik imzamın ıslak imzamla aynı sonucu doğurmasını kabul
                ediyorum.
              </span>
            </label>

            <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
              İmzanızla birlikte adınız, imza zamanı ve bağlantı bilgisinin özeti, imzanın size ait olduğunu ve belgenin değişmediğini
              kanıtlamak için saklanır. Ayrıntı:{" "}
              <button type="button" onClick={() => setYasalAcik("privacy")} className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
                Gizlilik Politikası
              </button>{" "}
              ve{" "}
              <button type="button" onClick={() => setYasalAcik("kvkk")} className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
                KVKK Aydınlatma Metni
              </button>
              .
            </p>

            {hata && <p className="mt-3 text-[13px] text-rose-300">{hata}</p>}

            <button
              type="button"
              onClick={() => void gonder()}
              disabled={gonderiyor || !riza || ad.trim().length < 2}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40"
            >
              {gonderiyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
              İmzala ve gönder
            </button>

            {reddet ? (
              <div className="mt-3 rounded-xl border border-white/[0.1] p-3">
                <textarea
                  rows={2}
                  value={redSebep}
                  onChange={(e) => setRedSebep(e.target.value)}
                  placeholder="Sebep (isteğe bağlı)"
                  className="w-full rounded-lg border border-white/[0.1] bg-[#0b1220] px-3 py-2 text-[13px] text-white"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void reddetGonder()}
                    className="rounded-lg bg-rose-600/80 px-3 py-2 text-[12px] font-semibold text-white"
                  >
                    Reddet
                  </button>
                  <button
                    type="button"
                    onClick={() => setReddet(false)}
                    className="rounded-lg border border-white/[0.1] px-3 py-2 text-[12px] font-semibold text-slate-300"
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex justify-end border-t border-white/[0.06] pt-4">
                <button
                  type="button"
                  onClick={() => setReddet(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/[0.08] px-4 py-2.5 text-[13px] font-semibold text-rose-200 transition hover:-translate-y-0.5 hover:border-rose-400/60 hover:bg-rose-500/20 hover:text-rose-100"
                >
                  <X className="h-4 w-4" />
                  İmzalamak istemiyorum
                </button>
              </div>
            )}
          </div>
        )}

        <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-slate-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Bu bağlantı yalnızca sizin için üretilmiştir. İmzanız, sunucuda saklanan özgün belgeye
          uygulanır ve belgeye imzalama sürecinin zaman damgalı kaydı eklenir. Ağ adresiniz açık
          saklanmaz, yalnız özeti tutulur.
        </p>
      </div>

      {yasalAcik && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setYasalAcik(null)}
        >
          <div
            className="relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0b1220]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end border-b border-white/[0.08] px-3 py-2">
              <button
                type="button"
                onClick={() => setYasalAcik(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] px-3 py-1.5 text-[13px] font-semibold text-slate-200 hover:bg-white/[0.06]"
              >
                <X className="h-4 w-4" />
                Kapat
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-5 sm:px-6">
              <LegalDocumentBody language="tr" documentKey={yasalAcik} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
