import { describe, it, expect } from "vitest";
import { toolDisplayName } from "../lib/teamActivity";

/** Eski elle yazılmış listedeki her araç hâlâ okunur bir ad almalı. */
describe("araç adları eksiksiz", () => {
  const ids = ["split", "merge", "compress", "pdf-to-word", "word-to-pdf", "excel-to-pdf", "pdf-to-excel", "encrypt", "unlock-pdf", "delete-pages", "rotate-pdf", "organize-pdf", "watermark", "page-numbers", "repair-pdf", "pdf-to-ppt", "ppt-to-pdf", "pdf-to-image", "image-to-pdf", "html-to-pdf", "pdf-to-text", "flatten-pdf", "extract-images"];
  it("hiçbir araç teknik kimliğine düşmüyor", () => {
    const kimlige_dusen = ids.filter((id) => toolDisplayName(id, "tr") === id);
    expect(kimlige_dusen).toEqual([]);
  });
  it("İngilizcede de ad var", () => {
    const bos = ids.filter((id) => !toolDisplayName(id, "en"));
    expect(bos).toEqual([]);
  });
});
