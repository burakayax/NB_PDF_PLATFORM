import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, HelpCircle, Lock, ShieldCheck, X } from "lucide-react";
import type { Language } from "../../i18n/landing";

/**
 * «Cihazında çalışır» / «Güvenli sunucuda» rozeti + yanıp sönen kırmızı «?» düğmesi.
 * «?» tıklanınca ne anlama geldiği kısa ve sade anlatılır (kimlik gibi hassas belge yüklerken
 * kullanıcının tereddüdünü gidermek için). Tüm araç başlıkları bu bileşeni kullanır.
 */
export function RunsWhereBadge({ onDevice, language, className = "" }: { onDevice: boolean; language: Language; className?: string }) {
  const tr = language === "tr";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const copy = onDevice
    ? {
        title: tr ? "«Cihazında çalışır» ne demek?" : "What does “Runs on your device” mean?",
        lead: tr
          ? "Dosyanız bu cihazdan dışarı çıkmaz. İşlem, tarayıcınızın içinde, sadece sizin telefonunuzda ya da bilgisayarınızda yapılır."
          : "Your file never leaves this device. The work is done inside your browser, on your own phone or computer only.",
        points: tr
          ? ["Dosyanın kendisi sunucumuza yüklenmez; biz görmeyiz.", "Kimlik, sözleşme, rapor gibi hassas belgeler için rahatça kullanabilirsiniz.", "Dosyanız yalnızca açık sayfada durur; sayfayı kapattığınızda silinir. (Dosyayı başka bir araca ya da girişe taşımak gibi sizin başlattığınız geçişlerde en fazla 30 dakika bekler, sonra silinir.)"]
          : ["The file itself is not uploaded to our servers; we never see it.", "Safe for sensitive documents such as IDs, contracts and reports.", "Your file only lives in the open page and is deleted when you close it. (If you move it to another tool or to sign-in, it waits at most 30 minutes and is then deleted.)"],
      }
    : {
        title: tr ? "«Güvenli sunucuda» ne demek?" : "What does “On our secure server” mean?",
        lead: tr
          ? "Bu işlem güçlü bir bilgisayar gerektirdiği için dosyanız şifreli bağlantıyla sunucumuza gönderilir ve orada işlenir."
          : "This task needs a powerful computer, so your file is sent over an encrypted connection to our server and processed there.",
        points: tr
          ? ["Aktarım şifrelidir; dosyanız yolda okunamaz.", "İşlem bittikten sonra dosyanız sunucudan silinir.", "Çok hassas bir belgeyse, «Cihazında çalışır» yazan araçları tercih edebilirsiniz."]
          : ["The transfer is encrypted; your file cannot be read on the way.", "Your file is deleted from the server after processing.", "For a very sensitive document, prefer tools marked “Runs on your device”."],
      };

  return (
    <>
      <span className={`inline-flex shrink-0 items-center gap-2 ${className}`}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold ${
            onDevice ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-sky-400/30 bg-sky-500/10 text-sky-300"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {onDevice ? (tr ? "Cihazında çalışır" : "Runs on your device") : tr ? "Güvenli sunucuda" : "On our secure server"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={tr ? "Bu ne demek? Açıklamayı oku" : "What does this mean? Read the explanation"}
          title={tr ? "Bu ne demek?" : "What does this mean?"}
          className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow ring-1 ring-red-300/50 hover:bg-red-400 motion-safe:animate-pulse"
        >
          <span className="absolute inset-0 rounded-full bg-red-500/60 motion-safe:animate-ping" aria-hidden />
          <HelpCircle className="relative h-4 w-4" strokeWidth={2.5} />
        </button>
      </span>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={copy.title} onClick={() => setOpen(false)}>
            <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
                    onDevice ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" : "bg-sky-500/15 text-sky-300 ring-sky-400/30"
                  }`}
                >
                  <Lock className="h-5 w-5" />
                </span>
                <p className="flex-1 pt-1 text-[16px] font-bold leading-snug text-white">{copy.title}</p>
                <button type="button" onClick={() => setOpen(false)} aria-label={tr ? "Kapat" : "Close"} className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-[14px] leading-relaxed text-slate-200">{copy.lead}</p>
              <ul className="space-y-2">
                {copy.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[13px] leading-snug text-slate-300">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${onDevice ? "text-emerald-400" : "text-sky-400"}`} />
                    {p}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] w-full rounded-xl bg-cyan-500 text-[14px] font-bold text-slate-950 hover:bg-cyan-400">
                {tr ? "Anladım" : "Got it"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
