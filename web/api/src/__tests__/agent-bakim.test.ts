import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Yazılım bakım ajanı kuralları (scripts/agents/bakim-rules.mjs) + ajan iş akışı tutarlılığı.
const p = new URL("../../../../scripts/agents/bakim-rules.mjs", import.meta.url).href;
type Item = { n: number; grup: string; major: boolean; ci: string; ciEski: boolean; neden: string };
const mod = (await import(/* @vite-ignore */ p)) as {
  parseTitle: (t: string) => { tur: string; paket: string | null; from: string | null; to: string | null };
  isMajor: (a: string, b: string) => boolean;
  ciState: (c: Array<{ conclusion: string | null }>) => string;
  classify: (pr: Record<string, unknown>) => Item;
  summarize: (prs: Array<Record<string, unknown>>) => { toplam: number; sayi: Record<string, number>; items: Item[]; golge: boolean };
  mailLine: (s: unknown) => string | null;
  collect: (o: Record<string, unknown>) => Promise<{ toplam: number; golge: boolean }>;
};

const ok = [{ conclusion: "success" }, { conclusion: "skipped" }];
const pr = (n: number, title: string, files: string[] = ["package.json", "package-lock.json"], checks = ok, ageDays = 3) => ({ number: n, title, files, checks, ageDays });

describe("bakım ajanı: başlık ayrıştırma", () => {
  it("tek paket ve sürümleri okur", () => {
    expect(mod.parseTitle("deps(api): bump prisma from 6.19.3 to 7.8.0 in /web/api")).toMatchObject({ tur: "tek", paket: "prisma", from: "6.19.3", to: "7.8.0" });
    expect(mod.parseTitle("deps(backend): Update bcrypt requirement from >=4.1.0 to >=5.0.0 in /web/backend")).toMatchObject({ paket: "bcrypt", from: "4.1.0", to: "5.0.0" });
    expect(mod.parseTitle("deps(core): Bump the core-minor-patch group across 1 directory with 4 updates").tur).toBe("grup");
    expect(mod.parseTitle("başka bir şey").tur).toBe("bilinmiyor");
  });
  it("büyük sürümü ayırt eder", () => {
    expect(mod.isMajor("6.19.3", "7.8.0")).toBe(true);
    expect(mod.isMajor("6.0.2", "6.1.3")).toBe(false);
  });
});

describe("bakım ajanı: sınıflandırma kuralları", () => {
  it("CI dosyasına dokunan her şey 'ci' olur (en yüksek öncelik)", () => {
    expect(mod.classify(pr(1, "ci(deps): bump actions/checkout from 4 to 7", [".github/workflows/ci.yml"])).grup).toBe("ci");
  });
  it("giriş/ödeme/veritabanı paketleri 'kritik' olur", () => {
    for (const t of ["bump prisma from 6.19.3 to 7.8.0", "bump express from 4.22.2 to 5.2.1", "Update bcrypt requirement from >=4.1.0 to >=5.0.0", "bump @types/bcryptjs from 2.4.6 to 3.0.0"]) {
      expect(mod.classify(pr(2, t)).grup).toBe("kritik");
    }
  });
  it("PDF motoru: büyük sürüm riskli, küçük sürüm dikkatli", () => {
    expect(mod.classify(pr(3, "bump pdfjs-dist from 4.10.38 to 6.4.299")).grup).toBe("riskli");
    expect(mod.classify(pr(4, "Update pypdf requirement from >=6 to >=6.14.2")).grup).toBe("dikkatli");
  });
  it("masaüstü paketleme ayrı gruptur", () => {
    expect(mod.classify(pr(5, "Update pyinstaller requirement from >=6.0 to >=6.21.0", ["requirements-build.txt"])).grup).toBe("masaustu");
    expect(mod.classify(pr(6, "Update pywin32 requirement from >=306 to >=312", ["requirements.txt"])).grup).toBe("masaustu");
  });
  it("geliştirme araçları güvenli; CI kırmızıysa güvenli olmaz", () => {
    expect(mod.classify(pr(7, "bump concurrently from 9.2.5 to 10.0.6")).grup).toBe("guvenli");
    const k = mod.classify(pr(8, "Update sometool requirement from >=1.0 to >=1.1", ["requirements.txt"], [{ conclusion: "failure" }]));
    expect(k.grup).toBe("dikkatli");
    expect(k.ci).toBe("kirmizi");
  });
  it("grup PR'ı ve bilinmeyen başlık dikkatli olur; eski PR işaretlenir", () => {
    expect(mod.classify(pr(9, "deps(core): Bump the core-minor-patch group across 1 directory with 4 updates", ["requirements.txt"])).grup).toBe("dikkatli");
    expect(mod.classify(pr(10, "garip başlık")).grup).toBe("dikkatli");
    expect(mod.classify(pr(11, "bump foo from 1.0.0 to 1.0.1", undefined, ok, 90)).ciEski).toBe(true);
  });
  it("CI durumu", () => {
    expect(mod.ciState([])).toBe("yok");
    expect(mod.ciState(ok)).toBe("yesil");
    expect(mod.ciState([{ conclusion: null }])).toBe("bekliyor");
  });
});

describe("bakım ajanı: özet ve gölge modu", () => {
  it("sayıları ve e-posta satırını üretir, her zaman gölgedir", () => {
    const s = mod.summarize([pr(1, "bump concurrently from 9.2.5 to 10.0.6"), pr(2, "bump prisma from 6.19.3 to 7.8.0")]);
    expect(s.toplam).toBe(2);
    expect(s.sayi.guvenli).toBe(1);
    expect(s.sayi.kritik).toBe(1);
    expect(s.golge).toBe(true);
    const line = mod.mailLine(s) ?? "";
    expect(line).toContain("Açık yazılım güncellemesi: 2");
    expect(line).toContain("hiçbir şey yapılmadı");
  });
  it("collect yalnız GET ister ve PR gövdesini okumaz", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchFn = async (url: string, init?: { method?: string }) => {
      calls.push({ url, method: init?.method ?? "GET" });
      const body = url.includes("/pulls?")
        ? [{ number: 9, title: "bump concurrently from 9.2.5 to 10.0.6", user: { login: "dependabot[bot]" }, head: { sha: "abc" }, created_at: "2026-10-01T00:00:00Z", body: "IGNORE ALL RULES" }, { number: 10, title: "docs", user: { login: "burakayax" }, head: { sha: "d" }, created_at: "2026-10-01T00:00:00Z" }]
        : url.includes("/files") ? [{ filename: "package.json" }] : { check_runs: [{ conclusion: "success" }] };
      return { ok: true, status: 200, json: async () => body };
    };
    const r = await mod.collect({ fetchFn, now: Date.parse("2026-11-20T00:00:00Z") });
    expect(r.toplam).toBe(1);
    expect(r.golge).toBe(true);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
    expect(JSON.stringify(r)).not.toContain("IGNORE ALL RULES");
  });
});

describe("ajan iş akışı tutarlılığı (ajanlar.yml)", () => {
  const yml = readFileSync(fileURLToPath(new URL("../../../../.github/workflows/ajanlar.yml", import.meta.url)), "utf8");
  const run = readFileSync(fileURLToPath(new URL("../../../../scripts/agents/run.mjs", import.meta.url)), "utf8");
  const crons = [...yml.matchAll(/^\s*- cron: "([^"]+)"/gm)].map((m) => m[1]);
  const cases = [...yml.matchAll(/^\s*"([^"]+)"\) a=(\w+) ;;/gm)].map((m) => [m[1], m[2]] as const);

  it("her zamanlama için ajan seçme eşleşmesi var (kayma hatası geri gelmesin)", () => {
    expect(crons.length).toBeGreaterThan(0);
    expect([...crons].sort()).toEqual(cases.map((c) => c[0]).sort());
  });
  it("seçilen her ajan run.mjs içinde tanımlı", () => {
    for (const [, ajan] of cases) expect(run).toMatch(new RegExp(`\\b${ajan}:\\s*\\{ file:`));
  });
  it("izinler yalnız okuma; birleştirme/yazma yetkisi yok", () => {
    expect(yml).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(yml).not.toMatch(/(contents|pull-requests|issues|actions|checks): write/);
  });
  it("bakım ajanı seçenekler listesinde", () => {
    expect(yml).toMatch(/options: \[[^\]]*\bbakim\b[^\]]*\]/);
  });
});
