import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { createApiKey, listApiKeys, revokeApiKey } from "./api-keys.service.js";

/** POST /api/api-keys — yeni anahtar üret (ham anahtar yalnız burada döner). */
export async function createApiKeyController(req: Request, res: Response): Promise<void> {
  const userId = req.authUser?.id;
  if (!userId) throw new HttpError(401, "Oturum gerekli.");
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  try {
    const key = await createApiKey(userId, name);
    res.status(201).json({ apiKey: key });
  } catch (e) {
    if (e instanceof Error && e.message === "API_KEY_LIMIT") {
      throw new HttpError(400, "En fazla 10 aktif API anahtarınız olabilir. Kullanmadığınızı iptal edin.");
    }
    throw e;
  }
}

/** GET /api/api-keys — kullanıcının anahtarları (ham anahtar YOK). */
export async function listApiKeysController(req: Request, res: Response): Promise<void> {
  const userId = req.authUser?.id;
  if (!userId) throw new HttpError(401, "Oturum gerekli.");
  const keys = await listApiKeys(userId);
  res.json({ apiKeys: keys });
}

/** DELETE /api/api-keys/:id — anahtarı iptal et. */
export async function revokeApiKeyController(req: Request, res: Response): Promise<void> {
  const userId = req.authUser?.id;
  if (!userId) throw new HttpError(401, "Oturum gerekli.");
  const id = typeof req.params.id === "string" ? req.params.id : "";
  const ok = await revokeApiKey(userId, id);
  if (!ok) throw new HttpError(404, "Anahtar bulunamadı.");
  res.json({ revoked: true });
}
