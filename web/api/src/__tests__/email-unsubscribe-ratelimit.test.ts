import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { unsubscribeIpLimiter, unsubscribeTokenLimiter } from "../modules/email/email.rate-limit.js";

let server: Server;
let base = "";

beforeAll(async () => {
  const app = express();
  const urlencoded = express.urlencoded({ extended: false });
  const chain = [unsubscribeIpLimiter, unsubscribeTokenLimiter];
  app.get("/unsubscribe", ...chain, (_req, res) => void res.send("ok"));
  app.post("/unsubscribe", urlencoded, ...chain, (_req, res) => void res.json({ ok: true }));
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => void server.close());

describe("çıkış bağlantısı sınırları", () => {
  it("aynı bağlantıya art arda tıklayan bot 12. denemeden sonra durdurulur", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 14; i++) codes.push((await fetch(`${base}/unsubscribe?token=bot-token`)).status);
    expect(codes.slice(0, 12).every((c) => c === 200)).toBe(true);
    expect(codes[12]).toBe(429);
    const blocked = await fetch(`${base}/unsubscribe?token=bot-token`);
    expect(await blocked.text()).toContain("Çok fazla deneme");
  });

  it("başka bir kullanıcının bağlantısı etkilenmez", async () => {
    expect((await fetch(`${base}/unsubscribe?token=baska-kisi`)).status).toBe(200);
  });

  it("Gmail tek-tık POST'ları aynı IP'den çok sayıda gelse de engellenmez", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 60; i++) {
      const r = await fetch(`${base}/unsubscribe?token=kisi-${i}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      });
      codes.push(r.status);
    }
    expect(codes.every((c) => c === 200)).toBe(true);
  });
});
