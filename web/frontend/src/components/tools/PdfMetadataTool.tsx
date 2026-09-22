/**
 * PDF ÜSTVERİ TEMİZLEME — belgede kalan gizli izleri gösterir ve siler.
 *
 * Kullanıcı önce NE OLDUĞUNU görür (yazar adı, üreten program, tarihler, XMP
 * bloğu, gömülü fotoğrafların EXIF/GPS bilgisi), sonra temizler. Önce göstermek
 * önemli: çoğu kişi özgeçmişinde ya da teklifinde bu bilgilerin taşındığını
 * bilmiyor; liste olmadan aracın ne işe yaradığı da anlaşılmıyor.
 *
 * Her şey cihazda yapılır — gizlilik aracının dosyayı sunucuya yüklemesi çelişki olurdu.
 */
import { useCallback, useState } from "react";
import { Eraser, FileText, Loader2, Lock, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { alanAdi, ustveriOku, ustveriTemizle, type UstveriOzeti } from "../../lib/pdfMetadata";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";

const METIN = {
  tr: {
    hint: "PDF'i seç — içinde kalan gizli bilgiler listelenir.",
    chipDevice: "Cihazda işlenir",
    chipFree: "Kayıt gerekmez",
    chipNoInstall: "Kurulum yok",
    reading: "Belge inceleniyor…",
    failed: "Belge okunamadı. Dosya bozuk ya da şifreli olabilir.",
    cleanFailed: "Üstveri temizlenemedi.",
    found: "Belgede bulunanlar",
    nothing: "Bu belgede temizlenecek üstveri bulunamadı. Yine de belge kimliğini silmek için temizleyebilirsin.",
    xmp: "XMP üstveri bloğu",
    xmpNote: "Program geçmişi ve belge kimlikleri burada saklanır; çoğu araç bunu atlar.",
    id: "Benzersiz belge kimliği",
    idNote: "Aynı belgenin farklı kopyalarını birbirine bağlamaya yarar.",
    images: "fotoğrafta EXIF bilgisi",
    imagesNote: "Makine modeli, çekim tarihi ve GPS KONUMU taşıyabilir.",
    cleanImages: "Gömülü fotoğrafların EXIF/GPS bilgisini de temizle",
    cleanImagesNote: "Renk profili korunur, görüntü kalitesi değişmez.",
    apply: "Üstveriyi temizle",
    working: "Temizleniyor…",
    another: "Başka dosya seç",
    cleanedImages: "fotoğrafın üstverisi temizlendi",
    freeWithAccount: "Ücretsiz — yalnızca üye girişi gerekir",
    joinTitle: "Üstveri temizleme — ücretsiz",
    joinText:
      "Belgende ne taşındığını gördün. Temizlemek için ücretsiz üyelik yeterli — dosyan yine cihazından çıkmaz.",
    joinCta: "Ücretsiz üye ol",
    joinLater: "Daha sonra",
  },
  en: {
    hint: "Pick a PDF — the hidden data left inside is listed for you.",
    chipDevice: "Processed on device",
    chipFree: "No sign-up",
    chipNoInstall: "No install",
    reading: "Inspecting the document…",
    failed: "Could not read the document. The file may be corrupt or encrypted.",
    cleanFailed: "Could not remove the metadata.",
    found: "Found in this document",
    nothing: "No metadata was found in this document. You can still clean it to drop the document ID.",
    xmp: "XMP metadata block",
    xmpNote: "Software history and document IDs live here; most tools skip it.",
    id: "Unique document ID",
    idNote: "Used to link different copies of the same document together.",
    images: "photos carrying EXIF data",
    imagesNote: "May include camera model, capture date and GPS LOCATION.",
    cleanImages: "Also strip EXIF/GPS from embedded photos",
    cleanImagesNote: "The colour profile is kept, image quality is unchanged.",
    apply: "Remove metadata",
    working: "Cleaning…",
    another: "Choose another file",
    cleanedImages: "photos had their metadata removed",
    freeWithAccount: "Free — you only need to sign in",
    joinTitle: "Metadata removal — free",
    joinText:
      "You have seen what your document carries. A free account is all it takes to strip it — your file still never leaves your device.",
    joinCta: "Create a free account",
    joinLater: "Later",
  },
} as const;

type Sonuc = { blob: Blob; filename: string; temizlenenGorsel: number };

/**
 * ÜYE GİRİŞİ NEREDE İSTENİYOR: İnceleme HERKESE açıktır — belgesinde ne
 * taşıdığını görmek için kimse kayıt olmak zorunda değil; asıl değer o listede.
 * Temizleme üye girişi ister. Bu bir ücret kapısı değil (araç ücretsiz);
 * değeri yüksek bir araçta kayıt anıdır ve kullanıcıya bedeli ödenmiş bir
 * karşılık sunar: ne kaybettiğini zaten görmüştür.
 */
export function PdfMetadataTool({
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
  const t = METIN[dil];
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("belge.pdf");
  const [ozet, setOzet] = useState<UstveriOzeti | null>(null);
  const [gorselleriTemizle, setGorselleriTemizle] = useState(true);
  const [okuyor, setOkuyor] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [kayitDuvari, setKayitDuvari] = useState(false);

  const dosyaYukle = useCallback(
    async (f: File | undefined) => {
      if (!f) return;
      setOkuyor(true);
      setHata(null);
      setOzet(null);
      try {
        const b = new Uint8Array(await f.arrayBuffer());
        const bulunan = await ustveriOku(b);
        setBytes(b);
        setFileName(f.name);
        setOzet(bulunan);
      } catch {
        setHata(t.failed);
      } finally {
        setOkuyor(false);
      }
    },
    [t],
  );

  const temizle = async () => {
    if (!bytes) return;
    if (!isSignedIn) {
      setKayitDuvari(true);
      return;
    }
    setCalisiyor(true);
    setHata(null);
    try {
      const { bytes: cikti, temizlenenGorsel } = await ustveriTemizle(bytes, {
        gorselleriTemizle,
      });
      setSonuc({
        blob: new Blob([cikti as unknown as BlobPart], { type: "application/pdf" }),
        filename:
          fileName.replace(/\.pdf$/i, "") + (dil === "tr" ? "-temiz.pdf" : "-cleaned.pdf"),
        temizlenenGorsel,
      });
    } catch {
      setHata(t.cleanFailed);
    } finally {
      setCalisiyor(false);
    }
  };

  if (sonuc) {
    return (
      <ToolResultPanel
        ratingToolSlug="ustveri-temizle"
        blob={sonuc.blob}
        filename={sonuc.filename}
        language={language}
        processedOnDevice
        subtitle={
          sonuc.temizlenenGorsel > 0
            ? `${sonuc.temizlenenGorsel} ${t.cleanedImages}`
            : undefined
        }
        onClose={() => setSonuc(null)}
      >
        <ValueMomentNudge language={language} source="metadata_clean_success" />
      </ToolResultPanel>
    );
  }

  if (!bytes || !ozet) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="tool-form">
          <WorkspaceUploadField
            language={language}
            accept="application/pdf,.pdf"
            note={t.hint}
            onFiles={(files) => void dosyaYukle(files[0])}
          />
        </div>
        {okuyor && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.reading}
          </p>
        )}
        {hata && <p className="mt-3 text-[13px] text-rose-300">{hata}</p>}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { icon: <ShieldCheck className="h-4 w-4" />, t: t.chipDevice },
            { icon: <Zap className="h-4 w-4" />, t: t.chipFree },
            { icon: <Lock className="h-4 w-4" />, t: t.chipNoInstall },
          ].map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-[12px] font-medium text-slate-300"
            >
              <span className="text-cyan-300">{c.icon}</span>
              {c.t}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const alanGirdileri = Object.entries(ozet.alanlar);
  const bosMu =
    alanGirdileri.length === 0 && !ozet.xmpVar && ozet.exifliGorsel === 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-3 flex items-center gap-2 text-[13px] text-slate-400">
        <FileText className="h-4 w-4 shrink-0 text-cyan-300" />
        <span className="truncate">{fileName}</span>
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {t.found}
      </p>

      {bosMu ? (
        <p className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[13px] leading-relaxed text-slate-300">
          {t.nothing}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {alanGirdileri.map(([anahtar, deger]) => (
            <div
              key={anahtar}
              className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5"
            >
              <span className="w-40 shrink-0 text-[12px] text-slate-400">
                {alanAdi(anahtar, dil)}
              </span>
              <span className="min-w-0 flex-1 break-words text-[13px] text-slate-100">{deger}</span>
            </div>
          ))}
          {ozet.xmpVar && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-2.5">
              <p className="text-[13px] font-semibold text-amber-200">{t.xmp}</p>
              <p className="text-[12px] text-amber-200/80">{t.xmpNote}</p>
            </div>
          )}
          {ozet.exifliGorsel > 0 && (
            <div className="rounded-xl border border-rose-400/25 bg-rose-500/[0.08] px-4 py-2.5">
              <p className="text-[13px] font-semibold text-rose-200">
                {ozet.exifliGorsel} {t.images}
              </p>
              <p className="text-[12px] text-rose-200/80">{t.imagesNote}</p>
            </div>
          )}
        </div>
      )}

      {ozet.kimlikVar && (
        <div className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5">
          <p className="text-[13px] font-semibold text-slate-200">{t.id}</p>
          <p className="text-[12px] text-slate-400">{t.idNote}</p>
        </div>
      )}

      <label className="mt-5 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={gorselleriTemizle}
          onChange={(e) => setGorselleriTemizle(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent"
        />
        <span className="text-sm text-slate-200">
          {t.cleanImages}
          <span className="block text-[12px] text-slate-400">{t.cleanImagesNote}</span>
        </span>
      </label>

      {!isSignedIn && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-medium text-violet-300/90">
          <Sparkles className="h-3.5 w-3.5" />
          {t.freeWithAccount}
        </p>
      )}

      {hata && <p className="mt-3 text-[13px] text-rose-300">{hata}</p>}

      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          onClick={() => {
            setBytes(null);
            setOzet(null);
          }}
          className="shrink-0 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-[13px] font-semibold text-slate-200"
        >
          {t.another}
        </button>
        <button
          type="button"
          onClick={() => void temizle()}
          disabled={calisiyor}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
        >
          {calisiyor ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSignedIn ? (
            <Eraser className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {calisiyor ? t.working : t.apply}
        </button>
      </div>

      {/* Kayıt duvarı — araç ücretsiz, yalnızca giriş ister. */}
      {kayitDuvari && !isSignedIn && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-4 sm:items-center"
          onClick={() => setKayitDuvari(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-violet-400/30 bg-[#0f1424] p-6 shadow-2xl"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 text-fuchsia-300 ring-1 ring-fuchsia-400/30">
              <Eraser className="h-7 w-7" />
            </div>
            <p className="mt-4 text-center text-lg font-bold text-white">{t.joinTitle}</p>
            <p className="mt-1 text-center text-[13px] leading-relaxed text-slate-400">{t.joinText}</p>
            <button
              type="button"
              onClick={() => {
                setKayitDuvari(false);
                onLogin?.();
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3.5 text-sm font-bold text-white transition hover:from-violet-500 hover:to-fuchsia-500"
            >
              <Sparkles className="h-4 w-4" />
              {t.joinCta}
            </button>
            <button
              type="button"
              onClick={() => setKayitDuvari(false)}
              className="mt-2 w-full rounded-2xl px-6 py-2.5 text-[13px] font-semibold text-slate-400 hover:text-slate-200"
            >
              {t.joinLater}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
