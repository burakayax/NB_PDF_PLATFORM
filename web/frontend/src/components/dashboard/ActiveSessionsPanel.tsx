/**
 * AÇIK OTURUMLAR — "hesabım nerelerde açık?"
 *
 * Kullanıcı, hesabının hangi cihazlarda açık olduğunu görür ve istediğini
 * uzaktan kapatabilir. İki işe yarar:
 *   1) Şifresi başkasının eline geçtiyse kullanıcı kendini kurtarabilir.
 *   2) Hesabını paylaşan kişi de durumu görür; sınır ve görünürlük birlikte
 *      paylaşımı caydırır (yalnız "tek oturum" kuralı dürüst kullanıcıyı
 *      cezalandırıyordu: telefon ve bilgisayar birbirini atıyordu).
 */
import { useCallback, useEffect, useState } from "react";
import { Laptop, Loader2, LogOut, Monitor, Smartphone } from "lucide-react";
import type { Language } from "../../i18n/landing";
import {
  fetchAktifOturumlar,
  kapatAktifOturum,
  kapatDigerOturumlar,
  type AktifOturum,
} from "../../api/auth";

type Props = { accessToken: string; language: Language };

function cihazSimgesi(cihaz: string, masaustu: boolean) {
  if (masaustu) return Monitor;
  if (/iPhone|Android telefon|iPad/i.test(cihaz)) return Smartphone;
  return Laptop;
}

function zamanMetni(iso: string, tr: boolean): string {
  const fark = Date.now() - new Date(iso).getTime();
  const dk = Math.floor(fark / 60000);
  if (dk < 2) return tr ? "şu anda" : "just now";
  if (dk < 60) return tr ? `${dk} dakika önce` : `${dk} minutes ago`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return tr ? `${sa} saat önce` : `${sa} hours ago`;
  const gun = Math.floor(sa / 24);
  return tr ? `${gun} gün önce` : `${gun} days ago`;
}

export function ActiveSessionsPanel({ accessToken, language }: Props) {
  const tr = language === "tr";
  const [oturumlar, setOturumlar] = useState<AktifOturum[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [islemdeki, setIslemdeki] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      setOturumlar(await fetchAktifOturumlar(accessToken));
      setHata(null);
    } catch {
      setHata(tr ? "Açık oturumlar getirilemedi." : "Sessions could not be loaded.");
    }
  }, [accessToken, tr]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const kapat = async (id: string) => {
    setIslemdeki(id);
    try {
      await kapatAktifOturum(accessToken, id);
      await yukle();
    } catch {
      setHata(tr ? "Oturum kapatılamadı." : "Session could not be closed.");
    } finally {
      setIslemdeki(null);
    }
  };

  const digerleriniKapat = async () => {
    setIslemdeki("hepsi");
    try {
      await kapatDigerOturumlar(accessToken);
      await yukle();
    } catch {
      setHata(tr ? "Oturumlar kapatılamadı." : "Sessions could not be closed.");
    } finally {
      setIslemdeki(null);
    }
  };

  const digerSayisi = (oturumlar ?? []).filter((o) => !o.suAnki).length;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-nb-panel/50 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {tr ? "GÜVENLİK" : "SECURITY"}
      </p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-nb-text">
        {tr ? "Açık oturumlar" : "Active sessions"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        {tr
          ? "Hesabın şu anda bu cihazlarda açık. Tanımadığın bir cihaz görürsen kapat ve şifreni değiştir. Bir hesap en fazla 4 cihazda açık kalabilir; sınır dolunca en eski oturum kendiliğinden kapanır."
          : "Your account is currently open on these devices. If you see one you don't recognise, close it and change your password. An account can stay open on up to 4 devices; the oldest session closes automatically when the limit is reached."}
      </p>

      {hata && (
        <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-2.5 text-[13px] text-amber-200">
          {hata}
        </p>
      )}

      {oturumlar === null ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr ? "Yükleniyor…" : "Loading…"}
        </div>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {oturumlar.map((o) => {
            const Simge = cihazSimgesi(o.cihaz, o.masaustu);
            return (
              <li
                key={o.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-nb-panel/70 px-4 py-3"
              >
                <Simge className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-nb-text">
                    {o.cihaz}
                    {o.suAnki && (
                      <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        {tr ? "bu cihaz" : "this device"}
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-slate-400">
                    {tr ? "Son kullanım: " : "Last used: "}
                    {zamanMetni(o.sonKullanim, tr)}
                  </p>
                </div>
                {!o.suAnki && (
                  <button
                    type="button"
                    onClick={() => void kapat(o.id)}
                    disabled={islemdeki !== null}
                    className="nb-transition shrink-0 rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] font-semibold text-slate-300 hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50"
                  >
                    {islemdeki === o.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      tr ? "Çıkış yap" : "Sign out"
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {digerSayisi > 0 && (
        <button
          type="button"
          onClick={() => void digerleriniKapat()}
          disabled={islemdeki !== null}
          className="nb-transition mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-nb-panel/70 px-5 py-2.5 text-sm font-semibold text-nb-text hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50"
        >
          {islemdeki === "hepsi" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {tr ? "Diğer tüm cihazlardan çık" : "Sign out of all other devices"}
        </button>
      )}
    </section>
  );
}
