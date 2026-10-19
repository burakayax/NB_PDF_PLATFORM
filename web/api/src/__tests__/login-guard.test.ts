import { beforeEach, describe, expect, it } from "vitest";
import {
  CAPTCHA_AFTER_FAILS,
  FREE_ATTEMPTS,
  _resetLoginGuard,
  captchaRequired,
  lockDurationMs,
  lockSecondsRemaining,
  registerFailure,
  registerSuccess,
} from "../modules/auth/login-guard.js";

const MAIL = "kisi@example.com";

describe("giriş koruması (hesap bazlı)", () => {
  beforeEach(() => _resetLoginGuard());

  it("ilk 4 yanlışta kilit yok, 5.'de kilit ve uyarı", () => {
    let t = 1_000_000;
    for (let i = 1; i < FREE_ATTEMPTS; i++) {
      const r = registerFailure(MAIL, t);
      expect(r.lockMs).toBe(0);
      expect(r.alert).toBe(false);
    }
    expect(lockSecondsRemaining(MAIL, t)).toBe(0);
    const r = registerFailure(MAIL, t);
    expect(r.lockMs).toBe(60_000);
    expect(r.alert).toBe(true);
    expect(lockSecondsRemaining(MAIL, t)).toBe(60);
    t += 61_000;
    expect(lockSecondsRemaining(MAIL, t)).toBe(0);
  });

  it("kilit süresi ikiye katlanır ve 15 dakikada durur", () => {
    expect(lockDurationMs(5)).toBe(60_000);
    expect(lockDurationMs(6)).toBe(120_000);
    expect(lockDurationMs(8)).toBe(480_000);
    expect(lockDurationMs(30)).toBe(15 * 60_000);
  });

  it("uyarı e-postası bir saatte yalnızca bir kez", () => {
    let t = 0;
    for (let i = 0; i < FREE_ATTEMPTS; i++) registerFailure(MAIL, t);
    t += 5 * 60_000;
    expect(registerFailure(MAIL, t).alert).toBe(false);
  });

  it("bot doğrulaması 3 yanlıştan sonra istenir; doğru girişte her şey sıfırlanır", () => {
    for (let i = 0; i < CAPTCHA_AFTER_FAILS; i++) registerFailure(MAIL, 5);
    expect(captchaRequired(MAIL, 5)).toBe(true);
    registerSuccess(MAIL);
    expect(captchaRequired(MAIL, 5)).toBe(false);
  });

  it("30 dakika sessizlikte sayaç sıfırlanır; e-posta harf farkı aynı hesap sayılır", () => {
    registerFailure("Kisi@Example.com", 0);
    registerFailure(MAIL, 0);
    expect(captchaRequired(MAIL, 0)).toBe(false);
    registerFailure(MAIL, 0);
    expect(captchaRequired(MAIL, 0)).toBe(true);
    expect(captchaRequired(MAIL, 31 * 60_000)).toBe(false);
  });
});
