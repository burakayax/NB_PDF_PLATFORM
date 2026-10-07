/**
 * AI FOTOĞRAF STÜDYOSU — cihazdaki yapay zekâ katmanı.
 *
 * Fotoğraf HİÇBİR AŞAMADA sunucuya gönderilmez: iki küçük model tarayıcıda
 * (WebAssembly) çalışır ve dosyaları sitenin kendi alan adından servis edilir
 * (public/photo-ai/, bkz. scripts/setup-photo-ai.mjs).
 *
 *  1) MODNet (portre matting, Apache-2.0) → saç telleri dâhil arka plan ayrımı
 *  2) MediaPipe Face Landmarker (Apache-2.0) → 478 yüz noktası + ifade skorları
 *
 * Ağır modüller yalnızca araç açılıp ilk fotoğraf yüklendiğinde dinamik import edilir.
 */

const BASE = "/photo-ai";

type Ort = typeof import("onnxruntime-web/wasm");
type FaceLandmarkerT = import("@mediapipe/tasks-vision").FaceLandmarker;

let ortPromise: Promise<Ort> | null = null;
let sessionPromise: Promise<import("onnxruntime-web/wasm").InferenceSession> | null = null;
let landmarkerPromise: Promise<FaceLandmarkerT> | null = null;

export type ModelProgress = (stage: "matte" | "face", pct: number) => void;

async function fetchWithProgress(url: string, onPct?: (p: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`model ${res.status}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body || !total || !onPct) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onPct(Math.min(99, Math.round((got / total) * 100)));
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out.buffer;
}

async function getSession(onProgress?: ModelProgress) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      ortPromise ??= import("onnxruntime-web/wasm");
      const ort = await ortPromise;
      ort.env.wasm.wasmPaths = `${BASE}/ort/`;
      // Çapraz-köken yalıtımı (SharedArrayBuffer) yok → tek iş parçacığı en güvenlisi.
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      const buf = await fetchWithProgress(`${BASE}/modnet.onnx`, (p) => onProgress?.("matte", p));
      const s = await ort.InferenceSession.create(buf, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      onProgress?.("matte", 100);
      return s;
    })().catch((e) => {
      sessionPromise = null;
      throw e;
    });
  }
  return sessionPromise;
}

async function getLandmarker(onProgress?: ModelProgress): Promise<FaceLandmarkerT> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(`${BASE}/mediapipe`);
      const lm = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${BASE}/face_landmarker.task`, delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 4,
        outputFaceBlendshapes: true,
      });
      onProgress?.("face", 100);
      return lm;
    })().catch((e) => {
      landmarkerPromise = null;
      throw e;
    });
  }
  return landmarkerPromise;
}

/** Modelleri önceden ısıt (kullanıcı fotoğraf seçerken arka planda). */
export async function warmUp(onProgress?: ModelProgress): Promise<void> {
  await Promise.all([getSession(onProgress), getLandmarker(onProgress)]);
}

// ── Arka plan ayrımı ───────────────────────────────────────────────────────

function modelSize(w: number, h: number, ref = 512): { w: number; h: number } {
  let scale = 1;
  if (Math.max(w, h) < ref) scale = ref / Math.max(w, h);
  else if (Math.min(w, h) > ref) scale = ref / Math.min(w, h);
  const round32 = (n: number) => Math.max(32, Math.round((n * scale) / 32) * 32);
  return { w: round32(w), h: round32(h) };
}

/**
 * Kaynak tuvalinden alfa matte üretir. Dönen tuval kaynakla AYNI boyuttadır;
 * R kanalı = matte (0–255), A = 255.
 */
export async function computeMatte(src: HTMLCanvasElement, onProgress?: ModelProgress): Promise<HTMLCanvasElement> {
  const session = await getSession(onProgress);
  const ort = await ortPromise!;
  const { w, h } = modelSize(src.width, src.height);

  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(src, 0, 0, w, h);
  const px = sctx.getImageData(0, 0, w, h).data;

  const plane = w * h;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = (px[i * 4] / 255 - 0.5) / 0.5;
    input[plane + i] = (px[i * 4 + 1] / 255 - 0.5) / 0.5;
    input[2 * plane + i] = (px[i * 4 + 2] / 255 - 0.5) / 0.5;
  }
  const inName = session.inputNames[0];
  const outName = session.outputNames[0];
  const out = await session.run({ [inName]: new ort.Tensor("float32", input, [1, 3, h, w]) });
  const m = out[outName].data as Float32Array;

  // Matte'i yumuşak bir eğriyle temizle: kenar halesi azalır, saç ayrıntısı kalır.
  const mc = document.createElement("canvas");
  mc.width = w;
  mc.height = h;
  const mctx = mc.getContext("2d")!;
  const img = mctx.createImageData(w, h);
  for (let i = 0; i < plane; i++) {
    let a = m[i];
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    // smoothstep(0.06 .. 0.94)
    const t = Math.min(1, Math.max(0, (a - 0.06) / 0.88));
    const v = t * t * (3 - 2 * t);
    const b = Math.round(v * 255);
    img.data[i * 4] = b;
    img.data[i * 4 + 1] = b;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  mctx.putImageData(img, 0, 0);

  const full = document.createElement("canvas");
  full.width = src.width;
  full.height = src.height;
  const fctx = full.getContext("2d")!;
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = "high";
  fctx.drawImage(mc, 0, 0, src.width, src.height);
  return full;
}

// ── Yüz noktaları ──────────────────────────────────────────────────────────

export type FaceInfo = {
  /** Piksel koordinatları (verilen tuval üzerinde). */
  eyeL: { x: number; y: number };
  eyeR: { x: number; y: number };
  chin: { x: number; y: number };
  foreheadTop: { x: number; y: number };
  noseTip: { x: number; y: number };
  /** Yüz genişliği (şakaklar arası, px). */
  faceWidth: number;
  /** Göz hattının yatayla yaptığı açı (derece, saat yönü +). */
  rollDeg: number;
  /** Basit ifade skorları (0–1). */
  eyesClosed: number;
  mouthOpen: number;
  smile: number;
  /** Başın yana/yukarı dönmesinin kabaca ölçüsü (0 = karşıdan). */
  yawRatio: number;
  faces: number;
};

export async function detectFace(c: HTMLCanvasElement, onProgress?: ModelProgress): Promise<FaceInfo | null> {
  const lm = await getLandmarker(onProgress);
  const res = lm.detect(c);
  if (!res.faceLandmarks.length) return null;
  // En büyük yüz
  let best = 0;
  let bestArea = -1;
  res.faceLandmarks.forEach((pts, i) => {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (a > bestArea) {
      bestArea = a;
      best = i;
    }
  });
  const pts = res.faceLandmarks[best];
  const W = c.width;
  const H = c.height;
  const P = (i: number) => ({ x: pts[i].x * W, y: pts[i].y * H });
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  // Gözler: dış+iç köşe ortası (MediaPipe: kişinin sağ/sol gözü görüntüde ters)
  const eyeA = mid(P(33), P(133));
  const eyeB = mid(P(263), P(362));
  const eyeL = eyeA.x < eyeB.x ? eyeA : eyeB;
  const eyeR = eyeA.x < eyeB.x ? eyeB : eyeA;
  const rollDeg = (Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x) * 180) / Math.PI;
  const tL = P(234);
  const tR = P(454);
  const faceWidth = Math.hypot(tR.x - tL.x, tR.y - tL.y);
  const nose = P(1);
  const eyeMidX = (eyeL.x + eyeR.x) / 2;
  const yawRatio = Math.abs(nose.x - eyeMidX) / Math.max(1, faceWidth);

  const bs = new Map<string, number>();
  res.faceBlendshapes?.[best]?.categories.forEach((c2) => bs.set(c2.categoryName, c2.score));
  const g = (k: string) => bs.get(k) ?? 0;

  return {
    eyeL,
    eyeR,
    chin: P(152),
    foreheadTop: P(10),
    noseTip: nose,
    faceWidth,
    rollDeg,
    eyesClosed: (g("eyeBlinkLeft") + g("eyeBlinkRight")) / 2,
    mouthOpen: g("jawOpen"),
    smile: (g("mouthSmileLeft") + g("mouthSmileRight")) / 2,
    yawRatio,
    faces: res.faceLandmarks.length,
  };
}
