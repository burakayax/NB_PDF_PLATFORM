import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  userFind: vi.fn(),
  userUpdate: vi.fn(),
  userUpdateMany: vi.fn(),
  logFindFirst: vi.fn(),
  logUpdate: vi.fn(),
  logCreate: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: m.userFind, update: m.userUpdate, updateMany: m.userUpdateMany },
    marketingConsentLog: { findFirst: m.logFindFirst, update: m.logUpdate, create: m.logCreate },
  },
}));
vi.mock("../lib/mailer.js", () => ({ sendMail: m.sendMail }));

import {
  makeUnsubscribeToken,
  resubscribeByToken,
  unsubscribeByToken,
  saveUnsubscribeFeedback,
} from "../modules/email/email-unsubscribe.service.js";

const token = makeUnsubscribeToken("u1");

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.userFind.mockResolvedValue({ email: "kisi@ornek.test", marketingConsent: false });
  m.logFindFirst.mockResolvedValue({ id: "log1", consentText: null });
});

describe("çıkış nedeni", () => {
  it("nedeni deftere yazar ve yöneticiye e-posta gönderir", async () => {
    const ok = await saveUnsubscribeFeedback(token, { reason: "too_many", comment: "Haftada üç kez geldi" });
    expect(ok).toBe("ok");
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
    expect(await saveUnsubscribeFeedback("bozuk.token", { reason: "too_many", comment: "" })).toBe("invalid");
    expect(await saveUnsubscribeFeedback(token, { reason: "uydurma", comment: "" })).toBe("invalid");
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("e-posta gönderilemese de kayıt başarılı sayılır", async () => {
    m.sendMail.mockRejectedValue(new Error("smtp"));
    expect(await saveUnsubscribeFeedback(token, { reason: "other", comment: "" })).toBe("ok");
  });
});

describe("yeniden abone ol", () => {
  it("izni açar ve onayı kanıt defterine yazar", async () => {
    const ok = await resubscribeByToken(token, { ip: "1.2.3.4", userAgent: "ua" });
    expect(ok).toBe("done");
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
    expect(await resubscribeByToken("bozuk.token")).toBe("invalid");
    expect(m.userUpdate).not.toHaveBeenCalled();
  });
});

describe("zaten listede olmayan kişi", () => {
  it("aynı çıkış bağlantısına tekrar tıklamak yazı yapmaz ve 'already' döner", async () => {
    const r = await unsubscribeByToken(token);
    expect(r.status).toBe("already");
    expect(m.userUpdateMany).not.toHaveBeenCalled();
    expect(m.logCreate).not.toHaveBeenCalled();
  });

  it("listedeyken ilk tıklama çıkarır ve defter satırı ekler", async () => {
    m.userFind.mockResolvedValue({ email: "kisi@ornek.test", marketingConsent: true });
    const r = await unsubscribeByToken(token);
    expect(r.status).toBe("done");
    expect(m.userUpdateMany).toHaveBeenCalledOnce();
    expect(m.logCreate).toHaveBeenCalledOnce();
  });

  it("neden daha önce verildiyse tekrar sorulmaz", async () => {
    m.logFindFirst.mockResolvedValue({ id: "log1", consentText: "Ret nedeni: Diğer" });
    const r = await unsubscribeByToken(token);
    expect(r).toEqual({ status: "already", hasReason: true });
  });

  it("ikinci geri bildirim kaydedilmez, yöneticiye ikinci e-posta gitmez", async () => {
    m.logFindFirst.mockResolvedValue({ id: "log1", consentText: "Ret nedeni: Diğer" });
    expect(await saveUnsubscribeFeedback(token, { reason: "too_many", comment: "" })).toBe("duplicate");
    expect(m.sendMail).not.toHaveBeenCalled();
    expect(m.logUpdate).not.toHaveBeenCalled();
  });

  it("listede olan kişi için neden kaydedilmez", async () => {
    m.userFind.mockResolvedValue({ email: "kisi@ornek.test", marketingConsent: true });
    expect(await saveUnsubscribeFeedback(token, { reason: "too_many", comment: "" })).toBe("invalid");
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("zaten abone olan 'yeniden abone ol'a basarsa deftere satır eklenmez", async () => {
    m.userFind.mockResolvedValue({ email: "kisi@ornek.test", marketingConsent: true });
    expect(await resubscribeByToken(token)).toBe("already");
    expect(m.logCreate).not.toHaveBeenCalled();
  });
});
