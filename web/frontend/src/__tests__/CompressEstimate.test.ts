/**
 * Sıkıştırma beklentisi — kullanıcıya gösterilen aralık gerçeği tutmalı.
 *
 * Aralık, iki GERÇEK ölçümle doğrulanır:
 *   • Metin ağırlıklı 45 sayfalık belge (görüntü oranı %7,7) → gerçekte %27 kazanç
 *   • Görüntü ağırlıklı belge (oran ~%100) → agresif %91, otomatik %84,
 *     dengeli %79, kaliteli %75 kazanç
 * Gösterilen aralık bu değerleri KAPSAMALI; kapsamıyorsa kullanıcıya
 * tutmayan bir söz veriyoruz demektir.
 */
import { describe, it, expect } from "vitest";
import {
  compressGainPercentRange,
  COMPRESS_TEXT_HEAVY_RATIO,
} from "../components/workspace/toolProgressUi";

describe("compressGainPercentRange", () => {
  it("metin ağırlıklı belgede gerçek sonucu kapsar (%27)", () => {
    const r = compressGainPercentRange(0.077, "auto");
    expect(r).not.toBeNull();
    expect(r!.min).toBeLessThanOrEqual(27);
    expect(r!.max).toBeGreaterThanOrEqual(27);
  });

  it("görüntü ağırlıklı belgede her kademede gerçek sonucu kapsar", () => {
    const measured = { low: 91, auto: 84, medium: 79, high: 75 } as const;
    for (const [quality, actual] of Object.entries(measured)) {
      const r = compressGainPercentRange(
        0.998,
        quality as keyof typeof measured,
      );
      expect(r).not.toBeNull();
      expect(r!.min).toBeLessThanOrEqual(actual);
      expect(r!.max).toBeGreaterThanOrEqual(actual);
    }
  });

  it("agresif kademe kaliteli kademeden daha çok küçültür", () => {
    const low = compressGainPercentRange(0.9, "low")!;
    const high = compressGainPercentRange(0.9, "high")!;
    expect(low.min).toBeGreaterThan(high.min);
    expect(low.max).toBeGreaterThan(high.max);
  });

  it("görüntü oranı bilinmiyorsa sayı uydurmaz", () => {
    expect(compressGainPercentRange(null, "auto")).toBeNull();
    expect(compressGainPercentRange(undefined, "auto")).toBeNull();
    expect(compressGainPercentRange(Number.NaN, "auto")).toBeNull();
  });

  it("metin ağırlıklı eşiği kullanıcının dosyasını yakalar", () => {
    expect(0.077).toBeLessThan(COMPRESS_TEXT_HEAVY_RATIO);
    expect(0.998).toBeGreaterThan(COMPRESS_TEXT_HEAVY_RATIO);
  });
});
