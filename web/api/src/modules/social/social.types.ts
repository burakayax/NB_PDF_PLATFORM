/**
 * Sosyal medya otomasyonunun ortak tipleri ve platform künyeleri.
 *
 * TASARIM KURALI — METİN GÖRSELE GÖMÜLMEZ: Gönderi metni her zaman platformun
 * kendi "caption"/"text" alanına gider; görsel ayrı bir medya eki olarak
 * yüklenir. Metni görselin içine yazmak (bazı hazır otomasyon araçlarının
 * yaptığı gibi) bağlantıyı tıklanamaz, metni aranamaz ve ekran okuyucular için
 * erişilemez hâle getirir.
 */

import type { SocialPlatform } from "@prisma/client";

/** Yayınlanacak içerik — RSS'ten türetilmiş, platformdan bağımsız hâli. */
export type FeedItem = {
  /** RSS <guid> — yazının kalıcı kimliği; mükerrer paylaşımı bu engeller. */
  guid: string;
  lang: "tr" | "en";
  title: string;
  summary: string;
  link: string;
  /** Yayın tarihi (ms). */
  publishedAt: number;
  categories: string[];
  /** En-boy oranına göre kapak adresleri. */
  images: { wide?: string; square?: string; tall?: string };
  /** Beslemedeki "diğer dil" işareti — eşleştirme için ham veri. */
  altRef?: { lang: "tr" | "en"; url: string } | null;
  /**
   * Yazının DİĞER dildeki hâli — varsa çift dilli gönderi buradan üretilir.
   * Çeviri DEĞİL: her iki metin de sitede zaten o dilde yazılmış özgün metin.
   */
  alt?: { lang: "tr" | "en"; title: string; summary: string; link: string };
  /** Sitenin hedeflediği gerçek arama terimleri (etiket üretiminin dayanağı). */
  keywords?: { tr: string[]; en: string[] };
};

/** Bir platforma gönderilecek hazır gönderi. */
export type PreparedPost = {
  platform: SocialPlatform;
  /** Caption metni — bağlantı ve etiketler dâhil. */
  body: string;
  /** Medya eki adresi (boşsa salt metin). */
  imageUrl: string | null;
};

/** Yayınlama sonucu. */
export type PublishResult = {
  externalId: string | null;
  externalUrl: string | null;
};

export type PlatformSpec = {
  platform: SocialPlatform;
  label: string;
  /** Caption için güvenli üst sınır (karakter). */
  maxChars: number;
  /** Gönderi görselsiz yayınlanabilir mi? */
  imageRequired: boolean;
  /** Tercih edilen kapak kesimi. */
  imageFormat: "wide" | "square" | "tall";
  /** Kaç etiket (hashtag) üretilsin. */
  hashtagCount: number;
  /** Metin içinde bağlantı gösterilsin mi? (Instagram'da tıklanmaz.) */
  inlineLink: boolean;
  /**
   * Bu ağda çift dilli (EN üstte, TR altta) gönderi yapılabilir mi?
   * X kapalı: 280 karakterde iki dil okunur bir gönderi çıkarmıyor.
   */
  bilingual: boolean;
  /** Bu platformda saklanması gereken gizli alanlar. */
  secretFields: { key: string; label: string; help: string }[];
};

export const PLATFORM_SPECS: Record<SocialPlatform, PlatformSpec> = {
  X: {
    platform: "X",
    label: "X (Twitter)",
    // 280 sınırı; bağlantı her zaman 23 karakter sayılır (t.co kısaltması).
    maxChars: 250,
    imageRequired: false,
    imageFormat: "wide",
    hashtagCount: 2,
    inlineLink: true,
    bilingual: false,
    secretFields: [
      { key: "apiKey", label: "API Key", help: "X geliştirici uygulamasının Consumer Key değeri" },
      { key: "apiSecret", label: "API Key Secret", help: "Consumer Secret değeri" },
      { key: "accessToken", label: "Access Token", help: "Hesaba ait erişim anahtarı (Read and write yetkili)" },
      { key: "accessSecret", label: "Access Token Secret", help: "Erişim anahtarının gizli eşi" },
    ],
  },
  LINKEDIN: {
    platform: "LINKEDIN",
    label: "LinkedIn",
    maxChars: 2800,
    imageRequired: false,
    imageFormat: "wide",
    hashtagCount: 3,
    inlineLink: true,
    bilingual: true,
    secretFields: [
      { key: "accessToken", label: "Access Token", help: "w_organization_social yetkili erişim anahtarı" },
      { key: "organizationId", label: "Şirket Sayfası ID", help: "Yalnızca sayı — örn. 12345678" },
    ],
  },
  FACEBOOK: {
    platform: "FACEBOOK",
    label: "Facebook Sayfası",
    maxChars: 2000,
    imageRequired: false,
    imageFormat: "wide",
    hashtagCount: 3,
    inlineLink: true,
    bilingual: true,
    secretFields: [
      { key: "pageId", label: "Sayfa ID", help: "Facebook sayfasının sayısal kimliği" },
      { key: "pageAccessToken", label: "Sayfa Erişim Anahtarı", help: "Süresiz (long-lived) page access token" },
    ],
  },
  INSTAGRAM: {
    platform: "INSTAGRAM",
    label: "Instagram",
    maxChars: 2100,
    // Instagram görselsiz gönderi kabul etmez.
    imageRequired: true,
    imageFormat: "square",
    hashtagCount: 6,
    bilingual: true,
    // Instagram caption'ındaki bağlantı tıklanmaz; yine de adresi yazıyoruz ki
    // kullanıcı kopyalayabilsin.
    inlineLink: true,
    secretFields: [
      { key: "igUserId", label: "Instagram İşletme Hesabı ID", help: "Facebook sayfasına bağlı IG Business hesabının kimliği" },
      { key: "pageAccessToken", label: "Sayfa Erişim Anahtarı", help: "Bağlı Facebook sayfasının erişim anahtarı" },
    ],
  },
  PINTEREST: {
    platform: "PINTEREST",
    label: "Pinterest",
    maxChars: 480,
    imageRequired: true,
    imageFormat: "tall",
    hashtagCount: 2,
    // Pinterest'te bağlantı ayrı bir alanda (link) taşınır; metne yazmaya gerek yok.
    inlineLink: false,
    bilingual: true,
    secretFields: [
      { key: "accessToken", label: "Access Token", help: "pins:write yetkili erişim anahtarı" },
      { key: "boardId", label: "Pano ID", help: "Pinlerin ekleneceği panonun kimliği" },
    ],
  },
};

export const ALL_PLATFORMS = Object.keys(PLATFORM_SPECS) as SocialPlatform[];
