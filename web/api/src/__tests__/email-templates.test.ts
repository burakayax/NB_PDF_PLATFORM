import { describe, it, expect } from "vitest";

import { buildWelcomeEmail } from "../lib/email-service.js";
import {
  createAdminNotificationEmailTemplate,
  createVerificationEmailTemplate,
} from "../modules/auth/auth.email.js";

describe("hoş geldin e-postası", () => {
  it("hediye AI işlemini konuda, ön izlemede ve gövdede vurgular", () => {
    const m = buildWelcomeEmail({ name: "Ayşe", giftCredits: 3 });
    expect(m.subject).toContain("3 ücretsiz yapay zekâ işlemi");
    expect(m.html).toContain("3 ücretsiz yapay zekâ işlemi hesabınıza tanımlandı");
    expect(m.text).toContain("3 ücretsiz yapay zekâ işlemi");
  });

  it("hediye 0 ise hediye bloğu ve konu vurgusu yoktur", () => {
    const m = buildWelcomeEmail({ name: "Ayşe", giftCredits: 0 });
    expect(m.subject).not.toContain("yapay zekâ");
    expect(m.html).not.toContain("hesabınıza tanımlandı");
  });

  it("işlem iletisidir: ücretli plana çağrı (Pro/indirim/yükselt) İÇERMEZ", () => {
    // Onay kapısı olmayan e-postada ticari özendirme olmamalı (Ticari İletişim Yönetmeliği).
    const m = buildWelcomeEmail({ name: "Ayşe", giftCredits: 3 });
    const gorunen = (m.html + m.text).toLowerCase();
    for (const yasak of ["pro'ya", "indirim", "yükselt", "planları gör", "kupon"]) {
      expect(gorunen).not.toContain(yasak);
    }
  });

  it("ad HTML'e kaçışlanır", () => {
    const m = buildWelcomeEmail({ name: "<script>alert(1)</script>", giftCredits: 1 });
    expect(m.html).not.toContain("<script>alert(1)</script>");
  });

  it("günlük hak sayısı gövdede yazar", () => {
    const m = buildWelcomeEmail({ name: "A", giftCredits: 0, dailyLimit: 3 });
    expect(m.html).toContain("Günde 3 sunucu işlemi");
  });
});

describe("yönetici yeni üye bildirimi", () => {
  const base = {
    userEmail: "ayse@example.com",
    registeredAt: "2026-10-14T12:25:00.000Z",
    productName: "PDF PLATFORM",
  };

  it("temel alanlarla da çalışır (eski çağrı biçimi)", () => {
    const m = createAdminNotificationEmailTemplate(base);
    expect(m.subject).toContain("ayse@example.com");
    expect(m.html).toContain("ayse@example.com");
  });

  it("zengin bilgi: ad, yöntem, durum, konum, sayaçlar ve yönetim bağlantısı", () => {
    const m = createAdminNotificationEmailTemplate({
      ...base,
      fullName: "Ayşe Yılmaz",
      authProvider: "google",
      verified: true,
      country: "Türkiye",
      city: "İzmir",
      marketingConsent: true,
      totalUsers: 27,
      todayUsers: 3,
      adminUrl: "https://www.pdfplatform.app/admin",
    });
    expect(m.subject).toBe("Yeni üye: Ayşe Yılmaz (ayse@example.com)");
    expect(m.html).toContain("Google hesabı");
    expect(m.html).toContain("E-posta doğrulandı");
    expect(m.html).toContain("İzmir, Türkiye");
    expect(m.html).toContain(">27<");
    expect(m.html).toContain("https://www.pdfplatform.app/admin");
    expect(m.text).toContain("Toplam üye: 27");
  });

  it("doğrulanmamış hesap 'bekleniyor' diye işaretlenir; kullanıcı girdisi kaçışlanır", () => {
    const m = createAdminNotificationEmailTemplate({
      ...base,
      fullName: "<b>x</b>",
      verified: false,
    });
    expect(m.html).toContain("doğrulaması bekleniyor");
    expect(m.html).not.toContain("<b>x</b>");
  });
});

describe("doğrulama e-postası", () => {
  it("bağlantı, süre ve düğme metni vardır; kurumsal düzen kullanır", () => {
    const m = createVerificationEmailTemplate({
      verificationUrl: "https://api.example.com/verify?token=abc",
      productName: "PDF PLATFORM",
      expiresInHours: 24,
    });
    expect(m.html).toContain("https://api.example.com/verify?token=abc");
    expect(m.html).toContain("24 saat");
    expect(m.html).toContain("NB GLOBAL STUDIO");
    expect(m.text).toContain("https://api.example.com/verify?token=abc");
  });
});
