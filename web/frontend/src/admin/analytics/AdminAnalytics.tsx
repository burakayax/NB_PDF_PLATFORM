/**
 * ANALİTİK — yönetim paneli raporları.
 *
 * TASARIM KURALLARI (sahadaki analitik ekranlarının ortak kuralları; kişisel
 * tercih değil):
 *
 *  1. HİYERARŞİ: En üstte değeri kanıtlayan birkaç ölçü, ortada bunların
 *     zaman içindeki seyri, en altta ayrıntılı kırılımlar. Her grafiği aynı
 *     anda göstermek "bilgi duvarı" yaratır ve hiçbiri okunmaz.
 *
 *  2. ÖLÇÜ KARTININ YAPISI: etiket → büyük sayı → bir KARŞILAŞTIRMA → küçük
 *     eğilim çizgisi. Tek başına bir sayı ("142") anlam taşımaz; "önceki
 *     döneme göre %18 artış" taşır. Karşılaştırması olmayan kart eksik karttır.
 *
 *  3. EĞİLİM ÇİZGİSİ (sparkline): 8–12 dönemlik, eksensiz, etiketsiz. Amacı
 *     rakam okutmak değil, "bu değer tek seferlik sıçrama mı yoksa süregelen
 *     bir yönelim mi" sorusunu tek bakışta yanıtlamak.
 *
 *  4. RENK: Yön bildirir, süsleme değildir. Artış yeşil, azalış kırmızı — ama
 *     yalnızca artışın İYİ olduğu ölçülerde; yoksa renk yanıltır.
 *
 *  5. BOŞ DURUM: Hiçbir kutu boş bırakılmaz. Veri yoksa "neden yok ve ne zaman
 *     dolar" yazılır; boş kutu arıza izlenimi verir.
 *
 *  6. KADEMELİ AÇILIM: Ham dökümler ve CSV gibi ileri işlemler varsayılan
 *     görünümde durmaz; isteyen açar.
 */
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  type LucideIcon,
} from "lucide-react";

/* ─────────────────────────── Yardımcılar ─────────────────────────── */

const sayi = (n: number) => n.toLocaleString("tr-TR");

/** Son n günün toplamı ile ondan önceki n günün toplamını karşılaştırır. */
export function donemKarsilastir(
  seri: number[],
  pencere: number,
): { simdi: number; onceki: number; degisimYuzde: number | null } {
  const son = seri.slice(-pencere);
  const onceki = seri.slice(-pencere * 2, -pencere);
  const t = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const simdiT = t(son);
  const oncekiT = t(onceki);
  // Önceki dönem sıfırken yüzde hesaplanamaz; "%∞ artış" yazmak yanıltıcıdır.
  const degisim = oncekiT > 0 ? ((simdiT - oncekiT) / oncekiT) * 100 : null;
  return {
    simdi: simdiT,
    onceki: oncekiT,
    degisimYuzde: degisim === null ? null : Math.round(degisim * 10) / 10,
  };
}

/* ─────────────────────────── Ölçü kartı ─────────────────────────── */

export type OlcuKartiProps = {
  etiket: string;
  deger: number | string;
  /** Önceki döneme göre yüzde değişim; null ise karşılaştırma yapılamıyor. */
  degisimYuzde?: number | null;
  /** Karşılaştırmanın neye göre yapıldığı (ör. "önceki 7 güne göre"). */
  karsilastirmaMetni?: string;
  /** 8–12 dönemlik eğilim; boşsa çizgi çizilmez. */
  egilim?: number[];
  Simge?: LucideIcon;
  /** Artışın iyi sayılmadığı ölçülerde (ör. hata sayısı) renk ters çevrilir. */
  artisIyi?: boolean;
  /** Veri yoksa gösterilecek açıklama. */
  bosMetin?: string;
  vurgu?: "normal" | "basari" | "uyari";
};

export function OlcuKarti({
  etiket,
  deger,
  degisimYuzde,
  karsilastirmaMetni,
  egilim,
  Simge,
  artisIyi = true,
  bosMetin,
  vurgu = "normal",
}: OlcuKartiProps) {
  const veriVar = typeof deger === "number" ? deger > 0 : Boolean(deger);
  const artis = (degisimYuzde ?? 0) > 0;
  const azalis = (degisimYuzde ?? 0) < 0;
  const iyi = artis ? artisIyi : azalis ? !artisIyi : null;

  const DeltaSimge = artis ? ArrowUpRight : azalis ? ArrowDownRight : Minus;
  const deltaRenk =
    degisimYuzde === null || degisimYuzde === undefined || degisimYuzde === 0
      ? "text-slate-400"
      : iyi
        ? "text-emerald-300"
        : "text-rose-300";

  const cerceve =
    vurgu === "basari"
      ? "border-emerald-400/25 bg-emerald-500/[0.05]"
      : vurgu === "uyari"
        ? "border-amber-400/25 bg-amber-500/[0.05]"
        : "border-white/[0.08] bg-white/[0.025]";

  const egilimVerisi = (egilim ?? []).slice(-12).map((v, i) => ({ i, v }));

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 ${cerceve}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {etiket}
        </p>
        {Simge && <Simge className="h-4 w-4 shrink-0 text-slate-400" />}
      </div>

      <p className="mt-2 text-[30px] font-bold leading-none tracking-tight text-white">
        {typeof deger === "number" ? sayi(deger) : deger}
      </p>

      {degisimYuzde !== undefined && (
        <p className={`mt-2 flex items-center gap-1 text-[12px] font-semibold ${deltaRenk}`}>
          <DeltaSimge className="h-3.5 w-3.5" />
          {degisimYuzde === null
            ? "karşılaştırma için yeterli geçmiş yok"
            : `%${Math.abs(degisimYuzde)}`}
          {degisimYuzde !== null && karsilastirmaMetni && (
            <span className="font-normal text-slate-400">{karsilastirmaMetni}</span>
          )}
        </p>
      )}

      {egilimVerisi.length >= 3 ? (
        <div className="mt-3 h-10">
          {/* Eksensiz, etiketsiz: amaç rakam okutmak değil, yönelimi göstermek. */}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={egilimVerisi} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`sp-${etiket}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="#22d3ee"
                strokeWidth={1.75}
                fill={`url(#sp-${etiket})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : !veriVar && bosMetin ? (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{bosMetin}</p>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── Huni ─────────────────────────── */

export type HuniBasamagi = {
  ad: string;
  deger: number;
  /** Bir önceki basamaktan geçiş oranı (%); ilk basamakta yoktur. */
  oran?: number;
  aciklama: string;
};

/**
 * DÖNÜŞÜM HUNİSİ — basamaklar ve aralarındaki DÜŞÜŞ.
 *
 * Tek tek sayılar "iyi mi kötü mü" sorusunu yanıtlamaz; bilgi basamaklar
 * arasındaki kayıptadır. Bu yüzden her basamak bir öncekine göre oranıyla ve
 * genişliği oranla değişen bir çubukla gösterilir.
 */
export function Huni({ basamaklar, toplamOran }: { basamaklar: HuniBasamagi[]; toplamOran: number }) {
  const enBuyuk = Math.max(1, ...basamaklar.map((b) => b.deger));
  const renkler = ["bg-slate-500/70", "bg-sky-500/70", "bg-amber-500/70", "bg-emerald-500/70"];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-200">
          Dönüşüm hunisi
        </h3>
        <p className="text-[12px] text-slate-400">
          Kayıttan ödemeye:{" "}
          <span className="text-lg font-bold text-emerald-300">
            {toplamOran > 0 ? `%${toplamOran}` : "—"}
          </span>
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {basamaklar.map((b, i) => (
          <div key={b.ad}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold text-slate-200">{b.ad}</p>
              <div className="flex items-baseline gap-2">
                {typeof b.oran === "number" && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    {b.oran > 0 ? `%${b.oran}` : "—"}
                  </span>
                )}
                <span className="text-[15px] font-bold text-white">{sayi(b.deger)}</span>
              </div>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className={`h-full rounded-full ${renkler[i] ?? renkler[0]}`}
                style={{ width: `${Math.max(2, (b.deger / enBuyuk) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{b.aciklama}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── Eğilim grafiği ─────────────────────────── */

export type SeriSecimi = { id: string; etiket: string; renk: string };

/**
 * ANA EĞİLİM GRAFİĞİ — tek seferde TEK seri.
 *
 * Birden çok seriyi üst üste çizmek karşılaştırmayı kolaylaştırmıyor, okumayı
 * zorlaştırıyor (ölçekler farklı olduğunda biri düz çizgiye dönüşüyor). Bunun
 * yerine seriler arasında geçiş yapılır; zaman aralığı da ayrı seçilir.
 */
export function EgilimGrafigi({
  baslik,
  veri,
  seriler,
  seciliSeri,
  onSeriDegis,
  pencere,
  onPencereDegis,
  bosMetin,
}: {
  baslik: string;
  veri: Array<Record<string, string | number>>;
  seriler: SeriSecimi[];
  seciliSeri: string;
  onSeriDegis: (id: string) => void;
  pencere: number;
  onPencereDegis: (g: number) => void;
  bosMetin: string;
}) {
  const aktif = seriler.find((s) => s.id === seciliSeri) ?? seriler[0]!;
  const gosterilen = veri.slice(-pencere);
  const veriVar = gosterilen.some((g) => Number(g[aktif.id] ?? 0) > 0);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-200">{baslik}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {/* Seri seçimi */}
          <div className="flex rounded-xl border border-white/[0.08] bg-black/30 p-1">
            {seriler.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSeriDegis(s.id)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                  s.id === seciliSeri ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {s.etiket}
              </button>
            ))}
          </div>
          {/* Zaman aralığı */}
          <div className="flex rounded-xl border border-white/[0.08] bg-black/30 p-1">
            {[7, 14, 30].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onPencereDegis(g)}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                  g === pencere ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {g}g
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 h-64">
        {veriVar ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={gosterilen} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="seriDolgu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={aktif.renk} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={aktif.renk} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="etiket"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#0b1220",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(v) => [sayi(Number(v ?? 0)), aktif.etiket] as [string, string]}
              />
              <Area
                type="monotone"
                dataKey={aktif.id}
                stroke={aktif.renk}
                strokeWidth={2}
                fill="url(#seriDolgu)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <BosDurum metin={bosMetin} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Kırılım (yatay çubuk) ─────────────────────────── */

/**
 * Sıralı kırılımlarda YATAY çubuk kullanılır: etiketler uzun olduğunda dikey
 * çubukta yazılar eğilir ve okunmaz hâle gelir.
 */
export function KirilimGrafigi({
  baslik,
  veri,
  renk = "#38bdf8",
  bosMetin,
}: {
  baslik: string;
  veri: Array<{ ad: string; deger: number }>;
  renk?: string;
  bosMetin: string;
}) {
  const sirali = [...veri].sort((a, b) => b.deger - a.deger).slice(0, 8);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-200">{baslik}</h3>
      <div className="mt-4" style={{ height: Math.max(120, sirali.length * 34) }}>
        {sirali.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sirali} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="ad"
                width={130}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: "#0b1220",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v) => [sayi(Number(v ?? 0)), "İşlem"] as [string, string]}
              />
              <Bar dataKey="deger" radius={[0, 6, 6, 0]} barSize={16}>
                {sirali.map((_, i) => (
                  <Cell key={i} fill={renk} fillOpacity={1 - i * 0.08} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <BosDurum metin={bosMetin} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Boş durum ─────────────────────────── */

/** Boş kutu arıza izlenimi verir; ne olduğu ve ne zaman dolacağı yazılır. */
export function BosDurum({ metin }: { metin: string }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl border border-dashed border-white/[0.08] px-6">
      <p className="max-w-sm text-center text-[12px] leading-relaxed text-slate-400">{metin}</p>
    </div>
  );
}

/* ─────────────────────────── Bölüm başlığı ─────────────────────────── */

export function BolumBasligi({ ustBaslik, baslik }: { ustBaslik: string; baslik: string }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">{ustBaslik}</p>
      <h2 className="mt-0.5 text-lg font-bold tracking-tight text-white">{baslik}</h2>
    </div>
  );
}

/* ─────────────────────────── Kademeli açılım ─────────────────────────── */

/** İleri düzey içerik varsayılan görünümü kalabalıklaştırmaz; isteyen açar. */
export function Katlanir({
  baslik,
  aciklama,
  children,
}: {
  baslik: string;
  aciklama?: string;
  children: React.ReactNode;
}) {
  const [acik, setAcik] = useState(false);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="block text-[13px] font-bold uppercase tracking-[0.14em] text-slate-200">
            {baslik}
          </span>
          {aciklama && <span className="mt-0.5 block text-[11px] text-slate-400">{aciklama}</span>}
        </span>
        <span className="shrink-0 text-[12px] font-semibold text-cyan-300">
          {acik ? "Gizle" : "Göster"}
        </span>
      </button>
      {acik && <div className="border-t border-white/[0.06] p-5">{children}</div>}
    </div>
  );
}

/** Birden çok günü tek etikete indirger (grafik ekseni için). */
export function gunEtiketi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(5);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Aynı tarihe düşen çoklu satırları (ör. plan bazlı satışlar) toplar. */
export function gunluktToplaMap(
  satirlar: Array<{ date: string; count: number }>,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of satirlar) m.set(s.date, (m.get(s.date) ?? 0) + s.count);
  return m;
}

/** Seri hizalama: verilen tarih listesine göre eksiksiz dizi üretir. */
export function seriHizala(tarihler: string[], harita: Map<string, number>): number[] {
  return tarihler.map((t) => harita.get(t) ?? 0);
}

export function useAnalitikVeri<T>(fabrika: () => T, bagimliliklar: unknown[]): T {
  // Bağımlılık listesi bilerek dışarıdan geliyor: bu bir sarmalayıcı hook ve
  // listeyi çağıran taraf belirliyor. React lint kuralları listeyi yerinde bir
  // dizi olarak görmek istediği için ikisi de burada kapatılıyor — `use-memo`
  // kuralı bunu hata sayıp CI'ı kırıyordu.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  return useMemo(fabrika, bagimliliklar);
}
