import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import { saasFetch, buildSaasApiUrl } from "../../api/saasHttp";

/**
 * Ticari ileti onay kanıt defteri — yönetim görünümü.
 *
 * NEDEN VAR: Ticari İletişim Yönetmeliği, onayın İSPATINI gönderenden istiyor.
 * Bir denetimde ya da şikâyette "bu kişi izin vermişti" demek yetmez;
 * ne zaman, hangi kanaldan ve hangi metni onayladığı gösterilmelidir.
 * Bu ekran o kanıtı okunur hâlde tutar ve belge olarak indirilmesini sağlar.
 *
 * NEDEN SİLME YOK: Kanıt defteri elle düzenlenebilir olursa kanıt olmaktan
 * çıkar. Kayıtlar yalnız yasal saklama süresi (3 yıl) dolduğunda otomatik
 * silinir.
 */

const CARD = "rounded-2xl border border-white/[0.08] bg-white/[0.02]";
const PAGE_SIZE = 50;

type ConsentRow = {
  id: string;
  userId: string;
  email: string;
  granted: boolean;
  source: string;
  consentText: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

type Payload = {
  rows: ConsentRow[];
  total: number;
  offset: number;
  limit: number;
  totals: { granted: number; revoked: number };
};

const SOURCE_LABEL: Record<string, string> = {
  signup: "Kayıt formu",
  settings: "Hesap ayarları",
  unsubscribe_link: "Çıkış bağlantısı",
  admin: "Yönetici",
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Uzun tarayıcı bilgisini tabloda tek satıra sığacak hâle getirir. */
function shortAgent(ua: string | null): string {
  if (!ua) return "—";
  return ua.length > 48 ? `${ua.slice(0, 48)}…` : ua;
}

export function ConsentLogTab({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  /** Kutuya yazılan metin — arama ancak gönderildiğinde uygulanır. */
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (query) params.set("q", query);
      const res = await saasFetch(`/api/admin/email-compliance/consents?${params.toString()}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setData((await res.json()) as Payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onay kayıtları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, offset, query]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Belgeyi indirir.
   *
   * Düz bir bağlantı kullanılamıyor: uç yönetici yetkisi istiyor ve yetki
   * başlığı ancak istek içinde gönderilebilir. Bu yüzden dosya önce belleğe
   * alınıp tarayıcıya öyle veriliyor.
   */
  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(
        buildSaasApiUrl(`/api/admin/email-compliance/consents/export?${params.toString()}`),
        { headers: { authorization: `Bearer ${accessToken}` }, credentials: "include" },
      );
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ticari-ileti-onay-kayitlari-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Bellek serbest bırakılmazsa dosya sekme kapanana kadar tutulur.
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Belge indirilemedi.");
    } finally {
      setDownloading(false);
    }
  };

  const submitSearch = () => {
    setOffset(0);
    setQuery(queryDraft.trim());
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="space-y-5 px-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Onay kayıtları
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
            Tanıtım e-postası izninin kanıt defteri. Kim, ne zaman, hangi kanaldan onay verdi ya
            da listeden çıktı — hepsi burada. Bir denetimde ya da şikâyette bu kaydı belge olarak
            sunabilirsiniz. Kayıtlar 3 yıl saklanır, elle silinemez.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </button>
          <button
            type="button"
            onClick={() => void download()}
            disabled={downloading || total === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Belge olarak indir
          </button>
        </div>
      </header>

      {error ? (
        <div className={`${CARD} flex items-start gap-3 p-4`}>
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-slate-300">{error}</p>
        </div>
      ) : null}

      {/* Özet sayılar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${CARD} p-4`}>
          <p className="text-xs uppercase tracking-wide text-slate-400">Toplam kayıt</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{total}</p>
        </div>
        <div className={`${CARD} p-4`}>
          <p className="text-xs uppercase tracking-wide text-slate-400">Onay verildi</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-300">
            {data?.totals.granted ?? 0}
          </p>
        </div>
        <div className={`${CARD} p-4`}>
          <p className="text-xs uppercase tracking-wide text-slate-400">Listeden çıkıldı</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-300">
            {data?.totals.revoked ?? 0}
          </p>
        </div>
      </div>

      {/* Arama */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitSearch();
            }}
            placeholder="E-posta adresi ya da kullanıcı kimliği ile ara…"
            className="w-full rounded-xl border border-white/[0.1] bg-black/25 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
          />
        </div>
        <button
          type="button"
          onClick={submitSearch}
          className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
        >
          Ara
        </button>
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQueryDraft("");
              setQuery("");
              setOffset(0);
            }}
            className="rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:text-white"
          >
            Temizle
          </button>
        ) : null}
      </div>

      {/* Defter */}
      {rows.length === 0 ? (
        <div className={`${CARD} p-10 text-center`}>
          <ShieldCheck className="mx-auto h-8 w-8 text-slate-500" />
          <p className="mt-3 text-sm text-slate-300">
            {query ? "Bu aramaya uyan kayıt yok." : "Henüz onay kaydı yok."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Kayıt formundaki tanıtım e-postası kutusu işaretlendiğinde ve biri listeden
            çıktığında buraya kayıt düşer.
          </p>
        </div>
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">İşlem</th>
                  <th className="px-4 py-3 font-medium">E-posta</th>
                  <th className="px-4 py-3 font-medium">Kanal</th>
                  <th className="px-4 py-3 font-medium">Tarih</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">Tarayıcı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top transition hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3">
                      {r.granted ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-300">
                          <Check className="h-3 w-3" /> Onay verildi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/25 bg-rose-400/10 px-2 py-1 text-xs font-medium text-rose-300">
                          <X className="h-3 w-3" /> Geri alındı
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-200">{r.email}</span>
                      {r.consentText ? (
                        <p
                          className="mt-1 max-w-md text-xs leading-relaxed text-slate-500"
                          title={r.consentText}
                        >
                          Onayladığı metin: {r.consentText}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                      {SOURCE_LABEL[r.source] ?? r.source}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-300">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-400">
                      {r.ip ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500" title={r.userAgent ?? ""}>
                      {shortAgent(r.userAgent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sayfalama */}
          {total > PAGE_SIZE ? (
            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-sm">
              <span className="text-slate-400">
                {offset + 1}–{pageEnd} / {total} kayıt
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={offset === 0 || loading}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-40"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={pageEnd >= total || loading}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-40"
                >
                  Sonraki
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
