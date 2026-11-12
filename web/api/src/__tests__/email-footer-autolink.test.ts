import { describe, expect, it, vi } from "vitest";

vi.mock("../modules/email/sender-identity.service.js", () => ({
  senderIdentity: () => ({
    legalName: "Ad Soyad",
    entityType: "sole",
    mersisNo: "",
    taxNo: "1234567890",
    phone: "+90 555 000 00 00",
    contactEmail: "info@ornek.test",
    postalAddress: "Örnek Mah. 12. Sok. No: 5 Daire 3 Çankaya / Ankara",
  }),
}));

import { renderCorporateEmail } from "../lib/email-layout.js";

const html = renderCorporateEmail({
  title: "Başlık",
  bodyHtml: "<p>Merhaba</p>",
  unsubscribeUrl: "https://ornek.test/u",
} as never);

describe("altbilgi: adres ve telefon otomatik bağlantıya dönmez", () => {
  it("görünen metin aynı kalır, görünmez ayırıcılar eklenir", () => {
    const gorunen = html.replace(/&#8203;/g, "");
    expect(gorunen).toContain("+90 555 000 00 00");
    expect(gorunen).toContain("Örnek Mah. 12. Sok. No: 5 Daire 3 Çankaya / Ankara");
    expect(gorunen).toContain("Vergi Kimlik No: 1234567890");
    // Ham hâliyle bitişik telefon ve adres kalmamalı (otomatik algılama bunlara tutunur).
    expect(html).not.toContain("+90 555 000 00 00");
    expect(html).not.toContain("12. Sok. No: 5");
  });

  it("e-posta kimlik satırında T.C. numarası yazmaz, çıkış bağlantısı bozulmaz", () => {
    expect(html).not.toContain("T.C. Kimlik");
    expect(html).toContain('href="https://ornek.test/u"');
  });

  it("iletişim e-postası olduğu gibi kalır", () => {
    expect(html).toContain("info@ornek.test");
  });
});
