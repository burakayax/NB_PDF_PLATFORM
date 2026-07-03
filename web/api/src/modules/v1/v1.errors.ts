import type { Response } from "express";

/** RFC 9457 (Problem Details for HTTP APIs) — profesyonel, makine-okur hata formatı. */
const TYPE_BASE = "https://pdfplatform.app/errors/";

const TITLES: Record<string, string> = {
  invalid_request: "Invalid request",
  invalid_api_key: "Invalid API key",
  insufficient_credits: "Insufficient credits",
  forbidden: "Forbidden",
  not_found: "Not found",
  payload_too_large: "Payload too large",
  unsupported_media_type: "Unsupported media type",
  unprocessable_entity: "Unprocessable entity",
  rate_limited: "Too many requests",
  ai_unavailable: "Service unavailable",
  server_error: "Internal server error",
};

/** Standart hata yanıtı (application/problem+json + X-Request-Id). */
export function problem(res: Response, status: number, code: string, detail: string, extra?: Record<string, unknown>): void {
  const requestId = res.getHeader("X-Request-Id");
  res
    .status(status)
    .type("application/problem+json")
    .json({
      type: `${TYPE_BASE}${code}`,
      title: TITLES[code] ?? "Error",
      status,
      code,
      detail,
      request_id: typeof requestId === "string" ? requestId : undefined,
      ...extra,
    });
}
