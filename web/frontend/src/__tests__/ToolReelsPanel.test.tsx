import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SocialToolReel } from "../api/admin";

const REEL: SocialToolReel = {
  id: "compress",
  guid: "tool-reel:compress",
  videoUrl: "https://www.pdfplatform.app/arac-videolari/pdf-sikistirma.mp4",
  seconds: 27,
  tr: { title: "PDF Sıkıştır", summary: "Özet metni", link: "https://www.pdfplatform.app/tools/compress" },
  en: { title: "Compress PDF", summary: "Summary", link: "https://www.pdfplatform.app/en/tools/compress" },
  posts: [{ platform: "INSTAGRAM", status: "DRAFT", createdAt: "2026-10-11T10:00:00.000Z" }],
};

const fetchReels = vi.fn();
const queueReel = vi.fn();
vi.mock("../api/admin", () => ({
  fetchSocialToolReels: (...a: unknown[]) => fetchReels(...a),
  queueSocialToolReel: (...a: unknown[]) => queueReel(...a),
}));

import { ToolReelsPanel } from "../admin/social/ToolReelsPanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ToolReelsPanel", () => {
  it("videoyu bu sitenin kendi yolundan oynatır ve mevcut gönderi durumunu gösterir", async () => {
    fetchReels.mockResolvedValue({ reels: [REEL] });
    const { container } = render(<ToolReelsPanel accessToken="t" onQueued={vi.fn()} />);

    expect(await screen.findByText("PDF Sıkıştır")).toBeTruthy();
    expect(container.querySelector("video")?.getAttribute("src")).toBe("/arac-videolari/pdf-sikistirma.mp4");
    expect(screen.getByText("Taslak")).toBeTruthy();
  });

  it("“Reels taslağı hazırla” videonun kimliğiyle çağrılır ve sonuç üst panele iletilir", async () => {
    fetchReels.mockResolvedValue({ reels: [REEL] });
    const result = { queued: [{ platform: "INSTAGRAM", title: "x", manual: false }], skipped: [] };
    queueReel.mockResolvedValue(result);
    const onQueued = vi.fn();
    render(<ToolReelsPanel accessToken="t" onQueued={onQueued} />);

    fireEvent.click(await screen.findByRole("button", { name: /Reels taslağı hazırla/ }));

    await waitFor(() => expect(onQueued).toHaveBeenCalledWith(result, "PDF Sıkıştır"));
    expect(queueReel).toHaveBeenCalledWith("t", "compress");
  });

  it("video yoksa boş durum gösterir", async () => {
    fetchReels.mockResolvedValue({ reels: [] });
    render(<ToolReelsPanel accessToken="t" onQueued={vi.fn()} />);
    expect(await screen.findByText("Henüz araç videosu yok")).toBeTruthy();
  });
});
