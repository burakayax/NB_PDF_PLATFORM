import { describe, expect, it } from "vitest";
import { maskEmails, sanitizeLogLine } from "../lib/console-log.js";

describe("konsol günlüğü temizliği", () => {
  it("e-postayı maskeler", () => {
    expect(maskEmails("hata ada.test@example.com için")).toBe("hata a***@example.com için");
  });
  it("ip, tarayıcı, şifre, jeton alanlarını atar; userId kalır", () => {
    const out = JSON.parse(
      sanitizeLogLine(
        JSON.stringify({ kind: "login_attempt", email: "ada@example.com", userId: "u1", ip: "1.2.3.4", userAgent: "x", password: "p", token: "t", reason: "kötü ada@example.com" }),
      ),
    );
    expect(out).toEqual({ kind: "login_attempt", email: "a***@example.com", userId: "u1", reason: "kötü a***@example.com" });
  });
  it("JSON olmayan satırda da e-postayı maskeler", () => {
    expect(sanitizeLogLine("düz ada@example.com")).toBe("düz a***@example.com");
  });
});
