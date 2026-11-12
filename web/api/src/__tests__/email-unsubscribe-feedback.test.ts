import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  userFind: vi.fn(),
  userUpdate: vi.fn(),
  logFindFirst: vi.fn(),
  logUpdate: vi.fn(),
  logCreate: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: m.userFind, update: m.userUpdate, updateMany: vi.fn() },
    marketingConsentLog: { findFirst: m.logFindFirst, update: m.logUpdate, create: m.logCreate },
  },
}));
vi.mock("../lib/mailer.js", () => ({ sendMail: m.sendMail }));

import {
  makeUnsubscribeToken,
  resubscribeByToken,
  saveUnsubscribeFeedback,
} from "../modules/email/email-unsubscribe.service.js";

const token = makeUnsubscribeToken("u1");

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.userFind.mockResolvedValue({ email: "kisi@ornek.test" });
  m.logFindFirst.mockResolvedValue({ id: "log1" });
});

describe("çıkış nedeni", () => {
  it("nedeni deftere yazar ve yöneticiye e-posta gönderir", async () => {
    const ok = await saveUnsubscribeFeedback(token, { reason: "too_many", comment: "Haftada üç kez geldi" });
    expect(ok).toBe(true);
    expect(m.logUpdate).toHaveBeenCalledWith({
      where: { id: "log1" },
      data: { consentText: "Ret nedeni: Çok sık e-posta alıyorum — Haftada üç kez geldi" },
    });
    expect(m.sendMail).toHaveBeenCalledOnce();
    const mail = m.sendMail.mock.calls[0][0];
    expect(mail.html).toContain("Çok sık e-posta alıyorum");
    expect(mail.html).toContain("Haftada üç kez geldi");
  });

  it("yorumdaki HTML e-postada etkisizleştirilir", async () => {
    await saveUnsubscribeFeedback(token, { reason: "other", comment: "<script>x</script>" });
    expect(m.sendMail.mock.calls[0][0].html).not.toContain("<script>");
  });

  it("geçersiz token ya da bilinmeyen neden reddedilir, e-posta gitmez", async () => {
    expect(await saveUnsubscribeFeedback("bozuk.token", { reason: "too_many", comment: "" })).toBe(false);
    expect(await saveUnsubscribeFeedback(token, { reason: "uydurma", comment: "" })).toBe(false);
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("e-posta gönderilemese de kayıt başarılı sayılır", async () => {
    m.sendMail.mockRejectedValue(new Error("smtp"));
    expect(await saveUnsubscribeFeedback(token, { reason: "other", comment: "" })).toBe(true);
  });
});

describe("yeniden abone ol", () => {
  it("izni açar ve onayı kanıt defterine yazar", async () => {
    const ok = await resubscribeByToken(token, { ip: "1.2.3.4", userAgent: "ua" });
    expect(ok).toBe(true);
    expect(m.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ marketingConsent: true, marketingUnsubscribedAt: null }),
      }),
    );
    expect(m.logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ granted: true, source: "unsubscribe_page", email: "kisi@ornek.test" }),
      }),
    );
  });

  it("geçersiz token ile hiçbir şey değişmez", async () => {
    expect(await resubscribeByToken("bozuk.token")).toBe(false);
    expect(m.userUpdate).not.toHaveBeenCalled();
  });
});
