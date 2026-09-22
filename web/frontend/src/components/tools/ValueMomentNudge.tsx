import { useEffect, useRef, useState } from "react";
import { Sparkles, X, FileOutput, Minimize2, ScanSearch, CreditCard, Unlock, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { trackGAEvent } from "../../lib/analytics";
import { useCurrentPlan } from "../../lib/currentPlan";

/**
 * "Değer-anı" upsell kartı — kullanıcı ücretsiz bir işlemi BAŞARIYLA bitirdiğinde
 * (değer taze, tatmin yüksek → satın-alma niyeti zirvede) gösterilen PROAKTİF,
 * SOMUT kazanımlı davet. Amaç: misafiri ücretsiz kayda çevirmek (huni girişi).
 *
 * Neden somut? Client-side araçlar (birleştir/böl/kırp…) misafirde tam bedava —
 * kayıt için doğal duvar yok. O yüzden pitch "daha fazlası" gibi soyut DEĞİL; kaydın
 * GERÇEKTE açtığı, tarayıcının tek başına yapamadığı araçları isimle sayar.
 *
 * ⚠ VAAT = GERÇEK. Buradaki liste ÜCRETSİZ planın gerçekten açtığı araçlardır
 * (kaynak: web/api/src/modules/subscription/subscription.config.ts → FREE_TOOLS,
 * artı yalnızca giriş isteyen cihaz-içi OCR). Kart bir süre Word/Excel/PPT
 * dönüştürme ve yapay zekâ vaat ediyordu; ikisi de ücretsiz planda YOK (Word PLUS'tan
 * itibaren, yapay zekâ hakkı ücretsizde 0). Kaydolan kullanıcı vaadi bulamayınca
 * güven kaybediyordu. Ücretli araçlar artık ayrı ve açıkça "Pro ile" diye geçer.
 *
 * Kart YALNIZCA MİSAFİRE çıkar. Giriş yapmış kullanıcıya "ücretsiz hesap aç"
 * demek anlamsızdı; ücretsiz üyenin yükseltme daveti panelde ayrıca var.
 *
 * Nezaket: kapatılabilir; kapatınca 24 saat snooze (localStorage) → nag etmez. Sonuç
 * ekranında inline durur (popup/blocking DEĞİL). CTA gerçek link (/register) — SPA yükler.
 *
 * `source` → GA'da hangi araçtan dönüştüğünü ayırmak için (ör. "crop_success").
 */
const SNOOZE_KEY = "nb_value_nudge_snooze_until";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

function isSnoozed(): boolean {
  try {
    const v = parseInt(localStorage.getItem(SNOOZE_KEY) || "0", 10);
    return Number.isFinite(v) && Date.now() < v;
  } catch {
    return false;
  }
}

/**
 * ÜCRETSİZ hesabın gerçekten açtığı araçlar. `feature` alanı boş bir süs değildir:
 * `__tests__/signupPromise.test.ts` her birini ücretsiz planın araç listesine karşı
 * doğrular, böylece kart bir daha ücretli bir aracı ücretsiz diye vaat edemez.
 *
 * `aranabilir-pdf` ücretsiz plan listesinde YOKTUR ve olması da gerekmez: OCR
 * tamamen cihazda çalışır, sunucuya iş göndermez; yalnızca üye girişi ister.
 */
export const FREE_ACCOUNT_UNLOCKS: Array<{
  feature: string;
  icon: typeof FileOutput;
  tr: string;
  en: string;
}> = [
  { feature: "compress", icon: Minimize2, tr: "PDF'i sıkıştır", en: "Compress your PDF" },
  { feature: "aranabilir-pdf", icon: ScanSearch, tr: "OCR — aranabilir PDF", en: "OCR — searchable PDF" },
  { feature: "unlock-pdf", icon: Unlock, tr: "Şifreli PDF'in kilidini aç", en: "Unlock a password-protected PDF" },
  { feature: "pdf-to-text", icon: FileOutput, tr: "PDF'i düzenlenebilir metne çevir", en: "Turn a PDF into editable text" },
];

/** Cihazda çalışan, ücretsiz plan listesinde aranmayacak araçlar (yalnız giriş ister). */
export const SIGNIN_ONLY_UNLOCKS = new Set<string>(["aranabilir-pdf"]);

type Props = { language: Language; source?: string };

export function ValueMomentNudge({ language, source = "value_nudge" }: Props) {
  const tr = language === "tr";
  const planState = useCurrentPlan();
  const [hidden, setHidden] = useState(() => isSnoozed());

  // Yalnızca MİSAFİR görür. Giriş yapmış kullanıcıda `plan` doludur (ücretsizde
  // "FREE"); ona "ücretsiz hesap aç" demek yanlış ve rahatsız edici olur.
  const misafir = planState.plan === null && !planState.teamMember;
  const gosterilir = misafir && !hidden;

  /**
   * GÖSTERİM ÖLÇÜMÜ.
   *
   * Kart yalnızca TIKLAMAYI bildiriyordu. Tıklama tek başına işe yaramaz: kaç
   * kişiye gösterildiği bilinmeden "kimse görmüyor" ile "herkes görüyor ama
   * ilgilenmiyor" ayırt edilemez — ve bu ikisinin çözümü birbirinin zıddıdır
   * (biri gösterim mantığını, diğeri teklifin kendisini düzeltmeyi gerektirir).
   * Gösterim bir kez bildirilir; her yeniden çizimde değil.
   */
  const bildirildiRef = useRef(false);
  useEffect(() => {
    if (!gosterilir || bildirildiRef.current) return;
    bildirildiRef.current = true;
    trackGAEvent("sign_up_cta_shown", { source });
  }, [gosterilir, source]);

  if (!gosterilir) return null;

  const dismiss = () => {
    trackGAEvent("sign_up_cta_dismissed", { source });
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* private mode */
    }
    setHidden(true);
  };


  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/[0.12] via-violet-500/[0.08] to-fuchsia-500/[0.10] p-5 text-left">
      <button
        type="button"
        onClick={dismiss}
        aria-label={tr ? "Kapat" : "Dismiss"}
        className="absolute right-2.5 top-2.5 rounded-lg p-1 text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-300"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 pr-6">
          <p className="text-[15px] font-bold leading-tight text-white">
            {tr ? "Bu işlemi ücretsiz yaptın 🎉" : "You did this for free 🎉"}
          </p>
          <p className="text-[12.5px] leading-snug text-slate-400">
            {tr
              ? "PDF Platform bunları da yapar — ücretsiz hesapla başla:"
              : "PDF Platform can do more too — start with a free account:"}
          </p>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FREE_ACCOUNT_UNLOCKS.map((u) => {
          const Icon = u.icon;
          return (
            <div
              key={u.feature}
              className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2"
            >
              <Icon className="h-4 w-4 shrink-0 text-fuchsia-300" />
              <span className="text-[12.5px] font-medium text-slate-200">{tr ? u.tr : u.en}</span>
            </div>
          );
        })}
      </div>

      {/* Ücretli araçlar ücretsiz vaadin İÇİNE karıştırılmaz — ayrı satırda ve
          hangi planın açtığı yazılı. Kayıt olan kullanıcı bulamadığına kızmasın. */}
      <p className="mt-3 text-center text-[11.5px] leading-snug text-slate-400">
        {tr
          ? "Word · Excel · PPT'ye çevirme ve yapay zekâ araçları ücretli planlarda."
          : "Word · Excel · PPT conversion and the AI tools are on the paid plans."}
      </p>

      <a
        href="/register"
        onClick={() => trackGAEvent("sign_up_cta_click", { source })}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-5 py-3 text-[14px] font-bold text-white shadow-[0_14px_36px_-12px_rgba(124,58,237,0.7)] ring-1 ring-white/10 transition hover:from-indigo-500 hover:to-fuchsia-500"
      >
        <Zap className="h-4 w-4" />
        {tr ? "Ücretsiz hesap aç" : "Create free account"}
      </a>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11.5px] text-slate-400">
        <CreditCard className="h-3.5 w-3.5" />
        {tr ? "Kart gerekmez · 30 saniyede · dilediğin an iptal" : "No card · 30 seconds · cancel anytime"}
      </p>
    </div>
  );
}
