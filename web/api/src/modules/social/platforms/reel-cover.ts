/**
 * Araç videolarının markalı kapak görseli (`frontend/public/reel-covers/<araç>.jpg`, 1080×1920).
 *
 * Instagram Reels kapağı ve YouTube küçük resmi olarak kullanılır. Kapak sitenin statik dosyasıdır;
 * henüz yayında değilse (yeni araç, dağıtım gecikmesi) video yine de kapaksız yayınlanır — kapak
 * eksikliği paylaşımı ASLA engellemez.
 */

import { env } from "../../../config/env.js";
import { TOOL_REEL_PREFIX } from "../tool-reels.service.js";

/** Gönderi kimliğinden (`tool-reel:<araç>`) araç kimliği; araç videosu değilse null. */
export function toolIdFromGuid(guid: string): string | null {
  return guid.startsWith(TOOL_REEL_PREFIX) ? guid.slice(TOOL_REEL_PREFIX.length) || null : null;
}

export const reelCoverUrl = (toolId: string): string =>
  `${env.APP_BASE_URL.replace(/\/$/, "")}/reel-covers/${encodeURIComponent(toolId)}.jpg`;

/**
 * Kapak adresi, yalnızca gerçekten erişilebilir bir görsel olarak yanıt veriyorsa döner.
 * Instagram erişemediği kapak adresinde TÜM gönderiyi reddeder; bu yüzden önce sınanır.
 */
export async function availableReelCover(guid: string): Promise<string | null> {
  const toolId = toolIdFromGuid(guid);
  if (!toolId) return null;
  const url = reelCoverUrl(toolId);
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
    const type = res.headers.get("content-type") ?? "";
    return res.ok && type.startsWith("image/") ? url : null;
  } catch {
    return null;
  }
}
