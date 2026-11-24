/**
 * TEK GERÇEK KAYNAK — tüm sayfa SEO içeriği. Eskiden tek dosyaydı; ana sayfa açılışını yavaşlatan
 * araç metinleri (seoToolData.mjs, ~330 KB) ile küçük sabitler (seoLight.mjs) ayrıldı.
 * Bu dosya İKİSİNİ birleştirir: Node betikleri ve testler eskisi gibi buradan okur.
 * Tarayıcı kodu araç metni için src/seo/toolSeoRuntime.ts'i kullanır (ağır dosyayı gerektiğinde yükler).
 * Tipler: seoContent.d.mts.
 */
export * from "./seoLight.mjs";
export * from "./seoToolData.mjs";
