import { afterEach, describe, expect, it, vi } from "vitest";
import { softenGiftLine } from "../lib/aiAvailability";
import { toolAccessBadge } from "../lib/toolAccess";
import { accountPanelFromPath, ACCOUNT_PANEL_PATHS } from "../lib/accountPaths";
import { touchifyDropText } from "../lib/touchCopy";
import { ARAC_SAYISI, AI_COMING_SOON_SLUGS } from "../seo/seoContent.mjs";

describe("AI açılana kadar vaatler", () => {
  it("hediye satırı AI kapalıyken 'açıldığında' diye zamanlanır; açıkken olduğu gibi kalır", () => {
    expect(softenGiftLine("✨ Hoş geldin hediyesi: 3 ücretsiz yapay zekâ işlemi", true, true)).toContain("açıldığında");
    expect(softenGiftLine("✨ Welcome gift: 3 free AI operations", false, true)).toContain("When AI opens");
    expect(softenGiftLine("✨ Hoş geldin hediyesi: 3 ücretsiz yapay zekâ işlemi", true, false)).toContain("Hoş geldin");
    expect(softenGiftLine("Dosya boyutu ≤ 80 MB", true, true)).toBe("Dosya boyutu ≤ 80 MB");
  });

  it("'Çok yakında' AI araçlarının rozeti üyeliksiz/hediye demez", () => {
    for (const id of AI_COMING_SOON_SLUGS) {
      const b = toolAccessBadge({ id, ai: true }, true, true);
      expect(b.label).toBe("Çok yakında");
    }
    expect(toolAccessBadge({ id: "hassas-veri-gizle" }, true, false).label).not.toBe("Çok yakında");
  });

  it("araç sayısı kullanılamayan (çok yakında) AI araçlarını saymaz", () => {
    expect(ARAC_SAYISI).toBeGreaterThan(0);
    expect(AI_COMING_SOON_SLUGS.length).toBe(9);
  });
});

describe("hesap ekranı adresleri", () => {
  it("her ekranın kendi adresi vardır ve geri çözülür", () => {
    for (const [id, yol] of Object.entries(ACCOUNT_PANEL_PATHS)) {
      expect(accountPanelFromPath(yol)).toBe(id);
      expect(accountPanelFromPath(`/en${yol}/`)).toBe(id);
    }
    expect(accountPanelFromPath("/tools/split-pdf")).toBeNull();
  });
});

describe("dokunmatik yükleme metni", () => {
  afterEach(() => vi.unstubAllGlobals());
  const coarse = (c: boolean) =>
    vi.stubGlobal("window", { matchMedia: () => ({ matches: c }) });

  it("dokunmatikte 'sürükle' yerine 'seç' yazar", () => {
    coarse(true);
    expect(touchifyDropText("Dosyayı buraya sürükle")).toBe("Dosyayı seç");
    expect(touchifyDropText("PDF'i buraya sürükle veya seç")).toBe("PDF'i seç");
    expect(touchifyDropText("Drag your file here")).toBe("Choose your file");
  });
  it("masaüstünde metni değiştirmez", () => {
    coarse(false);
    expect(touchifyDropText("Dosyayı buraya sürükle")).toBe("Dosyayı buraya sürükle");
  });
});
