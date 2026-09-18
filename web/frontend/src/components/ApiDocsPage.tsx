import { useEffect, useMemo, useState } from "react";
import type { Language } from "../i18n/landing";

/**
 * API dokümantasyonu.
 *
 * YAPI: Sol tarafta KATEGORİLİ gezinme, altta önceki/sonraki bağlantıları.
 * Düz bir başlık listesi, uzayan bir dokümanda nerede olduğunuzu kaybettiriyordu;
 * kategoriler hem yeri belli ediyor hem de aranan bölümü hızlı buldurtuyor.
 *
 * İÇERİK KURALI: Buradaki her istek/yanıt örneği KODDAN doğrulanmıştır.
 * Var olmayan bir ucu ya da alanı belgelemek, geliştiriciyi bir kez getirip
 * bir daha getirmemenin en hızlı yoludur.
 */

const API = "https://api.pdfplatform.app";

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="mt-3">
      {label ? <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{label}</p> : null}
      <pre className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/50 p-4 text-[12.5px] leading-relaxed text-slate-200"><code>{children}</code></pre>
    </div>
  );
}

function H({ id, children }: { id: string; children: string }) {
  return <h2 id={id} className="!mt-14 scroll-mt-24 text-[22px] font-extrabold tracking-tight text-white">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[14px] leading-relaxed text-slate-300">{children}</p>;
}

/** Uç nokta başlığı: yöntem rozeti + yol. */
function EndpointHead({ method, path }: { method: "GET" | "POST"; path: string }) {
  return (
    <p className="mt-3 font-mono text-[13px]">
      <span className={`mr-2 rounded px-1.5 py-0.5 text-[11px] font-bold ${method === "GET" ? "bg-emerald-500/15 text-emerald-300" : "bg-cyan-500/15 text-cyan-300"}`}>{method}</span>
      <span className="text-white">{path}</span>
    </p>
  );
}

/** Parametre tablosu — her uçta aynı biçim. */
function Params({ rows, tr }: { rows: [string, string, string][]; tr: boolean }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="bg-white/[0.04] text-slate-300">
            <th className="px-3 py-2 font-semibold">{tr ? "Alan" : "Field"}</th>
            <th className="px-3 py-2 font-semibold">{tr ? "Tür" : "Type"}</th>
            <th className="px-3 py-2 font-semibold">{tr ? "Açıklama" : "Description"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-white/[0.05]">
              <td className="px-3 py-2 font-mono text-cyan-300">{r[0]}</td>
              <td className="px-3 py-2 font-mono text-slate-400">{r[1]}</td>
              <td className="px-3 py-2 text-slate-400">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApiDocsPage({ language, isAuthenticated, onLogin, onRegister, onOpenApiKeys }: { language: Language; isAuthenticated?: boolean; onLogin: () => void; onRegister: () => void; onOpenApiKeys?: () => void }) {
  const tr = language === "tr";
  useEffect(() => { document.title = tr ? "API Dokümantasyonu — PDF Platform" : "API Documentation — PDF Platform"; }, [tr]);

  /** Kategorili gezinme. Sıra, alttaki önceki/sonraki bağlantılarını da belirler. */
  const groups = useMemo(() => [
    {
      title: tr ? "Başlangıç" : "Getting started",
      items: [
        ["overview", tr ? "Genel bakış" : "Overview"],
        ["auth", tr ? "Kimlik doğrulama" : "Authentication"],
        ["quickstart", tr ? "Hızlı başlangıç" : "Quick start"],
      ] as [string, string][],
    },
    {
      title: tr ? "Temeller" : "Core concepts",
      items: [
        ["base", tr ? "Temel URL & sürümleme" : "Base URL & versioning"],
        ["files", tr ? "PDF gönderme" : "Sending a PDF"],
        ["idempotency", tr ? "Tekrar güvenliği" : "Idempotency"],
        ["ratelimit", tr ? "İstek sınırı" : "Rate limits"],
        ["errors", tr ? "Hatalar" : "Errors"],
        ["credits", tr ? "Krediler & faturalama" : "Credits & billing"],
      ] as [string, string][],
    },
    {
      title: tr ? "Uç noktalar" : "Endpoints",
      items: [
        ["ep-me", "GET /v1/me"],
        ["ep-summarize", "POST /v1/summarize"],
        ["ep-extract", "POST /v1/extract"],
        ["ep-translate", "POST /v1/translate"],
      ] as [string, string][],
    },
    {
      title: tr ? "Kaynaklar" : "Resources",
      items: [
        ["openapi", "OpenAPI"],
        ["tools", tr ? "Postman & SDK" : "Postman & SDKs"],
        ["lifecycle", tr ? "Sürüm yaşam döngüsü" : "Version lifecycle"],
        ["changelog", tr ? "Değişiklik günlüğü" : "Changelog"],
      ] as [string, string][],
    },
  ], [tr]);

  /** Önceki/sonraki için düz sıra. */
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Okunan bölümü solda vurgula. Kaydırma konumunu izlemek, uzun dokümanda
  // "neredeyim" sorusunu kullanıcıya sordurtmamanın en ucuz yolu.
  const [active, setActive] = useState<string>(flat[0]?.[0] ?? "");
  useEffect(() => {
    const ids = flat.map(([id]) => id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      // Üst bantı görüş alanının dışında sayıyoruz; yapışkan başlık altında
      // kalan bölüm "okunuyor" sayılmasın.
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [flat]);

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

  const commonParams: [string, string, string][] = [
    ["text", "string", tr ? "İşlenecek metin. file gönderilmezse zorunlu." : "Text to process. Required unless file is sent."],
    ["file", "binary", tr ? "PDF dosyası (multipart/form-data, en fazla 20 MB). text yerine kullanılır." : "PDF file (multipart/form-data, max 20 MB). Used instead of text."],
    ["lang", "string", tr ? "Yanıt dili: tr | en. Varsayılan tr." : "Response language: tr | en. Defaults to tr."],
  ];

  const idx = flat.findIndex(([id]) => id === active);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  return (
    <div className="min-h-dvh bg-[radial-gradient(125%_125%_at_50%_-10%,#16213e_0%,#0b1020_42%,#070b14_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0b1020]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="/pdf-api" className="flex items-center gap-2"><img src="/emblem.png" alt="" className="h-8 w-8 object-contain" /><span className="text-sm font-bold text-white">PDF Platform <span className="text-slate-500">/ API</span></span></a>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <button type="button" onClick={onOpenApiKeys ?? onRegister} className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white">{tr ? "API anahtarlarım" : "My API keys"}</button>
            ) : (
              <>
                <button type="button" onClick={onLogin} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 hover:text-white">{tr ? "Giriş" : "Log in"}</button>
                <button type="button" onClick={onRegister} className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white">{tr ? "Kaydol" : "Sign up"}</button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-10 px-5 py-10">
        {/* Kategorili gezinme */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav className="sticky top-24 max-h-[calc(100dvh-7rem)] space-y-6 overflow-y-auto pr-2">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{g.title}</p>
                <div className="space-y-0.5">
                  {g.items.map(([id, label]) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      aria-current={active === id ? "true" : undefined}
                      className={`block rounded-lg px-3 py-1.5 text-[13px] transition ${active === id ? "bg-cyan-500/10 font-semibold text-cyan-300" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <h1 className="text-3xl font-black tracking-tight text-white">{tr ? "API Dokümantasyonu" : "API Documentation"}</h1>

          <H id="overview">{tr ? "Genel bakış" : "Overview"}</H>
          <P>{tr ? "PDF Platform API'si belge işlemeyi kendi yazılımınıza gömmenizi sağlar: bir PDF ya da metin gönderirsiniz, yapılandırılmış sonuç alırsınız. REST + JSON, anahtar bazlı kimlik doğrulama, kredi bazlı ücretlendirme." : "The PDF Platform API lets you embed document processing into your own software: send a PDF or text, get a structured result back. REST + JSON, API-key auth, credit-based billing."}</P>
          <ul className="mt-3 space-y-1.5 text-[14px] text-slate-300">
            <li className="flex gap-2"><span className="text-cyan-400">•</span>{tr ? <span>Tüm uçlar <code className="text-slate-200">/v1</code> altında sürümlenir.</span> : <span>All endpoints are versioned under <code className="text-slate-200">/v1</code>.</span>}</li>
            <li className="flex gap-2"><span className="text-cyan-400">•</span>{tr ? <span>Hatalar <b className="text-white">RFC 9457</b> (application/problem+json) biçiminde döner.</span> : <span>Errors follow <b className="text-white">RFC 9457</b> (application/problem+json).</span>}</li>
            <li className="flex gap-2"><span className="text-cyan-400">•</span>{tr ? <span>İstek sınırı başlıkları IETF <code className="text-slate-200">RateLimit</code> taslağına uyar.</span> : <span>Rate-limit headers follow the IETF <code className="text-slate-200">RateLimit</code> draft.</span>}</li>
            <li className="flex gap-2"><span className="text-cyan-400">•</span>{tr ? <span>POST istekleri <code className="text-slate-200">Idempotency-Key</code> ile tekrar-güvenlidir.</span> : <span>POST requests are retry-safe via <code className="text-slate-200">Idempotency-Key</code>.</span>}</li>
          </ul>
          <P>{tr ? "API erişimi Pro ve Business planlarında bulunur." : "API access is available on the Pro and Business plans."}</P>

          <H id="auth">{tr ? "Kimlik doğrulama" : "Authentication"}</H>
          <P>{tr ? "Dashboard → hesap menüsü → «API Erişimi»'nden bir anahtar (nb_live_…) üretin. Anahtarı her istekte Authorization başlığında gönderin. Anahtarı gizli tutun ve yalnızca sunucu tarafında kullanın — tarayıcıya gömülen anahtar herkese açıktır." : "Generate a key (nb_live_…) from Dashboard → account menu → «API Access». Send it in the Authorization header on every request. Keep it secret and use it server-side only — a key embedded in a browser is public."}</P>
          <Code>{`Authorization: Bearer nb_live_xxxxxxxxxxxxxxxxxxxxxxxx`}</Code>

          <H id="quickstart">{tr ? "Hızlı başlangıç" : "Quick start"}</H>
          <P>{tr ? "Anahtarınızın çalıştığını doğrulamanın en hızlı yolu /v1/me ucudur — kredi harcamaz." : "The fastest way to verify your key is the /v1/me endpoint — it costs no credits."}</P>
          <Code label="cURL">{`curl ${API}/v1/me \\
  -H "Authorization: Bearer nb_live_xxx"`}</Code>
          <Code label="Node.js">{`const res = await fetch("${API}/v1/extract", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.PDFPLATFORM_API_KEY}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({ text: "Fatura No: 2026-123 ...", lang: "tr" }),
});
if (!res.ok) {
  const problem = await res.json();        // RFC 9457
  throw new Error(\`\${problem.code}: \${problem.detail}\`);
}
const { data, usage } = await res.json();`}</Code>
          <Code label="Python">{`import os, uuid, requests

r = requests.post(
    "${API}/v1/extract",
    headers={
        "Authorization": f"Bearer {os.environ['PDFPLATFORM_API_KEY']}",
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json={"text": "Fatura No: 2026-123 ...", "lang": "tr"},
    timeout=120,
)
r.raise_for_status()
print(r.json()["data"])`}</Code>

          <H id="base">{tr ? "Temel URL & sürümleme" : "Base URL & versioning"}</H>
          <Code>{`${API}/v1`}</Code>
          <P>{tr ? "Tüm uçlar /v1 altında sürümlenir. Kırıcı değişiklikler asla mevcut sürümde yapılmaz; yeni bir sürüm yayınlanır. Ayrıntı için «Sürüm yaşam döngüsü» bölümüne bakın." : "All endpoints are versioned under /v1. Breaking changes are never made inside an existing version; a new version is published instead. See «Version lifecycle» for details."}</P>

          <H id="files">{tr ? "PDF gönderme" : "Sending a PDF"}</H>
          <P>{tr ? "Metin yerine doğrudan PDF gönderebilirsiniz: multipart/form-data ile 'file' alanı (application/pdf, en fazla 20 MB). Metin sunucuda çıkarılır." : "You can send a PDF directly: multipart/form-data with a 'file' field (application/pdf, up to 20 MB). Text is extracted server-side."}</P>
          <Code>{`curl -X POST ${API}/v1/extract \\
  -H "Authorization: Bearer nb_live_xxx" \\
  -F "file=@fatura.pdf" \\
  -F "lang=tr"`}</Code>
          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-3.5">
            <p className="text-[13px] leading-relaxed text-amber-100/90">{tr ? "Taranmış (görüntü) PDF'lerde metin katmanı yoktur ve 422 unprocessable_entity döner. Bu tür belgeler için önce metni kendi tarafınızda çıkarıp text alanıyla gönderin." : "Scanned (image) PDFs have no text layer and return 422 unprocessable_entity. For those, extract the text on your side first and send it via the text field."}</p>
          </div>

          <H id="idempotency">{tr ? "Tekrar güvenliği" : "Idempotency"}</H>
          <P>{tr ? "Ağ hatalarında güvenli tekrar için POST isteklerine Idempotency-Key başlığı (UUID v4 önerilir) ekleyin. Aynı anahtarla yinelenen istek, ilk başarılı yanıtı 24 saat boyunca tekrar döndürür — çift ücretlendirme olmaz. Yinelenen yanıt Idempotent-Replayed: true taşır." : "For safe retries on network errors, add an Idempotency-Key header (UUID v4 recommended) to POST requests. A repeated request with the same key replays the first successful response for 24h — no double charge. Replayed responses carry Idempotent-Replayed: true."}</P>
          <Code>{`-H "Idempotency-Key: 4f6c1e2a-8b3d-4a9e-9f10-2c3b4d5e6f70"`}</Code>

          <H id="ratelimit">{tr ? "İstek sınırı" : "Rate limits"}</H>
          <P>{tr ? "Anahtar başına dakikada 60 istek. Yanıtlar RateLimit ve X-RateLimit-* başlıklarını taşır; aşımda 429 ve Retry-After (saniye) döner. Retry-After değerine uymak, üst üste engellenmemenin en sağlam yoludur." : "60 requests per minute per key. Responses carry RateLimit and X-RateLimit-* headers; on exceed you get 429 with Retry-After (seconds). Honouring Retry-After is the reliable way to avoid repeated throttling."}</P>
          <Code>{`RateLimit: limit=60, remaining=59, reset=42
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
Retry-After: 42   (429)`}</Code>

          <H id="errors">{tr ? "Hatalar" : "Errors"}</H>
          <P>{tr ? "Hatalar RFC 9457 uyarınca application/problem+json biçiminde döner. Her yanıtta X-Request-Id başlığı bulunur; destek talebinde bu değeri iletin." : "Errors follow RFC 9457 and return as application/problem+json. Every response includes an X-Request-Id header; include it when contacting support."}</P>
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

          <H id="credits">{tr ? "Krediler & faturalama" : "Credits & billing"}</H>
          <P>{tr ? "Her başarılı işlem 1 AI kredisi harcar; /v1/me kredi harcamaz. Krediler kredi paketi (top-up) ile alınır ve başarılı satın almada fatura otomatik kesilir. Kredi bitince uçlar 402 döner. Kalan kredi her yanıtın usage.remaining alanında ve X-Credits-Remaining başlığında bulunur." : "Each successful operation uses 1 AI credit; /v1/me costs nothing. Credits are purchased as top-up packs and an invoice is issued automatically on a successful purchase. When out of credits, endpoints return 402. Remaining credits appear in each response's usage.remaining and in the X-Credits-Remaining header."}</P>

          {/* ─── Uç noktalar ─────────────────────────────────────────────── */}

          <H id="ep-me">{tr ? "Anahtarı doğrula" : "Verify the key"}</H>
          <EndpointHead method="GET" path="/v1/me" />
          <P>{tr ? "Anahtarın geçerliliğini, planı ve kalan krediyi döndürür. Kredi harcamaz — sağlık kontrolü için kullanın." : "Returns key validity, plan and remaining credits. Costs no credits — use it as a health check."}</P>
          <Code label={tr ? "İstek" : "Request"}>{`curl ${API}/v1/me \\
  -H "Authorization: Bearer nb_live_xxx"`}</Code>
          <Code label={tr ? "Yanıt" : "Response"}>{`{
  "ok": true,
  "plan": "PRO",
  "usage": { "remaining": 942, "unlimited": false }
}`}</Code>

          <H id="ep-summarize">{tr ? "Belge özetle" : "Summarize a document"}</H>
          <EndpointHead method="POST" path="/v1/summarize" />
          <P>{tr ? "Uzun bir belgeyi başlık, ana konular ve kilit noktalardan oluşan yapılandırılmış bir özete çevirir." : "Turns a long document into a structured summary with a title, key topics and key points."}</P>
          <Params rows={commonParams} tr={tr} />
          <Code label={tr ? "İstek" : "Request"}>{`curl -X POST ${API}/v1/summarize \\
  -H "Authorization: Bearer nb_live_xxx" \\
  -F "file=@rapor.pdf" \\
  -F "lang=tr"`}</Code>
          <Code label={tr ? "Yanıt" : "Response"}>{`{
  "summary": "# Tedarik Sözleşmesi Özeti\\n\\n## Belge türü\\n...",
  "usage": { "remaining": 941, "unlimited": false }
}`}</Code>
          <P>{tr ? "summary alanı Markdown biçiminde bir metindir — başlıklar, listeler ve vurgular içerir. Kendi arayüzünüzde göstermeden önce Markdown olarak işleyin." : "The summary field is a Markdown string — it contains headings, lists and emphasis. Render it as Markdown before displaying it in your own UI."}</P>

          <H id="ep-extract">{tr ? "Yapılandırılmış veri çıkar" : "Extract structured data"}</H>
          <EndpointHead method="POST" path="/v1/extract" />
          <P>{tr ? "Fatura, sözleşme ve benzeri belgelerden alan-değer çiftleri ile tabloları çıkarır. Belge türü otomatik belirlenir." : "Pulls key-value fields and tables out of invoices, contracts and similar documents. The document type is detected automatically."}</P>
          <Params rows={commonParams} tr={tr} />
          <Code label={tr ? "İstek" : "Request"}>{`curl -X POST ${API}/v1/extract \\
  -H "Authorization: Bearer nb_live_xxx" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 4f6c1e2a-8b3d-4a9e-9f10-2c3b4d5e6f70" \\
  -d '{"text":"Fatura No: 2026-123\\nGenel Toplam: 1.450 TL","lang":"tr"}'`}</Code>
          <Code label={tr ? "Yanıt" : "Response"}>{`{
  "data": {
    "docType": "Fatura",
    "fields": [
      { "label": "Fatura No", "value": "2026-123" },
      { "label": "Genel Toplam", "value": "1.450 TL" }
    ],
    "tables": [
      { "title": "Kalemler", "columns": ["Ürün", "Adet", "Tutar"], "rows": [["Lisans", "1", "1.450 TL"]] }
    ],
    "note": ""
  },
  "usage": { "remaining": 940, "unlimited": false }
}`}</Code>
          <P>{tr ? "Belgeden yapılandırılmış veri çıkarılamazsa 422 unprocessable_entity döner." : "If no structured data can be extracted, the endpoint returns 422 unprocessable_entity."}</P>

          <H id="ep-translate">{tr ? "Belge çevir" : "Translate a document"}</H>
          <EndpointHead method="POST" path="/v1/translate" />
          <P>{tr ? "Belgeyi hedef dile çevirir." : "Translates a document into a target language."}</P>
          <Params
            rows={[
              commonParams[0] as [string, string, string],
              commonParams[1] as [string, string, string],
              ["target", "string", tr ? "Hedef dil kodu (ör. en, de, fr). Varsayılan en." : "Target language code (e.g. en, de, fr). Defaults to en."],
            ]}
            tr={tr}
          />
          <Code label={tr ? "İstek" : "Request"}>{`curl -X POST ${API}/v1/translate \\
  -H "Authorization: Bearer nb_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Bu bir sözleşme metnidir.","target":"en"}'`}</Code>
          <Code label={tr ? "Yanıt" : "Response"}>{`{
  "translation": "This is a contract text.",
  "usage": { "remaining": 939, "unlimited": false }
}`}</Code>

          {/* ─── Kaynaklar ───────────────────────────────────────────────── */}

          <H id="openapi">OpenAPI</H>
          <P>{tr ? "Makine-okur tanım: " : "Machine-readable spec: "}<a href={`${API}/v1/openapi.json`} className="text-cyan-300 underline">{API}/v1/openapi.json</a></P>
          <P>{tr ? "Yapay zekâ araçları için kısa bir özet de yayınlıyoruz: " : "We also publish a short summary for AI tools: "}<a href="/llms.txt" className="text-cyan-300 underline">/llms.txt</a></P>

          <H id="tools">{tr ? "Postman & SDK" : "Postman & SDKs"}</H>
          <P>{tr ? "OpenAPI tanımımız hazır araçlarla çalışır — ayrı bir dosya gerekmez:" : "Our OpenAPI spec works with standard tooling — no separate files needed:"}</P>
          <ul className="mt-2 space-y-1.5 text-[14px] text-slate-300">
            <li className="flex gap-2"><span className="text-cyan-400">•</span>{tr ? <span><b className="text-white">Postman:</b> Import → «Link» sekmesine <code className="text-slate-200">{`${API}/v1/openapi.json`}</code> yapıştırın; tüm uçlar hazır gelir.</span> : <span><b className="text-white">Postman:</b> Import → «Link» and paste <code className="text-slate-200">{`${API}/v1/openapi.json`}</code>; all endpoints load automatically.</span>}</li>
            <li className="flex gap-2"><span className="text-cyan-400">•</span>{tr ? <span><b className="text-white">SDK üretimi:</b> OpenAPI Generator ile Node, Python, Java, C# ve daha fazlası için istemci kütüphanesi üretin (aynı URL'den).</span> : <span><b className="text-white">SDK generation:</b> Use OpenAPI Generator to produce a client library for Node, Python, Java, C# and more (from the same URL).</span>}</li>
          </ul>
          <p className="mt-2 text-[13px] text-slate-500">{tr ? "Resmi SDK paketlerine ihtiyaç duyarsanız bize yazın." : "Need official SDK packages? Contact us."}</p>

          <H id="lifecycle">{tr ? "Sürüm yaşam döngüsü" : "Version lifecycle"}</H>
          <P>{tr ? "Entegrasyonunuzun bir sabah habersiz bozulmaması için uyduğumuz kurallar:" : "The rules we follow so your integration does not break without warning:"}</P>
          <ul className="mt-3 space-y-2 text-[14px] text-slate-300">
            <li className="flex gap-2"><span className="text-cyan-400">•</span>{tr ? <span><b className="text-white">Eklemeler kırıcı değildir.</b> Yanıta yeni alan eklenebilir; bilmediğiniz alanları yok sayacak şekilde kod yazın.</span> : <span><b className="text-white">Additions are not breaking.</b> New fields may appear in responses; write code that ignores fields it does not know.</span>}</li>
            <li className="flex gap-2"><span className="text-cyan-400">•</span>{tr ? <span><b className="text-white">Kırıcı değişiklik yeni sürümde yapılır.</b> Mevcut <code className="text-slate-200">/v1</code> davranışı değiştirilmez.</span> : <span><b className="text-white">Breaking changes ship in a new version.</b> Existing <code className="text-slate-200">/v1</code> behaviour is not altered.</span>}</li>
            <li className="flex gap-2"><span className="text-cyan-400">•</span>{tr ? <span><b className="text-white">Emeklilik önceden duyurulur.</b> Bir uç emekliye ayrılacaksa yanıtlar <b>RFC 9745</b> uyarınca <code className="text-slate-200">Deprecation</code> ve <code className="text-slate-200">Sunset</code> başlıklarını taşımaya başlar; kapanma tarihine <b>en az 6 ay</b> vardır.</span> : <span><b className="text-white">Deprecation is announced in advance.</b> When an endpoint is being retired, responses start carrying <code className="text-slate-200">Deprecation</code> and <code className="text-slate-200">Sunset</code> headers per <b>RFC 9745</b>, with <b>at least 6 months</b> before shutdown.</span>}</li>
            <li className="flex gap-2"><span className="text-cyan-400">•</span>{tr ? <span><b className="text-white">Link başlığı yol gösterir.</b> Emeklilik duyurusunda <code className="text-slate-200">Link: &lt;…&gt;; rel="deprecation"</code> ile açıklama sayfasına yönlendiririz.</span> : <span><b className="text-white">A Link header points the way.</b> Deprecation responses include <code className="text-slate-200">Link: &lt;…&gt;; rel="deprecation"</code> pointing at the explanation.</span>}</li>
          </ul>
          <Code label={tr ? "Emekliye ayrılmış bir uçtan örnek yanıt başlıkları" : "Example response headers from a deprecated endpoint"}>{`Deprecation: @1774915200
Sunset: Wed, 30 Sep 2026 23:59:59 GMT
Link: <https://www.pdfplatform.app/pdf-api/docs#changelog>; rel="deprecation"; type="text/html"`}</Code>
          <P>{tr ? "Deprecation, RFC 9651 uyarınca yapılandırılmış bir tarihtir: başında @ olan Unix zaman damgası. Sunset ise HTTP-tarih biçimindedir ve Deprecation'dan önce olamaz." : "Deprecation is a structured Date per RFC 9651: a Unix timestamp prefixed with @. Sunset uses the HTTP-date format and can never be earlier than Deprecation."}</P>

          <H id="changelog">{tr ? "Değişiklik günlüğü" : "Changelog"}</H>
          <P>{tr ? "API'de yapılan her değişiklik buraya işlenir. Tarihler ISO biçimindedir." : "Every change to the API is recorded here. Dates are in ISO format."}</P>
          <div className="mt-4 space-y-4">
            {[
              {
                date: "2026-09-18",
                items: tr
                  ? ["Sürüm yaşam döngüsü politikası yayınlandı (RFC 9745 Deprecation / Sunset).", "Dokümantasyon kategorilere ayrıldı; her uç için istek ve yanıt örneği eklendi.", "Yapay zekâ araçları için /llms.txt yayınlandı."]
                  : ["Published the version lifecycle policy (RFC 9745 Deprecation / Sunset).", "Documentation split into categories; request and response examples added for every endpoint.", "Published /llms.txt for AI tools."],
              },
            ].map((entry) => (
              <div key={entry.date} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="font-mono text-[12.5px] font-bold text-cyan-300">{entry.date}</p>
                <ul className="mt-2 space-y-1.5 text-[13.5px] text-slate-300">
                  {entry.items.map((it) => <li key={it} className="flex gap-2"><span className="text-slate-600">—</span>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>

          {/* Önceki / sonraki */}
          <nav className="mt-14 grid gap-3 border-t border-white/[0.06] pt-6 sm:grid-cols-2">
            {prev ? (
              <a href={`#${prev[0]}`} className="group rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 transition hover:border-cyan-400/30 hover:bg-white/[0.04]">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tr ? "Önceki" : "Previous"}</span>
                <span className="mt-0.5 block text-[14px] font-semibold text-slate-200 group-hover:text-white">← {prev[1]}</span>
              </a>
            ) : <span />}
            {next ? (
              <a href={`#${next[0]}`} className="group rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-right transition hover:border-cyan-400/30 hover:bg-white/[0.04] sm:col-start-2">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tr ? "Sonraki" : "Next"}</span>
                <span className="mt-0.5 block text-[14px] font-semibold text-slate-200 group-hover:text-white">{next[1]} →</span>
              </a>
            ) : null}
          </nav>

          <div className="mt-10 rounded-2xl border border-cyan-400/25 bg-gradient-to-b from-cyan-500/[0.1] to-transparent p-6 text-center">
            <p className="text-[15px] font-bold text-white">{tr ? "Başlamaya hazır mısınız?" : "Ready to start?"}</p>
            <p className="mt-1 text-[13px] text-slate-400">{tr ? "API erişimi Pro ve Business planlarında." : "API access is on the Pro and Business plans."}</p>
            <button type="button" onClick={isAuthenticated ? (onOpenApiKeys ?? onRegister) : onRegister} className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-bold text-white">{isAuthenticated ? (tr ? "API anahtarı oluştur" : "Create an API key") : (tr ? "Hesap oluştur" : "Create an account")}</button>
          </div>
        </main>
      </div>
    </div>
  );
}
