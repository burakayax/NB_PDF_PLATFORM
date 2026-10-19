import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * OTURUM KORUMA — kullanıcı normal gezerken kendiliğinden atılmamalı.
 *
 * Canlıda görülen hata: tam sayfa yüklemeleri arka arkaya (ya da iki sekme aynı anda)
 * açılınca yenileme isteği yarışıyordu. Sayfa geçişinde yanıt tarayıcıya ulaşmadan
 * kesilirse çerezde bir önceki (artık iptal edilmiş) anahtar kalıyordu; sonraki sayfa
 * onu gönderince kullanıcı atılıyordu. Buradaki testler bu yarışı ve güvenlik
 * sınırlarını (gerçek çalıntı tespiti, çıkış sonrası geri dönememe) sabitler.
 */

type Satir = {
  id: string;
  tokenHash: string;
  userId: string;
  deviceKey: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  userAgent: string | null;
  isDesktop: boolean;
};

let depo: Satir[] = [];
let sayac = 0;

const eslesir = (t: Satir, w: any): boolean => {
  if (!w) return true;
  if (w.tokenHash !== undefined && t.tokenHash !== w.tokenHash) return false;
  if (w.userId !== undefined && t.userId !== w.userId) return false;
  if (w.deviceKey !== undefined && t.deviceKey !== w.deviceKey) return false;
  if (w.revokedAt === null && t.revokedAt !== null) return false;
  if (w.expiresAt?.gt && !(t.expiresAt > w.expiresAt.gt)) return false;
  if (w.createdAt?.gte && !(t.createdAt >= w.createdAt.gte)) return false;
  if (w.id?.not !== undefined && t.id === w.id.not) return false;
  if (w.id?.in && !w.id.in.includes(t.id)) return false;
  return true;
};

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    refreshToken: {
      findUnique: async ({ where }: any) => depo.find((t) => t.tokenHash === where.tokenHash) ?? null,
      findMany: async ({ where }: any) => depo.filter((t) => eslesir(t, where)).map((t) => ({ ...t })),
      updateMany: async ({ where, data }: any) => {
        const hedef = depo.filter((t) => eslesir(t, where));
        hedef.forEach((t) => Object.assign(t, data));
        return { count: hedef.length };
      },
      create: async ({ data }: any) => {
        depo.push({ id: `t${++sayac}`, revokedAt: null, createdAt: new Date(), ...data });
        return data;
      },
    },
    user: {
      findUnique: async () => ({
        id: "u1", email: "a@b.com", plan: "FREE", role: "USER", orgRole: null,
        organizationId: null, isVerified: true, firstName: "A", lastName: "B",
        preferredLanguage: "tr", createdAt: new Date(),
      }),
      update: async () => ({}),
    },
    paymentCheckout: { findFirst: async () => null },
  },
}));

vi.mock("../lib/jwt.js", async (orijinal) => {
  const gercek = await orijinal<typeof import("../lib/jwt.js")>();
  return { ...gercek, verifyRefreshToken: () => ({ sub: "u1" }) };
});

const { refreshSession } = await import("../modules/auth/auth.service.js");
const { createHash } = await import("node:crypto");
const ozet = (s: string) => createHash("sha256").update(s).digest("hex");

const BILGI = { userAgent: "Chrome/120", ip: "1.2.3.4" };
const gun = 24 * 3600 * 1000;

function ekle(anahtar: string, ek: Partial<Satir> = {}) {
  depo.push({
    id: `t${++sayac}`,
    tokenHash: ozet(anahtar),
    userId: "u1",
    deviceKey: ozet("Chrome/120|1.2.3.4"),
    expiresAt: new Date(Date.now() + 7 * gun),
    revokedAt: null,
    createdAt: new Date(),
    userAgent: "Chrome/120",
    isDesktop: false,
    ...ek,
  });
}

beforeEach(() => {
  depo = [];
  sayac = 0;
});

const acik = () => depo.filter((t) => !t.revokedAt).length;

describe("oturum yenileme dayanıklılığı", () => {
  it("20 sayfa arka arkaya yüklenince oturum korunur", async () => {
    ekle("k0");
    let anahtar = "k0";
    for (let i = 0; i < 20; i++) {
      const sonuc = await refreshSession(anahtar, BILGI);
      anahtar = sonuc.refreshToken;
    }
    expect(acik()).toBe(1);
  });

  it("yanıtı kesilen yenilemeden sonra çerezdeki eski anahtar kullanıcıyı atmaz", async () => {
    ekle("k0");
    // 1. sayfa yenilemeyi tetikledi ama yanıt tarayıcıya ulaşmadan sayfa değişti.
    await refreshSession("k0", BILGI);
    // 2. sayfa hâlâ "k0" gönderiyor.
    const sonuc = await refreshSession("k0", BILGI);
    expect(sonuc.accessToken).toBeTruthy();
    // Teslim edilmemiş kardeş oturum yuva doldurmasın.
    expect(acik()).toBe(1);
  });

  it("iki sekme aynı anda aynı anahtarla gelince ikisi de başarılı olur", async () => {
    ekle("k0");
    const [a, b] = [await refreshSession("k0", BILGI), await refreshSession("k0", BILGI)];
    expect(a.accessToken).toBeTruthy();
    expect(b.accessToken).toBeTruthy();
    expect(acik()).toBe(1);
  });

  it("tolerans süresi geçince eski anahtarın kullanılması tüm oturumları kapatır", async () => {
    ekle("eski", { revokedAt: new Date(Date.now() - 120_000) });
    ekle("telefon", { deviceKey: "baska-cihaz" });
    await expect(refreshSession("eski", BILGI)).rejects.toMatchObject({ statusCode: 401 });
    expect(acik()).toBe(0);
  });

  it("çıkış yapılmış oturum tolerans süresinde bile geri dönemez", async () => {
    // Çıkış/uzaktan kapatma: iptal edildi, ardılı yok.
    ekle("cikis", { revokedAt: new Date(Date.now() - 2_000) });
    await expect(refreshSession("cikis", BILGI)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("farklı cihazdaki oturumlar yenilemeden etkilenmez", async () => {
    ekle("k0");
    ekle("telefon", { deviceKey: "baska-cihaz" });
    await refreshSession("k0", BILGI);
    await refreshSession("k0", BILGI);
    expect(depo.find((t) => t.tokenHash === ozet("telefon"))!.revokedAt).toBeNull();
  });
});
