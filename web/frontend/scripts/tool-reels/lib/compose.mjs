/**
 * Araç tanıtım videosu kurgusu: kayıt (webm) + zaman çizelgesi → 1080x1920 MP4.
 *
 * Üst çubukta logo + alan adı, altta adım yazıları, başta/sonda marka kartı; seçilen alana
 * yumuşak yakınlaşıp geri çıkar. Yalnızca ffmpeg-static ve sitenin kendi dosyaları kullanılır.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { makeMusic } from "./music.mjs";

const require = createRequire(import.meta.url);

/** @returns {{ total: number }} */
export function compose({ workDir: S, out: OUT, intro, publicDir }) {
  const ffmpeg = process.env.FFMPEG_PATH || require("ffmpeg-static");
  const T = JSON.parse(readFileSync(S + "/timeline.json", "utf8"));
  const webm = readdirSync(S + "/rec").find((f) => f.endsWith(".webm"));
  copyFileSync(`${publicDir}/logo.png`, `${S}/logo.png`);
  copyFileSync(`${publicDir}/fonts/Roboto-Bold.ttf`, `${S}/Roboto-Bold.ttf`);

  const even = (n) => Math.round(n / 2) * 2;
  const D = T.end;
  const I = 3.2; // giriş kartı
  const O = 5.0; // kapanış kartı
  const TOTAL = +(I + D + O).toFixed(2);

  // ---- Kesim (araç bölümü) ----
  const cx = even(T.formBox.x - 14);
  const cw = even(T.formBox.w + 28);
  const y1 = even(T.formBox.y - 14);
  const btnBottom = T.btnBoxFinal.y + T.btnBoxFinal.height;
  const ch = even(btnBottom + 14 - y1);
  const y2 = Math.max(0, even(T.resultBox.y - 135));
  const ch2 = even(640);
  const swap = +(T.swapAt - 0.05).toFixed(2);

  const VW1 = 960, VH1 = even((ch * VW1) / cw), VX1 = even((1080 - VW1) / 2), VY1 = 310;
  const VW2 = 1000, VH2 = even((ch2 * VW2) / cw), VX2 = even((1080 - VW2) / 2), VY2 = 310;

  const ACC = "0x38bdf8", GREEN = "0x34d399", SOFT = "0xcbd5e1";
  const fontfile = "fontfile=Roboto-Bold.ttf:expansion=none";
  const fit = (text, base, maxW = 900) => Math.max(30, Math.min(base, Math.floor(maxW / (Math.max(1, text.length) * 0.53))));

  const filters = [];
  let n = 0;
  // Metin: [a,b] arasında yumuşak belirip kaybolur.
  const text = (str, color, size, y, a, b, fade = 0.35) => {
    if (!str) return;
    const f = `t${n++}.txt`;
    writeFileSync(`${S}/${f}`, str, "utf8");
    const alpha = `if(between(t,${a},${b}),min(1,min((t-${a})/${fade},(${b}-t)/${fade})),0)`;
    filters.push(
      `drawtext=${fontfile}:textfile=${f}:fontcolor=${color}:fontsize=${fit(str, size)}:x=(w-text_w)/2:y=${y}:alpha='${alpha}'`,
    );
  };

  // ---- Ana bölüm: üst marka çubuğu + alt metin paneli ----
  const MS = +I.toFixed(2), ME = +(I + D).toFixed(2);
  // panel
  filters.push(`drawbox=x=40:y=1240:w=1000:h=244:color=0x0d1630@0.96:t=fill:enable='between(t,${MS},${ME})'`);
  filters.push(`drawbox=x=40:y=1240:w=1000:h=4:color=${ACC}@0.95:t=fill:enable='between(t,${MS},${ME})'`);
  // alan adı (sağ üst, logonun yanında)
  writeFileSync(`${S}/domain.txt`, "pdfplatform.app", "utf8");
  filters.push(
    `drawtext=${fontfile}:textfile=domain.txt:fontcolor=${ACC}:fontsize=44:x=1020-text_w:y=186:enable='between(t,${MS},${ME})'`,
  );

  T.events.forEach((e, i) => {
    const a = +(MS + e.t).toFixed(2);
    const b = +(MS + (i + 1 < T.events.length ? T.events[i + 1].t : D)).toFixed(2);
    text(e.label, "0x7dd3fc", 28, 1262, a, b);
    text(e.title, "white", 56, 1298, a, b);
    text(e.l1, e.accent === "green" ? GREEN : ACC, 50, 1372, a, b);
    text(e.l2, e.accent === "green" ? "white" : SOFT, 40, 1430, a, b);
  });

  // ---- Giriş kartı ----
  text(intro.title, "white", 96, 960, 0, I, 0.6);
  text("pdfplatform.app", ACC, 66, 1075, 0, I, 0.6);
  text(intro.sub, SOFT, 46, 1175, 0, I, 0.6);
  // ---- Kapanış kartı ----
  const OS = +ME.toFixed(2), OE = TOTAL;
  text("pdfplatform.app", ACC, 84, 1000, OS, OE, 0.6);
  text("PDF Sıkıştır · Birleştir · Böl · Dönüştür", SOFT, 44, 1115, OS, OE, 0.6);
  text("Bağlantı profilde", "white", 58, 1220, OS, OE, 0.6);

  // ---- Animasyonlu büyütme (zoompan): odak pencereleri kayıttaki vurgu anlarından ----
  const E_ZOOM = 0.45; // yaklaşma/uzaklaşma süresi
  const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const wins1 = [], wins2 = [];
  for (const z of T.zooms) {
    if (z.b == null || z.b - z.a < 0.9) continue;
    (z.a < T.swapAt ? wins1 : wins2).push({ a: z.a + 0.15, b: Math.min(z.b, z.a < T.swapAt ? T.swapAt : D) - 0.1, box: z.box });
  }
  function zoomFilter(wins, { cropX, cropY, cropW, viewW, viewH, maxZ = 1.38 }) {
    // 2x büyütülmüş akış: zoompan'in tam sayı yuvarlama titremesini azaltır
    const k2 = (2 * viewW) / cropW;
    const IW = 2 * viewW, IH = 2 * viewH;
    if (wins.length === 0) return `scale=${viewW}:${viewH}:flags=lanczos`;
    const Tt = "(on/30)";
    const parts = wins.map((w) => {
      const bw = w.box.w * k2 * 1.04, bh = w.box.h * k2 * 1.1;
      const zm = clampN(Math.min(IW / bw, IH / bh), 1.0, maxZ);
      const cxv = (w.box.x + w.box.w / 2 - cropX) * k2;
      const cyv = (w.box.y + w.box.h / 2 - cropY) * k2;
      const p = `min(clip((${Tt}-${w.a.toFixed(2)})/${E_ZOOM},0,1),clip((${w.b.toFixed(2)}-${Tt})/${E_ZOOM},0,1))`;
      return { zm, cxv, cyv, a: w.a, b: w.b, s: `(${p}*${p}*(3-2*${p}))` };
    });
    const bump = parts.map((p) => `${(p.zm - 1).toFixed(3)}*${p.s}`).join("+");
    const Z = `1+${bump}`;
    const fx = parts.map((p) => `between(${Tt},${p.a.toFixed(2)},${p.b.toFixed(2)})*${p.cxv.toFixed(1)}`).join("+");
    const fy = parts.map((p) => `between(${Tt},${p.a.toFixed(2)},${p.b.toFixed(2)})*${p.cyv.toFixed(1)}`).join("+");
    const Fx = `if(gt(${fx},0),${fx},iw/2)`;
    const Fy = `if(gt(${fy},0),${fy},ih/2)`;
    const X = `min(max(${Fx}-iw/zoom/2,0),iw-iw/zoom)`;
    const Y = `min(max(${Fy}-ih/zoom/2,0),ih-ih/zoom)`;
    return `scale=${IW}:${IH}:flags=lanczos,zoompan=z='${Z}':x='${X}':y='${Y}':d=1:s=${viewW}x${viewH}:fps=30`;
  }
  // Tüm video kutusunun hafif büyümesi (geniş alanlar için): odak penceresi boyunca ~%10
  function blockScaleExpr(wins) {
    if (wins.length === 0) return "1";
    const Tt = "t";
    const s = wins.map((w) => {
      const p = `min(clip((${Tt}-${w.a.toFixed(2)})/${E_ZOOM},0,1),clip((${w.b.toFixed(2)}-${Tt})/${E_ZOOM},0,1))`;
      return `(${p}*${p}*(3-2*${p}))`;
    }).join("+");
    return `1+0.10*(${s})`;
  }
  const zf1 = zoomFilter(wins1, { cropX: cx, cropY: y1, cropW: cw, viewW: VW1, viewH: VH1 });
  const zf2 = zoomFilter(wins2, { cropX: cx, cropY: y2, cropW: cw, viewW: VW2, viewH: VH2, maxZ: 1.25 });
  const bs1 = blockScaleExpr(wins1), bs2 = blockScaleExpr(wins2);
  console.log("ZOOM", wins1.length, "+", wins2.length, "pencere");

  const filter = [
    // ana video akışı
    `[1:v]trim=start=${T.start}:end=${(T.start + D + 0.1).toFixed(2)},setpts=PTS-STARTPTS,fps=30,split=2[s1][s2]`,
    `[s1]crop=w=${cw}:h=${ch}:x=${cx}:y=${y1},${zf1},scale=w='trunc(${VW1}*(${bs1})/2)*2':h='trunc(${VH1}*(${bs1})/2)*2':eval=frame:flags=bilinear,setpts=PTS+${MS}/TB[v1]`,
    `[s2]crop=w=${cw}:h=${ch2}:x=${cx}:y=${y2},${zf2},scale=w='trunc(${VW2}*(${bs2})/2)*2':h='trunc(${VH2}*(${bs2})/2)*2':eval=frame:flags=bilinear,setpts=PTS+${MS}/TB[v2]`,
    // logolar
    `[3:v]scale=800:-1,format=rgba,fade=t=in:st=0:d=0.6:alpha=1,fade=t=out:st=${(I - 0.6).toFixed(2)}:d=0.6:alpha=1[lgi]`,
    `[4:v]scale=300:-1,format=rgba,setpts=PTS+${MS}/TB,fade=t=in:st=${MS}:d=0.6:alpha=1[lgt]`,
    `[5:v]scale=800:-1,format=rgba,setpts=PTS+${OS}/TB,fade=t=in:st=${OS}:d=0.6:alpha=1[lgo]`,
    // birleştirme
    `[0:v][v1]overlay=x='${VX1}+(${VW1}-overlay_w)/2':y='${VY1}+(${VH1}-overlay_h)/2':enable='between(t,${MS},${(swap + MS).toFixed(2)})':eof_action=pass[b1]`,
    `[b1][v2]overlay=x='${VX2}+(${VW2}-overlay_w)/2':y='${VY2}+(${VH2}-overlay_h)/2':enable='between(t,${(swap + MS).toFixed(2)},${ME})':eof_action=pass[b2]`,
    `[b2][lgi]overlay=140:640:enable='between(t,0,${I})':eof_action=pass[b3]`,
    `[b3][lgt]overlay=60:150:enable='between(t,${MS},${ME})':eof_action=pass[b4]`,
    `[b4][lgo]overlay=140:640:enable='between(t,${OS},${OE})':eof_action=pass[b5]`,
    `[b5]${filters.join(",")}[o]`,
  ].join(";");

  const music = makeMusic(ffmpeg, S, TOTAL);
  const args = [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", `color=c=0x080d1a:s=1080x1920:r=30:d=${TOTAL}`,
    "-i", `rec/${webm}`,
    "-i", music,
    "-loop", "1", "-t", String(TOTAL), "-i", "logo.png",
    "-loop", "1", "-t", String(TOTAL), "-i", "logo.png",
    "-loop", "1", "-t", String(TOTAL), "-i", "logo.png",
    "-filter_complex", filter,
    "-map", "[o]", "-map", "2:a", "-t", String(TOTAL),
    // Meta Reels şartları: sabit 30 fps, kapalı GOP (2 sn'de bir anahtar kare), 4:2:0,
    // AAC-LC 48 kHz stereo >=128 kbps.
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-r", "30", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0", "-x264-params", "open-gop=0",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", OUT,
  ];
  const run = spawnSync(ffmpeg, args, { cwd: S, encoding: "utf8", maxBuffer: 1 << 27 });
  if (run.status !== 0) throw new Error(run.stderr.slice(0, 3000));
  console.log("tamam", OUT, { TOTAL, cw, ch, VH1, VH2, y1, y2, swap, MS, ME });
  return { total: TOTAL };
}
