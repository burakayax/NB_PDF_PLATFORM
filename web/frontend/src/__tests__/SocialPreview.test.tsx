import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SocialAccountRow, SocialPlatformId, SocialPostRow } from "../api/admin";
import { PostFullPreviewModal } from "../admin/social/PostFullPreviewModal";
import { PostMediaPreview } from "../admin/social/PostMediaPreview";
import { RecentPostsPanel } from "../admin/social/RecentPostsPanel";

afterEach(cleanup);

const LONG_BODY = `${"Çok uzun bir gönderi metni. ".repeat(40)}\n\nSON-CÜMLE-GÖRÜNMELİ #PDF`;

function post(over: Partial<SocialPostRow> = {}): SocialPostRow {
  return {
    id: "p1",
    platform: "INSTAGRAM",
    title: "UDF Dosyası Nasıl Açılır?",
    linkUrl: "https://example.test/blog/a",
    body: "Metin",
    imageUrl: "https://example.test/covers/square/a.png",
    status: "PUBLISHED",
    scheduledAt: "2026-10-07T07:00:00.000Z",
    publishedAt: "2026-10-07T07:01:00.000Z",
    externalUrl: "https://www.instagram.com/p/X",
    attempts: 1,
    lastError: null,
    createdAt: "2026-10-07T06:00:00.000Z",
    updatedAt: "2026-10-07T07:01:00.000Z",
    carouselSlides: [],
    ...over,
  };
}

const SLIDES = [1, 2, 3, 4].map((n) => `https://example.test/social/carousel/tr/a/${n}.jpg`);

describe("kaydırmalı gönderi önizlemesi", () => {
  it("tüm slaytları sırayla gösterir ve sayacı günceller", () => {
    render(<PostMediaPreview post={post({ carouselSlides: SLIDES })} onOpen={() => undefined} />);

    expect(screen.getByText("1/4")).toBeTruthy();
    expect(screen.getByText(/Kaydırmalı gönderi · 4 slayt/)).toBeTruthy();
    expect((screen.getByAltText("Slayt 1 / 4") as HTMLImageElement).src).toBe(SLIDES[0]);

    fireEvent.click(screen.getByLabelText("Sonraki slayt"));
    fireEvent.click(screen.getByLabelText("Sonraki slayt"));
    expect(screen.getByText("3/4")).toBeTruthy();
    expect((screen.getByAltText("Slayt 3 / 4") as HTMLImageElement).src).toBe(SLIDES[2]);

    // Sondan öteye gidilemez.
    fireEvent.click(screen.getByLabelText("Sonraki slayt"));
    fireEvent.click(screen.getByLabelText("Sonraki slayt"));
    expect(screen.getByText("4/4")).toBeTruthy();
    expect((screen.getByLabelText("Sonraki slayt") as HTMLButtonElement).disabled).toBe(true);
  });

  it("tek görselde kaydırıcı yok, Reels'te video var", () => {
    const { rerender } = render(<PostMediaPreview post={post()} onOpen={() => undefined} />);
    expect(screen.queryByLabelText("Sonraki slayt")).toBeNull();

    rerender(<PostMediaPreview post={post({ imageUrl: "https://example.test/reel.mp4" })} onOpen={() => undefined} />);
    expect(screen.getByText("REELS")).toBeTruthy();
  });
});

describe("tam önizleme penceresi", () => {
  it("metnin TAMAMINI gösterir (kırpma yok) ve slaytlarda gezinilir", () => {
    render(<PostFullPreviewModal post={post({ body: LONG_BODY, carouselSlides: SLIDES })} accountLabel="@pdfplatform" onClose={() => undefined} />);

    expect(screen.getByText("@pdfplatform")).toBeTruthy();
    // Metnin en sonundaki ifade görünüyor → kısaltılmamış.
    expect(screen.getByText(/SON-CÜMLE-GÖRÜNMELİ/)).toBeTruthy();
    expect(screen.getByText(new RegExp(`${LONG_BODY.length} karakter`))).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("2/4")).toBeTruthy();
  });

  it("Esc ile kapanır", () => {
    const onClose = vi.fn();
    render(<PostFullPreviewModal post={post()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("her ağın son 5 paylaşımı", () => {
  const accounts = [] as SocialAccountRow[];

  it("ağ başına ayrı bölüm; her bölüm en fazla 5 satır; boş ağda 'henüz paylaşım yok'", () => {
    const mk = (platform: SocialPlatformId, n: number) =>
      Array.from({ length: n }, (_, i) => post({ id: `${platform}-${i}`, platform, title: `${platform} yazı ${i + 1}` }));
    render(
      <RecentPostsPanel
        recent={{ INSTAGRAM: mk("INSTAGRAM", 8), FACEBOOK: mk("FACEBOOK", 3) }}
        accounts={accounts}
        busyId={null}
        onRemove={() => undefined}
      />,
    );

    const ig = screen.getByRole("heading", { name: "Instagram" }).closest("section")!;
    expect(within(ig).getAllByRole("listitem")).toHaveLength(5); // 8 gelse de 5
    const fb = screen.getByRole("heading", { name: "Facebook" }).closest("section")!;
    expect(within(fb).getAllByRole("listitem")).toHaveLength(3);
    const x = screen.getByRole("heading", { name: "X" }).closest("section")!;
    expect(within(x).getByText("henüz paylaşım yok")).toBeTruthy();
  });

  it("Önizle tam önizlemeyi açar; kaldır onRemove çağırır", () => {
    const onRemove = vi.fn();
    render(
      <RecentPostsPanel
        recent={{ INSTAGRAM: [post({ body: LONG_BODY, carouselSlides: SLIDES })] }}
        accounts={accounts}
        busyId={null}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByText("Önizle"));
    expect(screen.getByRole("dialog", { name: "Tam önizleme" })).toBeTruthy();
    expect(screen.getByText(/SON-CÜMLE-GÖRÜNMELİ/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Kapat"));
    fireEvent.click(screen.getByTitle(/Panelden kaldır/));
    expect(onRemove).toHaveBeenCalledWith("p1");
  });
});
