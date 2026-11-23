/**
 * Araç tanıtım videosu kurgusu: kayıt (webm) + zaman çizelgesi → 1080x1920 MP4.
 *
 * Üst çubukta logo + alan adı, altta adım yazıları, başta/sonda marka kartı; seçilen alana
 * yumuşak yakınlaşıp geri çıkar. Yalnızca ffmpeg-static ve sitenin kendi dosyaları kullanılır.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeMusic } from "./music.mjs";
import { makeSfx } from "./sfx.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);

/** @returns {{ total: number }} */
export function compose({ workDir: S, out: OUT, intro, publicDir, linkLine = "Bağlantı profilde" }) {
  const ffmpeg = process.env.FFMPEG_PATH || require("ffmpeg-static");
  const T = JSON.parse(readFileSync(S + "/timeline.json", "utf8"));
  const webm = readdirSync(S + "/rec").find((f) => f.endsWith(".webm"));
  copyFileSync(`${publicDir}/logo.png`, `${S}/logo.png`);
  copyFileSync(`${publicDir}/fonts/Roboto-Bold.ttf`, `${S}/Roboto-Bold.ttf`);

  // Kesilen ölü bekleme aralıkları (kayıt zamanı): sonraki tüm zamanlar o kadar öne çekilir.
  const cuts = (T.cuts ?? []).slice().sort((x, y) => x.a - y.a);
  const adj = (t) => +(t - cuts.reduce((s, c) => s + Math.min(Math.max(t - c.a, 0), c.b - c.a), 0)).toFixed(2);
  const rawEnd = T.end;
  T.events.forEach((e) => (e.t = adj(e.t)));
  T.zooms.forEach((z) => {
    z.a = adj(z.a);
    if (z.b != null) z.b = adj(z.b);
  });
  T.swapAt = adj(T.swapAt);
  T.end = adj(T.end);
  // Kayıttan kesilecek kareler: kayıt-zamanında [a,b] aralıkları atılır, kalanlar yeniden numaralanır.
  const dropExpr = cuts.length ? cuts.map((c) => `between(t,${c.a},${c.b})`).join("+") : "";
  const sonuc = T.resultCard && existsSync(T.resultCard.png) ? T.resultCard : null;

  const even = (n) => Math.round(n / 2) * 2;
  const D = T.end;
  // "Önce sonuç" kurgusu: video, bitmiş dosyanın/rakamın gösterildiği 3,4 sn'lik bir açılışla başlar; sonda ayrı sonuç sahnesi yok.
  const RF = intro.resultFirst && (sonuc || T.stat) ? intro.resultFirst : null;
  const I = RF ? 3.4 : 2.0; // giriş kartı
  const O = 3.0; // kapanış kartı
  const hasRes = !RF && !!(sonuc || T.stat);
  const R = hasRes ? 3.8 : 0; // sonuç sahnesi (indirilen dosyanın gerçek görünümü)
  const TOTAL = +(I + D + R + O).toFixed(2);

  // ---- Kesim (araç bölümü) ----
  const cx = even(T.formBox.x - 14);
  const cw = even(T.formBox.w + 28);
  const y1 = even(T.formBox.y - 14);
  const btnBottom = T.btnBoxFinal.y + T.btnBoxFinal.height;
  // Kesit çok kısaysa (ör. OCR: yalnız yükleme alanı + düğme) video ince bir şeride düşer, altında geniş siyah boşluk kalır.
  // Sayfanın devamı da kesite katılır (en az ~760 px yüksekliğinde görünsün).
  const minCh = even((760 * cw) / 960);
  const ch = Math.min(even(T.VH - y1), Math.max(even(btnBottom + 14 - y1), minCh));
  const y2 = Math.max(0, even(T.resultBox.y - 135));
  const ch2 = even(640);
  const swap = +(T.swapAt - 0.05).toFixed(2);

  // Kesit çok uzunsa (görsel ızgaralı araçlar) videonun genişliği küçülür: altındaki yazı paneliyle çakışmasın.
  const MAXH = 880;
  const VW1 = Math.min(940, even((MAXH * cw) / ch)), VH1 = even((ch * VW1) / cw), VX1 = even((1080 - VW1) / 2), VY1 = 332;
  const VW2 = Math.min(960, even((MAXH * cw) / ch2)), VH2 = even((ch2 * VW2) / cw), VX2 = even((1080 - VW2) / 2), VY2 = 332;

  // Çerçeve görselleri (degrade arka plan, tarayıcı penceresi, köşe maskesi, kapanış düğmesi): fixtures/make-chrome.py
  const py = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  const chromeRun = spawnSync(
    py,
    ["-I", resolve(here, "../fixtures/make-chrome.py"), `${S}/chrome`, `${publicDir}/fonts`, String(VW1), String(VH1), String(VW2), String(VH2)],
    { encoding: "utf8" },
  );
  if (chromeRun.status !== 0) throw new Error(`Çerçeve görselleri üretilemedi: ${(chromeRun.stderr || "").slice(0, 600)}`);
  const BAR = 48, PAD = 12, SHADOW = 70; // make-chrome.py ile aynı olmalı
  const FX1 = VX1 - PAD - SHADOW, FY1 = VY1 - BAR - PAD - SHADOW;
  const FX2 = VX2 - PAD - SHADOW, FY2 = VY2 - BAR - PAD - SHADOW;

  const ACC = "0x38bdf8", GREEN = "0x34d399", SOFT = "0xcbd5e1";
  const fontfile = "fontfile=Roboto-Bold.ttf:expansion=none";
  const fit = (text, base, maxW = 900) => Math.max(30, Math.min(base, Math.floor(maxW / (Math.max(1, text.length) * 0.53))));

  const filters = [];
  let n = 0;
  // Metin: [a,b] arasında yumuşak belirip kaybolur.
  // Roboto'da ok (→) glifi yok: başlıkta boş kutu çıkıyordu. Ok, glifi olan DejaVu ile çizilir; yazı tipi
  // bulunamazsa (yerel makine) Roboto'da bulunan "›" kullanılır.
  const arrowFont = [
    process.env.DEJAVU_FONT,
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/DejaVuSans-Bold.ttf",
  ].find((p) => p && existsSync(p));
  if (arrowFont) copyFileSync(arrowFont, `${S}/DejaVuSans-Bold.ttf`);

  const textFile = (str) => {
    const f = `t${n++}.txt`;
    writeFileSync(`${S}/${f}`, str, "utf8");
    return f;
  };
  // Metin: [a,b] arasında yumuşak belirip kaybolur.
  const text = (str, color, size, y, a, b, fade = 0.35) => {
    if (!str) return;
    const alpha = `if(between(t,${a},${b}),min(1,min((t-${a})/${fade},(${b}-t)/${fade})),0)`;
    // Girişte yazı aşağıdan yukarı yumuşakça kayar (26 px).
    const slide = (base) => `'${base}+26*pow(max(0,1-(t-${a})/0.5),2)'`;
    const parts = str.split("→").map((p) => p.trim());
    if (parts.length === 2 && parts[0] && parts[1] && arrowFont) {
      // "PDF → Word": ok tam ortada; sol metin okun soluna, sağ metin okun sağına yaslanır.
      const [l, r] = parts;
      const fs = Math.max(30, Math.min(size, Math.floor(470 / (Math.max(l.length, r.length) * 0.53))));
      const half = Math.round(fs * 0.42) + 20;
      const common = `fontcolor=${color}:fontsize=${fs}:y=${slide(y)}:alpha='${alpha}'`;
      filters.push(`drawtext=${fontfile}:textfile=${textFile(l)}:${common}:x=(w/2-${half}-text_w)`);
      // Ok biraz büyük ve aşağıda: DejaVu'nun oku Roboto harflerinin ortasına oturur (gözle ayarlandı).
      const arrowFs = Math.round(fs * 1.15);
      const arrowY = Math.round(Number(y) + fs * 0.08);
      filters.push(
        `drawtext=fontfile=DejaVuSans-Bold.ttf:expansion=none:textfile=${textFile("→")}:fontcolor=${color}:fontsize=${arrowFs}:y=${slide(arrowY)}:alpha='${alpha}':x=(w-text_w)/2`,
      );
      filters.push(`drawtext=${fontfile}:textfile=${textFile(r)}:${common}:x=(w/2+${half})`);
      return;
    }
    const plain = str.replace(/\s*→\s*/g, " › ");
    filters.push(
      `drawtext=${fontfile}:textfile=${textFile(plain)}:fontcolor=${color}:fontsize=${fit(plain, size)}:x=(w-text_w)/2:y=${slide(y)}:alpha='${alpha}'`,
    );
  };

  // ---- Ana bölüm: üst marka çubuğu + alt metin paneli ----
  const MS = +I.toFixed(2), ME = +(I + D).toFixed(2);
  // panel
  filters.push(`drawbox=x=40:y=1240:w=1000:h=244:color=0x0d1630@0.96:t=fill:enable='between(t,${MS},${ME})'`);
  filters.push(`drawbox=x=40:y=1240:w=1000:h=6:color=0x1e2d52@1:t=fill:enable='between(t,${MS},${ME})'`);
  // alan adı (sağ üst, logonun yanında)
  writeFileSync(`${S}/domain.txt`, "pdfplatform.app", "utf8");
  filters.push(
    `drawtext=${fontfile}:textfile=domain.txt:fontcolor=${ACC}:fontsize=44:x=1020-text_w:y=186:enable='between(t,${RF ? 0 : MS},${(ME + R).toFixed(2)})'`,
  );

  T.events.forEach((e, i) => {
    const a = +(MS + e.t).toFixed(2);
    const b = +(MS + (i + 1 < T.events.length ? T.events[i + 1].t : D)).toFixed(2);
    if (!RF) text(e.label, "0x7dd3fc", 28, 1262, a, b);
    text(e.title, "white", 56, 1298, a, b);
    text(e.l1, e.accent === "green" ? GREEN : ACC, 50, 1372, a, b);
    text(e.l2, e.accent === "green" ? "white" : SOFT, 40, 1430, a, b);
  });

  // ---- Giriş kartı ----
  if (RF) {
    // Açılış: önce sonuç. Üstte kısa başlık, ortada gerçek çıktı kartı, altta rakam ya da tek cümlelik söz.
    text(RF.top, "white", 78, 300, 0, I, 0.3);
    if (RF.sub) text(RF.sub, "0x7dd3fc", 52, 410, 0, I, 0.3);
    if (T.stat) {
      text(T.stat.big, GREEN, sonuc ? 130 : 220, sonuc ? 1440 : 640, 0.4, I, 0.3);
      text(T.stat.small, "white", sonuc ? 40 : 56, sonuc ? 1600 : 1000, 0.4, I, 0.3);
    } else {
      text(RF.bottom, GREEN, 76, 1450, 0.4, I, 0.3);
      if (RF.bottom2) text(RF.bottom2, "white", 44, 1580, 0.4, I, 0.3);
    }
  } else {
    text(intro.hook ?? "Adım adım nasıl yapılır?", ACC, 50, 560, 0, I, 0.6);
    text(intro.title, "white", 96, 960, 0, I, 0.6);
    text("pdfplatform.app", ACC, 66, 1075, 0, I, 0.6);
    text(intro.sub, SOFT, 46, 1175, 0, I, 0.6);
  }
  // ---- Kapanış kartı ----
  const RS = +ME.toFixed(2), RE = +(ME + R).toFixed(2);
  if (hasRes) {
    text("İşte sonuç", "white", 88, 330, RS, RE, 0.4);
    if (sonuc) text("Hazır dosyan tam olarak böyle görünür", "0x7dd3fc", 40, 440, RS, RE, 0.4);
    if (T.stat) {
      // Büyük rakam: sonuçtaki gerçek sayı (ör. %91 küçüldü) sayfadan okunur, uydurulmaz.
      text(T.stat.big, GREEN, sonuc ? 130 : 220, sonuc ? 1440 : 640, RS + 0.5, RE, 0.4);
      text(T.stat.small, "white", sonuc ? 40 : 56, sonuc ? 1600 : 1000, RS + 0.5, RE, 0.4);
      if (!sonuc) text("küçüldü", "0x7dd3fc", 64, 900, RS + 0.5, RE, 0.4);
    }
    text("pdfplatform.app", ACC, 56, T.stat && sonuc ? 1730 : 1520, RS, RE, 0.4);
  }
  const OS = RE, OE = TOTAL;
  text("pdfplatform.app", ACC, 84, 930, OS, OE, 0.6);
  text("PDF Sıkıştır · Birleştir · Böl · Dönüştür", SOFT, 44, 1035, OS, OE, 0.6);
  text(linkLine, "white", 58, 1120, OS, OE, 0.6);

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
  const zf1 = zoomFilter(wins1, { cropX: cx, cropY: y1, cropW: cw, viewW: VW1, viewH: VH1 });
  const zf2 = zoomFilter(wins2, { cropX: cx, cropY: y2, cropW: cw, viewW: VW2, viewH: VH2, maxZ: 1.25 });
  console.log("ZOOM", wins1.length, "+", wins2.length, "pencere");

  // ---- Girdi sırası: 0 arka plan, 1 kayıt, 2 müzik, 3-5 logolar, 6 sonuç kartı (varsa), sonra çerçeve katmanları ----
  let nextIn = sonuc ? 7 : 6;
  const IN = { glow: nextIn++, fr1: nextIn++, fr2: nextIn++, mk1: nextIn++, mk2: nextIn++, pbar: nextIn++, cta: nextIn++, sfx: nextIn++ };
  const LS = RF ? 0 : MS; // küçük logonun belirdiği an
  const CS = RF ? 0 : RS, CE = RF ? I : RE; // sonuç kartının görüldüğü aralık
  const OSs = +(MS + swap).toFixed(2); // ikinci bölümün başladığı an (mutlak)
  const SW = OSs;

  const filter = [
    // hareketli ışık lekesi (arka plan canlı dursun)
    `[0:v][${IN.glow}:v]overlay=x='(W-w)/2+260*sin(t*0.35)':y='760+460*cos(t*0.27)-h/2':shortest=0[g0]`,
    // pencere çerçeveleri
    `[${IN.fr1}:v]format=rgba,setpts=PTS+${MS}/TB,fade=t=in:st=${MS}:d=0.5:alpha=1[fr1]`,
    `[${IN.fr2}:v]format=rgba[fr2]`,
    `[g0][fr1]overlay=x=${FX1}:y=${FY1}:enable='between(t,${MS},${SW})':eof_action=pass[g1]`,
    `[g1][fr2]overlay=x=${FX2}:y=${FY2}:enable='between(t,${SW},${ME})':eof_action=pass[g2]`,
    // ana video akışı
    `[1:v]trim=start=${T.start}:end=${(T.start + rawEnd + 0.1).toFixed(2)},setpts=PTS-STARTPTS,fps=30${dropExpr ? `,select='not(${dropExpr})',setpts=N/(30*TB)` : ""},split=2[s1][s2]`,
    `[s1]crop=w=${cw}:h=${ch}:x=${cx}:y=${y1},${zf1},format=rgba[a1]`,
    `[s2]crop=w=${cw}:h=${ch2}:x=${cx}:y=${y2},${zf2},format=rgba[a2]`,
    `[${IN.mk1}:v]format=gray[m1]`,
    `[${IN.mk2}:v]format=gray[m2]`,
    `[a1][m1]alphamerge,setpts=PTS+${MS}/TB,fade=t=in:st=${MS}:d=0.5:alpha=1[v1]`,
    `[a2][m2]alphamerge,setpts=PTS+${MS}/TB,fade=t=in:st=${SW}:d=0.3:alpha=1[v2]`,
    // logolar
    `[3:v]scale=800:-1,format=rgba,fade=t=in:st=0:d=0.6:alpha=1,fade=t=out:st=${(I - 0.6).toFixed(2)}:d=0.6:alpha=1[lgi]`,
    `[4:v]scale=300:-1,format=rgba,setpts=PTS+${LS}/TB,fade=t=in:st=${LS}:d=0.6:alpha=1[lgt]`,
    `[5:v]scale=800:-1,format=rgba,setpts=PTS+${OS}/TB,fade=t=in:st=${OS}:d=0.6:alpha=1[lgo]`,
    // birleştirme
    `[g2][v1]overlay=x=${VX1}:y=${VY1}:enable='between(t,${MS},${SW})':eof_action=pass[b1]`,
    `[b1][v2]overlay=x=${VX2}:y=${VY2}:enable='between(t,${SW},${ME})':eof_action=pass[b2]`,
    `[b2][lgi]overlay=140:640:enable='${RF ? "lt(t,0)" : `between(t,0,${I})`}':eof_action=pass[b3]`,
    `[b3][lgt]overlay=60:150:enable='between(t,${LS},${RE})':eof_action=pass[b4]`,
    sonuc ? `[6:v]scale=980:-1,format=rgba,setpts=PTS+${CS}/TB,fade=t=in:st=${CS}:d=0.5:alpha=1,fade=t=out:st=${(CE - 0.5).toFixed(2)}:d=0.5:alpha=1[rc]` : "",
    sonuc ? `[b4][rc]overlay=x=(W-w)/2:y=${RF ? 520 : 500}:enable='between(t,${CS},${CE})':eof_action=pass[b4r]` : "",
    `[${sonuc ? "b4r" : "b4"}][lgo]overlay=140:600:enable='between(t,${OS},${OE})':eof_action=pass[b5a]`,
    // kapanış düğmesi
    `[${IN.cta}:v]scale=840:-1,format=rgba,setpts=PTS+${OS}/TB,fade=t=in:st=${(OS + 0.5).toFixed(2)}:d=0.6:alpha=1[cta]`,
    `[b5a][cta]overlay=x=(W-w)/2:y=1230:enable='between(t,${OS},${OE})':eof_action=pass[b5]`,
    `[b5]${filters.join(",")}[o0]`,
    // ilerleme çubuğu: panelin üst çizgisinde, adımlar ilerledikçe dolar
    `[${IN.pbar}:v]scale=w='max(2,trunc(1000*clip((t-${MS})/${D},0,1)/2)*2)':h=6:eval=frame[pb]`,
    `[o0][pb]overlay=x=40:y=1240:enable='between(t,${MS},${ME})':eof_action=pass[o]`,
    // ses: müzik + efektler
    `[2:a][${IN.sfx}:a]amix=inputs=2:normalize=0,alimiter=limit=0.9:level=disabled[aud]`,
  ]
    .filter(Boolean)
    .join(";");

  // Ses efektleri: her tıklamada "tık", bölüm geçişlerinde "vuuş", sonuçta başarı çanı.
  const clickTimes = (T.clicks ?? []).map((c) => +(MS + adj(c)).toFixed(2));
  const sfxFile = makeSfx(ffmpeg, S, TOTAL, {
    clicks: clickTimes,
    whooshes: [MS - 0.25, SW - 0.1, ...(sonuc && !RF ? [RS - 0.1] : []), OS - 0.1],
    chimes: [...(RF ? [0.5] : []), SW + 0.2, ...(sonuc && !RF ? [RS + 0.6] : [])],
  });
  if (!sfxFile) throw new Error("Efekt izi üretilemedi");
  const music = makeMusic(ffmpeg, S, TOTAL);
  const loopImg = (f) => ["-loop", "1", "-framerate", "30", "-t", String(TOTAL), "-i", `chrome/${f}`];
  const args = [
    "-y", "-hide_banner", "-loglevel", "error",
    "-loop", "1", "-framerate", "30", "-t", String(TOTAL), "-i", "chrome/bg.png",
    "-i", `rec/${webm}`,
    "-i", music,
    "-loop", "1", "-t", String(TOTAL), "-i", "logo.png",
    "-loop", "1", "-t", String(TOTAL), "-i", "logo.png",
    "-loop", "1", "-t", String(TOTAL), "-i", "logo.png",
    ...(sonuc ? ["-loop", "1", "-t", String(TOTAL), "-i", sonuc.png] : []),
    ...loopImg("glow.png"),
    ...loopImg("frame1.png"),
    ...loopImg("frame2.png"),
    ...loopImg("mask1.png"),
    ...loopImg("mask2.png"),
    "-f", "lavfi", "-i", `color=c=0x38bdf8:s=1000x6:r=30:d=${TOTAL}`,
    ...loopImg("cta.png"),
    "-i", sfxFile,
    "-filter_complex", filter,
    "-map", "[o]", "-map", "[aud]", "-t", String(TOTAL),
    // Meta Reels şartları: sabit 30 fps, kapalı GOP (2 sn'de bir anahtar kare), 4:2:0,
    // AAC-LC 48 kHz stereo >=128 kbps.
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-r", "30", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0", "-x264-params", "open-gop=0",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", OUT,
  ];
  const t0 = Date.now();
  const run = spawnSync(ffmpeg, args, { cwd: S, encoding: "utf8", maxBuffer: 1 << 27 });
  if (run.status !== 0) throw new Error(run.stderr.slice(0, 3000));
  console.log(`kodlama ${Math.round((Date.now() - t0) / 1000)} sn`);
  console.log("tamam", OUT, { TOTAL, cw, ch, VH1, VH2, y1, y2, swap, MS, ME });
  return { total: TOTAL };
}
