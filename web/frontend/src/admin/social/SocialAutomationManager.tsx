import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Inbox,
  Loader2,
  Radio,
  RefreshCw,
  Rss,
  Send,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import {
  checkSocialFeed,
  deleteSocialPost,
  disconnectSocialAccount,
  fetchSocialOverview,
  fetchSocialPosts,
  publishSocialPost,
  queueSocialPosts,
  saveSocialAccount,
  saveSocialConfig,
  updateSocialPostBody,
  type SocialConfig,
  type SocialOverview,
  type SocialPlatformId,
  type SocialPostRow,
} from "../../api/admin";
import { AccountConnectCard } from "./AccountConnectCard";
import { PostPreviewCard } from "./PostPreviewCard";
import { PlatformBadge } from "./platformBrand";

/**
 * Sosyal medya otomasyonu paneli.
 *
 * Ekran üç soruya sırayla yanıt verecek şekilde kurgulandı:
 *   1. Şu an ne oluyor?      → durum başlığı + sonraki paylaşıma geri sayım
 *   2. Ne paylaşılacak?      → gönderi akışı (yayına gideceği biçimde önizleme)
 *   3. Nasıl ayarlanır?      → hesaplar ve zamanlama sekmeleri
 */

type TabId = "flow" | "accounts" | "schedule";

const TABS: { id: TabId; label: string }[] = [
  { id: "flow", label: "Gönderi akışı" },
  { id: "accounts", label: "Hesaplar" },
  { id: "schedule", label: "Zamanlama" },
];

const TIME_ZONES = [
  { id: "Europe/Istanbul", label: "İstanbul (TSİ)" },
  { id: "Europe/London", label: "Londra" },
  { id: "Europe/Berlin", label: "Berlin" },
  { id: "America/New_York", label: "New York" },
  { id: "UTC", label: "UTC" },
];

const ghostButton =
  "inline-flex h-9 items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/50 px-3.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-40";

const primaryButton =
  "inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-600 px-4 text-xs font-semibold text-white shadow-lg shadow-cyan-950/40 transition hover:bg-cyan-500 disabled:opacity-40";

const selectClass =
  "w-full rounded-xl border border-slate-700/60 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/15";

function two(n: number): string {
  return String(n).padStart(2, "0");
}

/** "3 saat 12 dakika" gibi okunur bir kalan süre. */
function humanizeUntil(target: number, now: number): string {
  const diff = Math.max(0, target - now);
  const totalMinutes = Math.floor(diff / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} gün ${hours} saat`;
  if (hours > 0) return `${hours} saat ${minutes} dakika`;
  if (minutes > 0) return `${minutes} dakika`;
  return "birazdan";
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  tone: "slate" | "amber" | "emerald" | "rose";
}) {
  const tones = {
    slate: "text-slate-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    rose: "text-rose-300",
  } as const;
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${value === 0 ? "text-slate-600" : tones[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-700/50 bg-slate-800/25 p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {description ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/20 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-800/60">
        <Icon className="h-5 w-5 text-slate-500" />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SocialAutomationManager({ accessToken }: { accessToken: string }) {
  const [overview, setOverview] = useState<SocialOverview | null>(null);
  const [posts, setPosts] = useState<SocialPostRow[]>([]);
  const [tab, setTab] = useState<TabId>("flow");
  const [busy, setBusy] = useState(false);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Geri sayım canlı kalsın; dakika hassasiyeti yettiği için 30 saniyede bir.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [data, postList] = await Promise.all([
        fetchSocialOverview(accessToken),
        fetchSocialPosts(accessToken),
      ]);
      setOverview(data);
      setPosts(postList.posts);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Panel yüklenemedi");
    }
  }, [accessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(job: () => Promise<void>, okNote?: string) {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      await job();
      if (okNote) setNote(okNote);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem tamamlanamadı");
    } finally {
      setBusy(false);
      setBusyPostId(null);
    }
  }

  function patchConfig(patch: Partial<SocialConfig>) {
    void run(async () => {
      await saveSocialConfig(accessToken, patch);
      await refresh();
    });
  }

  const config = overview?.config ?? null;
  const specByPlatform = useMemo(
    () => new Map((overview?.platforms ?? []).map((p) => [p.platform, p])),
    [overview?.platforms],
  );
  const accountByPlatform = useMemo(
    () => new Map((overview?.accounts ?? []).map((a) => [a.platform, a])),
    [overview?.accounts],
  );

  const livePlatforms = (overview?.accounts ?? []).filter((a) => a.connected && a.enabled);
  const pendingPosts = posts.filter((p) => p.status === "DRAFT" || p.status === "QUEUED" || p.status === "FAILED");
  const historyPosts = posts.filter((p) => p.status === "PUBLISHED" || p.status === "SKIPPED" || p.status === "PUBLISHING");

  if (!overview || !config) {
    return (
      <div className="space-y-4">
        {err ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{err}</p>
        ) : null}
        <div className="h-36 animate-pulse rounded-3xl border border-slate-700/40 bg-slate-800/30" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-700/40 bg-slate-800/20" />
          ))}
        </div>
      </div>
    );
  }

  const nextRun = overview.nextRunAt ? new Date(overview.nextRunAt).getTime() : null;

  return (
    <div className="space-y-5">
      {/* ── Durum başlığı ─────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl border border-slate-700/50 p-6"
        style={{
          background:
            "radial-gradient(120% 140% at 88% 0%, rgba(6,182,212,0.16), transparent 58%), linear-gradient(140deg, rgba(15,23,42,0.85), rgba(2,6,23,0.9))",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  config.enabled ? "bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.5)]" : "bg-slate-600"
                }`}
              />
              <span className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
                {config.enabled ? "Otomasyon çalışıyor" : "Otomasyon duraklatıldı"}
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-semibold text-white">
              {config.enabled && nextRun
                ? `Sonraki paylaşım ${humanizeUntil(nextRun, now)} içinde`
                : "Günlük paylaşım kapalı"}
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              {config.enabled && nextRun
                ? `${new Date(nextRun).toLocaleString("tr-TR", { weekday: "long", hour: "2-digit", minute: "2-digit" })} · ${
                    livePlatforms.length
                  } hesapta yayınlanacak`
                : "Açtığında site beslemendeki yeni yazı her gün seçtiğin saatte paylaşılır."}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {livePlatforms.length > 0 ? (
                livePlatforms.map((a) => (
                  <span
                    key={a.platform}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-900/60 py-1 pr-3 pl-1"
                  >
                    <PlatformBadge platform={a.platform} size={20} />
                    <span className="text-[11px] text-slate-300">{a.label}</span>
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-200">
                  <TriangleAlert className="h-3 w-3" />
                  Henüz bağlı hesap yok
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={config.enabled}
              aria-label="Otomatik paylaşım"
              disabled={busy}
              onClick={() => patchConfig({ enabled: !config.enabled })}
              className={`relative h-8 w-14 shrink-0 rounded-full border transition disabled:opacity-50 ${
                config.enabled ? "border-emerald-400/40 bg-emerald-500" : "border-slate-600/60 bg-slate-800"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  config.enabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-[11px] text-slate-500">
              Her gün {two(config.hour)}:{two(config.minute)}
            </span>
          </div>
        </div>
      </section>

      {/* ── Sayaçlar ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={FileText} label="Onay bekleyen" value={overview.stats.draft} tone="amber" />
        <StatTile icon={CalendarClock} label="Sırada" value={overview.stats.queued} tone="slate" />
        <StatTile icon={CheckCircle2} label="Paylaşılan" value={overview.stats.published} tone="emerald" />
        <StatTile icon={TriangleAlert} label="Başarısız" value={overview.stats.failed} tone="rose" />
      </div>

      {/* ── Bildirimler ───────────────────────────────────────────────────── */}
      {err ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{err}</p>
      ) : null}
      {note ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {note}
        </p>
      ) : null}

      {/* ── Sekmeler ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-700/60 bg-slate-900/50 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                tab === t.id ? "bg-slate-700/70 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
              {t.id === "flow" && pendingPosts.length > 0 ? (
                // Sayaç rozeti soluk tutuluyor: aktif sekme vurgusuyla
                // yarışırsa hangi sekmede olduğun okunmaz hâle geliyor.
                <span
                  className={`ml-1.5 rounded px-1.5 py-px text-[10px] ${
                    tab === "flow" ? "bg-white/10 text-white" : "bg-slate-700/50 text-slate-400"
                  }`}
                >
                  {pendingPosts.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryButton}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await queueSocialPosts(accessToken);
                await refresh();
                setTab("flow");
                setNote(
                  r.queued.length > 0
                    ? `${r.queued.length} gönderi hazırlandı. Okuyup onaylayana kadar hiçbir yere gitmez.`
                    : `Gönderi hazırlanmadı — ${r.skipped[0]?.reason ?? "uygun içerik bulunamadı"}.`,
                );
              })
            }
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Taslak hazırla
          </button>
          <button type="button" className={ghostButton} disabled={busy} onClick={() => void run(refresh)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Yenile
          </button>
        </div>
      </div>

      {/* ── Gönderi akışı ─────────────────────────────────────────────────── */}
      {tab === "flow" ? (
        <div className="space-y-5">
          {pendingPosts.length === 0 && historyPosts.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Henüz gönderi yok"
              description="“Taslak hazırla” dediğinde site beslemendeki en yeni yazı için her ağa uygun metinler yazılır. Onaylamadan hiçbir şey yayınlanmaz."
              action={
                <button
                  type="button"
                  className={primaryButton}
                  disabled={busy || livePlatforms.length === 0}
                  onClick={() =>
                    void run(async () => {
                      const r = await queueSocialPosts(accessToken);
                      await refresh();
                      setNote(
                        r.queued.length > 0
                          ? `${r.queued.length} gönderi hazırlandı.`
                          : `Gönderi hazırlanmadı — ${r.skipped[0]?.reason ?? "uygun içerik bulunamadı"}.`,
                      );
                    })
                  }
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {livePlatforms.length === 0 ? "Önce bir hesap bağla" : "İlk taslağı hazırla"}
                </button>
              }
            />
          ) : null}

          {pendingPosts.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Yayın bekleyenler</h3>
                <span className="text-[11px] text-slate-500">{pendingPosts.length} gönderi</span>
              </div>
              {pendingPosts.map((post) => (
                <PostPreviewCard
                  // Sunucudan yeni içerik gelince kart sıfırdan kurulur:
                  // düzenleme taslağını efektle senkronlamaya gerek kalmaz.
                  key={`${post.id}:${post.updatedAt}`}
                  post={post}
                  spec={specByPlatform.get(post.platform)}
                  busyId={busyPostId}
                  onPublish={(id) => {
                    setBusyPostId(id);
                    void run(async () => {
                      await publishSocialPost(accessToken, id);
                      await refresh();
                    }, "Gönderi yayınlandı.");
                  }}
                  onDelete={(id) => {
                    setBusyPostId(id);
                    void run(async () => {
                      await deleteSocialPost(accessToken, id);
                      await refresh();
                    });
                  }}
                  onSaveBody={(id, body) => {
                    setBusyPostId(id);
                    void run(async () => {
                      await updateSocialPostBody(accessToken, id, body);
                      await refresh();
                    }, "Metin kaydedildi.");
                  }}
                />
              ))}
            </div>
          ) : null}

          {historyPosts.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Geçmiş</h3>
              {historyPosts.slice(0, 20).map((post) => (
                <PostPreviewCard
                  // Sunucudan yeni içerik gelince kart sıfırdan kurulur:
                  // düzenleme taslağını efektle senkronlamaya gerek kalmaz.
                  key={`${post.id}:${post.updatedAt}`}
                  post={post}
                  spec={specByPlatform.get(post.platform)}
                  busyId={busyPostId}
                  onPublish={() => undefined}
                  onDelete={() => undefined}
                  onSaveBody={() => undefined}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Hesaplar ──────────────────────────────────────────────────────── */}
      {tab === "accounts" ? (
        <div className="space-y-3">
          <p className="rounded-xl border border-slate-700/50 bg-slate-800/25 px-4 py-3 text-xs leading-relaxed text-slate-400">
            Her ağın erişim anahtarını kendi geliştirici panelinden alıp buraya yapıştır. Anahtarlar şifrelenerek
            saklanır, bir daha ekranda gösterilmez ve kayıtlara yazılmaz.
          </p>
          {overview.platforms.map((spec) => (
            <AccountConnectCard
              key={spec.platform}
              spec={spec}
              account={accountByPlatform.get(spec.platform)}
              busy={busy}
              onSave={(platform: SocialPlatformId, secrets, enabled) =>
                void run(async () => {
                  await saveSocialAccount(accessToken, { platform, secrets, enabled });
                  await refresh();
                }, "Hesap güncellendi.")
              }
              onDisconnect={(platform: SocialPlatformId) =>
                void run(async () => {
                  await disconnectSocialAccount(accessToken, platform);
                  await refresh();
                }, "Bağlantı kaldırıldı.")
              }
            />
          ))}
        </div>
      ) : null}

      {/* ── Zamanlama ─────────────────────────────────────────────────────── */}
      {tab === "schedule" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Günlük paylaşım saati"
            description="Seçtiğin saat dilimine göre hesaplanır; sunucu başka bir bölgede çalışsa bile yayın bu saatte olur."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-300">Saat</span>
                <select
                  className={`${selectClass} mt-1.5`}
                  value={config.hour}
                  onChange={(e) => patchConfig({ hour: Number(e.target.value) })}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {two(h)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-300">Dakika</span>
                <select
                  className={`${selectClass} mt-1.5`}
                  value={config.minute}
                  onChange={(e) => patchConfig({ minute: Number(e.target.value) })}
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m}>
                      {two(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-300">Saat dilimi</span>
                <select
                  className={`${selectClass} mt-1.5`}
                  value={config.timeZone}
                  onChange={(e) => patchConfig({ timeZone: e.target.value })}
                >
                  {TIME_ZONES.map((tz) => (
                    <option key={tz.id} value={tz.id}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 accent-cyan-500"
                checked={config.recycleOldPosts}
                onChange={(e) => patchConfig({ recycleOldPosts: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-slate-200">
                  Yeni yazı yoksa eski yazıları tekrar gündeme getir
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Kapalıyken yeni içerik üretmediğin günlerde hesaplar sessiz kalır.
                </span>
              </span>
            </label>
          </SectionCard>

          <SectionCard
            title="İçerik kaynağı"
            description="Paylaşımlar sitenin kendi blog beslemesinden üretilir. Yeni yazı yayınladığında otomatik olarak sıraya girer."
          >
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Besleme dili</span>
              <select
                className={`${selectClass} mt-1.5`}
                value={config.lang}
                onChange={(e) => patchConfig({ lang: e.target.value === "en" ? "en" : "tr" })}
              >
                <option value="tr">Türkçe</option>
                <option value="en">İngilizce</option>
              </select>
            </label>

            <div className="flex items-center gap-2.5 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3.5 py-3">
              <Rss className="h-4 w-4 shrink-0 text-amber-400/80" />
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-400">{overview.feedUrl}</code>
            </div>

            <button
              type="button"
              className={ghostButton}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await checkSocialFeed(accessToken);
                  setNote(
                    r.count > 0
                      ? `Besleme okundu: ${r.count} yazı bulundu. En yenisi “${r.latest[0]?.title ?? ""}”.`
                      : "Beslemede paylaşılacak yazı bulunamadı.",
                  );
                })
              }
            >
              <Radio className="h-3.5 w-3.5" />
              Beslemeyi sına
            </button>

            <p className="flex items-start gap-2 rounded-xl border border-slate-700/50 bg-slate-900/30 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
              <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
              <span>
                Metin her zaman gönderinin yazı alanına, görsel ise ayrı bir ek olarak gider. Yazı görselin içine
                gömülmez — bağlantı tıklanabilir kalır, metin aramalarda görünür.
              </span>
            </p>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
