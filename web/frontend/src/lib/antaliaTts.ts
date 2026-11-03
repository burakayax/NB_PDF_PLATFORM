/**
 * Türkçe SESLİ OKUMA motoru — Antalia-2 Mini (PatientDesk AI, Apache-2.0). Tamamen CİHAZDA.
 *
 * Model (~49 MB) kendi sunucumuzdan (/tts-tr/) ilk kullanımda iner ve tarayıcıda saklanır; belge metni
 * hiçbir yere gönderilmez. Boru hattı: metin düzeltici (sayı/tarih/kısaltma → okunuş) → text_stage →
 * sound_stage (flow-matching) → decoder (vokoder) → ses son-işleme. Algoritma upstream `app.js`'in
 * `synthPieces` işlevinin TypeScript portudur (davranış birebir; kelime vurgulama çıkarıldı).
 *
 * Kaynak: https://github.com/fr0stb1rd/antalia-mini-web (Apache-2.0). Bkz. ./antalia/NOTICE.
 */
import AntaliaText from "./antalia/normalize.js";
import AntaliaAudio from "./antalia/audio.js";

export const RATE = 48000;
const HOP = 512;
const N_MELS = 128;
const STACK = 2;
const NOISE_DIM = N_MELS * STACK;
const MAX_DUR_FRAMES = 60;
const TEMPERATURE = 0.6;
const LOG_GEM = Math.log(1.3);
const PREFIX = "ee, ";
const SUFFIX = " ee.";
const PREFIX_INITIALS = new Set(["ö", "ı"]);

const BASE = "/tts-tr";
const MODEL_FILES = ["text_stage.onnx", "sound_stage.onnx", "decoder.onnx"] as const;
const DICT_FILES = ["foreign_dict.json", "foreign_parts.json", "known_words.json", "english_i.json"] as const;
const CACHE_NAME = "tts-tr-v1";

/** Metni model parçalarına böler: cümle sınırlarında, ilk parça kısa (hızlı başlangıç). */
export function splitModelText(text: string, maxChars = 250, firstChars = 80): string[] {
  const sentences = text.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    const limit = chunks.length === 0 ? firstChars : maxChars;
    if (cur && cur.length + 1 + s.length > limit) {
      chunks.push(cur);
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** Ham metni modelin okuyacağı biçime çevirir (sayılar yazıya vb.). Sözlükler yüklenmiş olmalı. */
export function toModelText(raw: string): string {
  return AntaliaText.toModelText(raw);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(len: number, rand: () => number): Float32Array {
  const o = new Float32Array(len);
  for (let i = 0; i < len; i += 2) {
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    const r = Math.sqrt(-2 * Math.log(u1));
    const th = 2 * Math.PI * u2;
    o[i] = r * Math.cos(th);
    if (i + 1 < len) o[i + 1] = r * Math.sin(th);
  }
  return o;
}

/** Önbellek-öncelikli indirme (ilerleme bildirir). */
async function fetchBuffer(url: string, onTick: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
  const cache = typeof caches !== "undefined" ? await caches.open(CACHE_NAME).catch(() => null) : null;
  const hit = await cache?.match(url);
  if (hit) {
    const buf = await hit.arrayBuffer();
    onTick(buf.byteLength, buf.byteLength);
    return buf;
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    onTick(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  await cache?.put(url, new Response(out, { headers: { "content-type": "application/octet-stream" } })).catch(() => {});
  return out.buffer;
}

export type TtsPiece = { audio: Float32Array; text: string; seconds: number };
export type TtsEngine = {
  /** Metni parça parça sese çevirir (her parça çalınmaya hazır). */
  synth(text: string, speed: number, seed?: number, signal?: { cancelled: boolean }): AsyncGenerator<TtsPiece>;
  dispose(): Promise<void>;
  backend: "webgpu" | "wasm";
};

export async function loadAntalia(onProgress: (pct: number, loadedBytes: number) => void): Promise<TtsEngine> {
  const ort = await import("onnxruntime-web");
  ort.env.wasm.wasmPaths = `${BASE}/ort/`;
  // Çok iş parçacığı/proxy, çapraz-köken yalıtımı (SharedArrayBuffer) ister; sitede yok → tek iş parçacığı (Fotoğraf Stüdyosu ile aynı).
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;

  const state = new Map<string, { loaded: number; total: number }>();
  const report = () => {
    let l = 0;
    let t = 0;
    for (const v of state.values()) {
      l += v.loaded;
      t += v.total || v.loaded;
    }
    onProgress(t ? Math.min(100, (100 * l) / t) : 0, l);
  };
  const get = (f: string) =>
    fetchBuffer(`${BASE}/${f}`, (loaded, total) => {
      state.set(f, { loaded, total });
      report();
    });

  const [dictBufs, modelBufs] = await Promise.all([
    Promise.all(DICT_FILES.map(get)),
    Promise.all(MODEL_FILES.map(get)),
  ]);
  const dicts = dictBufs.map((b) => JSON.parse(new TextDecoder().decode(b)));
  AntaliaText.setData({ foreign: dicts[0], parts: dicts[1], known: dicts[2], englishI: dicts[3] });

  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const create = async (eps: ("webgpu" | "wasm")[]) =>
    Promise.all(
      modelBufs.map((b) => ort.InferenceSession.create(b, { executionProviders: eps, graphOptimizationLevel: "all" })),
    );

  let backend: "webgpu" | "wasm" = isIos ? "wasm" : "webgpu";
  let sess: Awaited<ReturnType<typeof create>>;
  try {
    sess = await create(isIos ? ["wasm"] : ["webgpu", "wasm"]);
  } catch {
    backend = "wasm";
    sess = await create(["wasm"]);
  }
  let [sText, sSound, sDec] = sess;

  const T = (type: string, data: unknown, dims: number[]) => new ort.Tensor(type as "float32", data as Float32Array, dims);

  async function* synthPieces(text: string, speed: number, seed: number, signal?: { cancelled: boolean }): AsyncGenerator<TtsPiece> {
    const clean = toModelText(text);
    if (!clean) return;
    const chunks = splitModelText(clean);
    let seedI = 0;
    const low = new AntaliaAudio.Biquad(AntaliaAudio.TONE_LOW);
    const high = new AntaliaAudio.Biquad(AntaliaAudio.TONE_HIGH);
    const spaceId = AntaliaText.SYMBOL_TO_ID[" "]!;

    for (let k = 0; k < chunks.length; k++) {
      if (signal?.cancelled) return;
      const part = chunks[k]!;
      const firstChar = part.trim()[0];
      const hasPrefix = Boolean(firstChar && PREFIX_INITIALS.has(firstChar));
      const prefixStr = hasPrefix ? PREFIX : "";
      const ids = AntaliaText.encode(prefixStr + part + SUFFIX);
      const L = ids.length;
      const nPre = hasPrefix ? AntaliaText.encode(prefixStr).length - 2 : 0;
      const nSuf = AntaliaText.encode(SUFFIX).length - 2;

      const tOut = await sText!.run({
        ids: T("int64", BigInt64Array.from(ids.map(BigInt)), [1, L]),
        mask: T("bool", new Uint8Array(L).fill(1), [1, L]),
      });
      const dText = tOut.h!.dims[2]!;
      const h = (await tOut.h!.getData()) as Float32Array;
      const logd = new Float32Array((await tOut.logd!.getData()) as Float32Array);

      // Çift ünsüz uzatma (Türkçe)
      for (let i = 2; i < L - 1; i++) {
        if (ids[i] === ids[i - 1] && ids[i] !== spaceId) logd[i]! += LOG_GEM;
        else if (ids[i - 1] === spaceId && ids[i] === ids[i - 2]) logd[i - 1]! += LOG_GEM;
      }

      const dur = new Int32Array(L);
      let totalFrames = 0;
      for (let i = 0; i < L; i++) {
        dur[i] = Math.max(1, Math.min(MAX_DUR_FRAMES, Math.round(Math.exp(logd[i]!) / speed)));
        totalFrames += dur[i]!;
      }
      const melLen = Math.ceil(totalFrames / STACK) * STACK;

      const cond = new Float32Array(melLen * dText);
      let f = 0;
      for (let i = 0; i < L; i++) {
        for (let n = 0; n < dur[i]! && f < melLen; n++) {
          cond.set(h.subarray(i * dText, (i + 1) * dText), f * dText);
          f++;
        }
      }
      while (f < melLen) {
        cond.set(h.subarray((L - 1) * dText, L * dText), f * dText);
        f++;
      }

      const rand = mulberry32((seed * 1000003 + seedI++) >>> 0);
      const noise = randn((melLen / STACK) * NOISE_DIM, rand);
      for (let i = 0; i < noise.length; i++) noise[i]! *= TEMPERATURE;

      const sOut = await sSound!.run({
        cond: T("float32", cond, [1, melLen, dText]),
        fmask: T("bool", new Uint8Array(melLen).fill(1), [1, melLen]),
        noise: T("float32", noise, [1, melLen / STACK, NOISE_DIM]),
      });
      const mel = (await sOut.mel!.getData()) as Float32Array;
      const dOut = await sDec!.run({ mel: T("float32", mel, [1, N_MELS, melLen]) });
      const wavRaw = new Float32Array((await dOut.audio!.getData()) as Float32Array);

      // Ön/son ek seslerini kes
      let cum = 0;
      let a = 0;
      let b = wavRaw.length;
      for (let i = 0; i < L; i++) {
        cum += dur[i]!;
        if (i === nPre && hasPrefix) a = cum * HOP;
        if (i === L - 2 - nSuf) b = cum * HOP;
      }
      const wav = wavRaw.slice(Math.max(0, a), Math.min(wavRaw.length, b));
      const fade = Math.floor(0.005 * RATE);
      if (hasPrefix && wav.length > 2 * fade) for (let i = 0; i < fade; i++) wav[i]! *= i / fade;
      if (wav.length > 2 * fade) for (let i = 0; i < fade; i++) wav[wav.length - 1 - i]! *= i / fade;

      let framed = wav;
      if (k < chunks.length - 1) {
        const pad = Math.round(AntaliaAudio.pauseSec(part) * RATE);
        framed = new Float32Array(wav.length + pad);
        framed.set(wav);
      }
      const audio = AntaliaAudio.postProcessAudio(framed, low, high);
      yield { audio, text: part, seconds: audio.length / RATE };
    }
  }

  // Isınma: ilk gerçek okumada gecikme olmasın.
  try {
    for await (const _ of synthPieces("Merhaba.", 1, 0)) void _;
  } catch (e) {
    if (backend !== "webgpu") throw e;
    for (const s of [sText, sSound, sDec]) await s?.release().catch(() => {});
    backend = "wasm";
    [sText, sSound, sDec] = await create(["wasm"]);
    for await (const _ of synthPieces("Merhaba.", 1, 0)) void _;
  }

  return {
    backend,
    synth: (text, speed, seed = 0, signal) => synthPieces(text, speed, seed, signal),
    dispose: async () => {
      for (const s of [sText, sSound, sDec]) await s?.release().catch(() => {});
    },
  };
}

/** Mono Float32 → 16-bit WAV. */
export function toWavBlob(samples: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  let p = 44;
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(p, x < 0 ? x * 0x8000 : x * 0x7fff, true);
    p += 2;
  }
  return new Blob([v], { type: "audio/wav" });
}
