import { envHttpUrlIsLoopback, isNonLocalDeployedHost } from "./lib/runtimeApiOrigin";
import type { SaaSGating } from "./lib/saasGating";

/**
 * Streaming PDF responses cannot embed JSON bodies, so the Python backend
 * relays the entitlement decision as a base64-encoded JSON header named
 * `X-SaaS-Gating`. We decode it here and hand the structured object back to
 * the caller. Non-200 responses omit the header.
 *
 * The legacy `X-NB-SaaS-Friction` / `X-NB-Processing-Tier` headers (daily-
 * limit system) are no longer parsed — the backend stopped emitting them
 * when tool gating moved to the credit-based engine.
 */
function parseSaasGatingFromResponse(response: Response): SaaSGating | null {
  const raw = response.headers.get("X-SaaS-Gating");
  if (!raw?.trim()) {
    return null;
  }
  try {
    const binary = atob(raw.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const text = new TextDecoder("utf-8").decode(bytes);
    return normaliseSaasGating(JSON.parse(text));
  } catch {
    return null;
  }
}

/** FastAPI PDF sunucusu (yerelde :8000); `VITE_PDF_PROXY_TARGET` ile uyumlu. */
function defaultPdfBackendOrigin(): string {
  const raw = import.meta.env.VITE_PDF_PROXY_TARGET || "http://127.0.0.1:8000";
  return raw.replace(/\/$/, "");
}

/**
 * Kimlik Express’i `:4000` ile verilen `VITE_API_BASE`; PDF `/api/pdf/…` için FastAPI gerekir.
 */
function looksLikeLocalSsaasApiUrl(trimmed: string): boolean {
  try {
    const withProto = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
    const u = new URL(withProto);
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
      return false;
    }
    return u.port === "4000";
  } catch {
    return false;
  }
}

/**
 * PDF API kök adresi.
 * - `npm run dev`: boş string → istekler `/api/...` (Vite aynı origin + proxy → :8000). Tarayıcı doğrudan :8000’e gitmez, CORS gerekmez.
 * - `vite build` / önizleme: VITE_API_BASE (ör. tam URL) veya boş → göreli /api (aynı site / kendi domain’i).
 * - Üretimde derlemeye localhost gömülmüş olsa bile gerçek sitede açılınca göreli /api kullanılır.
 */
function getPdfApiBase(): string {
  if (import.meta.env.DEV) {
    return "";
  }
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    const p = window.location.port;
    if ((h === "localhost" || h === "127.0.0.1") && p === "4173") {
      return "";
    }
  }
  const raw = import.meta.env.VITE_API_BASE;
  if (typeof raw === "string" && raw.trim() !== "") {
    const trimmed = raw.trim();
    if (isNonLocalDeployedHost() && envHttpUrlIsLoopback(trimmed)) {
      return "";
    }
    if (looksLikeLocalSsaasApiUrl(trimmed)) {
      const fb = defaultPdfBackendOrigin();
      console.warn(
        "[pdfApi] VITE_API_BASE kimlik API’sine (:4000) benziyor; PDF uçları FastAPI’de (:8000).",
        `"${trimmed.replace(/\/$/, "")}" → "${fb}"`,
      );
      return fb;
    }
    return trimmed.replace(/\/$/, "");
  }
  return "";
}

const API_BASE = getPdfApiBase();

/** Geliştirmede Vite proxy takılırsa aynı yolu doğrudan PDF API köküne denemek için (örn. 127.0.0.1:8000). */
function devPdfApiDirectOrigin(): string | null {
  if (!import.meta.env.DEV) {
    return null;
  }
  return defaultPdfBackendOrigin();
}

/** Ağ hatası (Failed to fetch) için anlaşılır mesaj üretir. */
/** PDF API (FastAPI) SaaS oturumu: plan/kota sunucuda doğrulanır. */
function saasAuthHeaders(accessToken: string | null | undefined): HeadersInit | undefined {
  if (!accessToken?.trim()) {
    return undefined;
  }
  return { Authorization: `Bearer ${accessToken.trim()}` };
}

function appendSaasAccessToken(formData: FormData, accessToken: string | null | undefined) {
  if (accessToken?.trim()) {
    formData.set("access_token", accessToken.trim());
  }
}

async function pdfFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw e;
    }
    const baseHint =
      API_BASE === ""
        ? import.meta.env.DEV
          ? "Geliştirmede Vite /api → 127.0.0.1:8000. Proje kökünde `npm run dev` veya `node scripts/run-pdf-api.mjs` çalıştırın; yalnızca `web/frontend` içindeki `npm run dev` PDF API’yi başlatmaz."
          : "Üretimde aynı sitede /api yoksa derlemede VITE_API_BASE ile PDF sunucu adresini verin."
        : `Beklenen PDF API: ${API_BASE}`;
    const msg =
      e instanceof TypeError
        ? `PDF sunucusuna ulaşılamadı. ${baseHint} FastAPI’nin çalıştığından emin olun.`
        : e instanceof Error
          ? e.message
          : String(e);
    throw new Error(msg);
  }
}

/** Ağ kopması / geçici proxy hatalarında (Failed to fetch) birkaç kez dener; dev’de proxy sonrası doğrudan PDF API. */
async function pdfFetchWithRetry(
  url: string,
  init?: RequestInit,
  retries = 4,
  baseDelayMs = 380,
): Promise<Response> {
  const direct = devPdfApiDirectOrigin();
  const candidates: string[] = [url];
  if (direct && url.startsWith("/")) {
    candidates.push(`${direct}${url}`);
  }

  let last: unknown;
  for (const candidate of candidates) {
    const isCrossOrigin = /^https?:\/\//i.test(candidate);
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await pdfFetch(candidate, {
          cache: "no-store",
          mode: isCrossOrigin ? "cors" : "same-origin",
          ...init,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          throw e;
        }
        if (init?.signal?.aborted) {
          throw e;
        }
        last = e;
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
        }
      }
    }
  }
  throw last;
}

/** Sunucu yeniden başlayınca veya süre dolunca job kaybolabilir — `fetchMergeJob` 404 atar. */
export class MergeJobNotFoundError extends Error {
  constructor() {
    super("merge_job_not_found");
    this.name = "MergeJobNotFoundError";
  }
}

export type MergeJobStatus = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  message: string;
  where: string;
  current: number;
  total: number;
  percent: number;
  elapsed_seconds: number;
  error?: string | null;
  ready: boolean;
};

function extractFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
}

function detailToMessage(detail: unknown): string {
  if (detail == null) {
    return "";
  }
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: string }).msg);
        }
        return JSON.stringify(item);
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof detail === "object") {
    const o = detail as Record<string, unknown>;
    if (typeof o.msg === "string") {
      return o.msg;
    }
    if (typeof o.message === "string") {
      return o.message;
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }
  return String(detail);
}

/** Vite proxy 502 vb. boş/HTML gövde; kullanıcıya gerçek nedeni söyler. */
function gatewayUnreachableHint(status: number): string {
  if (status !== 502 && status !== 503 && status !== 504) {
    return "";
  }
  return "PDF API kapalı veya 127.0.0.1:8000 yanıt vermiyor. Önerilen: proje kökünde (NB_PDF_TOOLS) `npm run dev` veya `node scripts/run-pdf-api.mjs`. Alternatif: `cd web\\backend` → `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.";
}

async function ensureOk(response: Response, defaultMessage: string) {
  if (response.ok) {
    return;
  }
  const status = response.status;
  const hint = gatewayUnreachableHint(status);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let payload: { detail?: unknown };
    try {
      payload = (await response.json()) as { detail?: unknown };
    } catch {
      throw new Error(hint || defaultMessage);
    }
    const msg = detailToMessage(payload.detail);
    throw new Error(msg || hint || defaultMessage);
  }
  const errorText = (await response.text()).trim();
  const looksLikeHtml = errorText.startsWith("<") || errorText.toLowerCase().includes("<!doctype");
  if (!errorText || looksLikeHtml) {
    throw new Error(hint || defaultMessage);
  }
  throw new Error(errorText);
}

function buildToolApiUrl(endpoint: string): string {
  const ep = endpoint.replace(/^\/+/, "");
  const base = API_BASE.replace(/\/$/, "");
  if (base === "") {
    return `/api/${ep}`;
  }
  return `${base}/api/${ep}`;
}

function shouldUseBrowserNativeDownload(urlPathOrFull: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (urlPathOrFull.startsWith("/")) {
    return true;
  }
  try {
    return new URL(urlPathOrFull).origin === window.location.origin;
  } catch {
    return false;
  }
}

function parsePossibleJsonError(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith("{") || (t.length > 8000 && !t.startsWith('{"'))) {
    return null;
  }
  try {
    const o = JSON.parse(t) as { detail?: unknown; message?: string };
    if (typeof o.message === "string" && o.message.trim()) {
      return o.message.trim();
    }
    if (o.detail != null) {
      if (typeof o.detail === "string") {
        return o.detail;
      }
      if (Array.isArray(o.detail) && o.detail[0] && typeof o.detail[0] === "object" && "msg" in o.detail[0]) {
        return String((o.detail[0] as { msg: string }).msg);
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** iframe içinde API/HTTP hata sayfası var mı (başarılı dosya indirmesinde genelde boş veya ikili). */
function probeIframeForError(doc: Document | null | undefined): string | null {
  try {
    if (!doc?.body) {
      return null;
    }
    const text = doc.body.innerText?.trim() ?? "";
    if (text.length === 0 || text.length >= 12_000) {
      return null;
    }
    const errMsg = parsePossibleJsonError(text);
    if (errMsg) {
      return errMsg;
    }
    if (
      text.includes("502 Bad Gateway") ||
      text.includes("503 Service Unavailable") ||
      text.includes("504 Gateway Timeout")
    ) {
      return gatewayUnreachableHint(502) || "PDF API geçici olarak yanıt vermiyor.";
    }
    if (/internal\s+server\s+error/i.test(text) || /\b500\b\s+Internal\s+Server\s+Error/i.test(text)) {
      return "Sunucu hatası (500). PDF API günlüklerini veya sunucu bağımlılıklarını kontrol edin.";
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * POST sonucu dosyayı fetch+blob yerine iframe + form ile alır; büyük PDF çıktılarında akışın kesilmesini önler.
 * Content-Disposition: attachment ile bazı tarayıcılarda iframe `load` hiç tetiklenmez; PerformanceObserver ile tamamlanma yakalanır.
 */
function postFormDataForFileDownload(actionPath: string, formData: FormData): Promise<void> {
  const actionUrl = actionPath.startsWith("http")
    ? actionPath
    : `${window.location.origin}${actionPath.startsWith("/") ? actionPath : `/${actionPath}`}`;

  const target = new URL(actionUrl, window.location.href);
  const targetPathname = target.pathname;

  return new Promise((resolve, reject) => {
    /** form.submit() anından önceki kaynak zamanlamalarını yok say (önceki indirmeler /api/compress vb. ile karışmasın). */
    let submitPerfMark = 0;

    function resourceMatchesApiRequest(entry: PerformanceResourceTiming): boolean {
      try {
        const u = new URL(entry.name);
        if (u.pathname !== targetPathname) {
          return false;
        }
        if (submitPerfMark > 0 && entry.startTime > 0 && entry.startTime < submitPerfMark - 2000) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    }

    const iframe = document.createElement("iframe");
    const frameName = `nbpdf-dl-${Date.now()}`;
    iframe.name = frameName;
    iframe.setAttribute("name", frameName);
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
    iframe.setAttribute("aria-hidden", "true");

    let settled = false;
    let perfObs: PerformanceObserver | null = null;
    let pollId: number | null = null;
    let finalizeTimer: number | null = null;
    let finalizeScheduled = false;

    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve();
      }
    }, 900_000);

    function cleanup() {
      window.clearTimeout(timer);
      if (finalizeTimer != null) {
        window.clearTimeout(finalizeTimer);
        finalizeTimer = null;
      }
      if (pollId != null) {
        window.clearInterval(pollId);
        pollId = null;
      }
      try {
        perfObs?.disconnect();
      } catch {
        /* ignore */
      }
      perfObs = null;
      iframe.removeEventListener("load", onBlankReady);
      iframe.removeEventListener("load", onResponseLoad);
      window.setTimeout(() => iframe.remove(), 90_000);
    }

    function finishReject(msg: string) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error(msg));
    }

    function finishOk() {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    }

    /** Yanıt gövdesi iframe’e yazıldıktan sonra hata / başarı ayrımı (tek sefer). */
    function scheduleFinalize() {
      if (settled || finalizeScheduled) {
        return;
      }
      finalizeScheduled = true;
      finalizeTimer = window.setTimeout(() => {
        finalizeTimer = null;
        if (settled) {
          return;
        }
        const err = probeIframeForError(iframe.contentDocument ?? undefined);
        if (err) {
          finishReject(err);
          return;
        }
        finishOk();
      }, 280);
    }

    function scanPerformanceForCompletedRequest(): boolean {
      try {
        const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        for (let i = entries.length - 1; i >= 0; i--) {
          const e = entries[i];
          if (!resourceMatchesApiRequest(e)) {
            continue;
          }
          if (e.responseEnd > 0) {
            return true;
          }
        }
      } catch {
        /* ignore */
      }
      return false;
    }

    function onResponseLoad() {
      if (settled) {
        return;
      }
      try {
        const err = probeIframeForError(iframe.contentDocument ?? undefined);
        if (err) {
          finishReject(err);
          return;
        }
      } catch {
        /* boş veya ikili gövde */
      }
      scheduleFinalize();
    }

    function buildSubmitForm(): HTMLFormElement {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = actionUrl;
      form.target = frameName;
      form.enctype = "multipart/form-data";
      form.style.display = "none";

      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = value;
          form.appendChild(input);
        } else {
          const input = document.createElement("input");
          input.type = "file";
          input.name = key;
          const dt = new DataTransfer();
          dt.items.add(value);
          input.files = dt.files;
          form.appendChild(input);
        }
      }
      return form;
    }

    function onBlankReady() {
      iframe.removeEventListener("load", onBlankReady);
      iframe.addEventListener("load", onResponseLoad);

      try {
        perfObs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.entryType !== "resource") {
              continue;
            }
            const r = e as PerformanceResourceTiming;
            if (r.responseEnd <= 0 || !resourceMatchesApiRequest(r)) {
              continue;
            }
            scheduleFinalize();
          }
        });
        perfObs.observe({ type: "resource", buffered: true } as PerformanceObserverInit);
      } catch {
        /* PerformanceObserver yoksa yalnızca load + yoklama */
      }

      pollId = window.setInterval(() => {
        if (settled) {
          return;
        }
        if (scanPerformanceForCompletedRequest()) {
          scheduleFinalize();
        }
      }, 250);

      const form = buildSubmitForm();
      document.body.appendChild(form);
      submitPerfMark = performance.now();
      form.submit();
      form.remove();
    }

    iframe.addEventListener("load", onBlankReady);
    document.body.appendChild(iframe);
    iframe.src = "about:blank";
  });
}

export type ToolDownloadResult = {
  /** Tekrar indir; yalnızca blob ile tamamlanan yanıtlarda. */
  replay?: () => void;
  /** Bellekteki object URL’yi serbest bırakır; panel kapanırken çağrılmalı. */
  dispose?: () => void;
  /**
   * Entitlement decision the Node engine produced for this run, relayed by
   * the Python backend via the `X-SaaS-Gating` response header. `null` when
   * the header is absent (older backends, third-party-origin responses that
   * strip custom headers, or anonymous flows).
   */
  saasGating?: SaaSGating | null;
};

type ShowSavePickerWindow = Window &
  typeof globalThis & {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle>;
  };

function showSavePickerTypesFor(filename: string, blob: Blob) {
  const extMatch = filename.match(/(\.[a-z0-9]+)$/i);
  const ext = extMatch?.[1]?.toLowerCase() ?? ".bin";
  const mime =
    blob.type?.trim() ||
    (ext === ".pdf"
      ? "application/pdf"
      : ext === ".zip"
        ? "application/zip"
        : "application/octet-stream");
  return [
    {
      description: "Download",
      accept: { [mime]: [ext] },
    },
  ];
}

/**
 * Delivers a blob to the user: prefers the File System Access API Save dialog
 * when available (Chromium), otherwise falls back to `URL.createObjectURL` +
 * `<a download>` (browser default folder; still honors suggested filename).
 */
async function deliverBlobAsDownload(
  blob: Blob,
  filename: string,
  retainForReplay: boolean,
): Promise<Pick<ToolDownloadResult, "replay" | "dispose">> {
  const w = window as ShowSavePickerWindow;
  let objectUrl: string | null = null;
  const storedBlob = blob;
  const storedName = filename;

  const anchorDownload = () => {
    const u = URL.createObjectURL(blob);
    objectUrl = u;
    const anchor = document.createElement("a");
    anchor.href = u;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  let usedNativeSave = false;
  try {
    if (typeof w.showSaveFilePicker === "function") {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: showSavePickerTypesFor(filename, blob),
      });
      usedNativeSave = true;
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    }
  } catch (e: unknown) {
    const name =
      e && typeof e === "object" && "name" in e
        ? String((e as { name: unknown }).name)
        : "";
    if (name === "AbortError") {
      throw e instanceof DOMException
        ? e
        : new DOMException("The user aborted a request.", "AbortError");
    }
    usedNativeSave = false;
  }

  if (!usedNativeSave) {
    anchorDownload();
  }

  if (!retainForReplay) {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    return {};
  }

  const replay = () => {
    void deliverBlobAsDownload(storedBlob, storedName, false);
  };
  const dispose = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  };
  return { replay, dispose };
}

async function triggerDownloadFromResponse(
  response: Response,
  fallbackName: string,
  options?: {
    retainBlob?: boolean;
    clientDownloadName?: string;
  },
): Promise<ToolDownloadResult> {
  const saasGating = parseSaasGatingFromResponse(response);
  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    try {
      const buf = await response.arrayBuffer();
      const ct = response.headers.get("content-type") || "application/octet-stream";
      blob = new Blob([buf], { type: ct });
    } catch (e) {
      const msg =
        e instanceof TypeError
          ? "İndirme akışı kesildi. PDF API’nin çalıştığını ve ağın stabil olduğunu kontrol edin."
          : e instanceof Error
            ? e.message
            : String(e);
      throw new Error(msg);
    }
  }
  const filename = options?.clientDownloadName?.trim()
    ? options.clientDownloadName.trim()
    : extractFilename(response, fallbackName);
  const retain = !!options?.retainBlob;
  const { replay, dispose } = await deliverBlobAsDownload(blob, filename, retain);
  if (!retain) {
    return { saasGating };
  }
  return { replay, dispose, saasGating };
}

export async function fetchCapabilities() {
  const response = await pdfFetch(`${API_BASE}/api/capabilities`);
  await ensureOk(response, "API yetenekleri okunamadı.");
  return response.json();
}

export async function inspectPdf(
  file: File,
  password?: string,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
) {
  const formData = new FormData();
  formData.append("file", file);
  if (password?.trim()) {
    formData.append("password", password.trim());
  }
  appendSaasAccessToken(formData, accessToken);
  const response = await pdfFetch(`${API_BASE}/api/inspect-pdf`, {
    method: "POST",
    body: formData,
    headers: saasAuthHeaders(accessToken),
    signal: options?.signal,
  });
  await ensureOk(response, "PDF bilgisi okunamadı.");
  const data = (await response.json()) as {
    filename: string;
    encrypted: boolean;
    page_count: number | null;
    inspect_error?: string | null;
    inspect_diagnostic?: Record<string, unknown>;
  };
  if (
    typeof data.inspect_diagnostic !== "undefined" &&
    typeof console !== "undefined" &&
    typeof console.debug === "function"
  ) {
    console.debug("[inspect-pdf]", data.filename ?? "?", data.inspect_diagnostic);
  }
  return data;
}

export async function createMergeJob(
  formData: FormData,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
) {
  appendSaasAccessToken(formData, accessToken);
  const response = await pdfFetch(`${API_BASE}/api/merge`, {
    method: "POST",
    body: formData,
    headers: saasAuthHeaders(accessToken),
    signal: options?.signal,
  });
  await ensureOk(response, "Birleştirme başlatılamadı.");
  const raw = (await response.json()) as {
    job_id: string;
    saasGating?: unknown;
  };
  return {
    job_id: raw.job_id,
    saasGating: normaliseSaasGating(raw.saasGating),
  };
}

export async function fetchMergeJob(
  jobId: string,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
) {
  const id = encodeURIComponent(jobId);
  const response = await pdfFetchWithRetry(
    `${API_BASE}/api/jobs/${id}`,
    { headers: saasAuthHeaders(accessToken), cache: "no-store", signal: options?.signal },
    5,
    320,
  );
  if (response.status === 404) {
    try {
      await response.text();
    } catch {
      /* ignore */
    }
    throw new MergeJobNotFoundError();
  }
  await ensureOk(response, "İşlem durumu okunamadı.");
  return response.json() as Promise<MergeJobStatus>;
}

/** İstemci merge işlemini bırakınca sunucu tarafında işi kooperatif iptal eder. */
export async function requestMergeJobCancel(
  jobId: string,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const id = encodeURIComponent(jobId);
  const base = API_BASE.replace(/\/$/, "");
  const path = base === "" ? `/api/jobs/${id}/cancel` : `${base}/api/jobs/${id}/cancel`;
  const response = await pdfFetch(path, {
    method: "POST",
    headers: { ...saasAuthHeaders(accessToken) },
    signal: options?.signal,
  });
  if (response.status === 404) {
    return;
  }
  await ensureOk(response, "İptal isteği gönderilemedi.");
}

function mergeJobDownloadUrl(jobId: string): string {
  const id = encodeURIComponent(jobId);
  const base = API_BASE.replace(/\/$/, "");
  if (base === "") {
    return `/api/jobs/${id}/download`;
  }
  return `${base}/api/jobs/${id}/download`;
}

function shouldUseNativeMergeDownload(href: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (href.startsWith("/")) {
    return true;
  }
  try {
    return new URL(href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Birleştirilmiş PDF: aynı kökende tarayıcının doğrudan indirmesini kullanır (fetch+blob akışı büyük dosyalarda kesilebiliyor).
 * PDF API farklı kökende ise fetch + blob yedeği kullanılır.
 * Bearer ile çağrıda yeniden deneme yapılmaz — her yeniden istek çift indirme tetikleyebilir.
 */
export async function downloadMergeJob(
  jobId: string,
  fallbackName = "birleştirilmiş.pdf",
  accessToken?: string | null,
  options?: {
    signal?: AbortSignal;
    onBeforeReadBody?: () => void | Promise<void>;
  },
): Promise<ToolDownloadResult> {
  if (options?.signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
  const href = mergeJobDownloadUrl(jobId);
  const fetchInit: RequestInit = {
    cache: "no-store",
    signal: options?.signal,
  };

  if (accessToken?.trim()) {
    const response = await pdfFetch(href, {
      headers: saasAuthHeaders(accessToken),
      ...fetchInit,
    });
    await throwIfEntitlementPaymentRequired(response);
    await ensureOk(response, "Birleştirilmiş dosya indirilemedi.");
    await options?.onBeforeReadBody?.();
    return triggerDownloadFromResponse(response, fallbackName, { retainBlob: true });
  }

  if (shouldUseNativeMergeDownload(href) && !options?.signal) {
    const a = document.createElement("a");
    a.href = href;
    a.download = fallbackName;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return {};
  }

  const response = await pdfFetch(href, fetchInit);
  await throwIfEntitlementPaymentRequired(response);
  await ensureOk(response, "Birleştirilmiş dosya indirilemedi.");
  await options?.onBeforeReadBody?.();
  return triggerDownloadFromResponse(response, fallbackName, { retainBlob: true });
}

/**
 * Aynı kökende iframe + POST ile tamamlanma bazı tarayıcılarda hiç resolve olmuyor.
 * Bu sınıra kadar fetch + blob ile indirilir (çubuk kapanır, dosya gelir). Çok büyük çıktılarda bellek sınırına dikkat.
 */
const MAX_SAME_ORIGIN_FETCH_BYTES = 220 * 1024 * 1024;

function getPrimaryUploadFile(formData: FormData): File | null {
  const v = formData.get("file");
  return v instanceof File ? v : null;
}

export async function downloadFromApi(
  endpoint: string,
  formData: FormData,
  fallbackName: string,
  accessToken?: string | null,
  options?: {
    signal?: AbortSignal;
    onBeforeReadBody?: () => void | Promise<void>;
  },
): Promise<ToolDownloadResult> {
  if (options?.signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
  appendSaasAccessToken(formData, accessToken);
  const url = buildToolApiUrl(endpoint);
  const upload = getPrimaryUploadFile(formData);
  const authInit = { headers: saasAuthHeaders(accessToken) };
  const preferFetch =
    shouldUseBrowserNativeDownload(url) &&
    upload !== null &&
    upload.size > 0 &&
    upload.size <= MAX_SAME_ORIGIN_FETCH_BYTES;

  if (preferFetch) {
    const response = await pdfFetch(url, {
      method: "POST",
      body: formData,
      ...authInit,
      signal: options?.signal,
    });
    await throwIfEntitlementPaymentRequired(response);
    await ensureOk(response, "İşlem başarısız oldu.");
    await options?.onBeforeReadBody?.();
    return triggerDownloadFromResponse(response, fallbackName, { retainBlob: true });
  }

  if (shouldUseBrowserNativeDownload(url) && !options?.signal) {
    try {
      await postFormDataForFileDownload(url, formData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(msg || "İşlem başarısız oldu.");
    }
    return {};
  }

  const response = await pdfFetch(url, {
    method: "POST",
    body: formData,
    ...authInit,
    signal: options?.signal,
  });
  await throwIfEntitlementPaymentRequired(response);
  await ensureOk(response, "İşlem başarısız oldu.");
  await options?.onBeforeReadBody?.();
  return triggerDownloadFromResponse(response, fallbackName, { retainBlob: true });
}

// ---------------------------------------------------------------------------
// Result store: POST → result_id; kredi düşümü GET /api/pdf/result/{id}/download başında (sunucu).
// GET /api/pdf/result/{id}/preview/… , thumbnail, hero, pdf
// ---------------------------------------------------------------------------

export type CompressResult = {
  result_id: string;
  filename: string;
  mime: string;
  size_bytes: number;
  has_thumbnail: boolean;
  /**
   * Entitlement decision produced by the Node-side entitlement engine and
   * relayed to the client verbatim. Optional so older backends that have not
   * been rolled forward yet keep returning a valid payload; the UI falls back
   * to the 402/403 gating on the download endpoint in that case.
   */
  saasGating?: SaaSGating | null;
};

export type ResultPreview = {
  result_id: string;
  filename: string;
  mime: string;
  size_bytes: number;
  has_thumbnail: boolean;
  thumbnail_url: string | null;
  /** @deprecated Ham epoch — tercihen `created_at_iso` */
  created_at?: number;
  created_at_iso?: string | null;
};

/** POST /api/compress — returns a result_id; no blob in this response. */
export async function compressToResult(
  formData: FormData,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
): Promise<CompressResult> {
  return postToolToResult("compress", formData, accessToken, {
    ...options,
    errorMessage: "Sıkıştırma başarısız oldu.",
  });
}

/** POST /api/split — same result-store shape as compress. */
export async function splitToResult(
  formData: FormData,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
): Promise<CompressResult> {
  return postToolToResult("split", formData, accessToken, {
    ...options,
    errorMessage: "PDF ayıklama başarısız oldu.",
  });
}

/**
 * Result-store JSON uç noktaları (`/api/{tool}`) — yanıt `result_id` taşır;
 * kredi indirimi indirme anında uygulanır.
 */
export async function postToolToResult(
  endpoint: string,
  formData: FormData,
  accessToken?: string | null,
  options?: { signal?: AbortSignal; errorMessage?: string },
): Promise<CompressResult> {
  const path = endpoint.replace(/^\//, "");
  appendSaasAccessToken(formData, accessToken);
  const response = await pdfFetchWithRetry(
    `${API_BASE}/api/${path}`,
    {
      method: "POST",
      body: formData,
      headers: saasAuthHeaders(accessToken),
      signal: options?.signal,
    },
    4,
    400,
  );
  await ensureOk(response, options?.errorMessage ?? "İşlem başarısız oldu.");
  const data = (await response.json()) as CompressResult;
  return {
    result_id: data.result_id,
    filename: data.filename,
    mime: data.mime,
    size_bytes: data.size_bytes,
    has_thumbnail: data.has_thumbnail,
    saasGating: normaliseSaasGating(data.saasGating),
  };
}

/**
 * Shallow-validate an entitlement payload coming off the wire. Guards against
 * fields being absent (partial rollout) without leaking `undefined` into the
 * rest of the UI layer.
 */
function normaliseSaasGating(raw: unknown): SaaSGating | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<SaaSGating>;
  if (typeof candidate.allowed !== "boolean" || typeof candidate.reason !== "string") {
    return null;
  }
  return {
    allowed: candidate.allowed,
    reason: candidate.reason as SaaSGating["reason"],
    cost: typeof candidate.cost === "number" ? candidate.cost : 0,
    creditsBefore: typeof candidate.creditsBefore === "number" ? candidate.creditsBefore : 0,
    creditsAfter: typeof candidate.creditsAfter === "number" ? candidate.creditsAfter : 0,
  };
}

/** 402 with JSON body from the PDF worker (entitlement engine relay). */
export class EntitlementPaymentRequiredError extends Error {
  readonly saasGating: SaaSGating | null;

  constructor(saasGating: SaaSGating | null) {
    super("payment_required");
    this.name = "EntitlementPaymentRequiredError";
    this.saasGating = saasGating;
  }
}

/** PDF worker returns 402 + JSON; map to a typed error for the workspace UI. */
async function throwIfEntitlementPaymentRequired(response: Response): Promise<void> {
  if (response.status !== 402) {
    return;
  }
  let g: SaaSGating | null = null;
  try {
    const j = (await response.json()) as { saasGating?: unknown };
    g = normaliseSaasGating(j.saasGating);
  } catch {
    /* ignore */
  }
  throw new EntitlementPaymentRequiredError(g);
}

/** GET /api/pdf/result/{id}/preview — JSON metadata. Does not call checkAccess. */
export async function fetchResultPreview(
  resultId: string,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
): Promise<ResultPreview> {
  const id = encodeURIComponent(resultId);
  const response = await pdfFetch(`${API_BASE}/api/pdf/result/${id}/preview`, {
    headers: saasAuthHeaders(accessToken),
    cache: "no-store",
    signal: options?.signal,
  });
  await ensureOk(response, "Önizleme okunamadı.");
  return (await response.json()) as ResultPreview;
}

/**
 * GET /api/pdf/result/{id}/preview/thumbnail — returns an object URL for the
 * blurred PNG. Same-origin Bearer headers can't be attached to a plain
 * `<img src>`, so we fetch the image and wrap it in a blob URL. The caller
 * is responsible for revoking the URL with `URL.revokeObjectURL`.
 */
export async function fetchResultThumbnailBlobUrl(
  resultId: string,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const id = encodeURIComponent(resultId);
  const response = await pdfFetchWithRetry(`${API_BASE}/api/pdf/result/${id}/preview/thumbnail`, {
    headers: saasAuthHeaders(accessToken),
    cache: "no-store",
    signal: options?.signal,
  });
  await ensureOk(response, "Önizleme görseli okunamadı.");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/** Large watermarked first-page PNG for gated-download preview modal. */
export async function fetchResultHeroPreviewBlobUrl(
  resultId: string,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const id = encodeURIComponent(resultId);
  const response = await pdfFetchWithRetry(`${API_BASE}/api/pdf/result/${id}/preview/hero`, {
    headers: saasAuthHeaders(accessToken),
    cache: "no-store",
    signal: options?.signal,
  });
  await ensureOk(response, "Önizleme yüklenemedi.");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/** Tam çıktı PDF (inline, kota düşmez) — yalnızca PDF mime için; Word/Excel vb. 404 döner. */
export async function fetchResultPdfBlobUrl(
  resultId: string,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const id = encodeURIComponent(resultId);
  const response = await pdfFetchWithRetry(`${API_BASE}/api/pdf/result/${id}/preview/pdf`, {
    headers: saasAuthHeaders(accessToken),
    cache: "no-store",
    signal: options?.signal,
  });
  await ensureOk(response, "Önizleme PDF okunamadı.");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function fetchMergeJobHeroPreviewBlobUrl(
  jobId: string,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const id = encodeURIComponent(jobId);
  const response = await pdfFetchWithRetry(`${API_BASE}/api/jobs/${id}/preview/hero`, {
    headers: saasAuthHeaders(accessToken),
    cache: "no-store",
    signal: options?.signal,
  });
  await ensureOk(response, "Önizleme görseli okunamadı.");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function fetchMergeJobPdfBlobUrl(
  jobId: string,
  accessToken?: string | null,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const id = encodeURIComponent(jobId);
  const response = await pdfFetchWithRetry(`${API_BASE}/api/jobs/${id}/preview/pdf`, {
    headers: saasAuthHeaders(accessToken),
    cache: "no-store",
    signal: options?.signal,
  });
  await ensureOk(response, "Önizleme PDF okunamadı.");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export type DownloadResultOutcome =
  | { status: "ok"; download: ToolDownloadResult }
  | { status: "payment_required"; saasGating?: SaaSGating | null }
  | { status: "forbidden" };

/**
 * GET /api/pdf/result/{id}/download — the first access-gated call in the
 * product. We handle the three outcomes the gate can produce and let the
 * caller translate them into UI (alert, modal, upgrade CTA, etc.).
 *
 * GET öncesi sunucu ``entitlement_consume`` ile kotayı düşürür.
 *
 *   200 → file stream, triggers a browser download.
 *   402 → access denied; UI shows `alert("Upgrade required")` for now.
 *   403 → foreign owner (or server-side ownership mismatch); UI alerts.
 */
export async function downloadResult(
  resultId: string,
  fallbackName: string,
  accessToken?: string | null,
  options?: {
    signal?: AbortSignal;
    clientDownloadName?: string;
    /** After 200 OK, before reading the response body — used to create a pending `download_logs` row at stream start. */
    onBeforeReadBody?: () => void | Promise<void>;
  },
): Promise<DownloadResultOutcome> {
  const id = encodeURIComponent(resultId);
  const response = await pdfFetch(`${API_BASE}/api/pdf/result/${id}/download`, {
    headers: saasAuthHeaders(accessToken),
    cache: "no-store",
    signal: options?.signal,
  });
  if (response.status === 402) {
    let g: SaaSGating | null = null;
    try {
      const j = (await response.json()) as { saasGating?: unknown };
      g = normaliseSaasGating(j.saasGating);
    } catch {
      /* ignore */
    }
    return { status: "payment_required", saasGating: g };
  }
  if (response.status === 403) {
    try {
      await response.text();
    } catch {
      /* ignore */
    }
    return { status: "forbidden" };
  }
  await ensureOk(response, "Dosya indirilemedi.");
  await options?.onBeforeReadBody?.();
  const download = await triggerDownloadFromResponse(response, fallbackName, {
    retainBlob: true,
    clientDownloadName: options?.clientDownloadName,
  });
  return { status: "ok", download };
}
