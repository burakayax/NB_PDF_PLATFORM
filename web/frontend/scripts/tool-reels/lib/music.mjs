/**
 * Arka plan müziği: tamamen ffmpeg ile SENTEZLENİR (hazır parça/örnek kullanılmaz), bu yüzden telif hakkı
 * sorunu yoktur ve Meta'nın telif taramasına takılmaz.
 *
 * Tür: sıcak, yumuşak "ambient" — yavaş akor geçişleri (Cmaj7 · Am7 · Fmaj7 · G6), hafif çınlayan arpej
 * ve alt bas. Konuşma olmadığı için ses düşük tutulur: rahatsız etmez, sessiz de kalmaz.
 */

import { spawnSync } from "node:child_process";

const BPM = 72;
const BEAT = 60 / BPM;
const BAR = BEAT * 4; // 3,33 sn
const OVERLAP = 1.4; // akorlar birbirine yumuşakça geçer

// Hz. Dört sesli, yakın dizilimli akorlar.
const CHORDS = [
  { root: 65.41, tones: [130.81, 164.81, 196.0, 246.94] }, // Cmaj7
  { root: 55.0, tones: [110.0, 164.81, 196.0, 261.63] }, // Am7
  { root: 43.65, tones: [130.81, 164.81, 220.0, 261.63] }, // Fmaj7
  { root: 49.0, tones: [146.83, 196.0, 246.94, 329.63] }, // G6
];
const ARP = [0, 2, 1, 3, 2, 3, 1, 2]; // bir ölçüdeki sekizlikler

const f6 = (n) => n.toFixed(4);

function chordExpr(ch, side) {
  const L = BAR + OVERLAP;
  const det = side === 0 ? 1.0035 : 0.9965; // sol/sağ hafif detune: genişlik
  const env = `clip(t/1.3,0,1)*clip((${f6(L)}-t)/1.3,0,1)`;
  const pad = ch.tones.map((f) => `sin(2*PI*${f6(f * det)}*t)`).join("+");
  const bass = `sin(2*PI*${f6(ch.root)}*t)*0.55`;
  const arp = ARP.map((idx, k) => {
    const tk = k * (BAR / 8);
    const f = ch.tones[idx] * 2 * (side === 0 ? 1 : 1.002);
    // max(...,0): nota başlamadan önce exp() taşıp (inf*0 = NaN) sesi bozmasın.
    const d = `max(t-${f6(tk)},0)`;
    return `gt(t,${f6(tk)})*exp(-4.2*${d})*(1-exp(-260*${d}))*sin(2*PI*${f6(f)}*t)`;
  }).join("+");
  return `(${pad})*0.060*${env}+${bass}*0.090*${env}+(${arp})*0.055`;
}

/**
 * @param {string} ffmpeg  ffmpeg yolu
 * @param {string} dir     çalışma klasörü
 * @param {number} total   saniye
 * @returns {string} dosya adı (dir içinde)
 */
export function makeMusic(ffmpeg, dir, total) {
  const bars = Math.ceil(total / BAR) + 1;
  const inputs = [];
  const delays = [];
  for (let i = 0; i < bars; i++) {
    const ch = CHORDS[i % CHORDS.length];
    const L = BAR + OVERLAP;
    inputs.push("-f", "lavfi", "-t", f6(L), "-i", `aevalsrc=exprs='${chordExpr(ch, 0)}|${chordExpr(ch, 1)}':s=48000:d=${f6(L)}`);
    delays.push(`[${i}:a]adelay=${Math.round(i * BAR * 1000)}|${Math.round(i * BAR * 1000)}[c${i}]`);
  }
  const mix = Array.from({ length: bars }, (_, i) => `[c${i}]`).join("");
  const chain = [
    ...delays,
    `${mix}amix=inputs=${bars}:normalize=0:duration=longest`,
    // yumuşatma: tiz kırpılır, hafif yankı "geniş oda" hissi verir
    `lowpass=f=2600,aecho=0.78:0.62:340|610:0.32|0.20,highpass=f=40`,
    `atrim=0:${f6(total)},afade=t=in:st=0:d=2.0,afade=t=out:st=${f6(Math.max(0, total - 3.5))}:d=3.5`,
  ];
  const graph = chain.join(";").replace(/;(?=lowpass)/, ",").replace(/;(?=atrim)/, ",");
  const raw = `${dir}/music_raw.wav`;
  const r = spawnSync(
    ffmpeg,
    ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", graph, "-ac", "2", "-ar", "48000", raw],
    { encoding: "utf8", maxBuffer: 1 << 27 },
  );
  if (r.status !== 0) throw new Error("Müzik üretilemedi: " + r.stderr.slice(0, 1500));

  // Ses düzeyi: ortalama ≈ -31 dB (gövde ≈ -24 dB) (arka plan: duyulur ama konuşmanın/ekranın önüne geçmez), tepe sınırlı.
  const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", raw, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const mean = parseFloat((/mean_volume:\s*(-?[\d.]+) dB/.exec(probe.stderr) || [])[1]);
  const gain = Number.isFinite(mean) ? Math.max(-6, Math.min(30, -31 - mean)) : 12;
  const out = "music.wav";
  const g = spawnSync(
    ffmpeg,
    ["-y", "-hide_banner", "-loglevel", "error", "-i", raw, "-af", `volume=${gain.toFixed(2)}dB,alimiter=limit=0.5`, "-ar", "48000", "-ac", "2", `${dir}/${out}`],
    { encoding: "utf8" },
  );
  if (g.status !== 0) throw new Error("Müzik düzeyi ayarlanamadı: " + g.stderr.slice(0, 800));
  console.log("MUSIC mean", mean, "dB → gain", gain.toFixed(1), "dB");
  return out;
}
