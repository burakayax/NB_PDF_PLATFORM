/**
 * ELLE YAZILMIŞ SLAYT METİNLERİ (Instagram kaydırmalı gönderi).
 *
 * NEDEN ELLE: Yazıdan otomatik çıkarılan cümleler bağlamdan kopuk, terim dolu ve
 * robotik duruyordu ("Analiz sekmesi tarih çakışması gibi kesin hataları gösterir").
 * Burada her yazı, konuyu bir insan anlatıyormuş gibi kısa ve somut slaytlara bölünmüştür.
 *
 * İLKELER
 *  - Slayt başına TEK fikir. Başlık kısa (en çok ~8 kelime), metin 1–2 cümle.
 *  - Gündelik dil: "çözülür", "ATS röntgeni", "sekme" gibi kullanıcının bilmediği söz yok.
 *  - Yalnızca yazının kendi bilgisi: araçta olmayan özellik, uydurma rakam yok.
 *  - Kapak (`hook`) tek başına merak uyandırmalı; 10–12 kelimeyi geçmemeli.
 *  - Gizlilik cümlesi yalnızca cihazda çalışan araçlar için ("dosya yüklenmez").
 *
 * Bir yazı burada yoksa generate-carousels.mjs yazının kendi başlık ve adımlarından
 * otomatik slayt çıkarır (carouselSlides.mjs); yeni blog yazısı eklendiğinde yine slayt çıkar
 * ama kalite için buraya da elle metin eklenmelidir.
 */
import { COPY_1 } from "./carouselCopy1.mjs";
import { COPY_2 } from "./carouselCopy2.mjs";
import { COPY_3 } from "./carouselCopy3.mjs";
import { COPY_4 } from "./carouselCopy4.mjs";
import { COPY_5 } from "./carouselCopy5.mjs";
import { COPY_6 } from "./carouselCopy6.mjs";
import { COPY_7 } from "./carouselCopy7.mjs";
import { COPY_8 } from "./carouselCopy8.mjs";
import { CV_PROFESSION_CAROUSELS } from "./blogContentCv3.mjs";

export const CURATED_CAROUSELS = {
  ...COPY_1,
  ...COPY_2,
  ...COPY_3,
  ...COPY_4,
  ...COPY_5,
  ...COPY_6,
  ...COPY_7,
  ...COPY_8,
  ...CV_PROFESSION_CAROUSELS,
};

/** @returns {{ hook: string, slides: Array<{title:string,text:string}> } | null} */
export function curatedCarousel(slug) {
  const c = CURATED_CAROUSELS[slug];
  if (!c) return null;
  return { hook: c.hook, slides: c.slides.map(([title, text]) => ({ title, text })) };
}
