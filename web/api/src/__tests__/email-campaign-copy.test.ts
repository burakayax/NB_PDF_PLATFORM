import { describe, expect, it } from "vitest";

import { buildDefaultCampaigns, renderCampaign } from "../modules/email/emailCampaign.service.js";
import { AI_MONTHLY_CREDITS, PLAN_LIMITS } from "../lib/plan-catalogue.js";
import { greetingHtml } from "../lib/email-i18n.js";

const all = buildDefaultCampaigns() as Array<Record<string, string | number | null>>;
const text = (c: Record<string, string | number | null>) =>
  [c.subjectTr, c.titleTr, c.introTr, c.bodyTr, c.subjectEn, c.titleEn, c.introEn, c.bodyEn].join("\n");

describe("tanıtım e-postası metinleri dürüst", () => {
  it("altı varsayılan kampanya var ve her birinin TR ve EN metni dolu", () => {
    expect(all).toHaveLength(6);
    for (const c of all) {
      for (const k of ["subjectTr", "subjectEn", "titleTr", "titleEn", "bodyTr", "bodyEn", "ctaLabelTr", "ctaLabelEn"]) {
        expect(String(c[k] ?? "").length, `${c.name} ${k}`).toBeGreaterThan(0);
      }
    }
  });

  it("olmayan indirim, abartı ya da emoji vaadi içermez", () => {
    for (const c of all) {
      const t = text(c).toLowerCase();
      expect(t, String(c.name)).not.toMatch(/indirim|discount|ücretsiz ve sınırsız|free and unlimited|🎉|🚀/);
      // Kupon tanımlı değilken "size özel" gibi yok vaat edilmez.
      if (!c.couponCode) expect(t, String(c.name)).not.toMatch(/size özel|just for you|personal/);
    }
  });

  it("sayılar plan kataloğundan geliyor", () => {
    const joined = all.map((c) => String(c.bodyTr)).join("\n");
    expect(joined).toContain(`günde ${PLAN_LIMITS.FREE.dailyOperationLimit}, ayda ${PLAN_LIMITS.FREE.monthlyOperationLimit}`);
    expect(joined).toContain(`ayda ${AI_MONTHLY_CREDITS.PRO} yapay zekâ işlemi`);
    expect(joined).toContain(`${PLAN_LIMITS.PRO.fileSizeLimitMB} MB`);
  });

  it("yapay zekâ araçlarının ücretli olduğunu açıkça söyler", () => {
    const ai = all.find((c) => String(c.name).startsWith("Yükseltme"))!;
    expect(String(ai.bodyTr)).toContain("ücretlidir");
    expect(String(ai.bodyTr)).toContain("Başlangıç ya da üzeri");
    expect(String(ai.bodyEn)).toContain("paid");
  });

  it("sunucuda çalışan araçlara 'tarayıcıda çalışır' denmez", () => {
    const edit = all.find((c) => String(c.name).startsWith("Özellik keşfi"))!;
    expect(String(edit.bodyTr)).toMatch(/PDF Düzenle[^\n]*Sunucuda işlenir/);
  });
});

describe("karşılama satırı", () => {
  it("ad yoksa 'Merhaba Merhaba' yazmaz", () => {
    expect(greetingHtml("tr", "")).toBe("Merhaba,");
    expect(greetingHtml("tr", "Merhaba")).toBe("Merhaba,");
    expect(greetingHtml("en", "there")).toBe("Hi,");
    expect(greetingHtml("tr", "Burak")).toContain("Burak");
  });

  it("kampanya gövdesindeki araç listesi numaralı satırlara dönüşür", () => {
    const c = all[0] as never;
    const { html } = renderCampaign(c, "tr", { name: "Burak", unsubscribeUrl: "https://ornek.test/u" });
    expect(html).toContain("PDF Birleştir");
    expect(html).toContain("E-posta aboneliğinden çık");
    expect(html).toMatch(/>1<\/div>/);
  });
});
