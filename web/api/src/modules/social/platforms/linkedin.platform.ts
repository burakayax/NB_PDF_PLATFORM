/**
 * LinkedIn şirket sayfası yayıncısı.
 *
 * Kaydırmalı gönderi: LinkedIn'de kaydırma yalnız PDF belgesiyle olur. Yazının slaytları tek
 * PDF'e dizilip belge olarak yüklenir (yoksa ya da hazırlanamazsa tek görsele düşülür).
 *
 * Görsel üç adımda gider: yükleme izni al → ikili veriyi PUT et → gönderiyi
 * o görsel kimliğiyle oluştur. Metin `commentary` alanında, yani gerçek gönderi
 * metni olarak yayınlanır.
 */

import { PDFDocument } from "pdf-lib";
import { logger } from "../../../lib/file-log.js";
import { carouselSlidesFor } from "../carousel.service.js";
import { isReelUrl } from "../reels.service.js";
import { PlatformError, coverAltText, downloadImage, requestJson, requireSecret } from "./common.js";
import type { Publisher, Verifier } from "./common.js";

const API = "https://api.linkedin.com/rest";
/**
 * LinkedIn sürümü başlıkta ZORUNLU; eksikse 400, süresi dolmuşsa 426 (NONEXISTENT_VERSION) döner.
 * Her sürüm yaklaşık 1 yıl desteklenir → EN GEÇ yılda bir güncelle (en yeni: learn.microsoft.com/linkedin/marketing/versioning).
 * 202405 Kasım 2026'da kapanmıştı; 2026-11-22'de 202609'a geçildi.
 */
const LINKEDIN_VERSION = "202609";

function headers(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    "linkedin-version": LINKEDIN_VERSION,
    "x-restli-protocol-version": "2.0.0",
    "content-type": "application/json",
  };
}

async function uploadImage(token: string, owner: string, imageUrl: string): Promise<string> {
  const init = await requestJson("LinkedIn", `${API}/images?action=initializeUpload`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });

  const value = init.value as { uploadUrl?: string; image?: string } | undefined;
  if (!value?.uploadUrl || !value.image) throw new Error("LinkedIn yükleme adresi dönmedi");

  const { bytes, mime } = await downloadImage(imageUrl);
  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": mime },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(60_000),
  });
  if (!put.ok) throw new PlatformError("LinkedIn görsel yükleme", put.status, await put.text());

  return value.image;
}

/** Slaytları sayfa sayfa tek PDF'e dizer (her sayfa görselin kendi boyutunda). */
async function slidesToPdf(slideUrls: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const url of slideUrls) {
    const { bytes, mime } = await downloadImage(url);
    const img = /png/i.test(mime) || /\.png(\?|$)/i.test(url) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    pdf.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return pdf.save();
}

async function uploadDocument(token: string, owner: string, slideUrls: string[]): Promise<string> {
  const bytes = await slidesToPdf(slideUrls);
  const init = await requestJson("LinkedIn", `${API}/documents?action=initializeUpload`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  const value = init.value as { uploadUrl?: string; document?: string } | undefined;
  if (!value?.uploadUrl || !value.document) throw new Error("LinkedIn belge yükleme adresi dönmedi");

  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/pdf" },
    body: bytes,
    signal: AbortSignal.timeout(90_000),
  });
  if (!put.ok) throw new PlatformError("LinkedIn belge yükleme", put.status, await put.text());
  return value.document;
}

/**
 * Bağlantı sınaması: şirket sayfasını okumayı dener.
 * 401 = erişim anahtarı geçersiz/süresi dolmuş. 403 = anahtar geçerli ama okuma yetkisi yok
 * (yalnız paylaşım yetkisi verilmişse olağan) → anahtar kabul edilmiş sayılır.
 */
export const verifyLinkedIn: Verifier = async (secrets) => {
  const token = requireSecret(secrets, "accessToken", "LinkedIn Access Token");
  const orgId = requireSecret(secrets, "organizationId", "LinkedIn Şirket Sayfası ID").replace(/\D/g, "");
  if (!orgId) throw new Error("LinkedIn Şirket Sayfası ID yalnızca sayı olmalı");

  const res = await fetch(`${API}/organizations/${orgId}`, {
    headers: headers(token),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();

  if (res.ok) {
    let name = "";
    try {
      name = String((JSON.parse(text) as { localizedName?: string }).localizedName ?? "");
    } catch {
      /* gövde okunamadı: ad olmadan devam */
    }
    return name ? `${name} (sayfa ${orgId})` : `şirket sayfası ${orgId}`;
  }
  if (res.status === 401) {
    throw new PlatformError("LinkedIn", 401, `Erişim anahtarı geçersiz ya da süresi dolmuş (LinkedIn anahtarları 60 gün geçerlidir). ${text}`);
  }
  if (res.status === 403) {
    return `erişim anahtarı geçerli, sayfa ${orgId} okunamadı (yalnız paylaşım yetkisi varsa olağan; kesin kanıt gerçek bir gönderidir)`;
  }
  throw new PlatformError("LinkedIn", res.status, text);
};

export const publishToLinkedIn: Publisher = async ({ body, imageUrl, item, secrets }) => {
  const token = requireSecret(secrets, "accessToken", "LinkedIn Access Token");
  const orgId = requireSecret(secrets, "organizationId", "LinkedIn Şirket Sayfası ID").replace(/\D/g, "");
  if (!orgId) throw new Error("LinkedIn Şirket Sayfası ID yalnızca sayı olmalı");
  const author = `urn:li:organization:${orgId}`;

  const payload: Record<string, unknown> = {
    author,
    commentary: body,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  let slides: string[] = [];
  if (imageUrl && !isReelUrl(imageUrl)) {
    slides = await carouselSlidesFor(item).catch(() => [] as string[]);
  }
  let documentId: string | null = null;
  if (slides.length >= 2) {
    try {
      documentId = await uploadDocument(token, author, slides);
    } catch (err) {
      logger.warn("social", `LinkedIn kaydırmalı belge hazırlanamadı, tek görsele düşülüyor: ${String(err)}`);
      slides = [];
    }
  }

  if (documentId) {
    payload.content = { media: { id: documentId, title: item.title.slice(0, 200) } };
  } else if (imageUrl) {
    payload.content = {
      media: {
        id: await uploadImage(token, author, imageUrl),
        title: item.title.slice(0, 200),
        // LinkedIn alternatif metni 120 karakterle sınırlı.
        altText: coverAltText(item, 120),
      },
    };
  }

  const res = await fetch(`${API}/posts`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new PlatformError("LinkedIn", res.status, await res.text());

  // Gönderi kimliği gövdede değil, `x-restli-id` başlığında döner.
  const id = res.headers.get("x-restli-id");
  return {
    externalId: id,
    externalUrl: id ? `https://www.linkedin.com/feed/update/${id}` : null,
    ...(documentId ? { slides } : {}),
  };
};
