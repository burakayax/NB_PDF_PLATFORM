/**
 * Arka plan müziği: tamamen ffmpeg ile SENTEZLENİR (hazır parça/örnek kullanılmaz), bu yüzden telif hakkı
 * sorunu yoktur ve Meta/YouTube'un telif taramasına takılmaz.
 *
 * Tür: tempolu, pozitif "tech / startup" parçası — 116 BPM, majör, I–V–vi–IV akor dizisi (C · G · Am · F).
 * Dört vuruşluk yumuşak davul, ritmik bas, parlak akor vuruşları, hızlı arpej ve hi-hat. Amaç izleyiciyi
 * uyutmak değil, "bir şeyler oluyor, devam et" hissi vermek; ses yine de düşük tutulur (ekrandaki
 * yazıların önüne geçmez).
 */

import { spawnSync } from "node:child_process";

const BPM = 116;
const BEAT = 60 / BPM;
const BAR = BEAT * 4; // ≈ 2,07 sn
const S16 = BAR / 16; // on altılık nota

// Hz.
const CHORDS = [
  { name: "C", bass: 130.81, stab: [261.63, 329.63, 392.0], arp: [523.25, 659.25, 783.99] },
  { name: "G", bass: 98.0, stab: [246.94, 293.66, 392.0], arp: [493.88, 587.33, 783.99] },
  { name: "Am", bass: 110.0, stab: [220.0, 261.63, 329.63], arp: [440.0, 523.25, 659.25] },
  { name: "F", bass: 87.31, stab: [220.0, 261.63, 349.23], arp: [440.0, 523.25, 698.46] },
];

const n = (x) => x.toFixed(5);
/** Notanın başlangıcından itibaren geçen süre (başlamadan önce 0: exp() taşması NaN üretmesin). */
const since = (t0) => `max(t-${n(t0)},0)`;
const at = (t0) => `gt(t,${n(t0)})`;

/** Davul + bas + akor vuruşları + arpej + pad (tonlu kısım). side: 0 sol, 1 sağ (hafif detune = genişlik). */
function toneExpr(ch, side) {
  const det = side === 0 ? 1.0 : 1.004;
  const parts = [];

  // Kick: her vuruşta; frekans hızla düşer (50 → ~140 Hz'den). Faz = ∫f(t)dt.
  for (let k = 0; k < 4; k++) {
    const t0 = k * BEAT;
    const d = since(t0);
    parts.push(`${at(t0)}*0.80*exp(-8*${d})*sin(2*PI*(46*${d}+90*(1-exp(-26*${d}))/26))`);
  }

  // Bas: 16'lık adımlarda 0, 6, 8, 14 (zıplayan bir kalıp). Pluck + biraz harmonik (telefon hoparlöründe duyulsun).
  for (const [step, mult] of [[0, 1], [6, 1], [8, 1], [11, 1.5], [14, 2]]) {
    const t0 = step * S16;
    const d = since(t0);
    const f = ch.bass * mult;
    parts.push(`${at(t0)}*exp(-7*${d})*(0.34*sin(2*PI*${n(f)}*t)+0.14*sin(4*PI*${n(f)}*t))`);
  }

  // Akor vuruşları (tresillo): 0, 3, 6, 10, 13. Kısa, parlak; 3 harmonik.
  for (const step of [0, 3, 6, 10, 13]) {
    const t0 = step * S16;
    const d = since(t0);
    const voices = ch.stab
      .map((f) => {
        const g = n(f * det);
        return `(sin(2*PI*${g}*t)+0.45*sin(4*PI*${g}*t)+0.2*sin(6*PI*${g}*t))`;
      })
      .join("+");
    parts.push(`${at(t0)}*exp(-10*${d})*(1-exp(-400*${d}))*(${voices})*0.055`);
  }

  // Arpej: sekizliklerde yukarı-aşağı, hızlı sönen çınlama.
  const pat = [0, 1, 2, 1, 2, 1, 0, 1];
  pat.forEach((idx, k) => {
    const t0 = k * 2 * S16;
    const d = since(t0);
    const f = ch.arp[idx] * det;
    parts.push(`${at(t0)}*exp(-13*${d})*(1-exp(-500*${d}))*sin(2*PI*${n(f)}*t)*0.060`);
  });

  // Pad: akor boyunca sessizce uzanır (boşluk olmasın), kenarlar yumuşak.
  const pad = ch.stab.map((f) => `sin(2*PI*${n(f * det * 0.5)}*t)`).join("+");
  parts.push(`(${pad})*0.030*clip(t/0.04,0,1)*clip((${n(BAR)}-t)/0.10,0,1)`);

  return parts.join("+");
}

/** Hi-hat: sekizlik ara vuruşlar (açık) + on altılık "karıncalanma" (kapalı, daha sessiz). Gürültü: sonra yüksek geçiren süzgeçten geçer. */
function hatExpr() {
  const parts = [];
  for (let s = 0; s < 16; s++) {
    const t0 = s * S16;
    const d = since(t0);
    const open = s % 4 === 2;
    parts.push(`${at(t0)}*exp(-${open ? 38 : 90}*${d})*${open ? 0.34 : 0.14}`);
  }
  return `(${parts.join("+")})*(random(0)-0.5)*2`;
}

/** Clap/snare: 2. ve 4. vuruşta kısa gürültü patlaması + hafif gövde. */
function clapExpr() {
  const parts = [];
  for (const k of [1, 3]) {
    const t0 = k * BEAT;
    const d = since(t0);
    parts.push(`${at(t0)}*exp(-20*${d})*((random(0)-0.5)*2*0.5+0.35*sin(2*PI*190*${d}))`);
  }
  return parts.join("+");
}

function run(ffmpeg, args, what) {
  const r = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8", maxBuffer: 1 << 27 });
  if (r.status !== 0) throw new Error(`${what}: ${r.stderr.slice(0, 1500)}`);
}

/**
 * @param {string} ffmpeg  ffmpeg yolu
 * @param {string} dir     çalışma klasörü
 * @param {number} total   saniye
 * @returns {string} dosya adı (dir içinde)
 */
export function makeMusic(ffmpeg, dir, total) {
  // 1) Her akor için bir ölçü (davul + bas + vuruşlar dahil) üret.
  const src = (expr) => ["-f", "lavfi", "-t", n(BAR), "-i", `aevalsrc=exprs='${expr}':s=48000:d=${n(BAR)}`];
  CHORDS.forEach((ch, i) => {
    const hat = hatExpr();
    const clap = clapExpr();
    run(
      ffmpeg,
      [
        ...src(`${toneExpr(ch, 0)}|${toneExpr(ch, 1)}`),
        ...src(`${hat}|${hat}`),
        ...src(`${clap}|${clap}`),
        "-filter_complex",
        [
          "[1:a]highpass=f=7000[h]",
          "[2:a]bandpass=f=1900:width_type=h:w=2600[c]",
          "[0:a][h][c]amix=inputs=3:normalize=0,lowpass=f=12000,atrim=0:" + n(BAR),
        ].join(";"),
        "-ac", "2", "-ar", "48000", `${dir}/bar_${i}.wav`,
      ],
      `Müzik ölçüsü ${ch.name}`,
    );
  });

  // 2) Ölçüleri sırayla art arda diz, hafifçe sıkıştır, giriş/çıkış yumuşat.
  const bars = Math.ceil(total / BAR) + 1;
  const ins = [];
  for (let i = 0; i < bars; i++) ins.push("-i", `${dir}/bar_${i % CHORDS.length}.wav`);
  const labels = Array.from({ length: bars }, (_, i) => `[${i}:a]`).join("");
  const raw = `${dir}/music_raw.wav`;
  run(
    ffmpeg,
    [
      ...ins,
      "-filter_complex",
      `${labels}concat=n=${bars}:v=0:a=1,atrim=0:${n(total)},acompressor=threshold=0.18:ratio=3:attack=8:release=90,afade=t=in:st=0:d=0.8,afade=t=out:st=${n(Math.max(0, total - 2.5))}:d=2.5`,
      "-ac", "2", "-ar", "48000", raw,
    ],
    "Müzik birleştirme",
  );

  // 3) Ses düzeyi: ortalama ≈ -24 dB (canlı ama ekrandaki yazının önüne geçmez), tepe sınırlı.
  const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", raw, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const mean = parseFloat((/mean_volume:\s*(-?[\d.]+) dB/.exec(probe.stderr) || [])[1]);
  const gain = Number.isFinite(mean) ? Math.max(-12, Math.min(30, -24 - mean)) : 6;
  const out = "music.wav";
  run(ffmpeg, ["-i", raw, "-af", `volume=${gain.toFixed(2)}dB,alimiter=limit=0.55:level=disabled`, "-ar", "48000", "-ac", "2", `${dir}/${out}`], "Müzik düzeyi");
  console.log("MUSIC mean", mean, "dB → gain", gain.toFixed(1), "dB");
  return out;
}
