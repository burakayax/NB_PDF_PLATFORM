import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * HİZMET SAĞLIK KAYDI:
 *  1. Yazma kuralı: durum değişince hemen, değişmezse en çok 10 dakikada bir.
 *  2. 5xx olayı aynı yol+durum için 30 sn'de bir; yol içindeki uzun kimlikler maskelenir.
 *  3. Hesaplama: kesinti, "sinyal yok" (kayıt boşluğu) ve çalışma oranı doğru çıkar.
 *  4. Dahili uç yalnız sırla çalışır ve kişisel veri kabul etmez.
 */

const m = vi.hoisted(() => ({ create: vi.fn(async () => ({})), hasSecret: vi.fn(() => true) }));

vi.mock("../lib/prisma.js", () => ({ prisma: { serviceHealthEvent: { create: m.create, findMany: vi.fn(async () => []) } } }));
vi.mock("../middleware/api-security.middleware.js", () => ({ requestHasInternalServiceSecret: m.hasSecret }));
vi.mock("../lib/quota.js", () => ({ checkQuota: vi.fn(), incrementQuota: vi.fn(), checkAndIncrementQuota: vi.fn(), getQuotaSummary: vi.fn() }));
vi.mock("../modules/entitlement/entitlement.engine.js", () => ({ canExecute: vi.fn() }));
vi.mock("../modules/entitlement/editor-download.service.js", () => ({ consumeEditorDownload: vi.fn() }));

import {
  __resetServiceHealthState,
  checkPdfHeartbeatMissing,
  computeServiceStatus,
  normalizePath,
  recordHealth,
  recordHttpFailure,
  type HealthEventRow,
} from "../lib/service-health.js";
import { serviceEventController } from "../modules/entitlement/entitlement.controller.js";

const T0 = Date.UTC(2026, 9, 7, 10, 0, 0);
const mins = (n: number) => n * 60_000;

beforeEach(() => {
  vi.clearAllMocks();
  __resetServiceHealthState();
  process.env["INTERNAL_SERVICE_SECRET"] = "s";
  m.hasSecret.mockReturnValue(true);
});

describe("recordHealth yazma kuralı", () => {
  it("ilk kayıt hemen, aynı durum 10 dk dolmadan yazılmaz, değişim hemen yazılır", async () => {
    expect(await recordHealth("db", true, undefined, T0)).toBe(true);
    expect(await recordHealth("db", true, undefined, T0 + mins(1))).toBe(false);
    expect(await recordHealth("db", true, undefined, T0 + mins(9))).toBe(false);
    expect(await recordHealth("db", false, { detail: "x" }, T0 + mins(9))).toBe(true);
    expect(await recordHealth("db", false, undefined, T0 + mins(10))).toBe(false);
    expect(await recordHealth("db", true, undefined, T0 + mins(11))).toBe(true);
    expect(await recordHealth("db", true, undefined, T0 + mins(22))).toBe(true); // 10 dk heartbeat
    expect(m.create).toHaveBeenCalledTimes(4);
  });
});

describe("recordHttpFailure", () => {
  it("aynı yol+durum 30 sn içinde tekrar yazılmaz; kimlik parçası maskelenir", async () => {
    expect(await recordHttpFailure("pdf", "/api/pdf/result/0123456789abcdef0123456789abcdef/download", 500, T0)).toBe(true);
    expect(await recordHttpFailure("pdf", "/api/pdf/result/0123456789abcdef0123456789abcdef/download", 500, T0 + 10_000)).toBe(false);
    expect(await recordHttpFailure("pdf", "/api/pdf/result/0123456789abcdef0123456789abcdef/download", 500, T0 + 31_000)).toBe(true);
    const data = (m.create.mock.calls[0] as unknown as [{ data: { path: string } }])[0].data;
    expect(data.path).toBe("/api/pdf/result/:id/download");
  });

  it("normalizePath: araç adı maskelenmez, sorgu atılır", () => {
    expect(normalizePath("/api/extract-images-from-pdfs?token=abc")).toBe("/api/extract-images-from-pdfs");
  });
});

describe("PDF kalp atışı kaybı", () => {
  it("gizli anahtar yoksa (köprü kapalı) kontrol edilmez: yanlış alarm yok", async () => {
    delete process.env["INTERNAL_SERVICE_SECRET"];
    await checkPdfHeartbeatMissing(Date.now() + mins(10));
    expect(m.create).not.toHaveBeenCalled();
  });

  it("3 dakikadır kalp atışı yoksa 'kapalı' yazar", async () => {
    await checkPdfHeartbeatMissing(Date.now() + mins(4));
    expect(m.create).toHaveBeenCalledTimes(1);
    expect((m.create.mock.calls[0] as unknown as [{ data: { component: string; ok: boolean } }])[0].data).toMatchObject({ component: "pdf", ok: false });
  });
});

describe("computeServiceStatus", () => {
  const ev = (component: string, atMin: number, ok: boolean): HealthEventRow => ({ at: new Date(T0 + mins(atMin)), component, kind: "check", ok });

  it("kesintiyi ve çalışma oranını hesaplar", () => {
    const rows = [ev("db", 0, true), ev("db", 10, false), ev("db", 20, true), ev("db", 30, true)];
    const s = computeServiceStatus(rows, new Date(T0), new Date(T0 + mins(40)));
    const db = s.components.db;
    expect(db.downMinutes).toBe(10);
    expect(db.incidents).toEqual([expect.objectContaining({ type: "down", minutes: 10 })]);
    expect(db.uptimePct).toBe(75);
  });

  it("kayıt boşluğunu 'sinyal yok' olarak raporlar", () => {
    const rows = [ev("api", 0, true), ev("api", 60, true)]; // 15 dk geçerli, 45 dk sessizlik
    const s = computeServiceStatus(rows, new Date(T0), new Date(T0 + mins(60)));
    const a = s.components.api;
    expect(a.noSignalMinutes).toBe(45);
    expect(a.incidents[0]).toMatchObject({ type: "no-signal", minutes: 45 });
  });

  it("5xx olaylarını yola göre sayar", () => {
    const rows: HealthEventRow[] = [
      { at: new Date(T0 + mins(1)), component: "pdf", kind: "http_5xx", ok: false, path: "/api/merge", status: 500 },
      { at: new Date(T0 + mins(2)), component: "pdf", kind: "http_5xx", ok: false, path: "/api/merge", status: 500 },
    ];
    const s = computeServiceStatus(rows, new Date(T0), new Date(T0 + mins(10)));
    expect(s.failures).toEqual([expect.objectContaining({ path: "/api/merge", status: 500, count: 2 })]);
  });

  it("veri yoksa oran null", () => {
    const s = computeServiceStatus([], new Date(T0), new Date(T0 + mins(10)));
    expect(s.components.pdf.uptimePct).toBeNull();
  });
});

describe("serviceEventController", () => {
  function res() {
    const r: Record<string, unknown> = {};
    r["status"] = vi.fn(() => r);
    r["json"] = vi.fn(() => r);
    return r as never as import("express").Response;
  }

  it("sır yoksa 403", async () => {
    m.hasSecret.mockReturnValue(false);
    await expect(serviceEventController({ body: { kind: "heartbeat", component: "pdf" } } as never, res())).rejects.toMatchObject({ statusCode: 403 });
  });

  it("geçersiz gövdeyi (kişisel alan/durum kodu) reddeder", async () => {
    await expect(serviceEventController({ body: { kind: "http_5xx", component: "pdf", path: "/x", status: 200 } } as never, res())).rejects.toBeDefined();
    await expect(serviceEventController({ body: { kind: "heartbeat", component: "db" } } as never, res())).rejects.toBeDefined();
  });

  it("kalp atışını ve 5xx'i kaydeder", async () => {
    await serviceEventController({ body: { kind: "heartbeat", component: "pdf" } } as never, res());
    await serviceEventController({ body: { kind: "http_5xx", component: "pdf", path: "/api/compress", status: 503 } } as never, res());
    expect(m.create).toHaveBeenCalledTimes(2);
  });
});
