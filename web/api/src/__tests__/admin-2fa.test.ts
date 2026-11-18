import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();
const sent: { to: string; text: string }[] = [];

vi.mock("../config/env.js", () => ({ env: { JWT_REFRESH_SECRET: "test-refresh-secret-0123456789abcdef0123" } }));
vi.mock("../lib/site-config.service.js", () => ({
  getSettingDirect: vi.fn(async (k: string) => store.get(k) ?? null),
  setSetting: vi.fn(async (k: string, v: unknown) => {
    store.set(k, JSON.parse(JSON.stringify(v)));
  }),
}));
vi.mock("../lib/mailer.js", () => ({
  sendMail: vi.fn(async (m: { to: string; text: string }) => {
    sent.push({ to: m.to, text: m.text });
  }),
}));

const svc = await import("../modules/auth/admin-2fa.service.js");
const { requireAdmin } = await import("../middleware/admin.middleware.js");

const U = { id: "u1", email: "admin@example.com" };
const lastCode = () => /kodunuz: (\d{6})/.exec(sent[sent.length - 1]!.text)![1]!;

beforeEach(() => {
  store.clear();
  sent.length = 0;
  delete process.env.ADMIN_2FA_DISABLED;
  vi.useRealTimers();
});

describe("admin e-posta kodu", () => {
  it("kod düz metin saklanmaz; doğru kod kanıt verir ve tek kullanımlıktır", async () => {
    await svc.sendAdminCode(U);
    const code = lastCode();
    expect(JSON.stringify([...store.values()])).not.toContain(code);
    const proof = await svc.verifyAdminCode(U.id, code);
    expect(svc.hasValidProof(proof, U.id)).toBe(true);
    await expect(svc.verifyAdminCode(U.id, code)).rejects.toThrow();
  });

  it("kanıt başka yöneticide / bozuk çerezde geçmez", async () => {
    await svc.sendAdminCode(U);
    const proof = await svc.verifyAdminCode(U.id, lastCode());
    expect(svc.hasValidProof(proof, "baska")).toBe(false);
    expect(svc.hasValidProof(proof + "x", U.id)).toBe(false);
    expect(svc.hasValidProof(undefined, U.id)).toBe(false);
  });

  it("5 yanlış denemeden sonra doğru kod bile geçmez", async () => {
    await svc.sendAdminCode(U);
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(svc.verifyAdminCode(U.id, wrong)).rejects.toThrow();
    await expect(svc.verifyAdminCode(U.id, code)).rejects.toThrow();
  });

  it("10 dakikadan sonra kod geçmez", async () => {
    vi.useFakeTimers();
    await svc.sendAdminCode(U);
    const code = lastCode();
    vi.advanceTimersByTime(10 * 60 * 1000 + 1000);
    await expect(svc.verifyAdminCode(U.id, code)).rejects.toThrow();
  });

  it("60 saniye içinde yeni kod istenemez", async () => {
    await svc.sendAdminCode(U);
    await expect(svc.sendAdminCode(U)).rejects.toThrow();
  });

  it("yeni kod eskisini iptal eder", async () => {
    vi.useFakeTimers();
    await svc.sendAdminCode(U);
    const eski = lastCode();
    vi.advanceTimersByTime(61_000);
    await svc.sendAdminCode(U);
    const yeni = lastCode();
    if (eski !== yeni) await expect(svc.verifyAdminCode(U.id, eski)).rejects.toThrow();
    await expect(svc.verifyAdminCode(U.id, yeni)).resolves.toBeTruthy();
  });
});

function run(user: unknown, cookie?: string) {
  let status = 200;
  let body: unknown;
  let nextCalled = false;
  const res = {
    status(s: number) {
      status = s;
      return res;
    },
    json(b: unknown) {
      body = b;
    },
  };
  requireAdmin({ authUser: user, cookies: cookie ? { nb_admin_2fa: cookie } : {} } as never, res as never, () => {
    nextCalled = true;
  });
  return { status, body, nextCalled };
}

describe("requireAdmin + ikinci doğrulama", () => {
  const admin = { id: "u1", role: "ADMIN" };
  it("kanıt yoksa 403 admin_2fa_required", () => {
    const r = run(admin);
    expect(r.nextCalled).toBe(false);
    expect(r.status).toBe(403);
    expect((r.body as { code: string }).code).toBe("admin_2fa_required");
  });
  it("geçerli kanıtla geçer", () => {
    expect(run(admin, svc.signProof("u1")).nextCalled).toBe(true);
  });
  it("başka kullanıcının kanıtı geçmez", () => {
    expect(run(admin, svc.signProof("x")).nextCalled).toBe(false);
  });
  it("admin olmayan her zaman reddedilir", () => {
    expect(run({ id: "u1", role: "USER" }, svc.signProof("u1")).nextCalled).toBe(false);
  });
  it("acil durum anahtarı (ADMIN_2FA_DISABLED=true) kodu atlatır", () => {
    process.env.ADMIN_2FA_DISABLED = "true";
    expect(run(admin).nextCalled).toBe(true);
  });
});
