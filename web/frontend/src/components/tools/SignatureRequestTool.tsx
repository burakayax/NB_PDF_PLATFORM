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
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSignature,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import {
  imzaIstegiGonder,
  imzaIstekleriniGetir,
  imzaIstegiIptalEt,
  imzaBelgesiniIndir,
  type ImzaIstegi,
  type ImzaDurumu,
  type ImzaKontenjani,
} from "../../api/signatures";
import { ToolRating } from "../common/ToolRating";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { ToolFilePreview } from "../common/ToolFilePreview";

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
  const [gonderiyor, setGonderiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [istekler, setIstekler] = useState<ImzaIstegi[] | null>(null);
  const [kontenjan, setKontenjan] = useState<ImzaKontenjani | null>(null);

  const yukle = useCallback(async () => {
    if (!accessToken) return;
    try {
      const { istekler: liste, kontenjan: k } = await imzaIstekleriniGetir(accessToken);
      setIstekler(liste);
      setKontenjan(k);
    } catch {
      setIstekler([]);
    }
  }, [accessToken]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const gonder = async () => {
    if (!accessToken || !dosya) return;
    setGonderiyor(true);
    setHata(null);
    setBilgi(null);
    try {
      await imzaIstegiGonder(accessToken, {
        file: dosya,
        title: baslik.trim() || dosya.name,
        signerEmail: eposta.trim(),
        signerName: ad.trim() || undefined,
        message: not.trim() || undefined,
      });
      setBilgi(t.sent);
      setDosya(null);
      setBaslik("");
      setEposta("");
      setAd("");
      setNot("");
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

  if (!accessToken) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3 text-[13px] text-amber-200">
          {t.loginNeeded}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="tool-form">
        {dosya ? (
          /* Karşı tarafa imzaya gidecek belge kart kart görünür — yanlış dosyayı
             göndermek geri alınamaz, ad satırı tek başına yetmiyordu. */
          <div>
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[13px] text-slate-200">
              <FileSignature className="h-4 w-4 shrink-0 text-cyan-300" />
              <span className="truncate">{dosya.name}</span>
              <button
                type="button"
                onClick={() => setDosya(null)}
                className="ml-auto shrink-0 text-[12px] font-semibold text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>
            <ToolFilePreview file={dosya} password="" pageCount={null} language={language} />
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
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">{t.message}</span>
            <textarea
              rows={2}
              value={not}
              onChange={(e) => setNot(e.target.value)}
              placeholder={t.messagePh}
              className="w-full rounded-xl border border-white/[0.1] bg-nb-panel/70 px-3 py-2.5 text-sm text-nb-text"
            />
          </label>

          <button
            type="button"
            onClick={() => void gonder()}
            disabled={gonderiyor || !eposta.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
          >
            {gonderiyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {gonderiyor ? t.sending : t.send}
          </button>
        </div>
      )}

      {bilgi && (
        <>
          <p className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-2.5 text-[13px] text-emerald-200">
            {bilgi}
          </p>
          <ToolRating toolSlug="imza-iste" language={language} />
        </>
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

      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">{t.legalNote}</p>

      <div className="mt-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {t.requests}
        </p>
        {istekler === null ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </p>
        ) : istekler.length === 0 ? (
          <p className="mt-3 text-[13px] text-slate-400">{t.empty}</p>
        ) : (
          <ul className="mt-3 space-y-2">
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
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${DURUM_RENGI[r.status]}`}
                >
                  <DurumSimgesi durum={r.status} />
                  {t.durumlar[r.status]}
                </span>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => void indir(r)}
                    title={t.download}
                    className="rounded-lg border border-white/[0.1] p-2 text-slate-300 transition hover:text-white"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  {(r.status === "PENDING" || r.status === "VIEWED") && (
                    <button
                      type="button"
                      onClick={() => void iptal(r.id)}
                      className="rounded-lg border border-white/[0.1] px-2.5 py-2 text-[11px] font-semibold text-slate-300 transition hover:border-rose-400/40 hover:text-rose-200"
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
    </div>
  );
}
