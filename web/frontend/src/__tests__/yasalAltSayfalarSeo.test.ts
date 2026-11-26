import { describe, expect, it } from "vitest";
import { LEGAL_SEO } from "../seo/seoContent.mjs";
import { legalDocuments } from "../content/legalContent.mjs";

/** /legal/* sayfaları ana sayfa kopyası olarak dizine girmesin: her birinin kendi başlığı/açıklaması ve gerçek metni olmalı. */
const ALT = ["on-bilgilendirme", "mesafeli-satis", "iptal-iade", "cerez-politikasi"];

describe("yasal alt sayfalar SEO", () => {
  for (const k of ALT) {
    it(`${k}: TR+EN kendi başlığı ve açıklaması var, metin kaynağı mevcut`, () => {
      for (const lang of ["tr", "en"] as const) {
        const c = (LEGAL_SEO as Record<string, Record<string, { title: string; description: string; h1: string }>>)[`legal/${k}`]?.[lang];
        expect(c, `${k} ${lang}`).toBeTruthy();
        expect(c.title.length).toBeGreaterThan(5);
        expect(c.description.length).toBeGreaterThan(40);
        expect(c.description.length).toBeLessThanOrEqual(170);
        const doc = (legalDocuments as unknown as Record<string, Record<string, { sections: unknown[] }>>)[lang][k];
        expect(doc.sections.length).toBeGreaterThan(0);
      }
    });
  }
});
