import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GİRİŞ AKIŞI uçtan uca (controller seviyesi): hesap kilidi, Turnstile doğrulaması,
 * başarılı girişte sayaç sıfırlama. Veritabanı/e-posta/ağ sahte.
 */
const loginUser = vi.fn();
const sendMail = vi.fn().mockResolvedValue(undefined);

vi.mock("../lib/prisma.js", () => ({
  prisma: { user: { findUnique: vi.fn().mockResolvedValue({ email: "kisi@example.com", preferredLanguage: "tr" }) } },
}));
vi.mock("../lib/mailer.js", () => ({ sendMail: (...a: unknown[]) => sendMail(...a) }));
vi.mock("../modules/auth/auth.service.js", async (orig) => ({
  ...(await orig<object>()),
  loginUser: (...a: unknown[]) => loginUser(...a),
}));

const { loginController } = await import("../modules/auth/auth.controller.js");
const { _resetLoginGuard } = await import("../modules/auth/login-guard.js");
const { HttpError } = await import("../lib/http-error.js");

type Out = { statusCode: number; body?: { code?: string }; headers: Record<string, string>; error?: Error };

async function run(body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<Out> {
  const out: Out = { statusCode: 200, headers: {} };
  const response = {
    status(c: number) { out.statusCode = c; return response; },
    json(b: { code?: string }) { out.body = b; return response; },
    setHeader(k: string, v: string) { out.headers[k] = v; return response; },
    cookie() { return response; },
    send() { return response; },
  };
  const request = {
    body,
    headers,
    cookies: {},
    ip: "1.2.3.4",
    get: (k: string) => headers[k.toLowerCase()],
    socket: {},
  };
  try {
    await loginController(request as never, response as never);
  } catch (e) {
    out.error = e as Error;
  }
  return out;
}

const cred = { email: "kisi@example.com", password: "yanlis-sifre-1" };
const bad = () => loginUser.mockRejectedValueOnce(new HttpError(401, "Invalid email or password."));
const wrong = async (n: number, headers: Record<string, string> = {}) => {
  for (let i = 0; i < n; i++) { bad(); await run(cred, headers); }
};

beforeEach(() => {
  _resetLoginGuard();
  loginUser.mockReset();
  sendMail.mockClear();
  delete process.env.TURNSTILE_SECRET_KEY;
  vi.unstubAllGlobals();
});

describe("giriş akışı", () => {
  it("5 yanlıştan sonra sonraki deneme 429 ile reddedilir, şifre bile doğrulanmaz, uyarı e-postası gider", async () => {
    await wrong(5);
    loginUser.mockClear();
    const r = await run(cred);
    expect(r.statusCode).toBe(429);
    expect(r.body?.code).toBe("login_locked");
    expect(Number(r.headers["Retry-After"])).toBeGreaterThan(0);
    expect(loginUser).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(1));
  });

  it("anahtar tanımlıysa 3 yanlıştan sonra jetonsuz istek 428 alır; Cloudflare 'geçersiz' derse yine 428; 'geçerli' derse giriş denenir", async () => {
    process.env.TURNSTILE_SECRET_KEY = "gizli";
    await wrong(3);
    loginUser.mockClear();

    const noToken = await run(cred);
    expect(noToken.statusCode).toBe(428);
    expect(noToken.body?.code).toBe("captcha_required");
    expect(loginUser).not.toHaveBeenCalled();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }));
    const robot = await run({ ...cred, turnstileToken: "x".repeat(40) });
    expect(robot.statusCode).toBe(428);
    expect(loginUser).not.toHaveBeenCalled();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: true }) }));
    bad();
    const human = await run({ ...cred, turnstileToken: "x".repeat(40) });
    expect(loginUser).toHaveBeenCalledTimes(1);
    expect(human.error).toBeTruthy(); // parola yanlış → normal 401 hatası
  });

  it("anahtar tanımlı değilse bot doğrulaması hiç istenmez", async () => {
    await wrong(4);
    bad();
    const r = await run(cred);
    expect(r.statusCode).not.toBe(428);
    expect(loginUser).toHaveBeenCalled();
  });

  it("masaüstü istemcisi bot doğrulamasından muaf (kilit yine geçerli)", async () => {
    process.env.TURNSTILE_SECRET_KEY = "gizli";
    const desktop = { "x-nb-client-type": "desktop" };
    await wrong(3, desktop);
    loginUser.mockClear();
    bad();
    const r = await run(cred, desktop);
    expect(r.statusCode).not.toBe(428);
  });

  it("Cloudflare'e ulaşılamazsa kullanıcı dışarıda bırakılmaz", async () => {
    process.env.TURNSTILE_SECRET_KEY = "gizli";
    await wrong(3);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ağ yok")));
    loginUser.mockClear();
    bad();
    await run({ ...cred, turnstileToken: "x".repeat(40) });
    expect(loginUser).toHaveBeenCalledTimes(1);
  });

  it("doğru girişte sayaç sıfırlanır", async () => {
    await wrong(4);
    loginUser.mockResolvedValueOnce({
      user: { id: "u", email: cred.email },
      accessToken: "a",
      refreshToken: "r",
      refreshExpiresAt: new Date(Date.now() + 1e6),
    });
    await run(cred);
    await wrong(4);
    const r = await run(cred); // sayaç sıfırlandığı için 4 yanlıştan sonra hâlâ kilit yok
    expect(r.statusCode).not.toBe(429);
  });
});
