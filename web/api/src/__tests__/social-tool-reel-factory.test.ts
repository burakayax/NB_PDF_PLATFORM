/**
 * Üretim iş akışının uçları: anahtar, "üretim gerekli mi", video yükleme doğrulaması ve herkese açık indirme.
 *
 * Gerçek bir HTTP sunucusu açılır (sahte veritabanı/servis ile); istemci `fetch`tir.
 */

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "test-factory-key-0123456789";
let config: { toolReelEveryDays: number } = { toolReelEveryDays: 3 };
let due: { id: string } | null = { id: "compress" };
let fresh: unknown = null;
const stored = new Map<string, Buffer>();

vi.mock("../modules/social/social.service.js", () => ({
  readSocialConfig: vi.fn(async () => config),
}));
vi.mock("../modules/social/tool-reels.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../modules/social/tool-reels.service.js")>();
  return {
    ...actual,
    pickDueToolReel: vi.fn(async () => due),
    unusedFreshVideoFor: vi.fn(async () => fresh),
    saveToolVideo: vi.fn(async (toolId: string, data: Buffer, seconds: number) => {
      const id = `${toolId}-1791728774504`;
      stored.set(id, data);
      return { id, url: `https://api.example.test/api/public/tool-reels/${id}.mp4`, seconds, createdAt: new Date() };
    }),
    readToolVideo: vi.fn(async (id: string) => stored.get(id) ?? null),
  };
});

let server: Server;
let base = "";

beforeAll(async () => {
  process.env.TOOL_REEL_FACTORY_KEY = KEY;
  const { toolReelFactoryRouter, toolReelMediaRouter } = await import("../modules/social/tool-reel-factory.routes.js");
  const app = express();
  app.use("/api/tool-reel-factory", toolReelFactoryRouter);
  app.use("/api/public/tool-reels", toolReelMediaRouter);
  app.use((error: { statusCode?: number; message: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.statusCode ?? 500).json({ message: error.message });
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
});
beforeEach(() => {
  config = { toolReelEveryDays: 3 };
  due = { id: "compress" };
  fresh = null;
  stored.clear();
});

const factory = (path: string, init: RequestInit = {}, key: string | null = KEY) =>
  fetch(`${base}/api/tool-reel-factory${path}`, {
    ...init,
    headers: { ...(key ? { "x-factory-key": key } : {}), ...(init.headers as Record<string, string> | undefined) },
  });

/** Geçerli MP4 başlığı (4. baytta "ftyp") + dolgu. */
const fakeMp4 = (size = 4096) => {
  const buf = Buffer.alloc(size, 1);
  buf.write("ftypisom", 4, "latin1");
  return buf;
};

describe("anahtar", () => {
  it("anahtarsız ya da yanlış anahtarlı istek reddedilir", async () => {
    expect((await factory("/needed", {}, null)).status).toBe(401);
    expect((await factory("/needed", {}, "yanlis")).status).toBe(401);
  });

  it("sunucuda anahtar tanımlı değilse uçlar kapalıdır (fail-closed)", async () => {
    const keep = process.env.TOOL_REEL_FACTORY_KEY;
    process.env.TOOL_REEL_FACTORY_KEY = "";
    try {
      expect((await factory("/needed")).status).toBe(503);
    } finally {
      process.env.TOOL_REEL_FACTORY_KEY = keep;
    }
  });
});

describe("üretim gerekli mi", () => {
  it("sıradaki araç için video yoksa gerekli", async () => {
    const body = await (await factory("/needed")).json();
    expect(body).toMatchObject({ needed: true, tool: "compress" });
  });

  it("video zaten hazırsa gerekli değil", async () => {
    fresh = { id: "compress-1791728774504" };
    expect(await (await factory("/needed")).json()).toMatchObject({ needed: false, tool: "compress" });
  });

  it("ayar kapalıysa ya da bugün araç günü değilse gerekli değil", async () => {
    config = { toolReelEveryDays: 0 };
    expect((await (await factory("/needed")).json()).needed).toBe(false);
    config = { toolReelEveryDays: 3 };
    due = null;
    expect((await (await factory("/needed")).json()).needed).toBe(false);
  });

  it("elle istenen araç sıra/sıklık kuralını atlar; bilinmeyen araç 404", async () => {
    config = { toolReelEveryDays: 0 };
    expect(await (await factory("/needed?tool=merge")).json()).toMatchObject({ needed: true, tool: "merge" });
    expect((await factory("/needed?tool=yok")).status).toBe(404);
  });
});

describe("video yükleme ve indirme", () => {
  const put = (tool: string, body: Buffer) =>
    factory(`/${tool}/video`, { method: "PUT", headers: { "content-type": "video/mp4", "x-video-seconds": "21" }, body });

  it("geçerli MP4 kaydedilir ve herkese açık adresten aynen indirilir", async () => {
    const mp4 = fakeMp4(5000);
    const res = await put("merge", mp4);
    expect(res.status).toBe(200);
    const { id } = await res.json();
    expect(id).toBe("merge-1791728774504");

    const dl = await fetch(`${base}/api/public/tool-reels/${id}.mp4`);
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-type")).toBe("video/mp4");
    expect(Buffer.from(await dl.arrayBuffer()).equals(mp4)).toBe(true);
  });

  it("Range isteğine 206 ve doğru parça döner", async () => {
    const mp4 = fakeMp4(5000);
    await put("merge", mp4);
    const res = await fetch(`${base}/api/public/tool-reels/merge-1791728774504.mp4`, { headers: { range: "bytes=0-99" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-99/5000");
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });

  it("MP4 olmayan, çok küçük ya da bilinmeyen araç için gelen dosya reddedilir", async () => {
    expect((await put("merge", Buffer.alloc(5000, 7))).status).toBe(400);
    expect((await put("merge", Buffer.alloc(10))).status).toBe(400);
    expect((await put("yok", fakeMp4())).status).toBe(404);
  });

  it("silinmiş/bilinmeyen video 404; geçersiz ad 404", async () => {
    expect((await fetch(`${base}/api/public/tool-reels/merge-1234567890123.mp4`)).status).toBe(404);
    expect((await fetch(`${base}/api/public/tool-reels/..%2Fx.mp4`)).status).toBe(404);
  });
});
