import { useEffect, useState } from "react";
import { ArrowRight, Check, Code2, Copy, KeyRound, Loader2, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { getSaasApiBase } from "../../api/saasBase";
import { listApiKeys, createApiKey, revokeApiKey, type ApiKeyRow, type CreatedApiKey } from "../../api/apiKeys";

export function ApiKeysPanel({
  language,
  accessToken,
  hasApiAccess = true,
  onUpgrade,
}: {
  language: Language;
  accessToken: string | null;
  /** API erişimi yalnız Pro/Business (+admin). Aksi halde yükseltme yönlendirmesi. */
  hasApiAccess?: boolean;
  onUpgrade?: () => void;
}) {
  const tr = language === "tr";
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = getSaasApiBase();

  async function refresh() {
    setLoading(true);
    setKeys(await listApiKeys(accessToken));
    setLoading(false);
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [accessToken]);

  async function create() {
    if (!hasApiAccess) { onUpgrade?.(); return; }
    if (!name.trim() || creating) return;
    setCreating(true); setError(null);
    try {
      const k = await createApiKey(name.trim(), accessToken);
      setCreated(k); setName("");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Hata."); }
    finally { setCreating(false); }
  }
  async function revoke(id: string) {
    try { await revokeApiKey(id, accessToken); await refresh(); } catch { /* yoksay */ }
  }
  function copyKey() {
    if (!created) return;
    void navigator.clipboard?.writeText(created.key).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }

  const curl = `curl -X POST ${apiBase}/v1/extract \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Fatura No: 123 ...","lang":"tr"}'`;

  return (
    <section className="mx-auto w-full max-w-4xl py-2">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/25 to-blue-600/20 text-cyan-200 ring-1 ring-cyan-400/30"><KeyRound className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl font-black text-white">{tr ? "API Erişimi (Geliştirici)" : "API Access (Developer)"}</h1>
          <p className="mt-1 text-sm text-nb-muted">{tr ? "PDF+AI araçlarını kendi yazılımınızdan çağırın. Her istek AI kredinizden düşer." : "Call PDF+AI tools from your own software. Each request uses your AI credits."}</p>
        </div>
      </div>

      {/* Yeni oluşturulan anahtar — yalnız bir kez */}
      {created && (
        <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold text-emerald-200"><Check className="h-4 w-4" />{tr ? "Anahtar oluşturuldu — bir daha gösterilmez, şimdi kopyalayın:" : "Key created — it won't be shown again, copy it now:"}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-black/40 px-3 py-2 font-mono text-[13px] text-emerald-100">{created.key}</code>
            <button type="button" onClick={copyKey} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-2 text-[12px] font-bold text-emerald-100 transition hover:bg-emerald-500/30">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? (tr ? "Kopyalandı" : "Copied") : tr ? "Kopyala" : "Copy"}
            </button>
          </div>
          <button type="button" onClick={() => setCreated(null)} className="mt-2 text-[12px] text-emerald-300/70 hover:text-emerald-200">{tr ? "Kaydettim, kapat" : "Saved it, close"}</button>
        </div>
      )}

      {/* Pro'ya özel — bilgilendirme + yükseltme yönlendirmesi */}
      {!hasApiAccess && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/[0.08] via-blue-600/[0.05] to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/25 text-cyan-100 ring-1 ring-cyan-400/40"><Sparkles className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-[14px] font-black text-white">{tr ? "API erişimi Pro planına özel" : "API access is a Pro feature"}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-nb-muted">{tr ? "Anahtar oluşturup /v1 uçlarını kendi yazılımınızdan çağırmak için Pro veya Business'a geçin." : "Upgrade to Pro or Business to create keys and call /v1 endpoints from your own software."}</p>
            </div>
          </div>
          {onUpgrade && (
            <button type="button" onClick={() => onUpgrade()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_-10px_rgba(34,211,238,0.7)] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50">
              {tr ? "Pro'ya Yükselt" : "Upgrade to Pro"} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Oluştur — Pro değilse buton AKTİF kalır ve yükseltmeye yönlendirir. */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr ? "Anahtar adı (ör. Muhasebe entegrasyonu)" : "Key name (e.g. Accounting integration)"}
          onKeyDown={(e) => { if (e.key === "Enter") void create(); }}
          disabled={!hasApiAccess}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[14px] text-white outline-none placeholder:text-slate-500 disabled:opacity-60" />
        <button type="button" onClick={() => void create()} disabled={hasApiAccess && (creating || !name.trim())}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : hasApiAccess ? <Plus className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}{tr ? "Anahtar oluştur" : "Create key"}
        </button>
      </div>
      {error && <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}

      {/* Liste — yalnız erişimi olanlarda */}
      {hasApiAccess && (
        <div className="mb-8 space-y-2">
          {loading ? (
            <p className="text-[13px] text-nb-muted"><Loader2 className="inline h-4 w-4 animate-spin" /> {tr ? "Yükleniyor…" : "Loading…"}</p>
          ) : keys.length === 0 ? (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-center text-[13px] text-nb-muted">{tr ? "Henüz API anahtarınız yok." : "No API keys yet."}</p>
          ) : keys.map((k) => (
            <div key={k.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${k.revokedAt ? "border-white/[0.05] bg-white/[0.01] opacity-60" : "border-white/[0.08] bg-white/[0.03]"}`}>
              <KeyRound className="h-4 w-4 shrink-0 text-cyan-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-100">{k.name} {k.revokedAt && <span className="text-red-300">· {tr ? "iptal" : "revoked"}</span>}</p>
                <p className="font-mono text-[11px] text-slate-500">{k.prefix}••••{k.last4} · {tr ? "son kullanım" : "last used"}: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "—"}</p>
              </div>
              {!k.revokedAt && (
                <button type="button" onClick={() => void revoke(k.id)} title={tr ? "İptal et" : "Revoke"} className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dokümantasyon */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="flex items-center gap-2 text-[14px] font-bold text-white"><Code2 className="h-4 w-4 text-cyan-300" />{tr ? "Hızlı başlangıç" : "Quick start"}</p>
        <p className="mt-1 text-[12px] text-nb-muted">{tr ? "Uç noktalar (API anahtarıyla): " : "Endpoints (with API key): "}<code className="text-slate-300">/v1/extract</code>, <code className="text-slate-300">/v1/summarize</code>, <code className="text-slate-300">/v1/translate</code>, <code className="text-slate-300">/v1/me</code></p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-black/50 p-4 text-[12px] leading-relaxed text-slate-200"><code>{curl}</code></pre>
        <a href="/pdf-api/docs" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-cyan-300 hover:text-cyan-200">{tr ? "Tam dokümantasyon →" : "Full documentation →"}</a>
        <p className="mt-3 flex items-start gap-2 text-[12px] text-amber-300"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{tr ? "Her başarılı istek 1 AI kredisi harcar. Kredi bitince /v1 uçları 402 (insufficient_credits) döner — top-up ile kredi ekleyin." : "Each successful request uses 1 AI credit. When out, /v1 returns 402 (insufficient_credits) — add credits via top-up."}</p>
      </div>
    </section>
  );
}
