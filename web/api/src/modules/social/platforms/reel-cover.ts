/**
 * Araç videolarının markalı kapak görseli (`frontend/public/reel-covers/<araç>.jpg`, 1080×1920).
 *
 * Instagram Reels kapağı ve YouTube küçük resmi olarak kullanılır. Kapak sitenin statik dosyasıdır;
 * henüz yayında değilse (yeni araç, dağıtım gecikmesi) video yine de kapaksız yayınlanır — kapak
 * eksikliği paylaşımı ASLA engellemez.
 */

import { env } from "../../../config/env.js";
import { logger } from "../../../lib/file-log.js";
import { TOOL_REEL_PREFIX } from "../tool-reels.service.js";

/** Gönderi kimliğinden (`tool-reel:<araç>`) araç kimliği; araç videosu değilse null. */
export function toolIdFromGuid(guid: string): string | null {
  return guid.startsWith(TOOL_REEL_PREFIX) ? guid.slice(TOOL_REEL_PREFIX.length) || null : null;
}

/**
 * Kapaklar SİTENİN statik dosyasıdır (frontend/public/reel-covers); API alan adında YOKTUR.
 * Bu yüzden adres APP_BASE_URL (API) değil FRONTEND_ORIGIN (site) üzerinden kurulur. Videonun kendisi ise
 * API'den sunulur (`videoUrlFor`), ikisi karıştırılmamalı.
 */
export const reelCoverUrl = (toolId: string): string =>
  `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/reel-covers/${encodeURIComponent(toolId)}.jpg`;

/**
 * Kapak adresi, yalnızca gerçekten erişilebilir bir görsel olarak yanıt veriyorsa döner.
 * Instagram erişemediği kapak adresinde TÜM gönderiyi reddeder; bu yüzden önce sınanır.
 */
export async function availableReelCover(guid: string): Promise<string | null> {
  const toolId = toolIdFromGuid(guid);
  if (!toolId) return null;
  const url = reelCoverUrl(toolId);
  try {
    // Yönlendirme izlenir (ör. pdfplatform.app → www.pdfplatform.app); Instagram yönlendirmeli kapak adresini
    // indirmeyebilir, bu yüzden NİHAİ adres döner.
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10_000) });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && type.startsWith("image/")) return res.url || url;
    // Sessiz düşüş "kapak neden yok?" sorusunu cevapsız bırakıyordu (ör. FRONTEND_ORIGIN yanlış).
    logger.warn("social", `Reels kapağı kullanılamadı, kapaksız yayınlanacak: ${url} → HTTP ${res.status} ${type}`);
    return null;
  } catch (err) {
    logger.warn("social", `Reels kapağına erişilemedi, kapaksız yayınlanacak: ${url} (${String(err)})`);
    return null;
  }
}
