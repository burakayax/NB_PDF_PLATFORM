import { describe, expect, it } from "vitest";
import {
  filterAudience,
  plainToolName,
  sourceInfo,
  sourceRows,
  stepRows,
  toolRows,
  visitStage,
  type InsightPayer,
  type InsightVisit,
} from "../admin/journey/insightsModel";

type TestEvent = { name: string; toolId?: string | null; extra?: Record<string, unknown> };

function visit(over: Omit<Partial<InsightVisit>, "events"> & { events?: TestEvent[] } = {}): InsightVisit {
  const { events = [], ...rest } = over;
  return {
    id: Math.random().toString(36).slice(2),
    firstSeenAt: "2026-11-16T10:00:00.000Z",
    lastSeenAt: "2026-11-16T10:05:00.000Z",
    userId: null,
    who: null,
    isMember: false,
    referrer: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    landingPath: "/",
    pageCount: 1,
    events: events.map((e) => ({
      name: e.name,
      toolId: e.toolId ?? null,
      extra: e.extra ? JSON.stringify(e.extra) : null,
      createdAt: "2026-11-16T10:01:00.000Z",
    })),
    ...rest,
  };
}

describe("sourceInfo — nereden geldi", () => {
  it("geldiği site bilinen bir ada çevrilir", () => {
    expect(sourceInfo({ referrer: "https://www.google.com/", utmSource: null, utmMedium: null, utmCampaign: null })).toMatchObject({ name: "Google", kind: "Arama motoru" });
    expect(sourceInfo({ referrer: "https://chatgpt.com/", utmSource: null, utmMedium: null, utmCampaign: null })).toMatchObject({ name: "ChatGPT", kind: "Yapay zekâ sohbeti" });
  });
  it("etiket varsa geldiği siteden önce gelir; ücretli ortam 'reklam' sayılır", () => {
    const r = sourceInfo({ referrer: "https://l.facebook.com/", utmSource: "instagram", utmMedium: "social", utmCampaign: "kapak-1" });
    expect(r).toMatchObject({ name: "Instagram", kind: "Sosyal medya", campaign: "kapak-1" });
    expect(sourceInfo({ referrer: null, utmSource: "google", utmMedium: "cpc", utmCampaign: null })).toMatchObject({ name: "Google reklamı", kind: "Reklam" });
  });
  it("bilgi yoksa ya da kendi sitemizdense 'doğrudan' denir", () => {
    expect(sourceInfo(null).kind).toBe("Doğrudan");
    expect(sourceInfo({ referrer: "https://www.pdfplatform.app/", utmSource: null, utmMedium: null, utmCampaign: null }).kind).toBe("Doğrudan");
  });
});

describe("visitStage — en son ulaştığı yer", () => {
  it("en ileri adım kazanır; satın alma vazgeçmeden önce gelir", () => {
    expect(visitStage(visit())).toBe("browsed");
    expect(visitStage(visit({ events: [{ name: "sign_up_cta_shown" }] }))).toBe("finished_tool");
    expect(visitStage(visit({ events: [{ name: "sign_up_cta_shown" }, { name: "sign_up_cta_click" }] }))).toBe("clicked_signup");
    expect(visitStage(visit({ events: [{ name: "view_pricing" }, { name: "select_plan" }] }))).toBe("started_payment");
    expect(visitStage(visit({ events: [{ name: "select_plan" }, { name: "checkout_abandoned" }] }))).toBe("abandoned");
    expect(visitStage(visit({ events: [{ name: "checkout_abandoned" }, { name: "purchase" }] }))).toBe("purchased");
  });
});

describe("sayımlar", () => {
  const visits = [
    visit({ events: [{ name: "sign_up_cta_shown", toolId: "merge_success" }, { name: "sign_up_cta_click", toolId: "merge_success" }] }),
    visit({ events: [{ name: "sign_up_cta_shown", toolId: "merge_success" }] }),
    visit({ isMember: true, events: [{ name: "view_pricing", extra: { reason_tool: "compress" } }, { name: "purchase" }] }),
    visit(),
  ];

  it("adım adım tablosu doğru sayar", () => {
    const rows = Object.fromEntries(stepRows(visits).map((r) => [r.id, r.count]));
    expect(rows).toMatchObject({ visit: 4, tool: 2, click: 1, pricing: 1, buy: 1 });
  });

  it("misafir / üye süzgeci", () => {
    expect(filterAudience(visits, "guest")).toHaveLength(3);
    expect(filterAudience(visits, "member")).toHaveLength(1);
    expect(filterAudience(visits, "all")).toHaveLength(4);
  });

  it("araç tablosu araç adlarını okunur yapar ve toplar", () => {
    const rows = toolRows(visits);
    const merge = rows.find((r) => r.name === plainToolName("merge_success"))!;
    expect(merge.finished).toBe(2);
    expect(merge.clicked).toBe(1);
    expect(merge.name).not.toContain("_");
  });

  it("kaynak tablosunda satın alma, ödeme kaydındaki ilk geldiği yerden sayılır", () => {
    const payer = {
      kind: "plan",
      source: { referrer: "https://www.google.com/", utmSource: null, utmMedium: null, utmCampaign: null, landingPath: "/", firstVisitAt: null },
    } as unknown as InsightPayer;
    const g = visit({ referrer: "https://www.google.com/" });
    const rows = sourceRows([g, visit()], [payer]);
    expect(rows.find((r) => r.name === "Google")).toMatchObject({ visitors: 1, bought: 1 });
  });
});

describe("sayfa listesi", () => {
  it("adresi okunur ada çevirir", async () => {
    const { pageLabel } = await import("../admin/journey/insightsModel");
    expect(pageLabel("/")).toBe("Ana sayfa");
    expect(pageLabel("/tools/pdf-sikistir")).toBe("Araç: pdf sikistir");
    expect(pageLabel("/blog/pdf-nedir/?utm_source=x")).toBe("Blog: pdf nedir");
  });
  it("hangi sayfaya kaç farklı kişi baktığını sayar", async () => {
    const { pageRows } = await import("../admin/journey/insightsModel");
    const mk = (id: string, pages: Array<[string, number]>) =>
      ({ id, firstSeenAt: "", lastSeenAt: "", userId: null, who: null, isMember: false, referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, landingPath: "/", pageCount: 1, events: [], pages: pages.map(([path, views]) => ({ path, views, at: "" })) }) as never;
    const rows = pageRows([mk("a", [["/tools/x", 2], ["/", 1]]), mk("b", [["/tools/x", 1]])]);
    expect(rows[0]).toMatchObject({ path: "/tools/x", visitors: 2, views: 3 });
  });
});
