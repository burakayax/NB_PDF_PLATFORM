/**
 * Pinterest pano anahtarları ve adları. Sunucudaki `pinterest-boards.config.ts` ile AYNI anahtarlar olmalı;
 * eşleştirme kuralları ve araç tablosu yalnız sunucudadır (panelde “Eşleştirme kuralları”ndan görülür).
 */
export type PinterestBoardKey = "cv" | "pdf-duzenleme" | "tarama" | "gizlilik" | "hukuk" | "ogrenci" | "donusum";

export const PINTEREST_BOARDS: { key: PinterestBoardKey; name: string }[] = [
  { key: "cv", name: "CV Örnekleri ve CV Hazırlama" },
  { key: "pdf-duzenleme", name: "PDF Düzenleme İpuçları" },
  { key: "tarama", name: "Telefonla Belge Tarama" },
  { key: "gizlilik", name: "Belge Gizliliği ve Kişisel Veri" },
  { key: "hukuk", name: "Sözleşme ve Hukuk Belgeleri" },
  { key: "ogrenci", name: "Öğrenciler İçin PDF ve Ödev İpuçları" },
  { key: "donusum", name: "E-kitap ve Metin Dönüşümü" },
];

export const pinterestBoardName = (key: string | null | undefined): string =>
  PINTEREST_BOARDS.find((b) => b.key === key)?.name ?? key ?? "";
