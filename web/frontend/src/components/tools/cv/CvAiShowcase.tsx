import { ArrowDown, MessageCircleQuestion, Sparkles } from "lucide-react";

/**
 * Yapay zekânın ne yaptığını, hak harcamadan ve satın alma çağrısı yapmadan GÖSTEREN örnek.
 * Örnekler, aracın gerçek çıktılarından alınmıştır (kurgusal bir kişi için); kendi CV'nizde çalıştırmak 1 hak harcar.
 */
export function CvAiShowcase({ tr }: { tr: boolean }) {
  const before = "text-[12.5px] text-slate-400 line-through decoration-slate-600";
  const after = "text-[13px] font-semibold text-white";
  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-500/50 via-violet-500/40 to-amber-400/50 p-px">
      <div className="rounded-[15px] bg-slate-950/95 p-4">
        <p className="flex items-center gap-2 text-[14px] font-black text-white"><Sparkles className="h-4 w-4 text-amber-300" />{tr ? "Yapay zekâ cümlelerinizi böyle güçlendirir" : "This is how AI strengthens your sentences"}</p>
        <p className="mt-0.5 text-[12px] text-slate-400">{tr ? "Gerçek bir örnek (kurgusal kişi). Kendi CV'nizde denemek 1 hak harcar." : "A real example (fictional person). Trying it on your own CV uses 1 credit."}</p>

        <div className="mt-3 space-y-2.5">
          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className={before}>{tr ? "müşterilere bakardım" : "i looked after customers"}</p>
            <ArrowDown className="my-1 h-3.5 w-3.5 text-fuchsia-300" />
            <p className={after}>{tr ? "Kasada müşterilere hizmet verdim." : "Served customers at the checkout."}</p>
          </div>

          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className={before}>{tr ? "Teklif hazırlama ve fiyat görüşmelerini yürüttüm" : "Prepared quotes and handled price talks"}</p>
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-sky-500/[0.08] px-2.5 py-2 text-[12px] text-sky-200 ring-1 ring-sky-400/20"><MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0" />{tr ? "Yapay zekâ sorar: “Ayda kaç teklif hazırladınız, kaçı satışa döndü?”" : "AI asks: “How many quotes a month, and how many became sales?”"}</p>
            <p className="mt-1.5 text-[12px] text-slate-300">{tr ? <>Siz yazarsınız: <i>“ayda yaklaşık 40, 12’si satışa döndü”</i></> : <>You answer: <i>“about 40 a month, 12 became sales”</i></>}</p>
            <ArrowDown className="my-1 h-3.5 w-3.5 text-fuchsia-300" />
            <p className={after}>{tr ? "Teklif hazırlama ve fiyat görüşmelerini yürüttüm; ayda yaklaşık 40 teklif hazırlayarak bunların 12'sini satışa dönüştürdüm." : "Prepared quotes and handled price talks; prepared about 40 quotes a month and converted 12 of them into sales."}</p>
          </div>
        </div>

        <p className="mt-3 text-[12px] leading-snug text-emerald-300">{tr ? "Rakamı siz verirsiniz; yapay zekâ hiçbir şey uydurmaz, eklediği her sözcüğü sarıyla işaretler." : "You supply the numbers; the AI invents nothing and marks every word it adds in yellow."}</p>
      </div>
    </section>
  );
}
