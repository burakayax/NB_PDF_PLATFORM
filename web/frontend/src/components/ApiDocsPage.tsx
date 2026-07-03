import { useEffect } from "react";
import type { Language } from "../i18n/landing";

const API = "https://api.pdfplatform.app";

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/50 p-4 text-[12.5px] leading-relaxed text-slate-200"><code>{children}</code></pre>;
}
function H({ id, children }: { id: string; children: string }) {
  return <h2 id={id} className="!mt-12 scroll-mt-20 text-[22px] font-extrabold tracking-tight text-white">{children}</h2>;
}

export function ApiDocsPage({ language, onLogin, onRegister }: { language: Language; onLogin: () => void; onRegister: () => void }) {
  const tr = language === "tr";
  useEffect(() => { document.title = tr ? "API Dokümantasyonu — PDF Platform" : "API Documentation — PDF Platform"; }, [tr]);

  const nav = [
    ["auth", tr ? "Kimlik Doğrulama" : "Authentication"],
    ["base", tr ? "Temel URL & sürüm" : "Base URL & versioning"],
    ["quickstart", tr ? "Hızlı başlangıç" : "Quick start"],
    ["endpoints", tr ? "Uç noktalar" : "Endpoints"],
    ["files", tr ? "PDF yükleme" : "File upload"],
    ["errors", tr ? "Hatalar (RFC 9457)" : "Errors (RFC 9457)"],
    ["ratelimit", tr ? "İstek sınırı" : "Rate limits"],
    ["idempotency", "Idempotency"],
    ["credits", tr ? "Krediler & faturalama" : "Credits & billing"],
    ["openapi", "OpenAPI"],
  ];

  const errorRows: [string, string, string][] = [
    ["400", "invalid_request", tr ? "Eksik/geçersiz alan (ör. text yok)." : "Missing/invalid field (e.g. no text)."],
    ["401", "invalid_api_key", tr ? "Anahtar yok, geçersiz ya da iptal." : "Missing, invalid or revoked key."],
    ["402", "insufficient_credits", tr ? "Kredi tükendi — top-up ekleyin." : "Out of credits — add a top-up."],
    ["413", "payload_too_large", tr ? "Dosya 20 MB'ı aşıyor." : "File exceeds 20 MB."],
    ["415", "unsupported_media_type", tr ? "Yalnız application/pdf yüklenir." : "Only application/pdf accepted."],
    ["422", "unprocessable_entity", tr ? "PDF'ten metin çıkmadı / işlenemedi." : "No text / couldn't process."],
    ["429", "rate_limited", tr ? "Dakikalık istek sınırı (60/dk)." : "Per-minute limit (60/min)."],
    ["503", "ai_unavailable", tr ? "AI geçici kullanılamıyor." : "AI temporarily unavailable."],
  ];

  return (
    <div className="min-h-dvh bg-[radial-gradient(125%_125%_at_50%_-10%,#16213e_0%,#0b1020_42%,#070b14_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0b1020]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="/pdf-api" className="flex items-center gap-2"><img src="/emblem.png" alt="" className="h-8 w-8 object-contain" /><span className="text-sm font-bold text-white">PDF Platform <span className="text-slate-500">/ API</span></span></a>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onLogin} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 hover:text-white">{tr ? "Giriş" : "Log in"}</button>
            <button type="button" onClick={onRegister} className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white">{tr ? "Anahtar al" : "Get a key"}</button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-5 py-10">
        {/* TOC */}
        <aside className="hidden w-48 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-1">
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-[13px] text-slate-400 transition hover:bg-white/[0.04] hover:text-white">{label}</a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <h1 className="text-3xl font-black tracking-tight text-white">{tr ? "API Dokümantasyonu" : "API Documentation"}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-400">{tr ? "PDF Platform API'siyle belge işlemeyi (veri çıkarma, özetleme, çeviri) kendi yazılımınıza gömün. REST + JSON, API anahtarıyla, kredi bazlı." : "Embed document processing (data extraction, summarization, translation) into your software with the PDF Platform API. REST + JSON, API-key auth, credit-based."}</p>

          <H id="auth">{tr ? "Kimlik Doğrulama" : "Authentication"}</H>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-300">{tr ? "Dashboard → hesap menüsü → «API Erişimi»'nden bir anahtar (nb_live_…) üretin. Anahtarı her istekte Authorization başlığında gönderin. Anahtarı gizli tutun; sunucu tarafında kullanın." : "Generate a key (nb_live_…) from Dashboard → account menu → «API Access». Send it in the Authorization header on every request. Keep it secret; use it server-side."}</p>
          <Code>{`Authorization: Bearer nb_live_xxxxxxxxxxxxxxxxxxxxxxxx`}</Code>

          <H id="base">{tr ? "Temel URL & sürüm" : "Base URL & versioning"}</H>
          <Code>{`${API}/v1`}</Code>
          <p className="mt-2 text-[14px] text-slate-300">{tr ? "Tüm uçlar /v1 altında sürümlenir. Geriye dönük kırıcı değişiklikler yeni sürümde yapılır." : "All endpoints are versioned under /v1. Breaking changes ship in a new version."}</p>

          <H id="quickstart">{tr ? "Hızlı başlangıç" : "Quick start"}</H>
          <p className="mt-2 text-[13px] font-semibold text-slate-400">cURL</p>
          <Code>{`curl -X POST ${API}/v1/extract \\
  -H "Authorization: Bearer nb_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Fatura No: 2026-123\\nGenel Toplam: 1.450 TL","lang":"tr"}'`}</Code>
          <p className="mt-4 text-[13px] font-semibold text-slate-400">Node.js</p>
          <Code>{`const res = await fetch("${API}/v1/extract", {
  method: "POST",
  headers: {
    Authorization: "Bearer nb_live_xxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text: "Fatura No: 2026-123 ...", lang: "tr" }),
});
const { data, usage } = await res.json();`}</Code>
          <p className="mt-4 text-[13px] font-semibold text-slate-400">Python</p>
          <Code>{`import requests
r = requests.post("${API}/v1/extract",
  headers={"Authorization": "Bearer nb_live_xxx"},
  json={"text": "Fatura No: 2026-123 ...", "lang": "tr"})
print(r.json()["data"])`}</Code>

          <H id="endpoints">{tr ? "Uç noktalar" : "Endpoints"}</H>
          <div className="mt-3 space-y-4">
            {[
              { m: "GET", p: "/v1/me", d: tr ? "Anahtar geçerliliği + kalan kredi." : "Key validity + remaining credits." },
              { m: "POST", p: "/v1/summarize", d: tr ? "{ text | file, lang? } → { summary }" : "{ text | file, lang? } → { summary }" },
              { m: "POST", p: "/v1/extract", d: tr ? "{ text | file, lang? } → { data } (belge türü, alanlar, tablolar)" : "{ text | file, lang? } → { data } (doc type, fields, tables)" },
              { m: "POST", p: "/v1/translate", d: tr ? "{ text | file, target } → { translation } (12+ dil)" : "{ text | file, target } → { translation } (12+ languages)" },
            ].map((e) => (
              <div key={e.p} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <p className="font-mono text-[13px]"><span className={`mr-2 rounded px-1.5 py-0.5 text-[11px] font-bold ${e.m === "GET" ? "bg-emerald-500/15 text-emerald-300" : "bg-cyan-500/15 text-cyan-300"}`}>{e.m}</span><span className="text-white">{e.p}</span></p>
                <p className="mt-1 text-[13px] text-slate-400">{e.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-slate-400">{tr ? "Her başarılı yanıt bir usage nesnesi içerir: " : "Every successful response includes a usage object: "}<code className="text-slate-300">{`{ "usage": { "remaining": 42, "unlimited": false } }`}</code></p>

          <H id="files">{tr ? "PDF yükleme" : "File upload"}</H>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-300">{tr ? "Metin yerine doğrudan PDF gönderebilirsiniz: multipart/form-data ile 'file' alanı (application/pdf, en fazla 20 MB). Metin sunucuda çıkarılır. Taranmış/görüntü PDF'lerde metin katmanı olmadığından 422 döner — bu durumda 'text' gönderin." : "You can send a PDF directly: multipart/form-data with a 'file' field (application/pdf, up to 20 MB). Text is extracted server-side. Scanned/image PDFs have no text layer and return 422 — send 'text' instead."}</p>
          <Code>{`curl -X POST ${API}/v1/extract \\
  -H "Authorization: Bearer nb_live_xxx" \\
  -F "file=@fatura.pdf" \\
  -F "lang=tr"`}</Code>

          <H id="errors">{tr ? "Hatalar (RFC 9457)" : "Errors (RFC 9457)"}</H>
          <p className="mt-2 text-[14px] text-slate-300">{tr ? "Hatalar application/problem+json biçiminde döner; her yanıtta X-Request-Id başlığı bulunur (destek için)." : "Errors return as application/problem+json; every response includes an X-Request-Id header (for support)."}</p>
          <Code>{`{
  "type": "https://pdfplatform.app/errors/insufficient_credits",
  "title": "Insufficient credits",
  "status": 402,
  "code": "insufficient_credits",
  "detail": "AI krediniz tükendi. Kredi paketi (top-up) ekleyin.",
  "request_id": "req_9f2a..."
}`}</Code>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="bg-white/[0.04] text-slate-300"><th className="px-3 py-2 font-semibold">HTTP</th><th className="px-3 py-2 font-semibold">code</th><th className="px-3 py-2 font-semibold">{tr ? "Açıklama" : "Meaning"}</th></tr></thead>
              <tbody>
                {errorRows.map((r) => (
                  <tr key={r[0]} className="border-t border-white/[0.05]"><td className="px-3 py-2 font-mono text-slate-200">{r[0]}</td><td className="px-3 py-2 font-mono text-cyan-300">{r[1]}</td><td className="px-3 py-2 text-slate-400">{r[2]}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <H id="ratelimit">{tr ? "İstek sınırı" : "Rate limits"}</H>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-300">{tr ? "Anahtar başına dakikada 60 istek. Yanıtlar RateLimit ve X-RateLimit-* başlıklarını taşır; aşımda 429 + Retry-After (saniye) döner." : "60 requests per minute per key. Responses carry RateLimit and X-RateLimit-* headers; on exceed you get 429 + Retry-After (seconds)."}</p>
          <Code>{`RateLimit: limit=60, remaining=59, reset=42
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
Retry-After: 42   (429 durumunda)`}</Code>

          <H id="idempotency">Idempotency</H>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-300">{tr ? "Ağ hatalarında güvenli tekrar için POST isteklerine Idempotency-Key başlığı (UUID v4 önerilir) ekleyin. Aynı anahtarla yinelenen istek, ilk başarılı yanıtı 24 saat boyunca tekrar döndürür (çift ücretlendirme olmaz). Yinelenen yanıt Idempotent-Replayed: true taşır." : "For safe retries on network errors, add an Idempotency-Key header (UUID v4 recommended) to POST requests. A repeated request with the same key replays the first successful response for 24h (no double charge). Replayed responses carry Idempotent-Replayed: true."}</p>
          <Code>{`-H "Idempotency-Key: 4f6c1e2a-8b3d-4a9e-9f10-2c3b4d5e6f70"`}</Code>

          <H id="credits">{tr ? "Krediler & faturalama" : "Credits & billing"}</H>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-300">{tr ? "Her başarılı istek 1 AI kredisi harcar. Krediler kredi paketi (top-up) ile alınır; başarılı satın almada «Ek AI Hizmet Bedeli» faturası otomatik kesilir. Kredi bitince uçlar 402 döner. Kalan kredi her yanıtın usage.remaining alanında ve X-Credits-Remaining başlığında bulunur." : "Each successful request uses 1 AI credit. Credits are purchased via credit packs (top-up); on a successful purchase an «AI Service Fee» invoice is issued automatically. When out of credits, endpoints return 402. Remaining credits appear in each response's usage.remaining and the X-Credits-Remaining header."}</p>

          <H id="openapi">OpenAPI</H>
          <p className="mt-2 text-[14px] text-slate-300">{tr ? "Makine-okur tanım: " : "Machine-readable spec: "}<a href={`${API}/v1/openapi.json`} className="text-cyan-300 underline">{API}/v1/openapi.json</a></p>

          <div className="mt-12 rounded-2xl border border-cyan-400/25 bg-gradient-to-b from-cyan-500/[0.1] to-transparent p-6 text-center">
            <p className="text-[15px] font-bold text-white">{tr ? "Başlamaya hazır mısınız?" : "Ready to start?"}</p>
            <button type="button" onClick={onRegister} className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-bold text-white">{tr ? "Ücretsiz API anahtarı al" : "Get a free API key"}</button>
          </div>
        </main>
      </div>
    </div>
  );
}
