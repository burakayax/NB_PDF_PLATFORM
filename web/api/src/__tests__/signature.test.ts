import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * BAŞKASINDAN İMZA İSTEME.
 *
 * Elektronik imzanın hukuki dayanağı dört şeyin kanıtlanmasına bağlıdır:
 * imzalayanın NİYETİ, açık RIZASI, imzanın KİME ait olduğu ve belgenin
 * BÜTÜNLÜĞÜ. Buradaki testler bu dördünü koruyan davranışları sabitler —
 * özellikle "rıza olmadan imza yok" ve "imza, imzalayanın gönderdiği dosyaya
 * değil sunucudaki özgün belgeye uygulanır" kurallarını.
 */

const requestCreate = vi.fn();
const requestFindUnique = vi.fn();
const requestFindFirst = vi.fn();
const requestFindMany = vi.fn();
const requestUpdate = vi.fn();
const eventCreate = vi.fn();
const eventFindMany = vi.fn();
const userFindUnique = vi.fn();
const gonderilenPostalar: { to: string; subject: string }[] = [];
const imzaliBelgeUret = vi.fn(async () => new Uint8Array([1, 2, 3, 4]));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    signatureRequest: {
      create: (...a: unknown[]) => requestCreate(...a),
      findUnique: (...a: unknown[]) => requestFindUnique(...a),
      findFirst: (...a: unknown[]) => requestFindFirst(...a),
      findMany: (...a: unknown[]) => requestFindMany(...a),
      update: (...a: unknown[]) => requestUpdate(...a),
    },
    signatureEvent: {
      create: (...a: unknown[]) => eventCreate(...a),
      findMany: (...a: unknown[]) => eventFindMany(...a),
    },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
  },
}));
vi.mock("../lib/mailer.js", () => ({
  sendMail: vi.fn(async (m: { to: string; subject: string }) => {
    gonderilenPostalar.push(m);
  }),
}));
vi.mock("../lib/file-log.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../config/env.js", () => ({ env: { FRONTEND_ORIGIN: "https://pdfplatform.app" } }));
vi.mock("../modules/signature/signature.pdf.js", async () => {
  const { createHash } = await import("node:crypto");
  return {
    imzaliBelgeUret: (...a: unknown[]) => imzaliBelgeUret(...(a as [])),
    sha256: (v: Uint8Array) => createHash("sha256").update(v).digest("hex"),
  };
});

const svc = await import("../modules/signature/signature.service.js");

const pdf = Buffer.from("%PDF-1.7\n" + "x".repeat(200), "latin1");
const imzaPng = Buffer.from("x".repeat(500)).toString("base64");

beforeEach(() => {
  [requestCreate, requestFindUnique, requestFindFirst, requestFindMany, requestUpdate,
   eventCreate, eventFindMany, userFindUnique, imzaliBelgeUret].forEach((f) => f.mockReset());
  gonderilenPostalar.length = 0;
  eventCreate.mockResolvedValue({});
  eventFindMany.mockResolvedValue([]);
  imzaliBelgeUret.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
  userFindUnique.mockResolvedValue({ email: "gonderen@ornek.com", name: "Ayşe Yılmaz", firstName: "Ayşe" });
  requestCreate.mockResolvedValue({ id: "istek1", title: "Sözleşme" });
});

function bekleyenIstek(ustune: Record<string, unknown> = {}) {
  return {
    id: "istek1",
    title: "Sözleşme",
    filename: "sozlesme.pdf",
    message: null,
    status: "PENDING",
    signerEmail: "imzalayan@ornek.com",
    signerName: null,
    expiresAt: new Date(Date.now() + 86_400_000),
    originalData: pdf,
    originalHash: "abc",
    owner: { email: "gonderen@ornek.com", name: "Ayşe Yılmaz", firstName: "Ayşe" },
    ...ustune,
  };
}

describe("istek oluşturma", () => {
  it("PDF olmayan dosyayı reddeder", async () => {
    await expect(
      svc.imzaIstegiOlustur("u1", {
        belge: Buffer.from("MZ programdir"),
        filename: "virus.exe",
        title: "x",
        signerEmail: "a@b.com",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("geçersiz e-postayı reddeder", async () => {
    await expect(
      svc.imzaIstegiOlustur("u1", { belge: pdf, filename: "a.pdf", title: "x", signerEmail: "eposta-degil" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("bağlantı anahtarını AÇIK saklamaz, yalnız özetini tutar", async () => {
    const { baglanti } = await svc.imzaIstegiOlustur("u1", {
      belge: pdf,
      filename: "sozlesme.pdf",
      title: "Sözleşme",
      signerEmail: "imzalayan@ornek.com",
    });
    const kayit = requestCreate.mock.calls[0]![0].data;
    const anahtar = baglanti.split("/").pop()!;
    expect(kayit.tokenHash).not.toBe(anahtar);
    expect(kayit.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("belgenin parmak izini kaydeder (bütünlük kanıtı)", async () => {
    await svc.imzaIstegiOlustur("u1", {
      belge: pdf, filename: "a.pdf", title: "x", signerEmail: "a@b.com",
    });
    expect(requestCreate.mock.calls[0]![0].data.originalHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("imzalayacak kişiye bağlantıyı e-postayla gönderir", async () => {
    await svc.imzaIstegiOlustur("u1", {
      belge: pdf, filename: "a.pdf", title: "Sözleşme", signerEmail: "imzalayan@ornek.com",
    });
    expect(gonderilenPostalar[0]!.to).toBe("imzalayan@ornek.com");
  });
});

describe("imzalama", () => {
  it("RIZA olmadan imza uygulanmaz", async () => {
    requestFindUnique.mockResolvedValue(bekleyenIstek());
    await expect(
      svc.imzayiUygula("t", {
        imzaPngBase64: imzaPng, imzalayanAd: "Mehmet Demir",
        yerlesim: { sayfa: 1, xOran: 0.5, yOran: 0.8, genislikOran: 0.25 }, riza: false,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it("imzayı SUNUCUDAKİ özgün belgeye uygular (imzalayandan dosya kabul etmez)", async () => {
    requestFindUnique.mockResolvedValue(bekleyenIstek());
    requestUpdate.mockResolvedValue({});
    await svc.imzayiUygula("t", {
      imzaPngBase64: imzaPng, imzalayanAd: "Mehmet Demir",
      yerlesim: { sayfa: 1, xOran: 0.5, yOran: 0.8, genislikOran: 0.25 }, riza: true,
    });
    const girdi = imzaliBelgeUret.mock.calls[0]![0] as { ozgunPdf: Uint8Array };
    expect(Buffer.from(girdi.ozgunPdf).equals(pdf)).toBe(true);
  });

  it("imzalı belgenin parmak izini de kaydeder", async () => {
    requestFindUnique.mockResolvedValue(bekleyenIstek());
    requestUpdate.mockResolvedValue({});
    await svc.imzayiUygula("t", {
      imzaPngBase64: imzaPng, imzalayanAd: "Mehmet Demir",
      yerlesim: { sayfa: 1, xOran: 0.5, yOran: 0.8, genislikOran: 0.25 }, riza: true,
    });
    const veri = requestUpdate.mock.calls[0]![0].data;
    expect(veri.status).toBe("SIGNED");
    expect(veri.signedHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rızayı ayrı bir olay olarak kaydeder (niyetin kanıtı)", async () => {
    requestFindUnique.mockResolvedValue(bekleyenIstek());
    requestUpdate.mockResolvedValue({});
    await svc.imzayiUygula("t", {
      imzaPngBase64: imzaPng, imzalayanAd: "Mehmet Demir",
      yerlesim: { sayfa: 1, xOran: 0.5, yOran: 0.8, genislikOran: 0.25 }, riza: true,
    });
    const tipler = eventCreate.mock.calls.map((c) => c[0].data.type);
    expect(tipler).toContain("consent");
    expect(tipler).toContain("signed");
  });

  it("ağ adresini AÇIK saklamaz", async () => {
    requestFindUnique.mockResolvedValue(bekleyenIstek());
    requestUpdate.mockResolvedValue({});
    await svc.imzayiUygula(
      "t",
      { imzaPngBase64: imzaPng, imzalayanAd: "Mehmet Demir",
        yerlesim: { sayfa: 1, xOran: 0.5, yOran: 0.8, genislikOran: 0.25 }, riza: true },
      { ip: "88.77.66.55", userAgent: "Mozilla/5.0" },
    );
    const olay = eventCreate.mock.calls[0]![0].data;
    expect(olay.ipHash).not.toContain("88.77");
    expect(olay.ipHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("aynı belge ikinci kez imzalanamaz", async () => {
    requestFindUnique.mockResolvedValue(bekleyenIstek({ status: "SIGNED" }));
    await expect(
      svc.imzayiUygula("t", {
        imzaPngBase64: imzaPng, imzalayanAd: "Mehmet Demir",
        yerlesim: { sayfa: 1, xOran: 0.5, yOran: 0.8, genislikOran: 0.25 }, riza: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("süresi dolmuş bağlantıyla imzalanamaz", async () => {
    requestFindUnique.mockResolvedValue(bekleyenIstek({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(
      svc.imzayiUygula("t", {
        imzaPngBase64: imzaPng, imzalayanAd: "Mehmet Demir",
        yerlesim: { sayfa: 1, xOran: 0.5, yOran: 0.8, genislikOran: 0.25 }, riza: true,
      }),
    ).rejects.toMatchObject({ statusCode: 410 });
  });

  it("geçersiz bağlantı 404 verir", async () => {
    requestFindUnique.mockResolvedValue(null);
    await expect(svc.imzaSayfasiniAc("yanlis")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("imzadan sonra iki tarafa da haber verir", async () => {
    requestFindUnique.mockResolvedValue(bekleyenIstek());
    requestUpdate.mockResolvedValue({});
    await svc.imzayiUygula("t", {
      imzaPngBase64: imzaPng, imzalayanAd: "Mehmet Demir",
      yerlesim: { sayfa: 1, xOran: 0.5, yOran: 0.8, genislikOran: 0.25 }, riza: true,
    });
    const alicilar = gonderilenPostalar.map((m) => m.to);
    expect(alicilar).toContain("gonderen@ornek.com");
    expect(alicilar).toContain("imzalayan@ornek.com");
  });
});

describe("gönderen tarafı", () => {
  it("başkasının isteğini göremez", async () => {
    requestFindFirst.mockResolvedValue(null);
    await expect(svc.imzaIstegiDetayi("baska-kullanici", "istek1")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(requestFindFirst.mock.calls[0]![0].where.ownerId).toBe("baska-kullanici");
  });

  it("imzalanmış istek iptal edilemez", async () => {
    requestFindFirst.mockResolvedValue({ id: "istek1", status: "SIGNED" });
    await expect(svc.imzaIstegiIptal("u1", "istek1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("süresi geçmiş bekleyen istek listede 'süresi doldu' görünür", async () => {
    requestFindMany.mockResolvedValue([
      { id: "a", status: "PENDING", expiresAt: new Date(Date.now() - 1000) },
      { id: "b", status: "PENDING", expiresAt: new Date(Date.now() + 86_400_000) },
    ]);
    const liste = await svc.imzaIstekleriniListele("u1");
    expect(liste[0]!.status).toBe("EXPIRED");
    expect(liste[1]!.status).toBe("PENDING");
  });
});
