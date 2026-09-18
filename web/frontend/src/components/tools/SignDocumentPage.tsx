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
import { Check, Loader2, PenLine, RotateCcw, ShieldCheck, X } from "lucide-react";
import {
  imzaSayfasiniGetir,
  imzayiGonder,
  imzayiReddetGonder,
  imzalayanKopyasiniIndir,
  type ImzaSayfasi,
} from "../../api/signatures";

type Kip = "ciz" | "yaz";

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
    return c.toDataURL("image/png");
  };

  const imzaGorseli = (): string | null => {
    if (kip === "yaz") {
      return ad.trim().length >= 2 ? yazidanImza(ad.trim()) : null;
    }
    if (!cizdiRef.current || !tuvalRef.current) return null;
    return tuvalRef.current.toDataURL("image/png");
  };

  const gonder = async () => {
    const png = imzaGorseli();
    if (!png) {
      setHata(kip === "ciz" ? "Önce imzanı çiz." : "Adını yaz.");
      return;
    }
    setGonderiyor(true);
    setHata(null);
    try {
      await imzayiGonder(token, {
        signaturePng: png,
        signerName: ad.trim(),
        consent: riza,
        // İmza son sayfanın sağ alt bölgesine yerleştirilir (sözleşme alışkanlığı).
        placement: { sayfa: 1, xOran: 0.55, yOran: 0.78, genislikOran: 0.28 },
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

  const kopyaIndir = async () => {
    try {
      const blob = await imzalayanKopyasiniIndir(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (sayfa?.filename ?? "belge").replace(/\.pdf$/i, "") + "-imzali.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "");
    }
  };

  if (yukleniyor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b14] text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (hata && !sayfa) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b14] px-5">
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

  const belgeUrl = `data:application/pdf;base64,${sayfa.belgeBase64}`;

  return (
    <div className="min-h-screen bg-[#070b14] px-4 py-6 text-slate-200">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
            PDF Platform
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">{sayfa.title}</h1>
          <p className="mt-1 text-[13px] text-slate-400">
            <strong className="text-slate-200">{sayfa.isteyen}</strong> ({sayfa.isteyenEposta}) imzanı
            bekliyor.
          </p>
          {sayfa.message && (
            <p className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-[13px] text-slate-300">
              {sayfa.message}
            </p>
          )}
        </header>

        <object
          data={belgeUrl}
          type="application/pdf"
          className="h-[60vh] w-full rounded-2xl border border-white/[0.08] bg-white"
        >
          <p className="p-4 text-[13px] text-slate-600">
            Belgeyi görüntülemek için{" "}
            <a href={belgeUrl} download={sayfa.filename} className="font-semibold text-cyan-700">
              indir
            </a>
            .
          </p>
        </object>

        {bitti || sayfa.status === "SIGNED" ? (
          <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] p-5 text-center">
            <Check className="mx-auto h-6 w-6 text-emerald-300" />
            <p className="mt-2 text-sm font-semibold text-emerald-100">Belge imzalandı.</p>
            <p className="mt-1 text-[12px] text-emerald-200/80">
              İmzalı belge, imzalama sürecinin zaman damgalı kaydını taşıyan bir denetim
              sertifikasıyla birlikte hazırlandı ve isteği gönderen tarafa iletildi.
            </p>
            <button
              type="button"
              onClick={() => void kopyaIndir()}
              className="mt-4 rounded-xl border border-emerald-400/30 px-4 py-2.5 text-[13px] font-semibold text-emerald-100"
            >
              İmzalı kopyamı indir
            </button>
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
            ) : (
              <p className="mt-3 rounded-xl border border-white/[0.1] bg-white px-4 py-6 text-center text-3xl italic text-[#0b2447]" style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}>
                {ad.trim() || "Adınız"}
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
              <button
                type="button"
                onClick={() => setReddet(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-rose-200"
              >
                <X className="h-3.5 w-3.5" />
                İmzalamak istemiyorum
              </button>
            )}
          </div>
        )}

        <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Bu bağlantı yalnızca sizin için üretilmiştir. İmzanız, sunucuda saklanan özgün belgeye
          uygulanır ve belgeye imzalama sürecinin zaman damgalı kaydı eklenir. Ağ adresiniz açık
          saklanmaz, yalnız özeti tutulur.
        </p>
      </div>
    </div>
  );
}
