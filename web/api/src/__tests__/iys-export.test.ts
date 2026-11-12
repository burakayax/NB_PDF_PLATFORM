import { describe, expect, it } from "vitest";

import {
  formatIysDate,
  IYS_CSV_HEADER,
  latestPerEmail,
  toIysCsv,
} from "../modules/email/iys-export.service.js";

describe("İYS dışa aktarma", () => {
  it("tarihi Türkiye saatinde GG-AA-YYYY SS:dd:ss yazar", () => {
    expect(formatIysDate(new Date("2026-10-01T09:30:00.000Z"))).toBe("01-10-2026 12:30:00");
    // Gece yarısını aşan dönüşüm
    expect(formatIysDate(new Date("2026-10-13T21:04:45.000Z"))).toBe("14-10-2026 00:04:45");
  });

  it("her e-posta için en son kaydı alır (onay sonra geri alındıysa ret)", () => {
    const rows = latestPerEmail([
      { email: "A@x.com", granted: true, createdAt: new Date("2026-10-01T10:00:00Z") },
      { email: "b@x.com", granted: true, createdAt: new Date("2026-10-02T10:00:00Z") },
      { email: "a@x.com", granted: false, createdAt: new Date("2026-10-05T10:00:00Z") },
    ]);
    expect(rows.map((r) => [r.email, r.granted])).toEqual([
      ["b@x.com", true],
      ["a@x.com", false],
    ]);
  });

  it("başlık satırı İYS örneğiyle birebir aynı, satırlar EPOSTA/HS_WEB", () => {
    const csv = toIysCsv([
      { email: "a@x.com", granted: true, at: new Date("2026-10-01T09:30:00Z") },
    ]);
    const [head, line] = csv.split("\n");
    expect(head).toBe(IYS_CSV_HEADER);
    expect(line).toBe("EPOSTA,a@x.com,1,HS_WEB,01-10-2026 12:30:00,");
  });
});

import { businessDaysElapsed, iysUrgency } from "../modules/email/iys-export.service.js";

describe("İYS süre takibi", () => {
  // 2026-11-13 Cuma
  const fri = new Date("2026-11-13T12:00:00Z");
  it("hafta sonunu saymaz", () => {
    expect(businessDaysElapsed(fri, new Date("2026-11-14T12:00:00Z"))).toBe(0); // Cumartesi
    expect(businessDaysElapsed(fri, new Date("2026-11-16T07:00:00Z"))).toBe(1); // Pazartesi
    expect(businessDaysElapsed(fri, new Date("2026-11-17T07:00:00Z"))).toBe(2); // Salı
    expect(businessDaysElapsed(fri, new Date("2026-11-18T07:00:00Z"))).toBe(3); // Çarşamba
  });
  it("aciliyet: bekleyen yok / vakit var / son gün / süre doldu", () => {
    expect(iysUrgency(null)).toBe("none");
    expect(iysUrgency(fri, new Date("2026-11-16T07:00:00Z"))).toBe("ok");
    expect(iysUrgency(fri, new Date("2026-11-17T07:00:00Z"))).toBe("warn");
    expect(iysUrgency(fri, new Date("2026-11-18T07:00:00Z"))).toBe("overdue");
  });
});
