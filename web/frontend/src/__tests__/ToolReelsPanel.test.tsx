import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SocialToolReel } from "../api/admin";

const REEL: SocialToolReel = {
  id: "compress",
  guid: "tool-reel:compress",
  video: {
    id: "compress-1791728774504",
    url: "https://api.pdfplatform.app/api/public/tool-reels/compress-1791728774504.mp4",
    seconds: 27,
    createdAt: "2026-10-11T05:40:00.000Z",
  },
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
  it("hazır videoyu oynatır ve mevcut gönderi durumunu gösterir", async () => {
    fetchReels.mockResolvedValue({ reels: [REEL] });
    const { container } = render(<ToolReelsPanel accessToken="t" onQueued={vi.fn()} />);

    expect(await screen.findByText("PDF Sıkıştır")).toBeTruthy();
    expect(container.querySelector("video")?.getAttribute("src")).toBe(REEL.video?.url);
    expect(screen.getByText("Taslak")).toBeTruthy();
  });

  it("videosu hazır olmayan araç listelenmez; hiç video yoksa açıklama gösterilir", async () => {
    fetchReels.mockResolvedValue({ reels: [{ ...REEL, video: null, posts: [] }] });
    const { container } = render(<ToolReelsPanel accessToken="t" onQueued={vi.fn()} />);

    expect(await screen.findByText(/Şu an hazır araç videosu yok/)).toBeTruthy();
    expect(screen.queryByText("PDF Sıkıştır")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByRole("button", { name: /Reels taslağı hazırla/ })).toBeNull();
  });

  it("karışık listede yalnızca videosu hazır olan araç görünür", async () => {
    const merge: SocialToolReel = { ...REEL, id: "merge", guid: "tool-reel:merge", video: null, tr: { ...REEL.tr, title: "PDF Birleştir" }, posts: [] };
    fetchReels.mockResolvedValue({ reels: [REEL, merge] });
    render(<ToolReelsPanel accessToken="t" onQueued={vi.fn()} />);

    expect(await screen.findByText("PDF Sıkıştır")).toBeTruthy();
    expect(screen.queryByText("PDF Birleştir")).toBeNull();
  });

  it("“Yalnızca Facebook” yalnız Facebook için taslak ister", async () => {
    fetchReels.mockResolvedValue({ reels: [REEL] });
    queueReel.mockResolvedValue({ queued: [], skipped: [] });
    render(<ToolReelsPanel accessToken="t" onQueued={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Yalnızca Facebook" }));

    await waitFor(() => expect(queueReel).toHaveBeenCalledWith("t", "compress", ["FACEBOOK"]));
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
});
