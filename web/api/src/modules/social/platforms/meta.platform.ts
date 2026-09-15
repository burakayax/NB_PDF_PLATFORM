/**
 * Facebook Sayfası ve Instagram yayıncıları (ikisi de Meta Graph API).
 *
 * İkisinde de görsel bizim sitemizdeki ADRESİYLE veriliyor; Meta görseli
 * kendisi indiriyor. Metin ayrı alanda (`message` / `caption`) gidiyor —
 * yazının görsele gömülmesi diye bir durum yok.
 */

import { requestJson, requireSecret } from "./common.js";
import type { Publisher } from "./common.js";

const GRAPH = "https://graph.facebook.com/v21.0";

export const publishToFacebook: Publisher = async ({ body, imageUrl, secrets }) => {
  const pageId = requireSecret(secrets, "pageId", "Facebook Sayfa ID");
  const token = requireSecret(secrets, "pageAccessToken", "Facebook Sayfa Erişim Anahtarı");

  // Görsel varsa /photos ucu kullanılır: gönderi tek parça olur (metin + görsel).
  const endpoint = imageUrl ? `${GRAPH}/${pageId}/photos` : `${GRAPH}/${pageId}/feed`;
  const form = new URLSearchParams();
  form.set("access_token", token);
  if (imageUrl) {
    form.set("url", imageUrl);
    form.set("caption", body);
  } else {
    form.set("message", body);
  }

  const json = await requestJson("Facebook", endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const id = (json.post_id as string | undefined) ?? (json.id as string | undefined) ?? null;
  return { externalId: id, externalUrl: id ? `https://www.facebook.com/${id}` : null };
};

export const publishToInstagram: Publisher = async ({ body, imageUrl, secrets }) => {
  const igUserId = requireSecret(secrets, "igUserId", "Instagram İşletme Hesabı ID");
  const token = requireSecret(secrets, "pageAccessToken", "Instagram Sayfa Erişim Anahtarı");
  if (!imageUrl) throw new Error("Instagram görselsiz gönderi kabul etmiyor");

  // 1) Taslak kap oluştur.
  const container = new URLSearchParams();
  container.set("access_token", token);
  container.set("image_url", imageUrl);
  container.set("caption", body);

  const created = await requestJson("Instagram", `${GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: container.toString(),
  });
  const creationId = created.id as string | undefined;
  if (!creationId) throw new Error("Instagram taslak kimliği dönmedi");

  // 2) Kabın hazır olmasını BEKLE. Meta görseli kendi tarafına indirip
  //    işliyor; hazır olmadan yayınlamak "medya hazır değil" hatası verir.
  //    Körlemesine tekrar denemek yerine kabın kendi durumu sorgulanır —
  //    hata kalıcıysa (ERROR) boşuna beklenmez, sebebi de görülür.
  await waitForContainer(creationId, token);

  // 3) Yayınla.
  const publish = new URLSearchParams();
  publish.set("access_token", token);
  publish.set("creation_id", creationId);
  const json = await requestJson("Instagram", `${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: publish.toString(),
  });
  const id = (json.id as string | undefined) ?? null;
  return { externalId: id, externalUrl: id ? `https://www.instagram.com/p/${id}` : null };
};

/** Taslak kabın işlenme durumu: FINISHED olana kadar (en fazla ~60 sn) bekler. */
async function waitForContainer(creationId: string, token: string): Promise<void> {
  const DELAY_MS = 4000;
  const MAX_TRIES = 15;

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const status = await requestJson(
      "Instagram",
      `${GRAPH}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
      { method: "GET" },
    );
    const code = status.status_code as string | undefined;
    if (code === "FINISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Instagram görseli işleyemedi: ${String(status.status ?? code)}`);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  throw new Error("Instagram görseli zamanında işlemedi");
}
