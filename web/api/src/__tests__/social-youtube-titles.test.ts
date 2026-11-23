import { describe, expect, it } from "vitest";
import { TOOL_REEL_CATALOG } from "../modules/social/tool-reel-catalog.js";
import { TOOL_REEL_ABOUT } from "../modules/social/tool-reel-about.js";
import { TOOL_REEL_YOUTUBE_TITLES, youtubeTitleFor } from "../modules/social/tool-reel-youtube-titles.js";

describe("YouTube Shorts başlıkları", () => {
  it("her katalog satırının başlığı var, fazlalık yok, 100 karakteri aşmaz", () => {
    expect(Object.keys(TOOL_REEL_YOUTUBE_TITLES).sort()).toEqual(TOOL_REEL_CATALOG.map((e) => e.id).sort());
    for (const [id, t] of Object.entries(TOOL_REEL_YOUTUBE_TITLES)) {
      expect(t.length, id).toBeGreaterThan(10);
      expect(t.length, id).toBeLessThanOrEqual(100);
    }
  });

  it("tanımsız araçta null döner (katalog başlığına düşülür)", () => {
    expect(youtubeTitleFor("yok-boyle-arac")).toBeNull();
    expect(youtubeTitleFor(undefined)).toBeNull();
  });

  it("gönderi metinlerinde 'ATS röntgeni' jargonu kalmadı", () => {
    for (const e of TOOL_REEL_CATALOG) {
      expect(JSON.stringify(e)).not.toMatch(/röntgen|X-ray/i);
      expect(JSON.stringify(TOOL_REEL_ABOUT[e.id])).not.toMatch(/röntgen|X-ray/i);
    }
  });
});
