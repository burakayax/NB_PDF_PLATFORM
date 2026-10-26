import { describe, expect, it } from "vitest";
import { topicOf } from "../modules/social/feed-topic.js";

const item = (title: string, slug = "x") => ({ guid: slug, title, link: `https://s/blog/${slug}`, categories: [] as string[] });

describe("topicOf", () => {
  it("CV ile ilgili yazıları aynı kümeye koyar", () => {
    const t = topicOf(item("Öğretmen CV Örneği"));
    expect(topicOf(item("ATS Uyumlu CV Nasıl Yazılır?"))).toBe(t);
    expect(topicOf(item("Evde Vesikalık Fotoğraf Nasıl Çekilir?"))).toBe(t);
    expect(topicOf(item("Ön Yazı (Cover Letter) Nasıl Yazılır?"))).toBe(t);
  });
  it("tanınmayan konu kendi kümesidir", () => {
    expect(topicOf(item("PDF Boyutu Küçültme", "a"))).not.toBe(topicOf(item("PDF Sayfa Silme", "b")));
  });
  it("sözleşme yazıları ayrı kümedir", () => {
    expect(topicOf(item("Sözleşme İmzalamadan Önce"))).not.toBe(topicOf(item("Öğretmen CV Örneği")));
  });
});
