import { env } from "../../config/env.js";
import { logApiFailure } from "../../lib/app-logger.js";
import type {
  ContractReport,
  ContractReviewInput,
  ContractRole,
  Finding,
  FindingCategory,
  LegalReference,
  LegalStatus,
  MissingClause,
  Severity,
} from "./contract-review.types.js";

/**
 * SÖZLEŞME DENETÇİSİ — çok adımlı hat (tek model çağrısı değil).
 *
 *   1. HARİTA    belgeyi yapılandırır: taraflar, maddeler, rakamlar, atıflar
 *   2. ANALİZ    belgeyi baştan sona okur; çelişki / hesap / eksik madde / dengesizlik
 *   3. MEVZUAT   iddia gerektiren her hukuki soruyu RESMÎ kaynaklardan canlı arar
 *   4. DENETİM   kendi bulgularını eleştirir; alıntısı belgede olmayanı eler
 *
 * Tasarım ilkeleri:
 *  - Kanun maddesini model hafızasından yazmaz; yalnız arama sonucunda okuduğunu yazar.
 *  - Her bulgunun alıntısı belgede KOD tarafından aranır; bulunamayan bulgu rapora girmez.
 *  - Sayfa numarası modelden değil, alıntının metindeki konumundan hesaplanır.
 *  - Belge metni hiçbir yerde saklanmaz ve günlüğe yazılmaz.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const CALL_TIMEOUT_MS = 600_000;
const MAX_CONTINUATIONS = 6;

/** Mevzuat aramasının yapılabileceği alan adları — yalnız resmî kaynaklar. */
const LAW_DOMAINS = [
  "mevzuat.gov.tr",
  "resmigazete.gov.tr",
  "kik.gov.tr",
  "yargitay.gov.tr",
  "danistay.gov.tr",
  "anayasa.gov.tr",
  "kvkk.gov.tr",
  "rekabet.gov.tr",
  "sgk.gov.tr",
  "gib.gov.tr",
  "adalet.gov.tr",
];

export const PAGE_MARKER_RE = /<<<SAYFA (\d+)>>>/g;

export type ProgressFn = (stageIndex: number, label: string, note: string) => void;

export const QUICK_STAGES = [
  "Belge taranıyor, en önemli riskler aranıyor",
  "Alıntılar belge metninde doğrulanıyor",
] as const;

export const STAGES = [
  "Belge okunuyor, maddeler haritalanıyor",
  "Derin analiz: çelişkiler, rakamlar, eksik maddeler",
  "Güncel mevzuat resmî kaynaklardan kontrol ediliyor",
  "Bulgular denetleniyor, alıntılar doğrulanıyor",
] as const;

// ───────────────────────── Claude çağrısı ─────────────────────────

type WebSource = { title: string; url: string };

export type UsageInfo = { input: number; output: number; cacheRead: number; searches: number };

type RichResult = { text: string; sources: WebSource[]; searches: number };

async function callRich(opts: {
  system: string;
  user: string;
  maxTokens: number;
  effort: "low" | "medium" | "high";
  withWebSearch?: { maxUses: number };
  /** Maliyet ölçümü / kalibrasyon için token kullanımını bildirir. */
  onUsage?: (u: UsageInfo) => void;
}): Promise<RichResult> {
  if (!env.ANTHROPIC_API_KEY) throw new Error("AI not configured");
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: opts.user },
  ];
  const tools = opts.withWebSearch
    ? [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: opts.withWebSearch.maxUses,
          allowed_domains: LAW_DOMAINS,
        },
      ]
    : undefined;
  const sources: WebSource[] = [];
  let searches = 0;

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const turn = await streamOnce(
      {
        model: env.CONTRACT_REVIEW_MODEL,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages,
        output_config: { effort: opts.effort },
        ...(tools ? { tools } : {}),
      },
      opts.onUsage,
    );

    for (const b of turn.content) {
      if (b.type === "server_tool_use") searches++;
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content as Array<Record<string, unknown>>) {
          if (r.type === "web_search_result" && typeof r.url === "string") {
            sources.push({ title: typeof r.title === "string" ? r.title : r.url, url: r.url });
          }
        }
      }
    }

    if (turn.stopReason === "pause_turn") {
      // Sunucu araç döngüsü uzadı: yanıtı olduğu gibi geri verip devam ettir.
      messages.push({ role: "assistant", content: turn.content });
      continue;
    }
    if (turn.stopReason === "refusal") throw new Error("AI_REFUSED");
    if (turn.stopReason === "max_tokens") throw new Error("AI_TRUNCATED");

    const text = turn.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("")
      .trim();
    return { text, sources: dedupeSources(sources), searches };
  }
  throw new Error("AI_TOO_MANY_CONTINUATIONS");
}

type Block = Record<string, unknown>;

/**
 * Tek bir akışlı (SSE) istek. Akış ŞART: düşünme + uzun çıktı dakikalar sürebilir ve
 * akışsız istekte yanıt başlıkları en sonda geldiği için bağlantı zaman aşımına düşer.
 * Bloklar, `pause_turn` devamında olduğu gibi geri gönderilebilsin diye (düşünme imzası,
 * araç girdisi, arama sonuçları dahil) eksiksiz toplanır.
 */
async function streamOnce(
  body: Record<string, unknown>,
  onUsage?: (u: UsageInfo) => void,
): Promise<{ content: Block[]; stopReason: string }> {
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...body, stream: true }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error("Claude API zaman aşımı");
    }
    throw err;
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const blocks: Block[] = [];
  const partial = new Map<number, string>();
  let stopReason = "";
  const usage: UsageInfo = { input: 0, output: 0, cacheRead: 0, searches: 0 };

  const handle = (ev: Record<string, unknown>) => {
    const idx = typeof ev.index === "number" ? ev.index : -1;
    switch (ev.type) {
      case "message_start": {
        const u = (ev.message as { usage?: Record<string, number> } | undefined)?.usage;
        usage.input = u?.input_tokens ?? 0;
        usage.cacheRead = u?.cache_read_input_tokens ?? 0;
        break;
      }
      case "content_block_start":
        blocks[idx] = { ...(ev.content_block as Block) };
        if (blocks[idx].type === "server_tool_use") partial.set(idx, "");
        break;
      case "content_block_delta": {
        const d = ev.delta as Block;
        const b = blocks[idx];
        if (!b) break;
        if (d.type === "text_delta") b.text = String(b.text ?? "") + String(d.text ?? "");
        else if (d.type === "thinking_delta") b.thinking = String(b.thinking ?? "") + String(d.thinking ?? "");
        else if (d.type === "signature_delta") b.signature = d.signature;
        else if (d.type === "input_json_delta") partial.set(idx, (partial.get(idx) ?? "") + String(d.partial_json ?? ""));
        else if (d.type === "citations_delta") b.citations = [...((b.citations as unknown[]) ?? []), d.citation];
        break;
      }
      case "content_block_stop": {
        const b = blocks[idx];
        const raw = partial.get(idx);
        if (b && raw !== undefined) {
          try {
            b.input = raw ? JSON.parse(raw) : {};
          } catch {
            b.input = {};
          }
        }
        break;
      }
      case "message_delta": {
        const d = ev.delta as { stop_reason?: string } | undefined;
        if (d?.stop_reason) stopReason = d.stop_reason;
        const u = ev.usage as { output_tokens?: number; server_tool_use?: { web_search_requests?: number } } | undefined;
        if (u?.output_tokens !== undefined) usage.output = u.output_tokens;
        if (u?.server_tool_use?.web_search_requests !== undefined) usage.searches = u.server_tool_use.web_search_requests;
        break;
      }
      case "error": {
        const m = (ev.error as { message?: string } | undefined)?.message ?? "stream error";
        throw new Error(`Claude API stream: ${String(m).slice(0, 200)}`);
      }
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          handle(JSON.parse(payload) as Record<string, unknown>);
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("Claude API stream")) throw e;
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error("Claude API zaman aşımı");
    }
    throw err;
  }
  onUsage?.(usage);
  return { content: blocks.filter(Boolean), stopReason };
}

function dedupeSources(list: WebSource[]): WebSource[] {
  const seen = new Set<string>();
  const out: WebSource[] = [];
  for (const s of list) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}

function sliceJsonObject(s: string): string {
  const cleaned = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  return a >= 0 && b > a ? cleaned.slice(a, b + 1) : cleaned;
}

/** JSON bekleyen çağrı; bozuk dönerse modelden yalnızca JSON'u düzeltmesini ister (1 kez). */
async function callJson<T>(opts: Parameters<typeof callRich>[0]): Promise<{ data: T; sources: WebSource[]; searches: number }> {
  const first = await callRich(opts);
  try {
    return { data: JSON.parse(sliceJsonObject(first.text)) as T, sources: first.sources, searches: first.searches };
  } catch {
    const fix = await callRich({
      system: "Verilen metindeki JSON'u geçerli JSON olarak yeniden yaz. Anlamı ve içeriği değiştirme, hiçbir şey ekleme/çıkarma. YALNIZCA JSON döndür.",
      user: first.text,
      maxTokens: opts.maxTokens,
      effort: "low",
      onUsage: opts.onUsage,
    });
    try {
      return { data: JSON.parse(sliceJsonObject(fix.text)) as T, sources: first.sources, searches: first.searches };
    } catch {
      throw new Error("AI_JSON_PARSE");
    }
  }
}

// ───────────────────────── Alıntı doğrulama (belge metninde arama) ─────────────────────────

/** Boşluksuz, küçük harfli (TR) karşılaştırma dizgisi + her karakterin özgün indeksi. */
function compact(text: string): { s: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) continue;
    // Tırnak/tire biçimlerini tekleştir: PDF'ten gelen metinde farklı olabilir.
    const norm = c === "“" || c === "”" || c === "„" ? '"' : c === "’" || c === "‘" ? "'" : c === "–" || c === "—" ? "-" : c;
    chars.push(norm.toLocaleLowerCase("tr"));
    map.push(i);
  }
  return { s: chars.join(""), map };
}

export type DocIndex = {
  compact: { s: string; map: number[] };
  /** Sayfa başlangıç konumları (özgün metinde), artan sırada. */
  pages: Array<{ page: number; start: number }>;
  raw: string;
};

export function indexDocument(raw: string): DocIndex {
  const pages: Array<{ page: number; start: number }> = [];
  for (const m of raw.matchAll(PAGE_MARKER_RE)) {
    pages.push({ page: Number(m[1]), start: m.index ?? 0 });
  }
  return { compact: compact(raw), pages, raw };
}

function pageAt(idx: DocIndex, pos: number): number | null {
  let found: number | null = null;
  for (const p of idx.pages) {
    if (p.start <= pos) found = p.page;
    else break;
  }
  return found;
}

export type QuoteLookup = { match: "exact" | "partial" | "none"; page: number | null; start: number; end: number };

export function locateQuote(idx: DocIndex, quote: string): QuoteLookup {
  const q = compact(quote).s;
  if (q.length < 12) return { match: "none", page: null, start: -1, end: -1 };
  const hit = idx.compact.s.indexOf(q);
  if (hit >= 0) {
    const start = idx.compact.map[hit];
    const end = idx.compact.map[hit + q.length - 1] + 1;
    return { match: "exact", page: pageAt(idx, start), start, end };
  }
  // Model alıntıyı hafifçe kısaltmış/değiştirmiş olabilir: baş ve son parçayı ara.
  const chunk = Math.min(60, Math.floor(q.length / 2));
  const head = q.slice(0, chunk);
  const hh = idx.compact.s.indexOf(head);
  if (chunk >= 25 && hh >= 0) {
    const start = idx.compact.map[hh];
    const tail = q.slice(-chunk);
    const tt = idx.compact.s.indexOf(tail, hh);
    const endIdx = tt >= 0 ? tt + chunk - 1 : hh + chunk - 1;
    return { match: "partial", page: pageAt(idx, start), start, end: idx.compact.map[endIdx] + 1 };
  }
  return { match: "none", page: null, start: -1, end: -1 };
}

function contextAround(idx: DocIndex, lookup: QuoteLookup, radius = 700): string {
  if (lookup.start < 0) return "";
  const from = Math.max(0, lookup.start - radius);
  const to = Math.min(idx.raw.length, lookup.end + radius);
  return idx.raw.slice(from, to).replace(PAGE_MARKER_RE, " ").replace(/\s+/g, " ").trim();
}

// ───────────────────────── Yardımcılar ─────────────────────────

const ROLE_LABEL: Record<ContractRole, string> = {
  alici: "ALICI (mal satın alan)",
  satici: "SATICI / TEDARİKÇİ (mal satan)",
  hizmet_alan: "HİZMET ALAN",
  hizmet_veren: "HİZMET VEREN / YÜKLENİCİ",
  kiraci: "KİRACI",
  kiraya_veren: "KİRAYA VEREN",
  isveren: "İŞVEREN",
  isci: "İŞÇİ / ÇALIŞAN",
  istekli: "İSTEKLİ / YÜKLENİCİ (ihaleye teklif veren)",
  idare: "İDARE (ihaleyi açan kurum)",
  diger: "KULLANICININ TANIMLADIĞI TARAF",
};

const SEVERITIES: Severity[] = ["kritik", "yuksek", "orta", "dusuk"];
const CATEGORIES: FindingCategory[] = [
  "ceza", "fesih", "odeme", "sorumluluk", "fikri_mulkiyet", "gizlilik", "uyusmazlik", "teslim_sure",
  "garanti", "tek_tarafli_hak", "celisme", "hesaplama", "belirsizlik", "mevzuat", "diger",
];
const LEGAL_STATUSES: LegalStatus[] = ["dayanak_var", "mevzuata_aykiri", "dogrulanamadi", "ilgisiz"];

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const pick = <T extends string>(v: unknown, allowed: T[], fallback: T): T =>
  typeof v === "string" && (allowed as string[]).includes(v) ? (v as T) : fallback;

function userContext(input: ContractReviewInput): string {
  const lines = [
    `Kullanıcının tarafı: ${ROLE_LABEL[input.role]}${input.roleNote ? ` — ${input.roleNote}` : ""}`,
    `Sözleşme türü bağlamı: ${input.sector === "kamu" ? "KAMU İHALESİ / idari şartname-sözleşme (ihale mevzuatı geçerli olabilir)" : "Özel hukuk sözleşmesi"}`,
    `Yaklaşık sözleşme bedeli: ${input.contractValue?.trim() || "BELİRTİLMEDİ"}`,
    input.concerns?.trim()
      ? `KULLANICININ KENDİ NOTLARI (ÖNCELİKLİ — şirketi/kendisi için önemli dediği konular; bunlarla ilgili maddeleri en derin incele):\n${input.concerns.trim()}`
      : "",
    input.answers && input.answers.length
      ? `KULLANICININ ÖN SORULARA VERDİĞİ CEVAPLAR (kesin bilgi say; "bilmiyorum/cevaplanmadı" olanları varsayım olarak işaretle):\n${input.answers
          .map((a) => `- S: ${a.question}\n  C: ${a.answer || "(cevaplanmadı)"}`)
          .join("\n")}`
      : "",
    input.playbook?.trim()
      ? `KULLANICININ KENDİ STANDARTLARI / KIRMIZI ÇİZGİLERİ (bunlara uyum denetlenecek):\n${input.playbook.trim()}`
      : "Kullanıcı kendi standartlarını VERMEDİ → genel iyi uygulama ölçüsüyle değerlendir ve bunu varsayımlara yaz.",
  ];
  return lines.filter(Boolean).join("\n");
}

// ───────────────────────── Aşama 1: Harita ─────────────────────────

export type ContractMap = {
  docType?: string;
  parties?: Array<{ name?: string; role?: string }>;
  governingLaw?: string;
  disputeResolution?: string;
  term?: string;
  clauses?: Array<{ ref?: string; title?: string; page?: number; gist?: string }>;
  definitions?: Array<{ term?: string; meaning?: string }>;
  numbers?: Array<{ what?: string; value?: string; ref?: string }>;
  crossRefs?: Array<{ from?: string; to?: string; note?: string }>;
  attachments?: string[];
  unclearParts?: string[];
};

export const MAP_SYSTEM = `Sen kıdemli bir sözleşme hukuku analistisin. Verilen belgeyi (sayfalar <<<SAYFA n>>> işaretleriyle ayrılmıştır) okuyup YAPISAL HARİTASINI çıkar. Bu harita sonraki derin analizin iskeleti olacak; eksiksiz ve doğru olması önemli.

Çıkar:
- docType: belgenin türü (ör. "Mal tedarik sözleşmesi", "İhale idari şartnamesi", "Kira sözleşmesi").
- parties: taraflar ve rolleri.
- governingLaw / disputeResolution / term: uygulanacak hukuk, uyuşmazlık çözümü (mahkeme/tahkim/yetki), süre ve yenileme.
- clauses: HER madde/bölüm için {ref ("Madde 5.2", "Ek-1 md. 3"), title, page, gist (tek cümle öz)}. Hiçbir maddeyi atlama.
- definitions: sözleşmenin tanımladığı terimler.
- numbers: bağlayıcı TÜM rakamlar: tutarlar, yüzdeler, süreler, günler, oranlar, eşikler — {what, value (belgedeki gibi), ref}.
- crossRefs: bir maddenin başka madde/ekle bağlantısı veya iki yerde aynı konunun farklı düzenlenmesi gibi dikkat çeken atıflar.
- attachments: ekler ve belgede metni bulunmayan ama atıf yapılan belgeler (ör. "Teknik Şartname Ek-2 — belgede yok").
- unclearParts: okunamayan, bozuk, eksik görünen kısımlar.

KURALLAR: Yalnızca belgede yazanı kullan, uydurma. Rakamları belgedeki yazımıyla aktar. YALNIZCA şu şemada JSON döndür, başka metin yok:
{"docType":"","parties":[{"name":"","role":""}],"governingLaw":"","disputeResolution":"","term":"","clauses":[{"ref":"","title":"","page":1,"gist":""}],"definitions":[{"term":"","meaning":""}],"numbers":[{"what":"","value":"","ref":""}],"crossRefs":[{"from":"","to":"","note":""}],"attachments":[""],"unclearParts":[""]}`;

/**
 * ÖN TARAMA — haritayı çıkarır VE analizden ÖNCE kullanıcıya sorulması gereken soruları üretir.
 * Cevaplar analizde kesin bilgi olarak kullanılır; böylece sistem bilmediği şeyi varsaymaz.
 */
export const PRESCAN_SYSTEM =
  MAP_SYSTEM.replace(/KURALLAR: Yalnızca belgede yazanı kullan[\s\S]*$/, "") +
  `ÖN SORULAR (en önemli ek görev): Analize başlamadan ÖNCE kullanıcıya sorulması gereken soruları üret. Yalnızca CEVABI RİSK DEĞERLENDİRMESİNİ DEĞİŞTİRECEK ve belgeden öğrenilemeyen soruları yaz. Örnekler: kullanıcının şirket türü/ölçeği (tacir mi, KOBİ mi — bazı kanun hükümleri buna bağlı), belge standart bir metin mi yoksa müzakere edilmiş mi, belgede metni olmayan eklerin elinde olup olmadığı, bedel/KDV durumu belgede yoksa, kullanıcının işin fiilen yapılabilirlik durumu (ör. teslim süresine yetişebilir mi), sözleşmenin ne zaman imzalanacağı/yürürlük, uygulanacak hukuk belirsizse yurt dışı unsuru var mı.
- En fazla 6 soru, önem sırasıyla. Belgede zaten yazan şeyi SORMA. Kullanıcının HANGİ TARAFTA olduğunu SORMA (arayüz ayrıca soruyor); sözleşmenin imzalanıp imzalanmadığı gibi cevabı analizi gerçekten değiştiren soruları tercih et. "Genel olarak" tarzı belirsiz soru yazma.
- Mümkünse çoktan seçmeli yaz: options = 2-4 kısa seçenek ("Bilmiyorum" seçeneğini EKLEME, arayüz ekliyor). Serbest cevap gereken soruda options boş dizi.
- why: bu sorunun neden önemli olduğunu tek cümleyle yaz (kullanıcıya gösterilecek).
- sectorGuess: belge kamu ihalesi/idari şartname ise "kamu", değilse "ozel". valueInDoc: belgedeki toplam sözleşme bedeli (yoksa boş).

KURALLAR: Yalnızca belgede yazanı kullan, uydurma. Rakamları belgedeki yazımıyla aktar. YALNIZCA şu şemada JSON döndür, başka metin yok:
{"docType":"","parties":[{"name":"","role":""}],"governingLaw":"","disputeResolution":"","term":"","clauses":[{"ref":"","title":"","page":1,"gist":""}],"definitions":[{"term":"","meaning":""}],"numbers":[{"what":"","value":"","ref":""}],"crossRefs":[{"from":"","to":"","note":""}],"attachments":[""],"unclearParts":[""],"sectorGuess":"ozel|kamu","valueInDoc":"","questions":[{"id":"q1","question":"","why":"","options":[""]}]}`;

type PrescanRaw = ContractMap & {
  sectorGuess?: string;
  valueInDoc?: string;
  questions?: Array<{ id?: string; question?: string; why?: string; options?: unknown }>;
};

export type PrescanResult = {
  map: ContractMap;
  docType: string;
  parties: Array<{ name: string; role: string }>;
  sectorGuess: "ozel" | "kamu";
  valueInDoc: string;
  pageCount: number;
  questions: Array<{ id: string; question: string; why: string; options: string[] }>;
};

export async function prescanContract(text: string, onUsage?: (u: UsageInfo) => void): Promise<PrescanResult> {
  const { data } = await callJson<PrescanRaw>({
    system: PRESCAN_SYSTEM,
    user: text,
    maxTokens: 32000,
    effort: "low",
    onUsage,
  });
  const questions = (Array.isArray(data.questions) ? data.questions : [])
    .filter((q) => q && str(q.question))
    .slice(0, 6)
    .map((q, i) => ({
      id: str(q.id) || `q${i + 1}`,
      question: str(q.question),
      why: str(q.why),
      options: strArr(q.options).slice(0, 4),
    }));
  return {
    map: data,
    docType: str(data.docType) || "Sözleşme",
    parties: (Array.isArray(data.parties) ? data.parties : [])
      .map((p) => ({ name: str(p?.name), role: str(p?.role) }))
      .filter((p) => p.name),
    sectorGuess: data.sectorGuess === "kamu" ? "kamu" : "ozel",
    valueInDoc: str(data.valueInDoc),
    pageCount: indexDocument(text).pages.length || 1,
    questions,
  };
}

/**
 * Analiz İKİ UZMANA bölünür ve paralel çalışır: süre ~yarıya iner (çıktı uzunluğu süreyi belirler).
 * Ortak bulgular denetim aşamasında "merge" ile birleştirilir.
 */
const FOCUS_A = `BU GEÇİŞİN ODAĞI — PARA VE YÜKÜMLÜLÜKLER (diğer konuları ikinci bir uzman inceliyor, onları TEKRAR ETME):
ceza ve gecikme hesapları, ödeme/vade/kabul süreçleri, fesih ve süre/yenileme, teslim süreleri, fiyat/teminat/faiz, sorumluluk ve tazminat sınırları ve bunların rakamsal hesapları. Kullanıcı kurallarından bu konulara ait olanları denetle. Eksik madde olarak yalnızca bu konulardaki eksikleri yaz.`;
const FOCUS_B = `BU GEÇİŞİN ODAĞI — YAPI VE HUKUKİ DENGE (para/ceza hesaplarını ikinci bir uzman inceliyor, onları TEKRAR ETME):
maddeler/ekler arası çelişkiler ve öncelik kuralları, belgede olmayan eklere atıflar, tek taraflı haklar, belirsiz/ölçüsüz ifadeler, fikri mülkiyet, gizlilik, rekabet/münhasırlık, garanti/ayıp/kabul-test koşulları, uyuşmazlık/yetki/uygulanacak hukuk, devir/alt yüklenici, veri koruma. Kullanıcı kurallarından bu konulara ait olanları denetle. Eksik madde olarak yalnızca bu konulardaki eksikleri yaz.`;

function analyzeSystemFor(focus: string): string {
  return ANALYZE_SYSTEM.replace("{{FOCUS}}", focus)
    .replace("En fazla 18 bulgu.", "En fazla 10 bulgu.")
    .replace("missingClauses en çok 6", "missingClauses en çok 4")
    .replace("questions en çok 5, assumptions en çok 5", "questions en çok 3, assumptions en çok 3");
}

// ───────────────────────── Aşama 2: Analiz ─────────────────────────

type RawFinding = {
  id?: string;
  severity?: string;
  category?: string;
  title?: string;
  clause?: string;
  quote?: string;
  whyRisky?: string;
  impact?: string;
  recommendation?: string;
  suggestedText?: string;
  legalChecks?: unknown;
  confidence?: string;
};

type AnalysisOut = {
  findings?: RawFinding[];
  missingClauses?: Array<{ title?: string; why?: string; suggestedText?: string }>;
  questions?: unknown;
  assumptions?: unknown;
};

export const ANALYZE_SYSTEM = `Sen kullanıcının KİŞİSEL SÖZLEŞME ASİSTANISIN: kıdemli bir sözleşme avukatı titizliğiyle, kullanıcının tarafını koruyarak belgeyi satır satır incelersin. Sıradan "şurada şu var" özeti değil; kullanıcının fark etmeyeceği şeyleri yakalayan, kanıtlı ve somut bir denetim yaparsın.

{{FOCUS}}

NASIL ÇALIŞIRSIN
1. Belgenin TAMAMINI oku. Maddeleri tek tek değil, birbiriyle ilişkisi içinde değerlendir.
2. Şu tuzak türlerini özellikle ara:
   a) İÇ ÇELİŞKİ: aynı konunun (vade, ceza, teslim süresi, yetkili mahkeme…) farklı yerlerde/eklerde farklı düzenlenmesi; "ek ile madde çelişirse ek geçerlidir" gibi öncelik kuralları.
   b) HESAP: cezaları, gecikme oranlarını, teminatı, faizi kullanıcının sözleşme bedeline göre HESAPLA ve sonucu yaz (ör. "günlük %0,5 → 20 günde bedelin %10'u → fesih eşiği"). Bedel belirtilmediyse yüzdesel etkiyi yaz, tutarı uydurma. Hesabı adım adım göster.
   c) TEK TARAFLI HAK: yalnız bir tarafa tanınan fesih/değişiklik/fiyat güncelleme/inceleme/sonradan şart koyma hakları; karşılıklı olmayan sorumluluk sınırları.
   d) BELİRSİZLİK: "makul süre", "gerekli görülen", "idarenin takdiri" gibi ölçüsüz ifadeler; tanımlanmamış terimler; belgede bulunmayan eke atıf.
   e) SÜRE TUZAKLARI: itiraz/bildirim süreleri, otomatik yenileme, kısa yazılı bildirim şartı, hak düşürücü süreler.
   f) AĞIR CEZAİ ŞARTLAR, sınırsız/kusursuz sorumluluk, dolaylı zarar, fikri mülkiyet devri, rekabet yasağı, gizlilik süresiz, yetki/tahkim şartı.
   g) EKSİK MADDELER: olması gereken ama olmayanlar (mücbir sebep, sorumluluk üst sınırı, fesih sonrası yükümlülükler, ödeme gecikmesi karşılığı, teslim/kabul prosedürü, veri koruma…). Bunlar "missingClauses"a girer.
   h) KULLANICININ KURALLARI: kullanıcı kendi standartlarını verdiyse HER birine karşı belgeyi tek tek kontrol et; ihlalde hangi kuralı ihlal ettiğini bulgu içinde söyle. Uyan kuralları bulgu yapma.
3. Her bulgu için ÖNCE belgeden alıntıyı bul, SONRA değerlendir.

KULLANICI NOTLARI: Bağlamda "KULLANICININ KENDİ NOTLARI" varsa bu konulara ilişkin maddeleri (kendi odak alanın içinde) ÖNCELİKLE ve en derinlemesine incele; ilgili bulgunun önem derecesini bu notu dikkate alarak belirle ve bulgunun whyRisky metnini "Notunuzla ilgili:" diye başlat. Notun ilgilendiği konu diğer uzmanın alanındaysa orada tekrar etme.

ÇOK ÖNEMLİ KURALLAR (ihlal = güveni yıkar)
- "quote" belgeden BİREBİR kopya olmalı (kelime değiştirme, özetleme, düzeltme YOK), 1-3 cümle, en fazla ~350 karakter, bulguyu en iyi gösteren kısım. Bulgunun dayandığı yer belgede yoksa bulgu YAZMA (o durumda eksik madde olabilir).
- Belgede YAZMAYANI belgede varmış gibi söyleme. Çelişki bulgusunda quote'a bir tarafı koy, diğer tarafın madde/sayfasını whyRisky içinde ver.
- KANUN MADDESİ NUMARASI VERME ve mevzuat hakkında kesin hüküm kurma. Hukuki doğrulama gerektiren her iddiayı "legalChecks" içine, sonradan resmî kaynaktan araştırılacak SORU olarak yaz (ör. "Türk Borçlar Kanunu'nda cezai şartın fahiş olması halinde indirilmesine ilişkin hüküm nedir ve günlük %0,5 oranı bu kapsamda sorun yaratır mı?"). Kamu ihalesi ise ihale mevzuatına aykırılık sorusunu da ekle.
- Genel geçer, doldurma cümleler yasak ("dikkatli olun", "hukuki destek alın" gibi). Her cümle belgeden çıkarılmış somut bir bilgi, hesap veya net bir öneri içermeli.
- Gerçek bulgu yoksa bulgu üretme. Uydurma risk, kullanıcıya gösterilmez; hiç risk yoksa bunu söyle. Abartma: önem derecesini dürüst ver.
- Emin olmadığın şeyi "confidence":"dusuk" yap ve nedenini yaz.
- Kullanıcının ÖN SORULARDA zaten cevapladığı (ya da "bilmiyorum" dediği) konuları "questions"a TEKRAR YAZMA; yalnızca yeni ve hâlâ belirsiz kalanları yaz. Cevaplanan bilgiyi kesin kabul et ve analizi ona göre kur (ör. sözleşme imzalanmışsa "müzakere edin" yerine imza sonrası haklar ve yapılacaklar).
- Kullanıcıdan öğrenmeden kesinleşmeyen noktaları "questions"a yaz (ör. "Bu sözleşmede KDV dahil mi? Bedel belirtilmediği için ceza tutarını hesaplayamadım").
- Analizin dayandığı varsayımları ve bilemediklerini "assumptions"a yaz.

ÖNEM DERECESİ: kritik = imzalanırsa ağır/geri dönüşsüz zarar veya hukuka aykırılık riski, imzalamadan önce mutlaka değişmeli · yuksek = ciddi mali/hukuki risk, pazarlıkta ısrar edilmeli · orta = dengesiz veya belirsiz, düzeltilmesi iyi olur · dusuk = küçük iyileştirme.

Her bulgu için: recommendation = kullanıcının ne yapması gerektiği (net); suggestedText = maddenin kullanıcı lehine, karşı tarafın kabul edebileceği ölçüde dengeli YENİ HALİ (Türkçe, sözleşme diliyle, hazır yapıştırılabilir).

KISA VE KESKİN YAZ (kalite = az ama isabetli bulgu):
- En fazla 18 bulgu. Aynı sorunun farklı yüzlerini TEK bulguda birleştir (ör. aynı cezanın hem oranı hem tavansızlığı). Önemsiz/kozmetik şeyleri yazma.
- whyRisky en çok 2 cümle, impact en çok 2 cümle (rakamlı), recommendation en çok 2 cümle.
- suggestedText yalnızca kritik/yuksek/orta bulgular için, en çok 3 cümle; dusuk için boş bırak.
- legalChecks bulgu başına en çok 2 soru; yalnızca gerçekten hukuki doğrulama gerektirenler için.
- missingClauses en çok 6, her birinin suggestedText'i en çok 2 cümle. questions en çok 5, assumptions en çok 5.

ÇIKTI: YALNIZCA şu JSON, başka metin yok. En önemlileri önce.
{"findings":[{"id":"F1","severity":"kritik|yuksek|orta|dusuk","category":"ceza|fesih|odeme|sorumluluk|fikri_mulkiyet|gizlilik|uyusmazlik|teslim_sure|garanti|tek_tarafli_hak|celisme|hesaplama|belirsizlik|mevzuat|diger","title":"kısa başlık","clause":"Madde 12.3","quote":"belgeden birebir","whyRisky":"neden riskli (somut)","impact":"kullanıcının tarafı için somut etki, rakamla","recommendation":"ne yapmalı","suggestedText":"önerilen yeni madde metni","legalChecks":["araştırılacak hukuki soru"],"confidence":"yuksek|orta|dusuk"}],"missingClauses":[{"title":"","why":"","suggestedText":""}],"questions":[""],"assumptions":[""]}`;

// ───────────────────────── Aşama 3: Mevzuat ─────────────────────────

type LawCheck = { checkId: string; findingId: string; question: string };

type LawOut = {
  results?: Array<{
    checkId?: string;
    status?: string;
    law?: string;
    article?: string;
    note?: string;
    sourceUrl?: string;
  }>;
};

const LAW_SYSTEM = `Sen Türk mevzuatı araştırma asistanısın. Sana bir sözleşme bağlamı ve resmî kaynaklardan araştırılması gereken hukuki sorular verilir. Web arama aracı yalnızca resmî kaynaklarla (mevzuat.gov.tr, Resmî Gazete, Kamu İhale Kurumu, Yargıtay, Danıştay, Anayasa Mahkemesi, KVKK vb.) sınırlıdır.

KURALLAR
- Madde numarası, oran veya hüküm metnini ASLA hafızandan yazma. Yalnızca arama sonuçlarında/okuduğun sayfada GÖRDÜĞÜN içeriğe dayan. Görmediysen status "dogrulanamadi" yaz.
- Mevzuat sık değişir: ilgili hükmün yürürlükteki güncel halini ara; sayfada değişiklik/mülga uyarısı varsa note içinde belirt.
- Her soru için en fazla 1-2 hüküm ver; hükmün ne dediğini kendi cümlenle kısaca özetle ve sözleşme hükmüne etkisini söyle. Emredici hüküm ise ve sözleşme hükmü ona aykırı/indirilebilir olabilirse bunu açıkça yaz.
- status: "mevzuata_aykiri" = sözleşme hükmü emredici mevzuata aykırı, geçersiz veya yargıca indirilebilir/iptal edilebilir olabilir · "dayanak_var" = mevzuat konuyu düzenliyor ve bulguya ölçü/dayanak veriyor (ör. yasal oran, yasal süre, kullanıcıya tanınan hak) ama hüküm doğrudan aykırı değil · "ilgisiz" = ilgili hüküm bulunmadı/uygulanmaz · "dogrulanamadi" = resmî kaynakta okuyamadın.
- sourceUrl: hükmü okuduğun sayfanın adresi (boş bırakma; yoksa status "dogrulanamadi").
- Kullanıcıya tavsiye verme, yalnızca mevzuat gerçeğini raporla.

ÇIKTI: YALNIZCA JSON.
{"results":[{"checkId":"F1.1","status":"mevzuata_aykiri|dayanak_var|ilgisiz|dogrulanamadi","law":"Kanun adı ve numarası","article":"md. X","note":"hüküm ne diyor + sözleşme hükmüne etkisi","sourceUrl":"https://..."}]}`;

// ───────────────────────── Aşama 4: Denetim ─────────────────────────

type ReviewOut = {
  decisions?: Array<{ id?: string; action?: string; mergeInto?: string; severity?: string; reason?: string }>;
  riskLevel?: string;
  headline?: string;
  summary?: string;
  priorities?: Array<{ findingId?: string; title?: string; why?: string }>;
  concernResponses?: Array<{ note?: string; response?: string; findingIds?: unknown }>;
  questions?: unknown;
  assumptions?: unknown;
};

const REVIEW_SYSTEM = `Sen bu denetimin KALİTE KONTROL uzmanı ve baş editörüsün. Bir analist sözleşmeyi inceleyip bulgular üretti; her bulgunun belgedeki alıntısı kod tarafından aranıp çevresindeki metinle sana verildi, mevzuat sonuçları da eklendi. Görevin, kullanıcıya ulaşacak raporu GÜVENİLİR kılmak.

HER BULGU İÇİN karar ver:
- "keep": alıntı ve çevresi bulguyu gerçekten destekliyor.
- "drop": bulgu belgedeki metinle desteklenmiyor, abartılı, yanlış okunmuş, genel geçer/doldurma ya da kullanıcı açısından önemsiz. Şüphede kullanıcıya yanlış alarm vermektense ele.
- "merge": aynı sorunu anlatan başka bir bulguyla birleştirilmeli (mergeInto: kalacak bulgunun id'si).
Ayrıca önem derecesini düzelt (severity). Mevzuat sonucu "mevzuata_aykiri" ise önem derecesini yükseltmeyi düşün; "ilgisiz"/"dogrulanamadi" ise bulguyu ELEME ama kesinlik iddia etme. Karar gerekçesini (reason) tek cümleyle yaz.

SONRA raporun üst kısmını yaz:
- riskLevel: belgenin genel risk düzeyi (kritik|yuksek|orta|dusuk) — kullanıcının tarafı açısından.
- headline: tek satır, sayılarla ("2 kritik, 4 yüksek risk — imzalanmadan önce müzakere gerekli").
- summary: kullanıcıya DOĞRUDAN hitap eden (siz), asistan ağzıyla 4-7 cümlelik yönetici özeti. Önce en önemli sonuç ve bu sözleşmeyi imzalamanın somut sonucu; sonra en ağır 2-3 bulgunun rakamlı özeti; sonda ne yapmalı. Genel geçer laf yok, abartı yok. Yalnızca "keep" edilen bulgulara dayan.
- priorities: pazarlıkta ilk kapatılacak en fazla 3 konu {findingId, title, why}.
- questions: kullanıcının ÖN SORULARDA cevaplamadığı ve hâlâ analizi değiştirecek sorular (analistin sorularını birleştir/temizle; kullanıcının KULLANICI BAĞLAMI'nda zaten cevapladığı ya da "bilmiyorum" dediği hiçbir şeyi TEKRAR SORMA; en fazla 4). Yeni soru yoksa boş dizi.
- assumptions: analizin dayandığı varsayımlar ve bilinemeyenler (en fazla 6). Mevzuat kontrolü yapılamadıysa veya kısmen yapıldıysa bunu açıkça yaz.

NOTLARA YANIT (concernResponses): Bağlamda "KULLANICININ KENDİ NOTLARI" varsa, kullanıcının yazdığı HER ayrı notu/konuyu (satır ya da cümle bazında) ele al ve her biri için {note: kullanıcının notu (kısaltılmış), response: raporun o nota cevabı, findingIds: ilgili KEEP edilmiş bulgu id'leri}. response somut olmalı: ilgili bulgu varsa ne bulunduğunu rakamla özetle; ilgili bir bulgu YOKSA "Bu konuyla ilgili belgede kanıtlayabildiğimiz bir sorun bulunmadı" de ve neye baktığını söyle. Not yoksa boş dizi.

YALNIZCA JSON:
{"decisions":[{"id":"F1","action":"keep|drop|merge","mergeInto":"","severity":"kritik|yuksek|orta|dusuk","reason":""}],"riskLevel":"","headline":"","summary":"","priorities":[{"findingId":"F1","title":"","why":""}],"concernResponses":[{"note":"","response":"","findingIds":["F1"]}],"questions":[""],"assumptions":[""]}`;

// ───────────────────────── Hat ─────────────────────────

export async function runContractReview(
  input: ContractReviewInput,
  progress: ProgressFn,
  onUsage?: (u: UsageInfo) => void,
  /** Ön taramadan gelen harita varsa harita adımı atlanır. */
  priorMap?: ContractMap,
): Promise<ContractReport> {
  const idx = indexDocument(input.text);
  const pageCount = idx.pages.length || 1;
  const ctx = userContext(input);

  // 1 ─ HARİTA (ön tarama yapıldıysa hazır)
  progress(0, STAGES[0], "");
  const map: ContractMap =
    priorMap ??
    (
      await callJson<ContractMap>({
        system: MAP_SYSTEM,
        user: input.text,
        maxTokens: 32000,
        effort: "low",
        onUsage,
      })
    ).data;
  const clauseCount = Array.isArray(map.clauses) ? map.clauses.length : 0;
  const numberCount = Array.isArray(map.numbers) ? map.numbers.length : 0;
  progress(1, STAGES[1], `${clauseCount} madde ve ${numberCount} bağlayıcı rakam okundu; iki uzman paralel inceliyor`);

  // 2 ─ ANALİZ (iki odak paralel)
  const analysisUser = [
    "=== KULLANICI BAĞLAMI ===",
    ctx,
    "",
    "=== BELGE HARİTASI (ön okuma) ===",
    JSON.stringify(map),
    "",
    "=== BELGE (tam metin) ===",
    input.text,
  ].join("\n");
  const passes = await Promise.allSettled(
    [FOCUS_A, FOCUS_B].map((focus) =>
      callJson<AnalysisOut>({
        system: analyzeSystemFor(focus),
        user: analysisUser,
        maxTokens: 48000,
        effort: "high",
        onUsage,
      }),
    ),
  );
  const okPasses = passes.flatMap((r) => (r.status === "fulfilled" ? [r.value.data] : []));
  if (okPasses.length === 0) {
    const firstErr = passes.find((r) => r.status === "rejected") as PromiseRejectedResult;
    throw firstErr.reason instanceof Error ? firstErr.reason : new Error("analysis failed");
  }
  const analysis: AnalysisOut = {
    findings: okPasses.flatMap((a) => (Array.isArray(a.findings) ? a.findings : [])),
    missingClauses: okPasses.flatMap((a) => (Array.isArray(a.missingClauses) ? a.missingClauses : [])),
    questions: okPasses.flatMap((a) => strArr(a.questions)),
    assumptions: [
      ...okPasses.flatMap((a) => strArr(a.assumptions)),
      ...(okPasses.length < passes.length
        ? ["Analizin bir bölümü (konu gruplarından biri) tamamlanamadı; rapor eksik olabilir. Hakkınız iade edilmedi, isterseniz yeniden çalıştırın."]
        : []),
    ],
  };
  const rawFindings = (Array.isArray(analysis.findings) ? analysis.findings : []).filter(
    (f) => f && str(f.title) && str(f.quote),
  );

  const checks: LawCheck[] = [];
  const draft = rawFindings.map((f, i) => {
    const id = `F${i + 1}`;
    strArr(f.legalChecks).slice(0, 3).forEach((q, k) => checks.push({ checkId: `${id}.${k + 1}`, findingId: id, question: q }));
    return { id, raw: f };
  });
  // Maliyet/süre: en ağır bulguların soruları öncelikli, toplam en çok 16 soru.
  const sevRank = new Map(draft.map((d) => [d.id, SEVERITIES.indexOf(pick(d.raw.severity, SEVERITIES, "orta"))]));
  checks.sort((a, b) => (sevRank.get(a.findingId) ?? 9) - (sevRank.get(b.findingId) ?? 9));
  if (checks.length > 16) checks.length = 16;
  progress(2, STAGES[2], `${draft.length} bulgu çıkarıldı; ${checks.length} hukuki soru resmî kaynaklarda aranıyor`);

  // 3 ─ MEVZUAT (canlı, resmî kaynaklar; paralel gruplar)
  const lawResults = new Map<string, NonNullable<LawOut["results"]>[number]>();
  const lawSources: WebSource[] = [];
  let lawPerformed = false;
  let lawNote = "";
  if (checks.length === 0) {
    lawNote = "Hukuki doğrulama gerektiren bir iddia çıkmadığı için mevzuat araması yapılmadı.";
  } else {
    const batches: LawCheck[][] = [];
    for (let i = 0; i < checks.length; i += 2) batches.push(checks.slice(i, i + 2));
    const lawContext =
      `Belge türü: ${map.docType ?? "bilinmiyor"} · Bağlam: ${input.sector === "kamu" ? "kamu ihalesi" : "özel hukuk"} · Uygulanacak hukuk (belgeye göre): ${map.governingLaw || "belirtilmemiş"}`;
    let failures = 0;
    const MAX_PARALLEL = 6;
    for (let i = 0; i < batches.length; i += MAX_PARALLEL) {
      const group = batches.slice(i, i + MAX_PARALLEL);
      const outs = await Promise.all(
        group.map(async (batch) => {
          try {
            const user = [
              lawContext,
              "",
              "ARAŞTIRILACAK SORULAR:",
              ...batch.map((c) => `- [${c.checkId}] ${c.question}`),
            ].join("\n");
            return await callJson<LawOut>({
              system: LAW_SYSTEM,
              user,
              maxTokens: 24000,
              effort: "low",
              withWebSearch: { maxUses: 6 },
              onUsage,
            });
          } catch (e) {
            // Hız sınırı/geçici hata olabilir: kısa beklemeyle bir kez daha dene.
            try {
              await new Promise((r) => setTimeout(r, 4000));
              const user = [lawContext, "", "ARAŞTIRILACAK SORULAR:", ...batch.map((c) => `- [${c.checkId}] ${c.question}`)].join("\n");
              return await callJson<LawOut>({ system: LAW_SYSTEM, user, maxTokens: 24000, effort: "low", withWebSearch: { maxUses: 6 }, onUsage });
            } catch (e2) {
              logApiFailure({
                service: "contract-review",
                operation: "law-batch",
                message: `${e instanceof Error ? e.message.slice(0, 120) : "?"} | retry: ${e2 instanceof Error ? e2.message.slice(0, 120) : "?"}`,
              });
              failures++;
              return null;
            }
          }
        }),
      );
      for (const o of outs) {
        if (!o) continue;
        lawPerformed = true;
        lawSources.push(...o.sources);
        for (const r of Array.isArray(o.data.results) ? o.data.results : []) {
          if (r && typeof r.checkId === "string") lawResults.set(r.checkId, r);
        }
      }
    }
    const unresolved = checks.filter((c) => {
      const r = lawResults.get(c.checkId);
      return !r || pick(r.status, LEGAL_STATUSES, "dogrulanamadi") === "dogrulanamadi";
    }).length;
    lawNote =
      failures === 0 && unresolved === 0
        ? "Mevzuat hükümleri resmî kaynaklardan sorgulandığı tarihteki güncel hâliyle okundu."
        : failures === 0
          ? `${checks.length} hukuki sorunun ${checks.length - unresolved} tanesi resmî kaynaklarda doğrulandı; ${unresolved} tanesi doğrulanamadı ve ilgili bulgularda kesin hüküm iddia edilmedi.`
          : lawPerformed
          ? `Mevzuat kontrolü kısmen yapılabildi (${failures} sorgu grubu tamamlanamadı); tamamlanamayan maddeler "doğrulanamadı" olarak işaretlendi.`
          : "Mevzuat kontrolü bu analizde yapılamadı; hukuki dayanak göstermiyoruz ve hiçbir madde numarası uydurmuyoruz. Aşağıdaki bulgular belge metnine dayanır.";
  }

  progress(3, STAGES[3], "Alıntılar belge metninde aranıyor, bulgular çapraz denetleniyor");

  // 4 ─ DENETİM: alıntı doğrulama (kod) + eleştirmen (model)
  type Draft = {
    id: string;
    raw: RawFinding;
    lookup: QuoteLookup;
    refs: LegalReference[];
    legal: LegalStatus;
  };
  let droppedUnverified = 0;
  const verified: Draft[] = [];
  for (const d of draft) {
    const lookup = locateQuote(idx, str(d.raw.quote));
    if (lookup.match === "none") {
      droppedUnverified++;
      continue;
    }
    const refs: LegalReference[] = [];
    let legal: LegalStatus = "dogrulanamadi";
    const myChecks = checks.filter((c) => c.findingId === d.id);
    if (myChecks.length === 0) legal = "ilgisiz";
    const order: LegalStatus[] = ["mevzuata_aykiri", "dayanak_var", "dogrulanamadi", "ilgisiz"];
    let best = 99;
    for (const c of myChecks) {
      const r = lawResults.get(c.checkId);
      if (!r) continue;
      const st = pick(r.status, LEGAL_STATUSES, "dogrulanamadi");
      const url = str(r.sourceUrl);
      // Kaynak adresi yoksa doğrulanmış sayılmaz.
      const effective: LegalStatus = !url && (st === "mevzuata_aykiri" || st === "dayanak_var") ? "dogrulanamadi" : st;
      if (order.indexOf(effective) < best) {
        best = order.indexOf(effective);
        legal = effective;
      }
      if ((effective === "mevzuata_aykiri" || effective === "dayanak_var") && str(r.law)) {
        refs.push({ law: str(r.law), article: str(r.article), note: str(r.note), sourceUrl: url });
      }
    }
    verified.push({ id: d.id, raw: d.raw, lookup, refs, legal });
  }

  const reviewUser = [
    "=== KULLANICI BAĞLAMI ===",
    ctx,
    "",
    "=== BULGULAR (alıntı çevresiyle) ===",
    JSON.stringify(
      verified.map((v) => ({
        id: v.id,
        severity: v.raw.severity,
        category: v.raw.category,
        title: v.raw.title,
        clause: v.raw.clause,
        quote: v.raw.quote,
        quoteMatch: v.lookup.match,
        surroundingText: contextAround(idx, v.lookup),
        whyRisky: v.raw.whyRisky,
        impact: v.raw.impact,
        recommendation: v.raw.recommendation,
        legalStatus: v.legal,
        legalNotes: v.refs.map((r) => `${r.law} ${r.article}: ${r.note}`),
      })),
    ),
    "",
    "=== EKSİK MADDELER (analist) ===",
    JSON.stringify(analysis.missingClauses ?? []),
    "=== ANALİSTİN SORULARI ===",
    JSON.stringify(strArr(analysis.questions)),
    "=== ANALİSTİN VARSAYIMLARI ===",
    JSON.stringify(strArr(analysis.assumptions)),
    "=== MEVZUAT KONTROLÜ ===",
    lawNote,
  ].join("\n");

  let review: ReviewOut = {};
  try {
    review = (
      await callJson<ReviewOut>({ system: REVIEW_SYSTEM, user: reviewUser, maxTokens: 32000, effort: "medium", onUsage })
    ).data;
  } catch {
    // Denetim adımı başarısızsa analistin çıktısını (alıntıları kodla doğrulanmış hâliyle) kullan.
    review = {};
  }

  const decisions = new Map<string, { action: string; mergeInto: string; severity: Severity | null }>();
  for (const d of Array.isArray(review.decisions) ? review.decisions : []) {
    if (d && typeof d.id === "string") {
      decisions.set(d.id, {
        action: str(d.action) || "keep",
        mergeInto: str(d.mergeInto),
        severity: SEVERITIES.includes(d.severity as Severity) ? (d.severity as Severity) : null,
      });
    }
  }

  const findings: Finding[] = [];
  for (const v of verified) {
    const dec = decisions.get(v.id);
    if (dec && (dec.action === "drop" || dec.action === "merge")) continue;
    const severity = dec?.severity ?? pick(v.raw.severity, SEVERITIES, "orta");
    findings.push({
      id: v.id,
      severity,
      category: pick(v.raw.category, CATEGORIES, "diger"),
      title: str(v.raw.title),
      clause: str(v.raw.clause),
      page: v.lookup.page,
      quote: str(v.raw.quote),
      quoteMatch: v.lookup.match === "exact" ? "exact" : "partial",
      whyRisky: str(v.raw.whyRisky),
      impact: str(v.raw.impact),
      recommendation: str(v.raw.recommendation),
      suggestedText: str(v.raw.suggestedText),
      legalStatus: v.legal,
      legalReferences: v.refs,
      confidence: pick(v.raw.confidence, ["yuksek", "orta", "dusuk"] as const, "orta"),
    });
  }
  findings.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

  const missingClauses: MissingClause[] = [];
  const seenTitles: string[] = [];
  for (const m of Array.isArray(analysis.missingClauses) ? analysis.missingClauses : []) {
    if (!m || !str(m.title)) continue;
    const key = str(m.title).toLocaleLowerCase("tr").replace(/[^\p{L}\p{N} ]/gu, "").trim();
    // Biri diğerinin içinde geçiyorsa aynı eksik sayılır ("Mücbir sebep" / "Mücbir sebep ve ALICI kaynaklı gecikme").
    if (seenTitles.some((k) => k.includes(key) || key.includes(k))) continue;
    seenTitles.push(key);
    missingClauses.push({ title: str(m.title), why: str(m.why), suggestedText: str(m.suggestedText) });
  }

  const assumptions = strArr(review.assumptions).length ? strArr(review.assumptions) : strArr(analysis.assumptions);
  if (droppedUnverified > 0) {
    assumptions.push(
      `${droppedUnverified} bulgu, alıntısı belge metninde doğrulanamadığı için rapora alınmadı (yanlış alarm vermemek için).`,
    );
  }
  if (map.attachments && map.attachments.length) {
    const missingAtt = map.attachments.filter((a) => /yok|bulunm|eklenme/i.test(a));
    if (missingAtt.length) assumptions.push(`Belgede metni bulunmayan ekler analiz edilemedi: ${missingAtt.join("; ")}`);
  }

  const known = new Set(findings.map((f) => f.id));
  const priorities = (Array.isArray(review.priorities) ? review.priorities : [])
    .filter((p) => p && str(p.title))
    .slice(0, 3)
    .map((p) => ({
      title: str(p.title),
      why: str(p.why),
      findingId: typeof p.findingId === "string" && known.has(p.findingId) ? p.findingId : null,
    }));

  const counts = SEVERITIES.map((s) => findings.filter((f) => f.severity === s).length);
  const fallbackHeadline = `${findings.length} bulgu (${counts[0]} kritik, ${counts[1]} yüksek, ${counts[2]} orta, ${counts[3]} düşük)`;
  const riskLevel: Severity = SEVERITIES.includes(review.riskLevel as Severity)
    ? (review.riskLevel as Severity)
    : (SEVERITIES.find((s, i) => counts[i] > 0) ?? "dusuk");

  const allSources = dedupeSources(lawSources);
  return {
    meta: {
      mode: "full",
      docType: str(map.docType) || "Sözleşme",
      parties: (Array.isArray(map.parties) ? map.parties : []).map((p) => `${str(p?.name)}${str(p?.role) ? ` (${str(p?.role)})` : ""}`).filter((s) => s.trim()),
      pageCount,
      role: input.role,
      analyzedAt: new Date().toISOString(),
      model: env.CONTRACT_REVIEW_MODEL,
      lawCheck: { performed: lawPerformed, sources: allSources.slice(0, 40), note: lawNote },
    },
    riskLevel,
    headline: str(review.headline) || fallbackHeadline,
    summary: str(review.summary),
    priorities,
    concernResponses: (Array.isArray(review.concernResponses) ? review.concernResponses : [])
      .filter((c) => c && str(c.note) && str(c.response))
      .map((c) => ({
        note: str(c.note),
        response: str(c.response),
        findingIds: strArr(c.findingIds).filter((id) => known.has(id)),
      })),
    findings,
    missingClauses,
    questionsForUser: strArr(review.questions).length ? strArr(review.questions).slice(0, 6) : strArr(analysis.questions).slice(0, 6),
    assumptions: assumptions.slice(0, 8),
  };
}


// ───────────────────────── HIZLI TARAMA ─────────────────────────

const QUICK_FOCUS = `HIZLI TARAMA MODU: Tek geçişte belgenin TAMAMINI tara ve en önemli riskleri bul (para/ceza/ödeme/fesih/sorumluluk VE çelişki/tek taraflı hak/eksik ek/fikri mülkiyet/yetki). Mevzuat araması YAPILMAYACAK: "legalChecks" alanını BOŞ dizi bırak ve hiçbir kanun maddesi numarası yazma. "suggestedText" alanını BOŞ bırak. Her alanı en çok 1-2 kısa cümleyle yaz. En fazla 8 bulgu (en önemlileri), missingClauses en çok 3, questions en çok 2, assumptions en çok 2. JSON'a ayrıca "summary" (kullanıcıya doğrudan hitap eden, rakamlı 2-3 cümlelik özet) ve "riskLevel" (kritik|yuksek|orta|dusuk) ekle.`;

type QuickOut = AnalysisOut & { summary?: string; riskLevel?: string };

function quickSystem(): string {
  return ANALYZE_SYSTEM.replace("{{FOCUS}}", QUICK_FOCUS)
    .replace("En fazla 18 bulgu.", "En fazla 8 bulgu.")
    .replace('{"findings":[{"id":"F1"', '{"summary":"","riskLevel":"kritik|yuksek|orta|dusuk","findings":[{"id":"F1"');
}

/**
 * HIZLI TARAMA — tek model çağrısı; mevzuat araması, eleştirmen adımı ve notlara tek tek yanıt YOK.
 * Alıntı doğrulaması (kod) tam denetimdeki gibi uygulanır: belgede bulunamayan bulgu rapora girmez.
 */
export async function runQuickScan(
  input: ContractReviewInput,
  progress: ProgressFn,
  onUsage?: (u: UsageInfo) => void,
  priorMap?: ContractMap,
): Promise<ContractReport> {
  const idx = indexDocument(input.text);
  const pageCount = idx.pages.length || 1;
  progress(0, QUICK_STAGES[0], "");
  const user = [
    "=== KULLANICI BAĞLAMI ===",
    userContext(input),
    ...(priorMap ? ["", "=== BELGE HARİTASI (ön okuma) ===", JSON.stringify(priorMap)] : []),
    "",
    "=== BELGE (tam metin) ===",
    input.text,
  ].join("\n");
  const { data: out } = await callJson<QuickOut>({
    system: quickSystem(),
    user,
    maxTokens: 24000,
    effort: "medium",
    onUsage,
  });
  progress(1, QUICK_STAGES[1], "Alıntılar belge metninde aranıyor");

  const raw = (Array.isArray(out.findings) ? out.findings : []).filter((f) => f && str(f.title) && str(f.quote));
  let droppedUnverified = 0;
  const findings: Finding[] = [];
  raw.forEach((f) => {
    const lookup = locateQuote(idx, str(f.quote));
    if (lookup.match === "none") {
      droppedUnverified++;
      return;
    }
    findings.push({
      id: `F${findings.length + 1}`,
      severity: pick(f.severity, SEVERITIES, "orta"),
      category: pick(f.category, CATEGORIES, "diger"),
      title: str(f.title),
      clause: str(f.clause),
      page: lookup.page,
      quote: str(f.quote),
      quoteMatch: lookup.match === "exact" ? "exact" : "partial",
      whyRisky: str(f.whyRisky),
      impact: str(f.impact),
      recommendation: str(f.recommendation),
      suggestedText: "",
      legalStatus: "dogrulanamadi",
      legalReferences: [],
      confidence: pick(f.confidence, ["yuksek", "orta", "dusuk"] as const, "orta"),
    });
  });
  findings.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

  const counts = SEVERITIES.map((s) => findings.filter((f) => f.severity === s).length);
  const riskLevel: Severity = SEVERITIES.includes(out.riskLevel as Severity)
    ? (out.riskLevel as Severity)
    : (SEVERITIES.find((_, i) => counts[i] > 0) ?? "dusuk");
  const assumptions = strArr(out.assumptions);
  assumptions.push("Hızlı tarama yapıldı: güncel mevzuat kontrolü, önerilen madde metinleri ve notlarınıza tek tek yanıt bu raporda YOKTUR; kapsamlı sonuç için detaylı denetimi çalıştırın.");
  if (droppedUnverified > 0) {
    assumptions.push(`${droppedUnverified} bulgu, alıntısı belge metninde doğrulanamadığı için rapora alınmadı (yanlış alarm vermemek için).`);
  }
  const missingClauses: MissingClause[] = (Array.isArray(out.missingClauses) ? out.missingClauses : [])
    .filter((m) => m && str(m.title))
    .slice(0, 3)
    .map((m) => ({ title: str(m.title), why: str(m.why), suggestedText: "" }));
  const map = priorMap;
  return {
    meta: {
      mode: "quick",
      docType: str(map?.docType) || "Sözleşme",
      parties: (Array.isArray(map?.parties) ? map!.parties! : []).map((p) => `${str(p?.name)}${str(p?.role) ? ` (${str(p?.role)})` : ""}`).filter((s) => s.trim()),
      pageCount,
      role: input.role,
      analyzedAt: new Date().toISOString(),
      model: env.CONTRACT_REVIEW_MODEL,
      lawCheck: {
        performed: false,
        sources: [],
        note: "Hızlı taramada mevzuat kontrolü yapılmaz; bu rapordaki bulgular yalnızca belge metnine dayanır. Hukuki dayanak ve kaynak bağlantıları için detaylı denetimi çalıştırın.",
      },
    },
    riskLevel,
    headline: `${findings.length} bulgu (${counts[0]} kritik, ${counts[1]} yüksek, ${counts[2]} orta, ${counts[3]} düşük) — hızlı tarama`,
    summary: str(out.summary),
    priorities: [],
    concernResponses: [],
    findings,
    missingClauses,
    questionsForUser: strArr(out.questions).slice(0, 2),
    assumptions: assumptions.slice(0, 6),
  };
}
