import type { Request, Response } from "express";
import {
  getPublicCmsPayload,
  getPublicPlansPayload,
  getPublicRuntimePayload,
  getPublicSiteConfig,
} from "./public.service.js";

export async function publicCmsController(_request: Request, response: Response) {
  const payload = await getPublicCmsPayload();
  response.json(payload);
}

export async function publicSiteConfigController(_request: Request, response: Response) {
  const config = await getPublicSiteConfig();
  response.json(config);
}

export async function publicPlansController(_request: Request, response: Response) {
  const payload = await getPublicPlansPayload();
  response.json(payload);
}

export async function publicRuntimeController(request: Request, response: Response) {
  const payload = await getPublicRuntimePayload(request);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
  if (payload.flags.maintenanceMode === true) {
    response.setHeader("Retry-After", "3600");
    response.status(503).json(payload);
    return;
  }
  response.json(payload);
}
