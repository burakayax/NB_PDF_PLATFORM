import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * OTURUM KORUMA — kullanıcı normal gezerken kendiliğinden atılmamalı.
 *
 * Canlıda görülen hata: tam sayfa yüklemeleri arka arkaya (ya da iki sekme aynı anda)
 * açılınca yenileme isteği yarışıyordu. Sayfa geçişinde yanıt tarayıcıya ulaşmadan
 * kesilirse çerezde bir önceki (artık iptal edilmiş) anahtar kalıyordu; sonraki sayfa
 * onu gönderince kullanıcı atılıyordu.
 *
 * Çözüm: eski anahtar DÖNÜŞÜM yüzünden ve kısa süre önce iptal edildiyse, yerine geçen
 * oturumun anahtarı AYNEN tekrar verilir (yeni kayıt açılmaz, ham anahtar saklanmaz;
 * kayıttan türetilir). Çıkış / uzaktan kapatma / cihaz sınırı iptalleri kesin kapanır.
 *
 * Buradaki testler hem e-posta+şifre hem Google girişiyle açılan oturumları kapsar.
 */

type Satir = {
  id: string;
  tokenHash: string;
  userId: string;
  deviceKey: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  userAgent: string | null;
  isDesktop: boolean;
};

let depo: Satir[] = [];

const eslesir = (t: Satir, w: any): boolean => {
  if (!w) return true;
  if (w.id !== undefined) {
    if (typeof w.id === "string" && t.id !== w.id) return false;
    if (w.id?.in && !w.id.in.includes(t.id)) return false;
  }
  if (w.tokenHash !== undefined && t.tokenHash !== w.tokenHash) return false;
  if (w.userId !== undefined && t.userId !== w.userId) return false;
  if (w.revokedAt === null && t.revokedAt !== null) return false;
  if (w.expiresAt?.gt && !(t.expiresAt > w.expiresAt.gt)) return false;
  return true;
};

const KULLANICI = {
  id: "u1",
  email: "a@b.com",
  passwordHash: "x",
  plan: "FREE",
  role: "USER",
  orgRole: "MEMBER",
  organizationId: null,
  isVerified: true,
  firstName: "A",
  lastName: "B",
  preferredLanguage: "tr",
  createdAt: new Date(),
};

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    refreshToken: {
      findUnique: async ({ where }: any) =>
        depo.find((t) => (where.id ? t.id === where.id : t.tokenHash === where.tokenHash)) ?? null,
      findMany: async ({ where }: any) => depo.filter((t) => eslesir(t, where)).map((t) => ({ ...t })),
      updateMany: async ({ where, data }: any) => {
        const hedef = depo.filter((t) => eslesir(t, where));
        hedef.forEach((t) => Object.assign(t, data));
        return { count: hedef.length };
      },
      deleteMany: async ({ where }: any) => {
        const once = depo.length;
        depo = depo.filter((t) => !eslesir(t, where));
        return { count: once - depo.length };
      },
      create: async ({ data }: any) => {
        depo.push({ revokedAt: null, replacedById: null, lastUsedAt: new Date(), ...data });
        return data;
      },
    },
    user: {
      findUnique: async () => ({ ...KULLANICI }),
      update: async () => ({ ...KULLANICI }),
    },
    paymentCheckout: { findFirst: async () => null },
  },
}));

vi.mock("../lib/password.js", () => ({
  hashPassword: async () => "x",
  verifyPassword: async (sifre: string) => sifre === "dogru-sifre",
}));

// Doğrulama imzaya bakmadan kullanıcıyı döndürür; imzalama GERÇEK kalır (tekrar üretim testi için).
vi.mock("../lib/jwt.js", async (orijinal) => {
  const gercek = await orijinal<typeof import("../lib/jwt.js")>();
  return { ...gercek, verifyRefreshToken: () => ({ sub: "u1" }) };
});

const { refreshSession, loginUser } = await import("../modules/auth/auth.service.js");
const { hashToken } = await import("../lib/token.js");

const BILGI = { userAgent: "Chrome/120", ip: "1.2.3.4" };
const TELEFON = { userAgent: "iPhone Safari", ip: "9.9.9.9" };

const acik = () => depo.filter((t) => !t.revokedAt).length;

async function girisYap(bilgi = BILGI) {
  return loginUser({ email: "a@b.com", password: "dogru-sifre" } as any, undefined, bilgi);
}

beforeEach(() => {
  depo = [];
});

describe("e-posta/şifre ile giriş sonrası yenileme", () => {
  it("giriş bir oturum açar ve anahtar özetle eşleşir", async () => {
    const s = await girisYap();
    expect(depo).toHaveLength(1);
    expect(depo[0]!.tokenHash).toBe(hashToken(s.refreshToken));
  });

  it("20 sayfa arka arkaya yüklenince oturum ve kayıt sayısı sabit kalır", async () => {
    let anahtar = (await girisYap()).refreshToken;
    for (let i = 0; i < 20; i++) {
      anahtar = (await refreshSession(anahtar, BILGI)).refreshToken;
    }
    expect(acik()).toBe(1);
    expect(depo.length).toBe(21); // her yenileme eskiyi iptal eder, yalnız biri açık
  });

  it("yanıtı kesilen yenilemeden sonra çerezdeki eski anahtar AYNI yeni anahtarı geri getirir", async () => {
    const giris = await girisYap();
    const yeni = await refreshSession(giris.refreshToken, BILGI); // yanıt tarayıcıya ulaşmadı
    const tekrar = await refreshSession(giris.refreshToken, BILGI); // çerezde hâlâ eski anahtar
    expect(tekrar.refreshToken).toBe(yeni.refreshToken);
    expect(depo).toHaveLength(2); // yeni kayıt açılmadı
    expect(acik()).toBe(1);
    // Geri verilen anahtar gerçekten geçerli: devam eden gezinti sürer.
    const devam = await refreshSession(tekrar.refreshToken, BILGI);
    expect(devam.accessToken).toBeTruthy();
  });

  it("iki sekme aynı anda aynı anahtarla gelince ikisi de aynı yeni anahtarı alır", async () => {
    const giris = await girisYap();
    const [a, b] = await Promise.all([
      refreshSession(giris.refreshToken, BILGI),
      refreshSession(giris.refreshToken, BILGI),
    ]);
    expect(a.refreshToken).toBe(b.refreshToken);
    expect(acik()).toBe(1);
    expect(depo).toHaveLength(2);
  });

  it("art arda kesilen yenilemeler zincir olsa da kullanıcı atılmaz", async () => {
    const giris = await girisYap();
    const bir = await refreshSession(giris.refreshToken, BILGI);
    const iki = await refreshSession(bir.refreshToken, BILGI);
    // Çerezde hâlâ ilk anahtar var: zincir izlenip en güncel anahtar verilir.
    const tekrar = await refreshSession(giris.refreshToken, BILGI);
    expect(tekrar.refreshToken).toBe(iki.refreshToken);
    expect(acik()).toBe(1);
  });
});

describe("Google ile açılmış oturumda yenileme", () => {
  it("OAuth oturumu da aynı yenileme yolunu kullanır ve korunur", async () => {
    // Google girişi şifresiz kullanıcıyla aynı oturum kaydını açar (createSession ortak).
    // Kayıt, giriş yolundan bağımsız olarak doğrudan yazılıyor gibi hazırlanır.
    const { signStableRefreshToken } = await import("../lib/jwt.js");
    const createdAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 3600 * 1000);
    const anahtar = signStableRefreshToken({ userId: "u1", sessionId: "g1", createdAt, expiresAt });
    depo.push({
      id: "g1", tokenHash: hashToken(anahtar), userId: "u1", deviceKey: "g", expiresAt,
      revokedAt: null, replacedById: null, createdAt, lastUsedAt: createdAt,
      userAgent: "Chrome/120", isDesktop: false,
    });
    const yeni = await refreshSession(anahtar, BILGI);
    const tekrar = await refreshSession(anahtar, BILGI);
    expect(tekrar.refreshToken).toBe(yeni.refreshToken);
    expect(acik()).toBe(1);
  });
});

describe("güvenlik sınırları", () => {
  it("tolerans süresi geçince eski anahtarın kullanılması tüm oturumları kapatır", async () => {
    const giris = await girisYap();
    await girisYap(TELEFON);
    const yeni = await refreshSession(giris.refreshToken, BILGI);
    depo.find((t) => t.tokenHash === hashToken(giris.refreshToken))!.revokedAt = new Date(
      Date.now() - 120_000,
    );
    await expect(refreshSession(giris.refreshToken, BILGI)).rejects.toMatchObject({
      statusCode: 401,
      message: expect.stringContaining("closed for security"),
    });
    expect(acik()).toBe(0);
    await expect(refreshSession(yeni.refreshToken, BILGI)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("çıkış yapılmış oturum tolerans süresinde bile geri dönemez", async () => {
    const giris = await girisYap();
    // Çıkış: iptal edilir, yerine geçen YOKTUR.
    depo[0]!.revokedAt = new Date(Date.now() - 2_000);
    await expect(refreshSession(giris.refreshToken, BILGI)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("telefon oturumu hiçbir yenileme senaryosundan etkilenmez", async () => {
    const giris = await girisYap();
    const telefon = await girisYap(TELEFON);
    await refreshSession(giris.refreshToken, BILGI);
    await refreshSession(giris.refreshToken, BILGI);
    await Promise.all([
      refreshSession(giris.refreshToken, BILGI),
      refreshSession(giris.refreshToken, BILGI),
    ]);
    const kayit = depo.find((t) => t.tokenHash === hashToken(telefon.refreshToken))!;
    expect(kayit.revokedAt).toBeNull();
    expect(acik()).toBe(2);
  });

  it("süresi dolmuş oturum yenilenmez", async () => {
    const giris = await girisYap();
    depo[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(refreshSession(giris.refreshToken, BILGI)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("anahtar kayıttan türetilir: ham değer veritabanında tutulmaz", async () => {
    const giris = await girisYap();
    expect(JSON.stringify(depo)).not.toContain(giris.refreshToken);
  });
});
