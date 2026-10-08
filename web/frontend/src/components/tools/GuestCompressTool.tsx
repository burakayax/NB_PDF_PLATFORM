import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock, ShieldCheck, Sparkles, Trash2, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import {
  GuestCompressLimitError,
  downloadGuestCompress,
  getGuestCompressAllowance,
  getGuestCompressJob,
  startGuestCompress,
  type GuestCompressAllowance,
} from "../../api";
import { trackFunnelEvent, trackGAEvent } from "../../lib/analytics";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { useToolPageContext } from "../common/toolPageContext";

/**
 * MİSAFİR PDF SIKIŞTIR — üye olmayan ziyaretçiye günde 1 ücretsiz deneme.
 *
 * ÜRÜN KARARI (Ekim 2026): misafir 1 hak, ücretsiz üye 3 hak (günlük, sunucu araçları ortak),
 * paket satın alanlar planlarının dahilinde. Amaç DÖNÜŞÜM: ziyaretçi kayıt olmadan değeri bir
 * kez görsün, sonra üyeliğe geçsin. Bu yüzden:
 *   • hak hiç saklanmaz — yüklemeden ÖNCE "1 hakkın var, üyelikle 3" yazılır;
 *   • sonuç ekranında ve hak bitince somut, doğru bir üyelik daveti vardır;
 *   • sıkıştırma SUNUCUDA çalışır → gizlilik cümlesi buna göre dürüsttür (lib/onDeviceTools.ts).
 *
 * Kalite ile hedef boyut BİRLİKTE seçilemez (hedef seçilince kaliteyi araç belirler); arayüz bunu
 * "ya kaliteye göre ya hedef boyuta göre" diye ayırır — Görsel Sıkıştır ile aynı dil.
 */

/** Ücretsiz üyenin günlük hakkı. Kaynak: subscription.config.ts → FREE.dailyLimit (testle denetlenir). */
export const MEMBER_DAILY_OPS = 3;

type Mode = "quality" | "target";
type Quality = "auto" | "low" | "medium";
type Phase = "idle" | "running" | "done";

type Result = {
  blob: Blob;
  filename: string;
  inBytes: number;
  outBytes: number;
  targetKb: number;
  rasterized: boolean;
};

/** Hazır hedef boyutlar (KB) — çalışma alanındakiyle aynı seçenekler. */
const TARGETS_KB = [100, 200, 500, 1024, 2048, 5120, 10240];

function humanSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const L = {
  tr: {
    allowance: (n: number) => `Üye olmadan günde ${n} ücretsiz PDF sıkıştırma hakkın var`,
    allowanceMember: `Ücretsiz üyelikle günde ${MEMBER_DAILY_OPS} işlem`,
    free: "Ücretsiz üye ol",
    login: "Giriş yap",
    plans: "Paketlere bak",
    dropLabel: "PDF dosyanı buraya sürükle",
    dropNote: (mb: number) => `Tek PDF · ${mb} MB'a kadar · sunucuda işlenir, işlem sonrası silinir`,
    selected: "Seçilen dosya",
    remove: "Kaldır",
    howTitle: "Nasıl küçültelim?",
    byQuality: "Kaliteye göre",
    byTarget: "Hedef boyuta göre",
    qualityHint: "Kaliteyi sen seçersin, boyut ona göre çıkar.",
    targetHint:
      "Sınırın altına inen en yüksek kaliteyi arar. İnemezse bunu açıkça söyler; boyutu tutturmak için sessizce bozmaz. Hedef boyut seçiliyken kaliteyi araç kendisi belirler.",
    quality: "Kalite",
    qAuto: "Otomatik — görseller ekran çözünürlüğünde (önerilen)",
    qLow: "Agresif — en küçük dosya, görseller en çok küçülür",
    qMed: "Dengeli — görsellerde daha az bozulma",
    qualityMore: "Baskı çözünürlüğünü koruyan «Kaliteli» seçeneği üyelik planlarında.",
    target: "Hedef boyut",
    atMost: (kb: number) => `En fazla ${kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`}`,
    raster: "Hedefe inemezse sayfaları görüntüye çevir (yazı seçilemez ve aranamaz olur)",
    go: "PDF'i sıkıştır",
    working: "Sıkıştırılıyor…",
    tooBig: (mb: number) =>
      `Bu dosya ${mb} MB sınırını aşıyor. Üye olarak daha büyük dosyalar sıkıştırabilirsin.`,
    notPdf: "Lütfen bir PDF dosyası seç.",
    privacy: "Dosyan şifreli aktarılır, sunucuda işlenir ve işlem sonrası silinir.",
    gainTitle: (a: string, b: string, p: number) => `${a} → ${b} · %${p} küçüldü`,
    noGain: "Bu dosya zaten çok iyi sıkıştırılmış; boyutu anlamlı biçimde küçülmedi, orijinali kullanabilirsin.",
    targetMiss: (t: string, got: string) =>
      `Hedef olan ${t} altına inilemedi; ulaşılabilen en küçük sonuç ${got}. Görselleri daha fazla küçültmek için «Agresif» ya da sayfaları görüntüye çevirme seçeneğini deneyebilirsin.`,
    rasterNote: "Sayfalar görüntüye çevrildi: bu dosyada yazı artık seçilemez ve aranamaz.",
    usedUp: "Bugünkü misafir hakkını kullandın; yarın yenilenir.",
    gateTitle: "Bugünkü ücretsiz hakkını kullandın",
    gateBody: (n: number) =>
      `Üye olmadan günde ${n} PDF sıkıştırma hakkı var ve yarın yenilenir. Hemen devam etmek için ücretsiz üye ol: günde ${MEMBER_DAILY_OPS} işlem, kart gerekmez.`,
    capTitle: "Bugünkü misafir kapasitesi doldu",
    capBody: `Çok sayıda ziyaretçi aynı anda kullandı. Ücretsiz üye olursan beklemeden devam edebilirsin (günde ${MEMBER_DAILY_OPS} işlem), ya da yarın tekrar dene.`,
    inviteTitle: "Beğendin mi? Üye olunca günde 3 işlem seninle",
    inviteBody: `Ücretsiz üyelikle PDF sıkıştırma dahil günde ${MEMBER_DAILY_OPS} işlem, kart gerekmez. Paket alırsan daha yüksek günlük hak ve daha büyük dosyalar.`,
    deviceTitle: "Üyeliksiz, sınırsız ve cihazında",
    deviceBody: "Birleştir, böl, döndür gibi araçlar tarayıcında çalışır: dosyan sunucuya gitmez.",
    deviceLink: "PDF Birleştir",
    errGeneric: "Sıkıştırma başarısız oldu. Dosya parola korumalı veya bozuk olabilir; hakkın iade edildi.",
    badgeFree: "Üyelik gerekmez",
  },
  en: {
    allowance: (n: number) => `You get ${n} free PDF compression per day without an account`,
    allowanceMember: `${MEMBER_DAILY_OPS} a day with a free account`,
    free: "Create free account",
    login: "Sign in",
    plans: "See plans",
    dropLabel: "Drag your PDF here",
    dropNote: (mb: number) => `One PDF · up to ${mb} MB · processed on our server, deleted afterwards`,
    selected: "Selected file",
    remove: "Remove",
    howTitle: "How should we shrink it?",
    byQuality: "By quality",
    byTarget: "To a target size",
    qualityHint: "You pick the quality; the size follows from it.",
    targetHint:
      "Finds the highest quality that fits under the limit. If it cannot, it says so; it never quietly degrades the file to hit the number. While a target is set, the tool chooses the quality itself.",
    quality: "Quality",
    qAuto: "Auto — images at screen resolution (recommended)",
    qLow: "Aggressive — smallest file, images shrink most",
    qMed: "Balanced — less loss in images",
    qualityMore: "The print-resolution «Quality» level is part of the membership plans.",
    target: "Target size",
    atMost: (kb: number) => `At most ${kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`}`,
    raster: "If it cannot reach the target, turn pages into images (text becomes unselectable and unsearchable)",
    go: "Compress PDF",
    working: "Compressing…",
    tooBig: (mb: number) => `This file exceeds the ${mb} MB limit. Members can compress larger files.`,
    notPdf: "Please choose a PDF file.",
    privacy: "Your file is sent encrypted, processed on our server and deleted afterwards.",
    gainTitle: (a: string, b: string, p: number) => `${a} → ${b} · ${p}% smaller`,
    noGain: "This file is already well compressed; it did not shrink meaningfully, so you can keep the original.",
    targetMiss: (t: string, got: string) =>
      `Could not get under the ${t} target; the smallest result reachable is ${got}. Try «Aggressive» or the turn-pages-into-images option to shrink further.`,
    rasterNote: "Pages were turned into images: text in this file is no longer selectable or searchable.",
    usedUp: "You used today's guest allowance; it renews tomorrow.",
    gateTitle: "You used today's free allowance",
    gateBody: (n: number) =>
      `Without an account you get ${n} PDF compression per day, renewed tomorrow. To continue right away, create a free account: ${MEMBER_DAILY_OPS} a day, no card needed.`,
    capTitle: "Today's guest capacity is full",
    capBody: `Many visitors used it at once. A free account lets you continue right away (${MEMBER_DAILY_OPS} a day), or try again tomorrow.`,
    inviteTitle: "Liked it? A free account gives you 3 a day",
    inviteBody: `A free account includes PDF compression — ${MEMBER_DAILY_OPS} operations a day, no card. A paid plan adds a higher daily allowance and larger files.`,
    deviceTitle: "No account, unlimited, on your device",
    deviceBody: "Merge, split and rotate run in your browser: your file never reaches our server.",
    deviceLink: "Merge PDF",
    errGeneric: "Compression failed. The file may be password-protected or damaged; your allowance was refunded.",
    badgeFree: "No account needed",
  },
};

type Props = {
  language: Language;
  onRegister: () => void;
  onLogin: () => void;
};

export function GuestCompressTool({ language, onRegister, onLogin }: Props) {
  const tr = language === "tr";
  const t = L[tr ? "tr" : "en"];
  const { describesTool } = useToolPageContext();

  const [allowance, setAllowance] = useState<GuestCompressAllowance | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("quality");
  const [quality, setQuality] = useState<Quality>("auto");
  const [targetKb, setTargetKb] = useState(1024);
  const [raster, setRaster] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [gate, setGate] = useState<null | "daily_limit" | "capacity">(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    void getGuestCompressAllowance().then((a) => {
      if (aliveRef.current && a) setAllowance(a);
    });
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const maxMB = allowance?.maxMB ?? 20;
  const limit = allowance?.limit ?? 1;
  const exhausted = (allowance?.remaining ?? 1) <= 0;

  const pick = useCallback(
    (files: File[]) => {
      const f = files[0];
      if (!f) return;
      setError("");
      if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) {
        setError(t.notPdf);
        return;
      }
      if (f.size > maxMB * 1024 * 1024) {
        setError(t.tooBig(maxMB));
        return;
      }
      setFile(f);
    },
    [maxMB, t],
  );

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError("");
    setPhase("idle");
    setPercent(0);
    setMessage("");
    void getGuestCompressAllowance().then((a) => {
      if (aliveRef.current && a) setAllowance(a);
    });
  }, []);

  const run = useCallback(async () => {
    if (!file || phase === "running") return;
    setError("");
    setPhase("running");
    setPercent(0);
    setMessage("");
    trackGAEvent("guest_compress_started", { mode });
    try {
      const started = await startGuestCompress(file, {
        quality,
        targetKb: mode === "target" ? targetKb : 0,
        allowRasterize: mode === "target" && raster,
      });
      if (aliveRef.current) setAllowance(started.allowance);

      // İş sunucuda arka planda sürer; durumu aralıklı sorarız.
      const startedAt = Date.now();
      for (;;) {
        const job = await getGuestCompressJob(started.jobId, started.dl);
        if (!aliveRef.current) return;
        setPercent(job.percent);
        setMessage(job.message);
        if (job.status === "failed" || job.status === "cancelled") {
          throw new Error(job.error || t.errGeneric);
        }
        if (job.ready && job.result_id) {
          const blob = await downloadGuestCompress(job.result_id, started.dl);
          if (!aliveRef.current) return;
          const filename = job.filename || "sikistirilmis.pdf";
          const rasterized = /-g[öo]r[üu]nt[üu]\.pdf$/i.test(filename);
          setResult({
            blob,
            filename,
            inBytes: file.size,
            outBytes: blob.size,
            targetKb: mode === "target" ? targetKb : 0,
            rasterized,
          });
          setPhase("done");
          trackGAEvent("guest_compress_done", {
            saved_pct: Math.max(0, Math.round((1 - blob.size / file.size) * 100)),
            mode,
          });
          return;
        }
        if (Date.now() - startedAt > 10 * 60 * 1000) throw new Error(t.errGeneric);
        await new Promise((r) => setTimeout(r, 900));
      }
    } catch (e) {
      if (!aliveRef.current) return;
      setPhase("idle");
      if (e instanceof GuestCompressLimitError) {
        setGate(e.reason);
        if (e.allowance) setAllowance(e.allowance);
        // Admin "Kullanıcı Yolculuğu"nda: misafir günlük hakkına çarptı.
        trackFunnelEvent("quota_wall_hit", { source: "compress_guest", reason: e.reason });
        return;
      }
      setError(e instanceof Error ? e.message : t.errGeneric);
    }
  }, [file, phase, mode, quality, targetKb, raster, t]);

  // Sonuç ekranı gösterildi → davet GÖSTERİMİ ölçülür (tıklama tek başına yetmez).
  const inviteShownRef = useRef(false);
  useEffect(() => {
    if (phase === "done" && !inviteShownRef.current) {
      inviteShownRef.current = true;
      trackFunnelEvent("sign_up_cta_shown", { source: "compress_success" });
    }
  }, [phase]);

  const registerClick = (source: string) => {
    trackFunnelEvent("sign_up_cta_click", { source });
    onRegister();
  };

  // ── Hak bitti / kapasite doldu ─────────────────────────────────────────────
  if (gate || (exhausted && phase !== "done")) {
    const cap = gate === "capacity";
    return (
      <div className="tool-form">
        <div className="field field--full rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] p-5">
          <p className="flex items-center gap-2 text-[15px] font-bold text-white">
            <Lock className="h-4 w-4 text-amber-300" />
            {cap ? t.capTitle : t.gateTitle}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{cap ? t.capBody : t.gateBody(limit)}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => registerClick("compress_gate")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-5 py-2.5 text-[14px] font-bold text-white"
            >
              <Zap className="h-4 w-4" />
              {t.free}
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="rounded-xl border border-white/15 px-5 py-2.5 text-[14px] font-semibold text-slate-200 hover:border-white/30"
            >
              {t.login}
            </button>
          </div>
          <p className="mt-3 text-[12px] text-slate-400">
            <a href="/pricing" className="text-sky-300 underline-offset-2 hover:underline">
              {t.plans}
            </a>
          </p>
        </div>
        <DeviceToolsHint t={t} />
      </div>
    );
  }

  // ── Sonuç ────────────────────────────────────────────────────────────────
  if (phase === "done" && result) {
    const saved = result.inBytes > 0 ? Math.round((1 - result.outBytes / result.inBytes) * 100) : 0;
    const gained = result.outBytes < result.inBytes && saved >= 1;
    const targetBytes = result.targetKb * 1024;
    const missed = result.targetKb > 0 && result.outBytes > targetBytes;
    return (
      <ToolResultPanel
        blob={result.blob}
        filename={result.filename}
        language={language}
        subtitle={
          gained
            ? t.gainTitle(humanSize(result.inBytes), humanSize(result.outBytes), saved)
            : t.noGain
        }
        onClose={reset}
        ratingToolSlug="compress"
      >
        {missed ? (
          <p className="mt-2 text-[12.5px] text-amber-300/90">
            {t.targetMiss(humanSize(targetBytes), humanSize(result.outBytes))}
          </p>
        ) : null}
        {result.rasterized ? <p className="mt-2 text-[12.5px] text-amber-300/90">{t.rasterNote}</p> : null}

        <div className="mt-5 rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/[0.12] to-fuchsia-500/[0.06] p-4 text-left">
          <p className="flex items-center gap-2 text-[14px] font-bold text-white">
            <Sparkles className="h-4 w-4 text-indigo-300" />
            {t.inviteTitle}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-300">{t.inviteBody}</p>
          <p className="mt-1.5 text-[12px] text-slate-400">{t.usedUp}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => registerClick("compress_success")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2 text-[13.5px] font-bold text-white"
            >
              <Zap className="h-4 w-4" />
              {t.free}
            </button>
            <a href="/pricing" className="text-[12.5px] text-sky-300 underline-offset-2 hover:underline">
              {t.plans}
            </a>
          </div>
        </div>
        <DeviceToolsHint t={t} />
      </ToolResultPanel>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="tool-form">
        {/* Hak: yüklemeden ÖNCE açıkça yazılır — sürpriz yok, üyelik avantajı görünür. */}
        <div className="field field--full flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-2.5 text-[12.5px] text-emerald-100">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            {t.allowance(limit)}
          </span>
          <span className="text-emerald-200/80">· {t.allowanceMember}</span>
          <button
            type="button"
            onClick={() => registerClick("compress_banner")}
            className="font-semibold text-sky-300 underline-offset-2 hover:underline"
          >
            {t.free}
          </button>
        </div>

        <WorkspaceUploadField
          toolId="compress"
          language={language}
          accept="application/pdf,.pdf"
          disabled={phase === "running"}
          appendMode={!!file}
          label={t.dropLabel}
          note={t.dropNote(maxMB)}
          hideHeader={describesTool}
          onFiles={pick}
        />

        {file && (
          <>
            <div className="field field--full">
              <span>{t.selected}</span>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-100">{file.name}</p>
                  <p className="text-[11px] text-slate-400">{humanSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  disabled={phase === "running"}
                  onClick={() => setFile(null)}
                  aria-label={t.remove}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Ya kaliteye göre ya hedef boyuta göre: ikisi birlikte seçilemez. */}
            <div className="field field--full">
              <span>{t.howTitle}</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "quality" as Mode, label: t.byQuality },
                    { id: "target" as Mode, label: t.byTarget },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    aria-pressed={mode === m.id}
                    className={`rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition ${
                      mode === m.id
                        ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                        : "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <span className="field-hint">{mode === "target" ? t.targetHint : t.qualityHint}</span>
            </div>

            {mode === "quality" ? (
              <label className="field field--full">
                <span>{t.quality}</span>
                <select value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
                  <option value="auto">{t.qAuto}</option>
                  <option value="low">{t.qLow}</option>
                  <option value="medium">{t.qMed}</option>
                </select>
                <span className="field-hint">{t.qualityMore}</span>
              </label>
            ) : (
              <>
                <label className="field field--full">
                  <span>{t.target}</span>
                  <select value={targetKb} onChange={(e) => setTargetKb(Number(e.target.value))}>
                    {TARGETS_KB.map((kb) => (
                      <option key={kb} value={kb}>
                        {t.atMost(kb)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field field--full field--checkbox">
                  <input type="checkbox" checked={raster} onChange={(e) => setRaster(e.target.checked)} />
                  <span>{t.raster}</span>
                </label>
              </>
            )}
          </>
        )}

        {error && (
          <p className="field--full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">
            {error}
          </p>
        )}

        {phase === "running" && (
          <div className="field field--full" role="status" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-[width] duration-500"
                style={{ width: `${Math.max(6, percent)}%` }}
              />
            </div>
            <span className="field-hint">{message || t.working}</span>
          </div>
        )}

        <button
          type="button"
          className="primary-action"
          onClick={() => void run()}
          disabled={phase === "running" || !file}
        >
          {phase === "running" ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.working}
            </span>
          ) : (
            t.go
          )}
        </button>
        <p className="field--full mt-1 text-center text-[11.5px] text-slate-400">{t.privacy}</p>
      </div>
    </div>
  );
}

/** Cihazda çalışan araçlara dürüst bir yönlendirme: üyeliksiz, sınırsız (kaynak: lib/onDeviceTools.ts). */
function DeviceToolsHint({ t }: { t: (typeof L)["tr"] | (typeof L)["en"] }) {
  return (
    <p className="mt-4 text-[12px] leading-relaxed text-slate-400">
      <span className="font-semibold text-slate-300">{t.deviceTitle}:</span> {t.deviceBody}{" "}
      <a href="/tools/merge-pdf" className="text-sky-300 underline-offset-2 hover:underline">
        {t.deviceLink}
      </a>
    </p>
  );
}
