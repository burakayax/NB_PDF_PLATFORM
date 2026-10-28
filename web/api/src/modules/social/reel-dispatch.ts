/**
 * Panelden "video üret" komutu: GitHub'daki iş akışını (tool-reels.yml) API üzerinden başlatır.
 *
 * Gerekli sunucu ayarları (yoksa özellik kapalıdır; panel eski yönlendirmeyi gösterir):
 *   GITHUB_DISPATCH_TOKEN  Fine-grained erişim anahtarı; yalnız bu depo, izin: Actions → Read and write
 *   GITHUB_REPO            "kullanici/depo" (varsayılan: burakayax/NB_PDF_PLATFORM)
 */
import { logger } from "../../lib/file-log.js";

const WORKFLOW_FILE = "tool-reels.yml";
const DEFAULT_REPO = "burakayax/NB_PDF_PLATFORM";

export type DispatchResult = { ok: true } | { ok: false; reason: "not-configured" | "failed"; detail?: string };

export function reelDispatchConfigured(): boolean {
  return (process.env.GITHUB_DISPATCH_TOKEN ?? "").trim().length > 0;
}

export async function dispatchReelProduction(toolId: string, fetchImpl: typeof fetch = fetch): Promise<DispatchResult> {
  const token = (process.env.GITHUB_DISPATCH_TOKEN ?? "").trim();
  if (!token) return { ok: false, reason: "not-configured" };
  const repo = (process.env.GITHUB_REPO ?? "").trim() || DEFAULT_REPO;
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "pdf-platform-api",
      },
      body: JSON.stringify({ ref: "main", inputs: { tool: toolId } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 204) return { ok: true };
    const detail = `HTTP ${res.status}`;
    logger.warn("social", `Video üretimi başlatılamadı: ${detail}`);
    return { ok: false, reason: "failed", detail };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.warn("social", `Video üretimi başlatılamadı: ${detail}`);
    return { ok: false, reason: "failed", detail };
  }
}
