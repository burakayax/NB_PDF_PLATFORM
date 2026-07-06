import { useEffect } from "react";
import { ArrowRight, Code2, FileText, Languages, KeyRound, Table2, Zap, ShieldCheck } from "lucide-react";
import type { Language } from "../i18n/landing";

type Props = {
  language: Language;
  isAuthenticated?: boolean;
  onLogin: () => void;
  onRegister: () => void;
  onOpenApiKeys?: () => void;
  onOpenPricing?: () => void;
};

export function DeveloperApiPage({ language, isAuthenticated, onLogin, onRegister, onOpenApiKeys, onOpenPricing }: Props) {
  const tr = language === "tr";
  useEffect(() => { document.title = tr ? "PDF & Yapay Zekâ API — PDF Platform" : "PDF & AI API — PDF Platform"; }, [tr]);

  // Oturum açıksa birincil eylem: panelde anahtar oluştur. Değilse: ücretsiz kaydol.
  const primaryAction = isAuthenticated ? (onOpenApiKeys ?? onRegister) : onRegister;
  const primaryLabel = isAuthenticated
    ? (tr ? "Panelde API anahtarı oluştur" : "Create an API key in your dashboard")
    : (tr ? "Ücretsiz kaydol & anahtar oluştur" : "Sign up free & create a key");

  const curl = `curl -X POST https://api.pdfplatform.app/v1/extract \\
  -H "Authorization: Bearer nb_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Fatura No: 2026-123\\nGenel Toplam: 1.450 TL","lang":"tr"}'`;

  const useCases = tr
    ? [
        { icon: Table2, t: "Fatura & tablo verisi", d: "Fatura no, tarih, taraflar, tutar, KDV ve satır kalemlerini yapılandırılmış JSON olarak alın." },
        { icon: FileText, t: "Belge özeti", d: "Uzun sözleşme, ihale ve raporları taraflar/tarih/tutar odağında özetleyin." },
        { icon: Languages, t: "Belge çevirisi", d: "İçeriği 12+ dile, yapısını koruyarak çevirin." },
      ]
    : [
        { icon: Table2, t: "Invoice & table data", d: "Get invoice no, date, parties, totals, VAT and line items as structured JSON." },
        { icon: FileText, t: "Document summaries", d: "Summarize long contracts, tenders and reports focused on parties/dates/amounts." },
        { icon: Languages, t: "Document translation", d: "Translate content into 12+ languages while preserving structure." },
      ];

  const steps = tr
    ? [
        { t: "Hesap aç & anahtar üret", d: "Ücretsiz kaydol, panelden bir API anahtarı (nb_live_…) oluştur." },
        { t: "Uçları çağır", d: "/v1/extract, /v1/summarize, /v1/translate — anahtarınla, JSON gövdeyle." },
        { t: "JSON al & entegre et", d: "Yapılandırılmış yanıtı kendi sistemine işle. Her istek 1 kredi harcar." },
      ]
    : [
        { t: "Create account & key", d: "Sign up free, generate an API key (nb_live_…) from the dashboard." },
        { t: "Call the endpoints", d: "/v1/extract, /v1/summarize, /v1/translate — with your key and a JSON body." },
        { t: "Get JSON & integrate", d: "Process the structured response in your system. Each request uses 1 credit." },
      ];

  const faq = tr
    ? [
        { q: "API'yi nasıl kullanmaya başlarım?", a: "Ücretsiz hesap açın, dashboard'da hesap menüsünden «API Erişimi» ile bir anahtar üretin ve /v1 uçlarını çağırın." },
        { q: "Faturalandırma nasıl işliyor?", a: "Kullanım kredi bazlıdır. Hesap açmak ve anahtar oluşturmak ücretsizdir; her başarılı API çağrısında 1 AI kredisi harcanır. Krediler kredi paketi (top-up) ya da Pro/Business aboneliğiyle gelir; kredi bitince uçlar 402 (insufficient_credits) döner. Fatura otomatik kesilir." },
        { q: "Hangi işlemler var?", a: "Şu an /v1/extract (veri çıkarma), /v1/summarize (özet), /v1/translate (çeviri) ve /v1/me (anahtar/kota kontrolü)." },
      ]
    : [
        { q: "How do I start using the API?", a: "Create a free account, generate a key via «API Access» in the dashboard account menu, and call the /v1 endpoints." },
        { q: "How does billing work?", a: "Usage is credit-based. Creating an account and a key is free; each successful API call spends 1 AI credit. Credits come from a top-up pack or a Pro/Business plan; when out, endpoints return 402 (insufficient_credits). Invoices are issued automatically." },
        { q: "Which operations are available?", a: "Currently /v1/extract (data extraction), /v1/summarize, /v1/translate, and /v1/me (key/quota check)." },
      ];

  return (
    <div className="min-h-dvh bg-[radial-gradient(125%_125%_at_50%_-10%,#16213e_0%,#0b1020_42%,#070b14_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0b1020]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <a href="/" className="flex items-center gap-2"><img src="/emblem.png" alt="" className="h-8 w-8 object-contain" /><span className="text-sm font-bold tracking-tight text-white">PDF Platform</span></a>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <button type="button" onClick={primaryAction} className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:brightness-110">{tr ? "API anahtarlarım" : "My API keys"}</button>
            ) : (
              <>
                <button type="button" onClick={onLogin} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:text-white">{tr ? "Giriş yap" : "Log in"}</button>
                <button type="button" onClick={onRegister} className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:brightness-110">{tr ? "Ücretsiz kaydol" : "Sign up free"}</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-14 sm:pt-20">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[12px] font-semibold text-cyan-300"><Code2 className="h-3.5 w-3.5" />{tr ? "Geliştirici API'si" : "Developer API"}</span>
          <h1 className="mx-auto mt-4 max-w-3xl bg-gradient-to-b from-white to-slate-300 bg-clip-text text-4xl font-black leading-tight tracking-tight text-transparent sm:text-5xl">
            {tr ? "Belge işlemeyi yazılımınıza gömün" : "Embed document processing in your software"}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-400">
            {tr ? "PDF veri çıkarma, özetleme ve çeviriyi tek API ile ürününüze entegre edin. Yapılandırılmış JSON, API anahtarıyla, kredi bazlı." : "Integrate PDF data extraction, summarization and translation with one API. Structured JSON, with an API key, credit-based."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={primaryAction} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"><KeyRound className="h-4 w-4" />{primaryLabel}</button>
            <a href="/pdf-api/docs" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"><Code2 className="h-4 w-4" />{tr ? "Dokümantasyon" : "Documentation"}</a>
            {onOpenPricing && <button type="button" onClick={onOpenPricing} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]">{tr ? "Fiyatlandırma" : "Pricing"}</button>}
          </div>
          {/* Fiyat şeffaflığı — anahtar ücretsiz, kullanım kredi bazlı */}
          <p className="mx-auto mt-4 max-w-xl text-[12.5px] leading-relaxed text-slate-500">
            {tr
              ? "Hesap açmak ve anahtar oluşturmak ücretsizdir. Her başarılı API çağrısı 1 AI kredisi harcar — krediler kredi paketi (top-up) ya da Pro/Business aboneliğiyle gelir."
              : "Creating an account and a key is free. Each successful API call spends 1 AI credit — credits come from a top-up pack or a Pro/Business plan."}
          </p>
        </div>

        {/* Kod örneği */}
        <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-2xl border border-white/[0.1] bg-black/50">
          <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400/60" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" /><span className="ml-2 text-[11px] text-slate-500">POST /v1/extract</span></div>
          <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-slate-200"><code>{curl}</code></pre>
        </div>

        {/* Kullanım alanları */}
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {useCases.map((u) => (
            <div key={u.t} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-300"><u.icon className="h-5 w-5" /></span>
              <p className="mt-3 text-[15px] font-bold text-white">{u.t}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{u.d}</p>
            </div>
          ))}
        </div>

        {/* Nasıl başlanır */}
        <h2 className="mt-16 text-center text-2xl font-black text-white">{tr ? "3 adımda başla" : "Start in 3 steps"}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.t} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-[15px] font-black text-white">{i + 1}</span>
              <p className="mt-3 text-[15px] font-bold text-white">{s.t}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{s.d}</p>
            </div>
          ))}
        </div>

        {/* Özellik şeridi */}
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: <Zap className="h-4 w-4" />, t: tr ? "Yapılandırılmış JSON" : "Structured JSON" },
            { icon: <ShieldCheck className="h-4 w-4" />, t: tr ? "Kredi bazlı, iptal edilebilir anahtar" : "Credit-based, revocable keys" },
            { icon: <FileText className="h-4 w-4" />, t: tr ? "Otomatik fatura" : "Automatic invoicing" },
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[12px] text-slate-300"><span className="text-cyan-300">{b.icon}</span>{b.t}</div>
          ))}
        </div>

        {/* SSS */}
        <section className="mt-16">
          <h2 className="mb-4 text-center text-xl font-black text-white">{tr ? "Sık Sorulan Sorular" : "Frequently Asked Questions"}</h2>
          <div className="mx-auto max-w-2xl space-y-3">
            {faq.map((f, i) => (
              <details key={i} className="group rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15px] font-semibold text-slate-100">{f.q}<span className="text-slate-500 transition group-open:rotate-45">+</span></summary>
                <p className="mt-3 text-[14px] leading-relaxed text-slate-400">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Son CTA */}
        <div className="mt-14 rounded-3xl border border-cyan-400/25 bg-gradient-to-b from-cyan-500/[0.1] to-transparent p-8 text-center">
          <p className="text-lg font-black text-white">{tr ? "Bugün entegre etmeye başla" : "Start integrating today"}</p>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-slate-300">{tr ? "Ücretsiz hesap aç, anahtarını üret ve ilk isteğini dakikalar içinde gönder." : "Create a free account, generate your key and send your first request in minutes."}</p>
          <button type="button" onClick={primaryAction} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:brightness-110">{primaryLabel}<ArrowRight className="h-4 w-4" /></button>
        </div>
      </main>
    </div>
  );
}
