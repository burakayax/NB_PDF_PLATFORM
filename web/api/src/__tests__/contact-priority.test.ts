import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: Array<{ subject: string; text?: string; html?: string }> = [];
let foundPlan: string | null = null;

vi.mock("../lib/mailer.js", () => ({
  sendMail: vi.fn(async (m: { subject: string; text?: string; html?: string }) => {
    sent.push(m);
  }),
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: { findFirst: vi.fn(async () => (foundPlan ? { plan: foundPlan } : null)) },
  },
}));

import { submitContactMessage } from "../modules/contact/contact.service.js";

const input = { name: "Ayşe", email: "Ayse@Example.com", message: "Merhaba, bir sorum var." };

describe("İletişim formu: öncelikli destek etiketi", () => {
  beforeEach(() => {
    sent.length = 0;
    foundPlan = null;
  });

  it("Pro üyeden gelen mesajın konusu ÖNCELİKLİ etiketi taşır", async () => {
    foundPlan = "PRO";
    await submitContactMessage(input);
    expect(sent[0]?.subject).toBe("[ÖNCELİKLİ · Pro] Yeni İletişim Mesajı - Ayşe");
    expect(sent[0]?.text).toContain("ÖNCELİKLİ");
    expect(sent[0]?.html).toContain("ÖNCELİKLİ · Pro");
  });

  it("Business üyeden gelen mesaj da etiketlenir", async () => {
    foundPlan = "BUSINESS";
    await submitContactMessage(input);
    expect(sent[0]?.subject).toBe("[ÖNCELİKLİ · Business] Yeni İletişim Mesajı - Ayşe");
  });

  it("Plus, ücretsiz ya da üye olmayan kişinin mesajı normal gider", async () => {
    foundPlan = "PLUS";
    await submitContactMessage(input);
    foundPlan = null;
    await submitContactMessage(input);
    expect(sent[0]?.subject).toBe("Yeni İletişim Mesajı - Ayşe");
    expect(sent[1]?.subject).toBe("Yeni İletişim Mesajı - Ayşe");
  });
});
