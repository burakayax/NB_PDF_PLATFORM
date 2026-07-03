/** PDF Platform v1 API — makine-okur OpenAPI 3.1 tanımı (GET /v1/openapi.json). */
export function openApiSpec(baseUrl: string) {
  const textOrFile = {
    oneOf: [
      { type: "object", required: ["text"], properties: { text: { type: "string" }, lang: { type: "string", enum: ["tr", "en"] } } },
      { type: "string", format: "binary", description: "multipart/form-data 'file' (application/pdf)" },
    ],
  };
  const usage = { type: "object", properties: { usage: { type: "object", properties: { remaining: { type: "integer", nullable: true }, unlimited: { type: "boolean" } } } } };
  const problemSchema = {
    type: "object",
    properties: {
      type: { type: "string", format: "uri" }, title: { type: "string" }, status: { type: "integer" },
      code: { type: "string" }, detail: { type: "string" }, request_id: { type: "string" },
    },
  };
  const errResp = (desc: string) => ({ description: desc, content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } } });
  const jsonBody = { content: { "application/json": { schema: textOrFile }, "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" }, lang: { type: "string" } } } } } };

  return {
    openapi: "3.1.0",
    info: {
      title: "PDF Platform API",
      version: "1.0.0",
      description: "PDF & yapay zekâ belge işleme API'si. Metin ya da PDF gönderin; yapılandırılmış JSON alın. Her başarılı istek 1 AI kredisi harcar.",
    },
    servers: [{ url: `${baseUrl}/v1` }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API Key (nb_live_...)" } },
      schemas: { Problem: problemSchema },
    },
    paths: {
      "/me": {
        get: {
          summary: "Anahtar & kota kontrolü", operationId: "me",
          responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, plan: { type: "string" }, ...usage.properties } } } } }, "401": errResp("Geçersiz API anahtarı") },
        },
      },
      "/summarize": {
        post: {
          summary: "Belge özetle", operationId: "summarize", requestBody: jsonBody,
          responses: {
            "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { summary: { type: "string" }, ...usage.properties } } } } },
            "400": errResp("Geçersiz istek"), "401": errResp("Geçersiz anahtar"), "402": errResp("Kredi yetersiz"), "429": errResp("İstek sınırı"),
          },
        },
      },
      "/extract": {
        post: {
          summary: "Yapılandırılmış veri çıkar", operationId: "extract", requestBody: jsonBody,
          responses: {
            "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { data: { type: "object" }, ...usage.properties } } } } },
            "400": errResp("Geçersiz istek"), "402": errResp("Kredi yetersiz"), "422": errResp("İşlenemedi"), "429": errResp("İstek sınırı"),
          },
        },
      },
      "/translate": {
        post: {
          summary: "Belge çevir", operationId: "translate",
          requestBody: { content: { "application/json": { schema: { type: "object", required: ["target"], properties: { text: { type: "string" }, target: { type: "string" } } } }, "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" }, target: { type: "string" } } } } } },
          responses: {
            "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { translation: { type: "string" }, ...usage.properties } } } } },
            "400": errResp("Geçersiz istek"), "402": errResp("Kredi yetersiz"), "429": errResp("İstek sınırı"),
          },
        },
      },
    },
  };
}
