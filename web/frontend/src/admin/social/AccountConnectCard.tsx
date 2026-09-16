import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, Eye, EyeOff, KeyRound, Loader2, Pause, Play, PlugZap, Unplug } from "lucide-react";
import type { SocialAccountRow, SocialPlatformId, SocialPlatformSpec } from "../../api/admin";
import { BRANDS, PlatformBadge } from "./platformBrand";

/**
 * Tek bir platformun bağlantı kartı.
 *
 * Anahtarlar sunucudan GERİ GELMEZ; alanlar bu yüzden boş açılır. Kayıtlı bir
 * alanın yer tutucusunda "kayıtlı" yazar ve boş bırakılırsa mevcut değer
 * korunur — yalnızca süresi dolan tek bir anahtarı yenilemek için diğerlerini
 * yeniden yazmak gerekmez.
 */

const ghostButton =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-40";

type Props = {
  spec: SocialPlatformSpec;
  account: SocialAccountRow | undefined;
  busy: boolean;
  onSave: (platform: SocialPlatformId, secrets: Record<string, string>, enabled: boolean) => void;
  onDisconnect: (platform: SocialPlatformId) => void;
  onTest: (platform: SocialPlatformId) => void;
  /** Son sınamanın sonucu — kart yeniden çizilse de kaybolmasın diye dışarıda tutulur. */
  testResult?: { ok: boolean; message: string };
};

export function AccountConnectCard({ spec, account, busy, onSave, onDisconnect, onTest, testResult }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);

  const brand = BRANDS[spec.platform];
  const connected = account?.connected ?? false;
  const live = connected && (account?.enabled ?? false);
  const filled = account?.filledFields.length ?? 0;
  const total = spec.fields.length;
  const hasInput = Object.values(draft).some((v) => v.trim());

  const state = live
    ? { label: "Yayında", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" }
    : connected
      ? { label: "Duraklatıldı", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" }
      : { label: "Bağlı değil", className: "border-slate-600/50 bg-slate-800/70 text-slate-400" };

  return (
    <article
      className="overflow-hidden rounded-2xl border bg-slate-900/40 transition"
      style={{ borderColor: live ? brand.accent : "rgba(51,65,85,0.5)" }}
    >
      <div className="flex flex-wrap items-center gap-3 p-4">
        <PlatformBadge platform={spec.platform} size={42} muted={!connected} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-white">{brand.label}</h4>
            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${state.className}`}>
              {state.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {connected
              ? `${total} anahtar kayıtlı · ${spec.imageRequired ? "görsel zorunlu" : "görsel isteğe bağlı"}`
              : `${filled}/${total} anahtar girildi · ${brand.where}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {connected ? (
            <button
              type="button"
              className={ghostButton}
              disabled={busy}
              onClick={() => onSave(spec.platform, {}, !(account?.enabled ?? false))}
              title={account?.enabled ? "Bu hesapta paylaşımı durdur" : "Paylaşıma devam et"}
            >
              {account?.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {account?.enabled ? "Duraklat" : "Devam et"}
            </button>
          ) : null}
          <button
            type="button"
            className={ghostButton}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <KeyRound className="h-3.5 w-3.5" />
            {connected ? "Anahtarlar" : "Bağla"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {account?.lastError ? (
        <p className="mx-4 mb-4 flex items-start gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{account.lastError}</span>
        </p>
      ) : null}

      {open ? (
        <div className="space-y-3 border-t border-slate-700/40 bg-slate-950/30 p-4">
          {spec.fields.map((field) => {
            const saved = account?.filledFields.includes(field.key) ?? false;
            const show = visible[field.key] ?? false;
            return (
              <label key={field.key} className="block">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  {field.label}
                  {saved ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-px text-[10px] text-emerald-300">
                      <Check className="h-2.5 w-2.5" />
                      kayıtlı
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{field.help}</span>
                <span className="relative mt-1.5 block">
                  <input
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 px-3.5 py-2.5 pr-10 font-mono text-xs text-slate-100 outline-none transition placeholder:font-sans placeholder:text-slate-600 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/15"
                    type={show ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={saved ? "Değiştirmek için yeni değeri yapıştır" : "Yapıştır"}
                    value={draft[field.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition hover:text-slate-200"
                    onClick={() => setVisible((v) => ({ ...v, [field.key]: !show }))}
                    aria-label={show ? "Gizle" : "Göster"}
                  >
                    {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </span>
              </label>
            );
          })}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
              disabled={busy || !hasInput}
              onClick={() => {
                onSave(spec.platform, draft, account?.enabled ?? true);
                setDraft({});
                setVisible({});
                setOpen(false);
              }}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Kaydet
            </button>
            <button
              type="button"
              className={ghostButton}
              onClick={() => { setDraft({}); setVisible({}); setOpen(false); }}
            >
              Vazgeç
            </button>
            {connected ? (
              <>
                <button
                  type="button"
                  className={ghostButton}
                  disabled={busy}
                  onClick={() => onTest(spec.platform)}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                  Bağlantıyı sına
                </button>
                <button
                  type="button"
                  className={`${ghostButton} ml-auto text-rose-300 hover:border-rose-500/50 hover:text-rose-200`}
                  disabled={busy}
                  onClick={() => onDisconnect(spec.platform)}
                >
                  <Unplug className="h-3.5 w-3.5" />
                  Bağlantıyı kaldır
                </button>
              </>
            ) : null}
          </div>

          {testResult ? (
            <p
              className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-200"
              }`}
            >
              {testResult.message}
              {testResult.ok ? (
                <span className="mt-1 block text-emerald-300/70">
                  Bu, anahtarların geçerli olduğunu gösterir. Paylaşım yetkisinin kesin kanıtı
                  gerçek bir gönderidir — bir taslağı “Şimdi paylaş” ile deneyebilirsin.
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
