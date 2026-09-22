/**
 * GÜNLÜK HAK GÖSTERGESİ — duvara ÇARPMADAN ÖNCE görünür.
 *
 * NEDEN: Kullanıcı hakkının bittiğini ancak işi yarıda kesildiğinde öğreniyordu.
 * Ölçülmüş davranış şu: kullanım sayacı duvara varmadan görünürse kişi
 * yükseltmeyi PLANLAR; görünmezse iş bölünür ve o an alınan karar "sonra
 * bakarım" olur. Sayaç, kalan hak azaldıkça belirginleşir.
 *
 * TASARIM KURALI: Bu bir reklam değil, bir bilgi. Hak boldur → sessiz gri satır.
 * Son hakka inildi → uyarı rengi ve yükseltme bağlantısı. Hak bitti → ne
 * kaybedildiği ve ne zaman yenileneceği yazılır; kullanıcı kaybolmaz.
 */
import { useEffect, useRef } from "react";
import { AlertTriangle, Infinity as InfinityIcon, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { trackGAEvent } from "../../lib/analytics";

export type QuotaMeterProps = {
  language: Language;
  /** Bugün kullanılan işlem sayısı. */
  used: number;
  /** Günlük sınır; null ise sınırsız. */
  limit: number | null;
  /** Sınırın yenileneceği an (ISO). */
  resetAt?: string | null;
  /** Ücretli plana geçiş akışını açar. */
  onUpgrade?: () => void;
  /** Misafir kullanıcıya kayıt çağrısı gösterilir (ücretsiz plan daha geniş). */
  isGuest?: boolean;
  onRegister?: () => void;
  className?: string;
};

function yenilenmeMetni(resetAt: string | null | undefined, tr: boolean): string | null {
  if (!resetAt) return null;
  const t = new Date(resetAt);
  if (Number.isNaN(t.getTime())) return null;
  const kalanDk = Math.max(0, Math.round((t.getTime() - Date.now()) / 60000));
  if (kalanDk < 90) {
    return tr ? `${kalanDk} dakika içinde yenilenir` : `renews in ${kalanDk} minutes`;
  }
  const saat = Math.round(kalanDk / 60);
  return tr ? `${saat} saat içinde yenilenir` : `renews in ${saat} hours`;
}

export function QuotaMeter({
  language,
  used,
  limit,
  resetAt,
  onUpgrade,
  isGuest,
  onRegister,
  className = "",
}: QuotaMeterProps) {
  const tr = language === "tr";

  const sinirli = limit !== null;
  const kalan = sinirli ? Math.max(0, limit - used) : 0;
  const bitti = sinirli && kalan === 0;
  const azKaldi = sinirli && !bitti && kalan <= Math.max(1, Math.ceil(limit * 0.34));

  /**
   * ÖLÇÜM: "Kaç kişi duvara çarpıyor, kaçı yükseltmeye tıklıyor?" sorusunun
   * cevabı yoktu — dönüşüm tartışmaları bu yüzden tahmine dayanıyordu.
   * Durum oturumda BİR KEZ bildirilir (her yeniden çizimde değil), yoksa
   * sayılar şişer ve veri yanıltır.
   *
   * KANCA ERKEN DÖNÜŞÜN ÜSTÜNDE: React kancaları her çizimde aynı sırada
   * çalışmak zorundadır; plan sınırsıza geçtiğinde aşağıdaki erken dönüş
   * devreye girer ve kanca alttan çağrılsaydı sıra bozulurdu.
   */
  const bildirildiRef = useRef<string>("");
  useEffect(() => {
    const durum = bitti ? "wall" : azKaldi ? "warning" : "";
    if (!durum || bildirildiRef.current === durum) return;
    bildirildiRef.current = durum;
    trackGAEvent(durum === "wall" ? "quota_wall_hit" : "quota_warning_shown", {
      used,
      limit: limit ?? 0,
      is_guest: Boolean(isGuest),
    });
  }, [bitti, azKaldi, used, limit, isGuest]);

  // Sınırsız planda sayaç GÖSTERİLMEZ: bilgi taşımayan bir çubuk yalnızca
  // ekranı kalabalıklaştırır ve ödeyen kullanıcıya sınır varmış hissi verir.
  if (limit === null) {
    return (
      <p
        className={`flex items-center gap-1.5 text-[12px] font-medium text-emerald-300/80 ${className}`}
      >
        <InfinityIcon className="h-3.5 w-3.5" />
        {tr ? "Sınırsız işlem hakkın var" : "You have unlimited operations"}
      </p>
    );
  }

  const oran = limit > 0 ? Math.min(1, used / limit) : 0;
  const yenilenme = yenilenmeMetni(resetAt, tr);

  const renk = bitti
    ? "border-rose-400/30 bg-rose-500/[0.08]"
    : azKaldi
      ? "border-amber-400/30 bg-amber-500/[0.08]"
      : "border-white/[0.08] bg-white/[0.02]";
  const cubukRenk = bitti ? "bg-rose-400" : azKaldi ? "bg-amber-400" : "bg-cyan-400";

  return (
    <div className={`rounded-xl border px-3.5 py-2.5 ${renk} ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold text-slate-200">
          {bitti
            ? tr
              ? "Bugünkü hakkın doldu"
              : "You've used today's operations"
            : tr
              ? `Bugün ${used}/${limit} işlem kullanıldı`
              : `${used} of ${limit} operations used today`}
        </p>
        {(azKaldi || bitti) && (
          <button
            type="button"
            onClick={() => {
              trackGAEvent("upgrade_cta_clicked", {
                source: bitti ? "quota_wall" : "quota_warning",
                is_guest: Boolean(isGuest),
              });
              if (isGuest) onRegister?.();
              else onUpgrade?.();
            }}
            className="shrink-0 text-[12px] font-bold text-cyan-300 underline-offset-2 hover:underline"
          >
            {isGuest
              ? tr
                ? "Ücretsiz üye ol →"
                : "Create free account →"
              : tr
                ? "Sınırsıza geç →"
                : "Go unlimited →"}
          </button>
        )}
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all ${cubukRenk}`}
          style={{ width: `${Math.round(oran * 100)}%` }}
        />
      </div>

      {(azKaldi || bitti) && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          {bitti
            ? tr
              ? `Hakkın ${yenilenme ?? "gece yarısı yenilenir"}. Beklemek istemiyorsan ${
                  isGuest ? "ücretsiz üyelik günde 5 işlem verir" : "Pro'da işlem sınırı yoktur"
                }.`
              : `Your quota ${yenilenme ?? "renews at midnight"}. If you'd rather not wait, ${
                  isGuest ? "a free account gives you 5 a day" : "Pro removes the limit entirely"
                }.`
            : tr
              ? `Son ${kalan} hakkın kaldı${yenilenme ? ` · ${yenilenme}` : ""}.`
              : `${kalan} left${yenilenme ? ` · ${yenilenme}` : ""}.`}
        </p>
      )}
    </div>
  );
}

/**
 * Hak bittiğinde gösterilen KUTU — "limitine ulaştınız, yükseltin" demez.
 *
 * Ölçülmüş bulgu: sınır mesajını kısıt olarak kuran metinler ("limitiniz doldu,
 * yükseltin") en zayıf dönüşümü veriyor; kullanıcının O AN yapmaya çalıştığı işi
 * ve yükseltmenin ona ne KAZANDIRACAĞINI söyleyenler en iyisini. Bu yüzden
 * burada araç adı geçer ve kazanım somut yazılır.
 */
export function QuotaWall({
  language,
  toolLabel,
  resetAt,
  isGuest,
  onUpgrade,
  onRegister,
}: {
  language: Language;
  /** Kullanıcının o an yapmak istediği işin adı (ör. "PDF'i Word'e çevir"). */
  toolLabel?: string;
  resetAt?: string | null;
  isGuest?: boolean;
  onUpgrade?: () => void;
  onRegister?: () => void;
}) {
  const tr = language === "tr";
  const yenilenme = yenilenmeMetni(resetAt, tr);

  return (
    <div className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/[0.10] to-blue-500/[0.06] p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
          {isGuest ? <Zap className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-white">
            {toolLabel
              ? tr
                ? `«${toolLabel}» için bugünkü hakkın bitti`
                : `You've used today's runs for «${toolLabel}»`
              : tr
                ? "Bugünkü işlem hakkın bitti"
                : "You've used today's operations"}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">
            {isGuest
              ? tr
                ? "Ücretsiz üyelik günde 5 işlem veriyor ve taramalarını hesabında saklıyor — kart bilgisi istenmez, 30 saniye sürer."
                : "A free account gives you 5 operations a day and keeps your scans in your account — no card, 30 seconds."
              : tr
                ? "Pro'da günlük sınır yoktur: belgeleri arka arkaya işler, büyük dosyaları yükler ve toplu dönüştürme yaparsın."
                : "Pro has no daily cap: process documents back to back, upload larger files and convert in batches."}
          </p>
          {yenilenme && (
            <p className="mt-1 text-[12px] text-slate-400">
              {tr ? `Beklemek istersen hakkın ${yenilenme}.` : `If you'd rather wait, your quota ${yenilenme}.`}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              trackGAEvent("upgrade_cta_clicked", { source: "quota_wall_panel", is_guest: Boolean(isGuest) });
              if (isGuest) onRegister?.();
              else onUpgrade?.();
            }}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-blue-500"
          >
            {isGuest
              ? tr
                ? "Ücretsiz üye ol"
                : "Create a free account"
              : tr
                ? "Planları gör"
                : "See plans"}
          </button>
        </div>
      </div>
    </div>
  );
}
