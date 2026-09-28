import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Route, User as UserIcon, Users } from "lucide-react";

import { saasFetch } from "../../api/saasHttp";
import { BolumBasligi, BosDurum, Huni, OlcuKarti } from "../analytics/AdminAnalytics";
import { eventToStoryLine, sourceLabel, TONE_CLASSES } from "./journeyNarrative";

/**
 * KULLANICI YOLCULUĞU — misafirin/üyenin oturumu boyunca ne yaptığını,
 * hiç kod bilmeyen birinin de anlayacağı bir "hikaye" olarak gösterir.
 *
 * VERİ KAYNAĞI: `UserJourneyEvent` (bkz. web/api .../analytics/analytics.service.ts
 * `recordJourneyEvent` — frontend'de `trackFunnelEvent`, lib/analytics.ts).
 * Yalnızca huniyle ilgili olaylar (üye-ol daveti, kota/ödeme duvarı, ödeme
 * adımları, kayıt) buraya yazılır; GA'ya giden diğer tüm olaylar DEĞİŞMEDİ.
 */

type SessionEvent = { name: string; toolId: string | null; extra: string | null; createdAt: string };

type Session = {
  sessionId: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  referrer: string | null;
  landingPath: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  events: SessionEvent[];
};

type SummaryPayload = {
  toolSuccessByTool: Array<{ toolId: string; count: number }>;
  signupPromptShown: number;
  signupPromptDismissed: number;
  signupPromptClicked: number;
  signupCompleted: number;
  paymentPromptShown: number;
  paymentAbandoned: number;
  purchaseCompleted: number;
};

const CARD = "rounded-2xl border border-white/[0.08] bg-white/[0.02]";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function SessionCard({ session }: { session: Session }) {
  const isGuest = !session.userId;
  const who = isGuest ? "Misafir" : (session.userName ?? session.userEmail ?? "Üye");
  const source = sourceLabel(session.referrer);

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full ${
              isGuest ? "bg-slate-500/20 text-slate-300" : "bg-cyan-500/20 text-cyan-300"
            }`}
          >
            {isGuest ? <Users className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
          </span>
          <div>
            <p className="text-[13px] font-bold text-white">{who}</p>
            <p className="text-[11px] text-slate-400">
              {source} geldi · {formatTime(session.firstSeenAt)}
            </p>
          </div>
        </div>
      </div>

      <ol className="mt-3 space-y-1.5 border-l border-white/[0.08] pl-3.5">
        {session.events.map((ev, i) => {
          const line = eventToStoryLine(ev);
          return (
            <li key={i} className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] ${TONE_CLASSES[line.tone]}`}>
              {line.text}
              <span className="ml-2 text-[10.5px] text-slate-400">{formatTime(ev.createdAt)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function UserJourneyTab({ accessToken }: { accessToken: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyGuests, setOnlyGuests] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessRes, sumRes] = await Promise.all([
        saasFetch(`/api/admin/journeys?days=30&limit=30${onlyGuests ? "&onlyGuests=true" : ""}`, {
          headers: { authorization: `Bearer ${accessToken}` },
        }),
        saasFetch("/api/admin/journeys/summary?days=30", {
          headers: { authorization: `Bearer ${accessToken}` },
        }),
      ]);
      if (!sessRes.ok) throw new Error(await sessRes.text());
      if (!sumRes.ok) throw new Error(await sumRes.text());
      const sessData = (await sessRes.json()) as { sessions: Session[]; nextCursor: string | null };
      setSessions(sessData.sessions);
      setNextCursor(sessData.nextCursor);
      setSummary((await sumRes.json()) as SummaryPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kullanıcı yolculuğu verisi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, onlyGuests]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await saasFetch(
        `/api/admin/journeys?days=30&limit=30&cursor=${encodeURIComponent(nextCursor)}${onlyGuests ? "&onlyGuests=true" : ""}`,
        { headers: { authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { sessions: Session[]; nextCursor: string | null };
      setSessions((prev) => [...prev, ...data.sessions]);
      setNextCursor(data.nextCursor);
    } catch {
      /* sessizce vazgeç — "daha fazla yükle" ikincil bir eylem */
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken, nextCursor, onlyGuests]);

  if (loading && sessions.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${CARD} mx-6 my-6 p-6 text-center`}>
        <AlertTriangle className="mx-auto h-6 w-6 text-amber-400" />
        <p className="mt-2 text-sm text-slate-300">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-3 text-sm text-cyan-300 underline">
          Yeniden dene
        </button>
      </div>
    );
  }

  const huniBasamaklar = summary
    ? [
        {
          ad: "Araç kullanıp başarılı oldu",
          deger: summary.signupPromptShown,
          aciklama: "Misafir bir aracı bitirdi, üye olma ekranı gösterildi.",
        },
        {
          ad: "Üye ol'a tıkladı",
          deger: summary.signupPromptClicked,
          oran: summary.signupPromptShown > 0 ? Math.round((summary.signupPromptClicked / summary.signupPromptShown) * 100) : 0,
          aciklama: "Ekranı kapatmak yerine kayda yöneldi.",
        },
        {
          ad: "Kaydı tamamladı",
          deger: summary.signupCompleted,
          oran: summary.signupPromptClicked > 0 ? Math.round((summary.signupCompleted / summary.signupPromptClicked) * 100) : 0,
          aciklama: "Üye oldu.",
        },
        {
          ad: "Satın aldı",
          deger: summary.purchaseCompleted,
          oran: summary.paymentPromptShown > 0 ? Math.round((summary.purchaseCompleted / summary.paymentPromptShown) * 100) : 0,
          aciklama: "Ödeme ekranından satın almaya geçti.",
        },
      ]
    : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">Kullanıcı Yolculuğu</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-300">
            Her kart bir ziyaretçinin (misafir ya da üye) oturumu — hangi araçtan geldi, hangi işlemi
            yaptı, üye-ol/ödeme ekranını gördükten sonra ne yaptı. En yeni oturum en üstte.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1.5 text-[12px] text-slate-300">
            <input
              type="checkbox"
              checked={onlyGuests}
              onChange={(e) => setOnlyGuests(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-transparent"
            />
            Sadece misafirler
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-2 text-[13px] text-slate-300 transition hover:bg-white/[0.05]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Yenile
          </button>
        </div>
      </div>

      <section>
        <BolumBasligi ustBaslik="Son 30 gün" baslik="Üye olma daveti" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OlcuKarti etiket="Ekran gösterildi" deger={summary?.signupPromptShown ?? 0} bosMetin="Henüz misafir araç bitirip daveti görmedi." />
          <OlcuKarti etiket="Kapatıldı" deger={summary?.signupPromptDismissed ?? 0} artisIyi={false} bosMetin="Henüz kapatan olmadı." />
          <OlcuKarti etiket="Üye ol'a tıklandı" deger={summary?.signupPromptClicked ?? 0} vurgu="basari" bosMetin="Henüz tıklayan olmadı." />
          <OlcuKarti etiket="Kayıt tamamlandı" deger={summary?.signupCompleted ?? 0} vurgu="basari" bosMetin="Henüz kayıt tamamlanmadı." />
        </div>
      </section>

      <section>
        <BolumBasligi ustBaslik="Son 30 gün" baslik="Ödeme ekranı" />
        <div className="grid gap-3 sm:grid-cols-3">
          <OlcuKarti etiket="Ekran gösterildi" deger={summary?.paymentPromptShown ?? 0} bosMetin="Henüz kimse kota/yükseltme duvarına çarpmadı." />
          <OlcuKarti etiket="Vazgeçildi" deger={summary?.paymentAbandoned ?? 0} artisIyi={false} bosMetin="Henüz vazgeçen olmadı." />
          <OlcuKarti etiket="Satın alındı" deger={summary?.purchaseCompleted ?? 0} vurgu="basari" bosMetin="Henüz satın alma yok." />
        </div>
      </section>

      {summary && summary.signupPromptShown > 0 && (
        <Huni
          basamaklar={huniBasamaklar}
          toplamOran={
            summary.signupPromptShown > 0 ? Math.round((summary.purchaseCompleted / summary.signupPromptShown) * 100) : 0
          }
        />
      )}

      {summary && summary.toolSuccessByTool.length > 0 && (
        <div className={CARD}>
          <div className="border-b border-white/[0.06] px-5 py-3">
            <p className="text-[13px] font-bold text-white">Misafirler en çok hangi araçta başarılı oldu?</p>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {summary.toolSuccessByTool.slice(0, 10).map((t) => (
              <div key={t.toolId} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                <span className="text-slate-200">{t.toolId}</span>
                <span className="font-bold tabular-nums text-white">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <section>
        <BolumBasligi ustBaslik="Akış" baslik="Oturum hikayeleri" />
        {sessions.length === 0 ? (
          <BosDurum metin="Henüz kayıtlı bir oturum yok. Misafirler siteyi kullanıp üye-ol ekranını gördükçe burada birikecek — genelde birkaç saat içinde ilk kayıtlar görünür." />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sessions.map((s) => (
                <SessionCard key={s.sessionId} session={s} />
              ))}
            </div>
            {nextCursor && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2 text-[13px] text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Route className="h-3.5 w-3.5" />}
                  Daha fazla yükle
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
