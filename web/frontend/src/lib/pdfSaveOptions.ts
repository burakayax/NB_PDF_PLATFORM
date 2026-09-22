/**
 * Cihazda üretilen TÜM PDF çıktıları için ortak kaydetme seçenekleri.
 *
 * `useObjectStreams: false` ŞART. Varsayılan (açık) haliyle üretilen dosya,
 * nesnelerini sıkıştırılmış "nesne akışları" içine koyar ve klasik `trailer`
 * bölümünü hiç yazmaz. Bu biçim standarda uygundur ve modern okuyucular
 * sorunsuz açar — ama eski ya da katı PDF ayrıştıran yazılımlar (bazı e-imza,
 * muhasebe, ERP, matbaa ve tarayıcı programları) dosyayı kabul etmez;
 * kullanıcı karşı tarafta "PDF eklenemedi" hatası alır.
 *
 * Kapalı halde klasik çapraz-referans tablosu ve `trailer` yazılır: en geniş
 * uyumluluk. Ölçülen bedel, görsel içeren gerçek belgelerde ~%0,3 boyut artışı
 * (dosya başına birkaç yüz bayt). Çıktının başka bir programda hiç açılamaması
 * ihtimaline kıyasla önemsiz.
 *
 * Bu dosya bilerek BAĞIMSIZ tutuldu: hiçbir şey içe aktarmıyor, böylece
 * kullanan modüller birbirine ya da PDF kütüphanesine bağlanmıyor.
 */
export const PDF_SAVE_OPTIONS = { useObjectStreams: false } as const;
