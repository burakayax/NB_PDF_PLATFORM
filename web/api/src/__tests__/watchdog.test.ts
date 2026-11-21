import { describe, expect, it } from "vitest";

// Çöküş bekçisi (cloudflare/bekci-worker.mjs) kural testleri + gölge modu güvencesi.
const wp = new URL("../../../../cloudflare/bekci-worker.mjs", import.meta.url).href;
const op = new URL("../../../../scripts/agents/bekci-ozet.mjs", import.meta.url).href;
type Rule = { ad: string; tamam: boolean; aciklama: string };
const w = (await import(/* @vite-ignore */ wp)) as {
  MOD: string;
  kurallariDegerlendir: (x: Record<string, unknown>) => { karar: string; kurallar: Rule[] };
  kontrolEt: (env: Record<string, unknown>, f: unknown, now: number) => Promise<{ ok: boolean; streak: number }>;
};
const o = (await import(/* @vite-ignore */ op)) as { bekciOzet: (k: unknown, now: number) => { satir: string; dikkat: string[] } };

const DK = 60000;
const H = 3600000;
const T0 = Date.parse("2026-11-21T10:00:00Z");
// kesinti başlamadan önceki n saat boyunca 5 dakikada bir sağlıklı kayıt
const saglikli = (basladi: number, saat: number, bozuk = 0) => {
  const a = [];
  for (let t = basladi - saat * H; t < basladi; t += 5 * DK) a.push({ t, ok: true });
  for (let i = 0; i < bozuk; i++) a[i * 3] = { t: a[i * 3].t, ok: false };
  return a;
};
const merge = (dkOnce: number) => ({ sha: "abc1234", baslik: "x", t: T0 - dkOnce * DK });

describe("bekçi: 4 kuralın hepsi sağlanınca 'geri alırdım'", () => {
  it("tüm kurallar tamam", () => {
    const r = w.kurallariDegerlendir({ basladi: T0, history: saglikli(T0, 24), merge: merge(20), mergeDosyalar: ["web/frontend/src/a.ts"] });
    expect(r.karar).toBe("GERI_ALIRDIM");
    expect(r.kurallar.every((k) => k.tamam)).toBe(true);
  });
  it("kesinti birleştirmeden 60 dakikadan geç başladıysa geri almaz", () => {
    expect(w.kurallariDegerlendir({ basladi: T0, history: saglikli(T0, 24), merge: merge(120), mergeDosyalar: [] }).karar).toBe("GERI_ALMAZDIM");
  });
  it("kesinti birleştirmeden ÖNCE başladıysa geri almaz", () => {
    expect(w.kurallariDegerlendir({ basladi: T0, history: saglikli(T0, 24), merge: merge(-5), mergeDosyalar: [] }).karar).toBe("GERI_ALMAZDIM");
  });
  it("site öncesinde sağlıksızsa ya da kayıt yetersizse geri almaz", () => {
    expect(w.kurallariDegerlendir({ basladi: T0, history: saglikli(T0, 24, 30), merge: merge(20), mergeDosyalar: [] }).karar).toBe("GERI_ALMAZDIM");
    expect(w.kurallariDegerlendir({ basladi: T0, history: saglikli(T0, 3), merge: merge(20), mergeDosyalar: [] }).karar).toBe("GERI_ALMAZDIM");
  });
  it("veritabanı (prisma) değişikliği varsa ya da dosya listesi bilinmiyorsa geri almaz", () => {
    expect(w.kurallariDegerlendir({ basladi: T0, history: saglikli(T0, 24), merge: merge(20), mergeDosyalar: ["web/api/prisma/migrations/1/migration.sql"] }).karar).toBe("GERI_ALMAZDIM");
    expect(w.kurallariDegerlendir({ basladi: T0, history: saglikli(T0, 24), merge: merge(20), mergeDosyalar: null }).karar).toBe("GERI_ALMAZDIM");
  });
  it("birleştirme bilgisi yoksa geri almaz", () => {
    expect(w.kurallariDegerlendir({ basladi: T0, history: saglikli(T0, 24), merge: null, mergeDosyalar: null }).karar).toBe("GERI_ALMAZDIM");
  });
  it("gölge modu açık", () => expect(w.MOD).toBe("golge"));
});

function sahte(saglik: () => boolean, mergeDk = 20, dosyalar = ["web/frontend/src/a.ts"]) {
  const depo = new Map<string, string>();
  const bucket = {
    get: async (k: string) => (depo.has(k) ? { text: async () => depo.get(k) as string } : null),
    put: async (k: string, v: string) => { depo.set(k, v); },
  };
  const istekler: Array<{ url: string; method: string }> = [];
  const f = async (url: string, init?: { method?: string }) => {
    istekler.push({ url, method: init?.method ?? "GET" });
    if (url.includes("api.github.com")) {
      const sha = "a".repeat(40);
      if (url.includes("/commits?")) return { ok: true, status: 200, json: async () => [{ sha, commit: { message: "Merge pull request #1 from x/y\n\nbaşlık", committer: { date: new Date(T_NOW - mergeDk * DK).toISOString() } } }] };
      return { ok: true, status: 200, json: async () => ({ files: dosyalar.map((filename) => ({ filename })) }) };
    }
    return { status: saglik() ? 200 : 503 };
  };
  return { bucket, f, istekler, depo };
}
let T_NOW = T0;

describe("bekçi: tur akışı", () => {
  it("3 art arda başarısızlıkta olay açar, düzelince kapatır; yalnız GET ve yalnız bekci/ yazar", async () => {
    let iyi = true;
    const s = sahte(() => iyi);
    const env = { BUCKET: s.bucket };
    // 24 saat sağlıklı geçmiş: önceden doldur
    s.depo.set("bekci/durum.json", JSON.stringify({ history: saglikli(T0, 24), streak: 0, basladi: null, olayBasladi: null }));
    T_NOW = T0;
    iyi = false;
    for (let i = 0; i < 3; i++) { T_NOW = T0 + i * 5 * DK; await w.kontrolEt(env, s.f, T_NOW); }
    let kayit = JSON.parse(s.depo.get("bekci/kayit.json") as string);
    expect(kayit.olaylar).toHaveLength(1);
    expect(kayit.olaylar[0].karar).toBe("GERI_ALIRDIM");
    expect(kayit.olaylar[0].bitti).toBeNull();
    // dördüncü kontrol yeni olay açmaz
    T_NOW = T0 + 15 * DK; await w.kontrolEt(env, s.f, T_NOW);
    expect(JSON.parse(s.depo.get("bekci/kayit.json") as string).olaylar).toHaveLength(1);
    // düzelme
    iyi = true; T_NOW = T0 + 20 * DK; await w.kontrolEt(env, s.f, T_NOW);
    kayit = JSON.parse(s.depo.get("bekci/kayit.json") as string);
    expect(kayit.olaylar[0].sureDk).toBe(20);
    expect(kayit.golge).toBe(true);
    expect(s.istekler.every((x) => x.method === "GET")).toBe(true);
    expect([...s.depo.keys()].every((k) => k.startsWith("bekci/"))).toBe(true);
  });
  it("tek ya da iki başarısızlık olay açmaz (deploy sırasındaki kısa kesinti)", async () => {
    let iyi = false;
    const s = sahte(() => iyi);
    const env = { BUCKET: s.bucket };
    T_NOW = T0; await w.kontrolEt(env, s.f, T_NOW);
    T_NOW = T0 + 5 * DK; await w.kontrolEt(env, s.f, T_NOW);
    iyi = true; T_NOW = T0 + 10 * DK; await w.kontrolEt(env, s.f, T_NOW);
    expect(JSON.parse(s.depo.get("bekci/kayit.json") as string).olaylar).toHaveLength(0);
  });
  it("R2 bağlantısı yoksa açıkça hata verir", async () => {
    await expect(w.kontrolEt({}, async () => ({ status: 200 }), T0)).rejects.toThrow(/BUCKET/);
  });
});

describe("bekçi: sabah özeti satırı", () => {
  it("kayıt yoksa nazik not, bayat kayıtta uyarı, olayda dikkat maddesi", () => {
    expect(o.bekciOzet(null, T0).satir).toContain("henüz yok");
    expect(o.bekciOzet(null, T0).dikkat).toHaveLength(0);
    expect(o.bekciOzet({ guncelleme: T0 - 5 * H, son24: { kontrol: 100, basarisiz: 0 }, olaylar: [] }, T0).dikkat[0]).toContain("kayıt yazmadı");
    const r = o.bekciOzet({ guncelleme: T0, son24: { kontrol: 280, basarisiz: 4 }, olaylar: [{ basladi: T0 - 3 * H, bitti: T0 - 2 * H, sureDk: 60, karar: "GERI_ALMAZDIM", kurallar: [{ ad: "x", tamam: false, aciklama: "Önceki kayıt yetersiz." }], sonBirlestirme: { sha: "abc1234" } }] }, T0);
    expect(r.satir).toContain("Gölge modu: hiçbir şey yapılmadı");
    expect(r.satir).toContain("geri ALMAZDIM");
    expect(r.dikkat[0]).toContain("kesinti");
  });
});
