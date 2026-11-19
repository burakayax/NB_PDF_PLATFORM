import { describe, expect, it } from "vitest";
import { trYesterdayYmd } from "../modules/nightly-summary/nightly-summary.js";

describe("gecelik özet", () => {
  it("dün, Türkiye saatine göre hesaplanır", () => {
    // 18 Kasım 00:30 TR = 17 Kasım 21:30 UTC → "dün" 17 Kasım
    expect(trYesterdayYmd(new Date("2026-11-17T21:30:00Z"))).toBe("2026-11-17");
    // 18 Kasım 23:30 TR = 20:30 UTC → "dün" 17 Kasım
    expect(trYesterdayYmd(new Date("2026-11-18T20:30:00Z"))).toBe("2026-11-17");
  });
});
