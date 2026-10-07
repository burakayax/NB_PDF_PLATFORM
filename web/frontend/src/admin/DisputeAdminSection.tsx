import { useRef, useState } from "react";
import { downloadAdminDisputeFile, downloadAdminFinancialExport, verifyAdminOutputFile, type AdminOutputVerifyResult } from "../api/admin";
import { Katlanir } from "./analytics/AdminAnalytics";

const ts = (iso: string) => iso.slice(0, 19).replace("T", " ");

/**
 * İtiraz / anlaşmazlık araçları:
 *  • Müşterinin elindeki dosyanın parmak izini sunucu kayıtlarıyla karşılaştırır (dosya saklanmaz).
 *  • Bir kullanıcının ödeme, abonelik, kullanım ve indirme kayıtlarını tek belgede toplar
 *    (müşteri itirazı, tüketici hakem heyeti veya resmi kurum talebi için).
 */
export function DisputeAdminSection({ accessToken }: { accessToken: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [verify, setVerify] = useState<AdminOutputVerifyResult | null>(null);
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [err, setErr] = useState<string | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setErr(null);
    setVerify(null);
    try {
      setVerify(await verifyAdminOutputFile(accessToken, f));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Doğrulama yapılamadı.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDossier() {
    if (!who.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await downloadAdminDisputeFile(accessToken, who);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Dosya oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-50";

  return (
    <Katlanir baslik="İtiraz ve dosya doğrulama" aciklama="Müşteri “dosya bozuk / ücret iadesi” dediğinde veya resmi kurum belge istediğinde">
      <div className="mb-4 rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <p className="text-[12px] font-bold text-slate-200">Müşterinin dosyasını doğrula</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
          Müşterinin gönderdiği dosyayı yükleyin. Dosya SAKLANMAZ; yalnızca parmak izi (SHA-256) hesaplanıp sunucumuzdan çıkan çıktılarla
          karşılaştırılır. Eşleşirse dosya bizden çıktığı hâliyle duruyor demektir; eşleşmezse sonradan değiştirilmiş, bizden çıkmamış veya
          cihazda (tarayıcıda) işlenmiş olabilir.
        </p>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={`${btn} mt-3`}>
          {busy ? "Kontrol ediliyor…" : "Dosya seç ve doğrula"}
        </button>
        {verify && (
          <div className="mt-3 space-y-1 rounded-lg border border-white/[0.06] bg-black/30 p-3 text-[12px]">
            <p className={`font-bold ${verify.matched ? "text-emerald-300" : "text-amber-300"}`}>
              {verify.matched ? "EŞLEŞTİ" : "EŞLEŞME YOK"}
            </p>
            <p className="text-slate-300">{verify.explanation}</p>
            <p className="break-all font-mono text-[10.5px] text-slate-500">SHA-256: {verify.sha256}</p>
            {verify.records.map((r, i) => (
              <p key={i} className="text-slate-400">
                {r.userEmail} · {r.tool} · {ts(r.producedAt)} UTC{r.planAtTime ? ` · o günkü plan ${r.planAtTime}` : ""}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <p className="text-[12px] font-bold text-slate-200">İtiraz dosyası oluştur</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
          Kullanıcının e-postasını veya numarasını yazın. Ödemeler, abonelik, faturalar, işlem/indirme kayıtları, dosya parmak izleri ve
          onay tarihleri tek belgede indirilir. TC kimlik no, telefon ve kart bilgisi belgeye konmaz. Her indirme denetim kaydına yazılır.
          Resmi kurum talebinde belgeyi göndermeden önce avukatınıza gösterin.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="E-posta veya kullanıcı no"
            className="min-w-[220px] flex-1 rounded-xl border border-white/[0.1] bg-black/40 px-3 py-2 text-[12px] text-slate-100"
          />
          <button type="button" disabled={busy || !who.trim()} onClick={() => void onDossier()} className={btn}>
            Dosyayı indir
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <p className="text-[12px] font-bold text-slate-200">Muhasebe dökümü (yıllık)</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
          Seçilen yılın tüm ödeme ve fatura kayıtlarını (hesabını silen kullanıcıların arşivlenmiş kayıtları dahil) tek CSV dosyasında indirir.
          Veritabanı dışında da bir kopyanız olsun diye her yıl sonunda (tercihen her ay) indirip muhasebecinizle paylaşın veya kendi diskinize kaydedin.
          Kart bilgisi içermez.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            inputMode="numeric"
            className="w-24 rounded-xl border border-white/[0.1] bg-black/40 px-3 py-2 text-[12px] text-slate-100"
          />
          <button
            type="button"
            disabled={busy || year.length !== 4}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await downloadAdminFinancialExport(accessToken, Number(year));
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Döküm indirilemedi.");
              } finally {
                setBusy(false);
              }
            }}
            className={btn}
          >
            CSV indir
          </button>
        </div>
      </div>
      {err && <p className="mt-3 text-[12px] text-rose-300">{err}</p>}
    </Katlanir>
  );
}
