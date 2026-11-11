/**
 * İMZA İSTE — belgeyi karşı tarafa imzalatma.
 *
 * Gönderen belgeyi yükler, imzalayacak kişinin e-postasını yazar; karşı tarafa
 * tek kullanımlık bir bağlantı gider. İmzalanan belge, imzalama sürecinin
 * zaman damgalı kaydını taşıyan bir denetim sertifikasıyla birlikte döner.
 *
 * Kendi imzasını atmak isteyen kullanıcı için ayrı bir araç (PDF İmzala) var;
 * burada iş, BAŞKASINDAN imza almaktır — bu yüzden ekranda istek listesi ve
 * durum takibi ön plandadır.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  ExternalLink,
  FileSignature,
  Loader2,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import {
  imzaIstegiGonder,
  imzaIstekleriniGetir,
  imzaIstegiIptalEt,
  imzaIstegiSil,
  imzaBelgesiniIndir,
  type ImzaIstegi,
  type ImzaTercihi,
  type ImzaKonumu,
  type ImzaSayfaModu,
  type ImzaDurumu,
  type ImzaKontenjani,
} from "../../api/signatures";
import { SignatureNoteEditor, duzMetin } from "./SignatureNoteEditor";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";

const METIN = {
  tr: {
    hint: "İmzalatmak istediğin PDF'i seç.",
    title: "Belge adı",
    signerEmail: "İmzalayacak kişinin e-postası",
    signerName: "Adı (isteğe bağlı)",
    message: "Not (isteğe bağlı)",
    messagePh: "Karşı tarafa iletilecek kısa bir not…",
    send: "İmza iste",
    sending: "Gönderiliyor…",
    sent: "İmza bağlantısı gönderildi.",
    requests: "İmza istekleri",
    empty: "Henüz imza isteği göndermedin.",
    cancel: "İptal et",
    download: "İndir",
    signedBy: "imzaladı",
    waiting: "bekleniyor",
    loginNeeded: "İmza istemek için oturum açman gerekiyor.",
    quotaLeft: "Bu ay kalan imza isteği hakkın:",
    quotaUnlimited: "Bu ay sınırsız imza isteği gönderebilirsin.",
    quotaNone: "Bu ayki imza isteği hakkın doldu. Planını yükselterek devam edebilirsin.",
    legalNote:
      "Bu araç görsel (ıslak imza görünümlü) elektronik imza üretir ve imzalama sürecinin zaman damgalı kaydını belgeye ekler. Nitelikli elektronik imza (e-imza) ayrı bir hukuki kategoridir ve nitelikli hizmet sağlayıcıdan alınan sertifika gerektirir.",
    durumlar: {
      PENDING: "Gönderildi",
      VIEWED: "Görüntülendi",
      SIGNED: "İmzalandı",
      DECLINED: "Reddedildi",
      CANCELLED: "İptal edildi",
      EXPIRED: "Süresi doldu",
    } as Record<ImzaDurumu, string>,
  },
  en: {
    hint: "Choose the PDF you want signed.",
    title: "Document name",
    signerEmail: "Signer's email address",
    signerName: "Name (optional)",
    message: "Note (optional)",
    messagePh: "A short note for the signer…",
    send: "Request signature",
    sending: "Sending…",
    sent: "The signing link has been sent.",
    requests: "Signature requests",
    empty: "You have not sent any signature requests yet.",
    cancel: "Cancel",
    download: "Download",
    signedBy: "signed",
    waiting: "waiting",
    loginNeeded: "You need to sign in to request a signature.",
    quotaLeft: "Signature requests left this month:",
    quotaUnlimited: "You can send unlimited signature requests this month.",
    quotaNone: "You have used this month's signature requests. Upgrade your plan to continue.",
    legalNote:
      "This tool produces a visual (wet-ink-style) electronic signature and attaches a timestamped record of the signing process to the document. A qualified electronic signature is a separate legal category and requires a certificate from a qualified trust service provider.",
    durumlar: {
      PENDING: "Sent",
      VIEWED: "Viewed",
      SIGNED: "Signed",
      DECLINED: "Declined",
      CANCELLED: "Cancelled",
      EXPIRED: "Expired",
    } as Record<ImzaDurumu, string>,
  },
} as const;

const DOCK =
  "transition duration-150 ease-out hover:z-10 hover:-translate-y-0.5 hover:scale-110 hover:border-cyan-300 hover:bg-cyan-400/25 hover:text-white hover:shadow-[0_6px_18px_-6px_rgba(34,211,238,0.6)]";

const KONUMLAR: { id: ImzaKonumu; ad: string; sinif: string }[] = [
  { id: "sol-ust", ad: "Sol üst", sinif: "left-2 top-2" },
  { id: "orta-ust", ad: "Üst orta", sinif: "left-[calc(50%-2.625rem)] top-2" },
  { id: "sag-ust", ad: "Sağ üst", sinif: "right-2 top-2" },
  { id: "sol-alt", ad: "Sol alt", sinif: "bottom-2 left-2" },
  { id: "orta-alt", ad: "Alt orta", sinif: "bottom-2 left-[calc(50%-2.625rem)]" },
  { id: "sag-alt", ad: "Sağ alt", sinif: "bottom-2 right-2" },
];

const SAYFA_MODLARI: { id: ImzaSayfaModu; ad: string }[] = [
  { id: "son", ad: "Son sayfa" },
  { id: "ilk", ad: "İlk sayfa" },
  { id: "hepsi", ad: "Her sayfa" },
  { id: "sec", ad: "Seçtiğim sayfalar" },
  { id: "haric", ad: "Şunlar hariç hepsi" },
];

function tercihOzeti(t: ImzaTercihi): string {
  const konum = {
    "sag-alt": "sağ alt köşesine",
    "orta-alt": "alt ortasına",
    "sol-alt": "sol alt köşesine",
    "sag-ust": "sağ üst köşesine",
    "orta-ust": "üst ortasına",
    "sol-ust": "sol üst köşesine",
  }[t.konum];
  const l = t.sayfalar.trim();
  switch (t.mod) {
    case "ilk": return `İmza, belgenin ilk sayfasının ${konum} eklenecek.`;
    case "hepsi": return `İmza, belgenin her sayfasının ${konum} eklenecek.`;
    case "sec": return l ? `İmza, ${l} numaralı sayfaların ${konum} eklenecek.` : "Hangi sayfalara imza atılacağını yazın (ör. 1, 3, 5-7).";
    case "haric": return l ? `İmza, ${l} numaralı sayfalar dışındaki tüm sayfaların ${konum} eklenecek.` : "İmza atılmayacak sayfaları yazın (ör. 2, 4-5).";
    default: return `İmza, belgenin son sayfasının ${konum} eklenecek.`;
  }
}

function tarihSaat(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const DURUM_RENGI: Record<ImzaDurumu, string> = {
  PENDING: "text-slate-300 border-white/15",
  VIEWED: "text-sky-200 border-sky-400/30 bg-sky-500/10",
  SIGNED: "text-emerald-200 border-emerald-400/30 bg-emerald-500/10",
  DECLINED: "text-rose-200 border-rose-400/30 bg-rose-500/10",
  CANCELLED: "text-slate-400 border-white/10",
  EXPIRED: "text-amber-200 border-amber-400/30 bg-amber-500/10",
};

function DurumSimgesi({ durum }: { durum: ImzaDurumu }) {
  if (durum === "SIGNED") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (durum === "DECLINED" || durum === "CANCELLED") return <XCircle className="h-3.5 w-3.5" />;
  if (durum === "VIEWED") return <Eye className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
}

export function SignatureRequestTool({
  language,
  accessToken,
}: {
  language: Language;
  accessToken?: string | null;
  initialFile?: File | null;
}) {
  const dil = language === "tr" ? "tr" : "en";
  const t = METIN[dil];
  const [dosya, setDosya] = useState<File | null>(null);
  const [baslik, setBaslik] = useState("");
  const [eposta, setEposta] = useState("");
  const [ad, setAd] = useState("");
  const [not, setNot] = useState("");
  const [notSifirla, setNotSifirla] = useState(0);
  const notMetin = duzMetin(not);
  const notUzun = notMetin.length > 1000;
  const [gonderiyor, setGonderiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [istekler, setIstekler] = useState<ImzaIstegi[] | null>(null);
  const [kontenjan, setKontenjan] = useState<ImzaKontenjani | null>(null);
  const [tercih, setTercih] = useState<ImzaTercihi>({ mod: "son", sayfalar: "", konum: "sag-alt" });
  const [yerOnay, setYerOnay] = useState(false);
  const [sonuc, setSonuc] = useState<{ eposta: string; baslik: string; zaman: string; ozet: string; blob: Blob; ad: string; epostaBildirildi: boolean } | null>(null);
  const [listeHatasi, setListeHatasi] = useState<string | null>(null);
  const [epostaBildir, setEpostaBildir] = useState(false);
  const [guncelleme, setGuncelleme] = useState<string | null>(null);
  const oncekiDurumRef = useRef<Map<string, ImzaDurumu> | null>(null);
  const [silinecek, setSilinecek] = useState<ImzaIstegi | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);
  const listeRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const listeGerekli = tercih.mod === "sec" || tercih.mod === "haric";
  const yerHazir = !listeGerekli || tercih.sayfalar.trim().length > 0;

  const yukle = useCallback(async (sessiz = false) => {
    if (!accessToken) return;
    try {
      const { istekler: liste, kontenjan: k } = await imzaIstekleriniGetir(accessToken);
      // Yoklamada durumu değişen istekleri kısa bir bildirimle duyur.
      const onceki = oncekiDurumRef.current;
      if (onceki) {
        const degisen = liste.filter((r) => {
          const eski = onceki.get(r.id);
          return eski && eski !== r.status && (r.status === "SIGNED" || r.status === "DECLINED");
        });
        if (degisen.length > 0) {
          const r = degisen[0];
          setGuncelleme(
            `«${r.title}» ${r.status === "SIGNED" ? "imzalandı" : "reddedildi"}.` +
              (degisen.length > 1 ? ` (+${degisen.length - 1} istek daha güncellendi)` : ""),
          );
        }
      }
      oncekiDurumRef.current = new Map(liste.map((r) => [r.id, r.status]));
      setIstekler(liste);
      setKontenjan(k);
      setListeHatasi(null);
    } catch (e) {
      // Arka plandaki yoklama bir kez başarısız olursa mevcut liste bozulmasın.
      if (sessiz) return;
      setIstekler([]);
      setListeHatasi(e instanceof Error ? e.message : "İmza istekleri yüklenemedi.");
    }
  }, [accessToken]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useEffect(() => {
    if (!guncelleme) return;
    const z = window.setTimeout(() => setGuncelleme(null), 9000);
    return () => window.clearTimeout(z);
  }, [guncelleme]);

  /**
   * AKILLI YOKLAMA: 30 sn'de bir, yalnızca (1) sekme görünürken ve (2) cevap
   * bekleyen en az bir istek varken sorar. Sekmeye dönünce hemen bir kez yeniler
   * (en az 5 sn arayla). Liste isteği küçüktür; belge içeriği taşımaz.
   */
  const bekleyenVar = (istekler ?? []).some((r) => r.status === "PENDING" || r.status === "VIEWED");
  useEffect(() => {
    if (!accessToken) return;
    let son = Date.now();
    const sor = () => {
      son = Date.now();
      void yukle(true);
    };
    const zaman = bekleyenVar
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") sor();
        }, 30_000)
      : null;
    const donus = () => {
      if (document.visibilityState === "visible" && Date.now() - son > 5_000) sor();
    };
    document.addEventListener("visibilitychange", donus);
    window.addEventListener("focus", donus);
    return () => {
      if (zaman) window.clearInterval(zaman);
      document.removeEventListener("visibilitychange", donus);
      window.removeEventListener("focus", donus);
    };
  }, [accessToken, bekleyenVar, yukle]);

  const gonder = async () => {
    if (!accessToken || !dosya) return;
    setGonderiyor(true);
    setHata(null);
    try {
      await imzaIstegiGonder(accessToken, {
        file: dosya,
        title: baslik.trim() || dosya.name,
        signerEmail: eposta.trim(),
        signerName: ad.trim() || undefined,
        message: notMetin ? not : undefined,
        placement: tercih,
        notifyOwner: epostaBildir,
      });
      setSonuc({ eposta: eposta.trim(), baslik: baslik.trim() || dosya.name, zaman: tarihSaat(new Date().toISOString()), ozet: tercihOzeti(tercih), blob: dosya, ad: dosya.name, epostaBildirildi: epostaBildir });
        setYerOnay(false);
      setEpostaBildir(false);
      setTercih({ mod: "son", sayfalar: "", konum: "sag-alt" });
      setDosya(null);
      setBaslik("");
      setEposta("");
      setAd("");
      setNot("");
      setNotSifirla((n) => n + 1);
      await yukle();
    } catch (e) {
      setHata(e instanceof Error ? e.message : t.send);
    } finally {
      setGonderiyor(false);
    }
  };

  const iptal = async (id: string) => {
    if (!accessToken) return;
    try {
      await imzaIstegiIptalEt(accessToken, id);
      await yukle();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "");
    }
  };

  const indir = async (istek: ImzaIstegi) => {
    if (!accessToken) return;
    try {
      const blob = await imzaBelgesiniIndir(accessToken, istek.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = istek.filename.replace(/\.pdf$/i, "") + (istek.status === "SIGNED" ? "-imzali.pdf" : ".pdf");
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "");
    }
  };

  const sil = async () => {
    if (!accessToken || !silinecek) return;
    setSiliniyor(true);
    try {
      await imzaIstegiSil(accessToken, silinecek.id);
      setSilinecek(null);
      await yukle();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "");
      setSilinecek(null);
    } finally {
      setSiliniyor(false);
    }
  };

  const ac = async (istek: ImzaIstegi) => {
    if (!accessToken) return;
    // Açılır pencere engelleyicisine takılmamak için pencere tıklamada, içerik sonra yüklenir.
    const pencere = window.open("", "_blank");
    try {
      const blob = await imzaBelgesiniIndir(accessToken, istek.id);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      if (pencere) pencere.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      pencere?.close();
      setHata(e instanceof Error ? e.message : "");
    }
  };

  if (!accessToken) {
    return (
      <div className="w-full">
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3 text-[13px] text-amber-200">
          {t.loginNeeded}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="tool-form" ref={formRef}>
        {dosya ? (
          /* Karşı tarafa imzaya gidecek belge kart kart görünür — yanlış dosyayı
             göndermek geri alınamaz, ad satırı tek başına yetmiyordu. */
          <div>
            <div className="mb-3 flex items-center gap-4 rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/[0.10] to-violet-500/[0.06] px-4 py-4 shadow-[0_0_0_1px_rgba(34,211,238,0.05)]">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10">
                <FileSignature className="h-7 w-7 text-cyan-300" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300/90">
                  {language === "tr" ? "İmzaya gönderilecek belge" : "Document to be signed"}
                </p>
                <p className="mt-0.5 truncate text-[15px] font-semibold text-white" title={dosya.name}>
                  {dosya.name}
                </p>
                <p className="mt-0.5 text-[12px] text-slate-400">
                  PDF · {dosya.size >= 1024 * 1024 ? `${(dosya.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(dosya.size / 1024))} KB`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDosya(null)}
                className="shrink-0 rounded-lg border border-white/[0.12] px-3 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:border-white/25 hover:text-white"
              >
                {language === "tr" ? "Değiştir" : "Change"}
              </button>
            </div>
          </div>
        ) : (
          <WorkspaceUploadField
            toolId="imza-iste"
            language={language}
            accept="application/pdf,.pdf"
            note={t.hint}
            onFiles={(files) => {
              const f = files[0];
              if (f) {
                setDosya(f);
                if (!baslik) setBaslik(f.name.replace(/\.pdf$/i, ""));
              }
            }}
          />
        )}
      </div>

      {dosya && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">{t.title}</span>
            <input
              type="text"
              value={baslik}
              onChange={(e) => setBaslik(e.target.value)}
              className="w-full rounded-xl border border-white/[0.1] bg-nb-panel/70 px-3 py-2.5 text-sm text-nb-text"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{t.signerEmail}</span>
              <input
                type="email"
                value={eposta}
                onChange={(e) => setEposta(e.target.value)}
                className="w-full rounded-xl border border-white/[0.1] bg-nb-panel/70 px-3 py-2.5 text-sm text-nb-text"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{t.signerName}</span>
              <input
                type="text"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                className="w-full rounded-xl border border-white/[0.1] bg-nb-panel/70 px-3 py-2.5 text-sm text-nb-text"
              />
            </label>
          </div>
          <div className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">{t.message}</span>
            <p className="mb-2 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2.5 text-[13px] font-semibold leading-relaxed text-amber-200">
              <span aria-hidden>💡</span>
              <span>
              Not, imzalayana e-postada ve imza sayfasında beyaz bir kutuda, burada seçtiğiniz kalın, renk ve punto
              ayarlarıyla gösterilir. Bu yüzden yazı alanı da beyazdır; göreceğiniz, karşı tarafın göreceğidir.
              </span>
            </p>
            <SignatureNoteEditor onChange={setNot} placeholder={t.messagePh} sifirla={notSifirla} />
            <p className={`mt-1 text-right text-[11px] ${notUzun ? "text-rose-300" : "text-slate-500"}`}>
              {notMetin.length} / 1000
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">İmza nereye atılsın?</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SAYFA_MODLARI.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setTercih((x) => ({ ...x, mod: m.id })); setYerOnay(false); }}
                  className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${DOCK} ${
                    tercih.mod === m.id ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100" : "border-white/[0.1] text-slate-300"
                  }`}
                >
                  {m.ad}
                </button>
              ))}
            </div>
            {listeGerekli && (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">
                  {tercih.mod === "sec" ? "İmza atılacak sayfalar" : "İmza atılmayacak sayfalar"} (örnek: 1, 3, 5-7)
                </span>
                <input
                  type="text"
                  value={tercih.sayfalar}
                  onChange={(e) => { setTercih((x) => ({ ...x, sayfalar: e.target.value })); setYerOnay(false); }}
                  className="w-full rounded-xl border border-white/[0.1] bg-nb-panel/70 px-3 py-2.5 text-sm text-nb-text"
                />
              </label>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="relative h-72 w-full max-w-[19rem] shrink-0 rounded-md border border-white/20 bg-white/[0.06]">
                {KONUMLAR.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    title={k.ad}
                    aria-label={k.ad}
                    onClick={() => { setTercih((x) => ({ ...x, konum: k.id })); setYerOnay(false); }}
                    className={`absolute flex h-10 w-[5.25rem] items-center justify-center whitespace-nowrap rounded-md border text-[13px] font-bold leading-none ${DOCK} ${k.sinif} ${
                      tercih.konum === k.id ? "border-cyan-300 bg-cyan-400/40 text-white" : "border-dashed border-white/25 text-transparent hover:text-cyan-50"
                    }`}
                  >
                    {tercih.konum === k.id ? "İmza" : "Seç"}
                  </button>
                ))}
              </div>
              <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-slate-300">
                <p>{tercihOzeti(tercih)}</p>
                <p className="mt-1 text-[12px] text-slate-500">Köşeyi sayfa şemasından seçin. İmzalayan yeri değiştiremez.</p>
              </div>
            </div>
            <label className="mt-4 flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={yerOnay}
                disabled={!yerHazir}
                onChange={(e) => setYerOnay(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent"
              />
              <span className="text-[13px] text-slate-200">İmzanın bu yerleşimle atılmasını onaylıyorum.</span>
            </label>
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <input
              type="checkbox"
              checked={epostaBildir}
              onChange={(e) => setEpostaBildir(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent"
            />
            <span className="text-[13px] text-slate-200">
              İmzalandığında veya reddedildiğinde e-posta ile bilgilendir
              <span className="mt-0.5 block text-[12px] text-slate-500">
                İşaretlemezseniz size bilgilendirme e-postası gönderilmez; bu sayfa açıkken sonuç kendiliğinden güncellenir. İmzalayan kişiye bağlantı e-postası her durumda gider.
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={() => void gonder()}
            disabled={gonderiyor || !eposta.trim() || !yerOnay || !yerHazir || notUzun}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
          >
            {gonderiyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {gonderiyor ? t.sending : t.send}
          </button>
        </div>
      )}

      {sonuc && (
        <div className="mt-4">
          <ToolResultPanel
            blob={sonuc.blob}
            filename={sonuc.ad}
            language={language}
            heading="İmza isteği gönderildi"
            subtitle={`«${sonuc.baslik}» için imza bağlantısı ${sonuc.eposta} adresine iletildi (${sonuc.zaman}).`}
            confirmClose={false}
            hideFileActions
            ratingToolSlug="imza-iste"
            onClose={() => setSonuc(null)}
            extraActions={
              <>
              <button
                type="button"
                onClick={() => {
                  setSonuc(null);
                  // Sayfa değil, uygulamanın kendi kaydırma alanı kayar: formun başına git.
                  window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-[0_10px_26px_-10px_rgba(34,211,238,0.7)] transition duration-200 hover:scale-[1.04] hover:from-cyan-500 hover:to-blue-500"
              >
                <Send className="h-4 w-4" /> Yeni imza iste
              </button>
              <button
                type="button"
                onClick={() => listeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-3 text-sm font-bold text-emerald-100 transition duration-200 hover:scale-[1.04] hover:bg-emerald-500/20"
              >
                <FileSignature className="h-4 w-4" /> İmza isteklerimi göster
              </button>
              </>
            }
          >
            <p className="mt-4 text-xs text-slate-400">{sonuc.ozet}</p>
            <p className="mt-1 text-xs text-slate-500">
              {sonuc.epostaBildirildi
                ? "İmzalandığında veya reddedildiğinde size e-posta gelir. "
                : "Sonuç, bu sayfa açıkken listede kendiliğinden güncellenir. "}
              İmzalı belgeyi aşağıdaki listeden açabilir veya indirebilirsiniz.
            </p>
          </ToolResultPanel>
        </div>
      )}
      {hata && <p className="mt-3 text-[13px] text-rose-300">{hata}</p>}

      {kontenjan && (
        <p
          className={`mt-4 rounded-xl border px-4 py-2.5 text-[12px] ${
            kontenjan.kaldi === 0
              ? "border-amber-400/25 bg-amber-500/[0.08] text-amber-200"
              : "border-white/[0.08] bg-white/[0.02] text-slate-400"
          }`}
        >
          {kontenjan.sinir === null
            ? t.quotaUnlimited
            : kontenjan.kaldi === 0
              ? t.quotaNone
              : `${t.quotaLeft} ${kontenjan.kaldi} / ${kontenjan.sinir}`}
        </p>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-slate-400">{t.legalNote}</p>

      {guncelleme && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-2.5 text-[13px] text-emerald-200"
        >
          {guncelleme}
        </p>
      )}

      <div className="mt-7" ref={listeRef}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {t.requests}
        </p>
        {istekler === null ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </p>
        ) : listeHatasi ? (
          <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/[0.08] px-4 py-2.5 text-[13px] text-rose-200">
            İstekler yüklenemedi: {listeHatasi}
          </p>
        ) : istekler.length === 0 ? (
          <p className="mt-3 text-[13px] text-slate-400">{t.empty}</p>
        ) : (
          <ul className="mt-3 max-h-[17.5rem] space-y-2 overflow-y-auto overscroll-contain pr-1.5 [scrollbar-color:rgba(148,163,184,0.4)_transparent] [scrollbar-width:thin]">
            {istekler.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{r.title}</p>
                  <p className="truncate text-[12px] text-slate-400">
                    {r.signerName ? `${r.signerName} · ` : ""}
                    {r.signerEmail}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                    İstendi: {tarihSaat(r.createdAt)}
                    {r.viewedAt && r.status !== "SIGNED" && r.status !== "DECLINED" ? ` · Görüntülendi: ${tarihSaat(r.viewedAt)}` : ""}
                    {r.signedAt ? ` · İmzalandı: ${tarihSaat(r.signedAt)}` : ""}
                    {r.declinedAt ? ` · Reddedildi: ${tarihSaat(r.declinedAt)}` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${DURUM_RENGI[r.status]}`}
                >
                  <DurumSimgesi durum={r.status} />
                  {t.durumlar[r.status]}
                </span>
                <div className="flex shrink-0 gap-1.5">
                  {r.status === "SIGNED" && (
                    <button
                      type="button"
                      onClick={() => void ac(r)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/80 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-emerald-500"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      İmzalı belgeyi aç
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void indir(r)}
                    title={t.download}
                    className="rounded-lg border border-white/[0.1] p-2 text-slate-300 transition hover:text-white"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSilinecek(r)}
                    title="Sil"
                    aria-label="İsteği sil"
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-rose-300 transition hover:bg-rose-500/25 hover:text-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {(r.status === "PENDING" || r.status === "VIEWED") && (
                    <button
                      type="button"
                      onClick={() => void iptal(r.id)}
                      className="rounded-lg border border-white/[0.1] px-2.5 py-2 text-[12px] font-semibold text-slate-300 transition hover:border-rose-400/40 hover:text-rose-200"
                    >
                      {t.cancel}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {silinecek && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !siliniyor && setSilinecek(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#0b1220] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15">
                <Trash2 className="h-5 w-5 text-rose-300" />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-white">Bu imza isteği silinsin mi?</p>
                <p className="mt-1 truncate text-[13px] text-slate-300">«{silinecek.title}»</p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">
                  Belge ve imzalı kopyası sunucudan kalıcı olarak silinir ve geri alınamaz.
                  {silinecek.status === "SIGNED"
                    ? " İmzalı kopyayı saklamak istiyorsanız önce indirin."
                    : " Henüz imzalanmadıysa gönderilen imza bağlantısı da çalışmaz."}{" "}
                  Silmek bu ayın imza isteği hakkını geri vermez.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={siliniyor}
                onClick={() => setSilinecek(null)}
                className="rounded-lg border border-white/[0.12] px-4 py-2 text-[13px] font-semibold text-slate-200 hover:bg-white/[0.06]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={siliniyor}
                onClick={() => void sil()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {siliniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Evet, sil
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
