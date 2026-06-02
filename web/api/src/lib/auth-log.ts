// Kimlik doğrulama olaylarını yapılandırılmış NDJSON olarak yazar (şifre ve token asla yazılmaz).
// appendLogLine üzerinden dosyaya yönlendirilir; geliştirme ortamında stderr üzerinden görünür.
import { appendLogLine } from "./file-log.js";

function write(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    kind: "auth",
    level,
    message,
    ...(meta && Object.keys(meta).length ? meta : {}),
  });
  appendLogLine(line);
}

export const authLog = {
  info(message: string, meta?: Record<string, unknown>) {
    write("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    write("warn", message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    write("error", message, meta);
  },
};
