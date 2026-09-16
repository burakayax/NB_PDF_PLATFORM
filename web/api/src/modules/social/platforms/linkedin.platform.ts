/**
 * LinkedIn şirket sayfası yayıncısı.
 *
 * Görsel üç adımda gider: yükleme izni al → ikili veriyi PUT et → gönderiyi
 * o görsel kimliğiyle oluştur. Metin `commentary` alanında, yani gerçek gönderi
 * metni olarak yayınlanır.
 */

import { PlatformError, coverAltText, downloadImage, requestJson, requireSecret } from "./common.js";
import type { Publisher } from "./common.js";

const API = "https://api.linkedin.com/rest";
/** LinkedIn sürümü başlıkta ZORUNLU; eksikse istek 426 ile reddedilir. */
const LINKEDIN_VERSION = "202405";

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

  if (imageUrl) {
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
  };
};
