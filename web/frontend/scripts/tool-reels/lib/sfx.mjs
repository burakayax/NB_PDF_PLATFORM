/**
 * Ses efektleri (tıklama, geçiş "vuuş", başarı çanı): müzik gibi tamamen ffmpeg ile SENTEZLENİR, telif sorunu yoktur.
 * Tek bir efekt izi üretir; kurgu bunu müzikle karıştırır.
 */
import { spawnSync } from "node:child_process";

const f5 = (x) => x.toFixed(5);

function run(ffmpeg, args, what) {
  const r = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8", maxBuffer: 1 << 27 });
  if (r.status !== 0) throw new Error(`${what}: ${r.stderr.slice(0, 1200)}`);
}

function synth(ffmpeg, dir, name, expr, dur, post = "anull") {
  run(
    ffmpeg,
    ["-f", "lavfi", "-i", `aevalsrc=exprs='${expr}|${expr}':s=48000:d=${f5(dur)}`, "-af", post, "-ar", "48000", "-ac", "2", `${dir}/${name}.wav`],
    `Efekt ${name}`,
  );
}

/**
 * @param {string} ffmpeg
 * @param {string} dir
 * @param {number} total saniye
 * @param {{ clicks?: number[], whooshes?: number[], chimes?: number[] }} at  efektin çalacağı zamanlar (sn)
 * @returns {string} dosya adı (dir içinde)
 */
export function makeSfx(ffmpeg, dir, total, at) {
  // Tıklama: kısa, ince "tık" (gürültü darbesi + 1,5 kHz ton)
  synth(ffmpeg, dir, "sfx_click", "(random(0)-0.5)*exp(-140*t)*0.55+sin(2*PI*1500*t)*exp(-70*t)*0.45", 0.14, "highpass=f=500");
  // Geçiş: süzülen "vuuş" (zarf: yumuşak çan eğrisi)
  synth(ffmpeg, dir, "sfx_whoosh", "(random(0)-0.5)*2*pow(sin(PI*t/0.55),2)*0.7", 0.55, "highpass=f=350,lowpass=f=4200,aecho=0.6:0.5:60:0.25");
  // Başarı: yükselen üçlü çın (C6 · E6 · G6)
  const note = (f, t0) => `gt(t,${t0})*exp(-5*max(t-${t0},0))*(sin(2*PI*${f}*t)+0.3*sin(4*PI*${f}*t))*(1-exp(-300*max(t-${t0},0)))`;
  synth(ffmpeg, dir, "sfx_chime", `(${note(1046.5, 0)}+${note(1318.5, 0.09)}+${note(1568, 0.18)})*0.22`, 1.2, "aecho=0.7:0.6:90:0.3");

  const items = [
    ...(at.clicks ?? []).map((t) => ["sfx_click", t, 0.9]),
    ...(at.whooshes ?? []).map((t) => ["sfx_whoosh", t, 0.7]),
    ...(at.chimes ?? []).map((t) => ["sfx_chime", t, 1.0]),
  ].filter(([, t]) => t >= 0 && t < total - 0.1);
  if (!items.length) return null;

  const ins = items.flatMap(([n]) => ["-i", `${dir}/${n}.wav`]);
  const parts = items.map(([, t, g], i) => {
    const ms = Math.max(0, Math.round(t * 1000));
    return `[${i}:a]volume=${g},adelay=${ms}|${ms}[e${i}]`;
  });
  const labels = items.map((_, i) => `[e${i}]`).join("");
  const filter = `${parts.join(";")};${labels}amix=inputs=${items.length}:normalize=0,apad=whole_dur=${f5(total)},atrim=0:${f5(total)}[o]`;
  run(ffmpeg, [...ins, "-filter_complex", filter, "-map", "[o]", "-ar", "48000", "-ac", "2", `${dir}/sfx.wav`], "Efekt izi");
  return "sfx.wav";
}
