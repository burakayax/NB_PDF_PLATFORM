// Sıcak ve hareketli müzik: tel çekme (akustik), elektrikli piyano, marimba, yuvarlak bas, davul. Cızırtı/yazı sesi yok. Telifsiz (burada üretilir).
const SR = 48000;
const TAU = Math.PI * 2;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
let tohum = 7;
const rast = () => ((tohum = (tohum * 16807) % 2147483647) / 2147483647) * 2 - 1;

// ağır akan işlem anı: [başı, sonu, eklenen saniye] (html dosyalarıyla aynı)
export const AGIR = {"udf-to-pdf":[21.1,22.2,2],"gorsel-sikistir":[20.6,23.3,1.2],"aranabilir-pdf":[20.4,22.6,1],"pdf-to-excel":[23,24.8,1.8]};

function stüdyo(sure) {
  const n = Math.ceil(SR * sure);
  const L = new Float32Array(n), R = new Float32Array(n), G = new Float32Array(n);
  const yaz = (t, dizi, pan = 0, yanki = 0.15) => {
    const i0 = Math.floor(t * SR);
    const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < dizi.length && i0 + i < n; i++) {
      if (i0 + i < 0) continue;
      L[i0 + i] += dizi[i] * l; R[i0 + i] += dizi[i] * r; G[i0 + i] += dizi[i] * yanki;
    }
  };
  const uret = (uz, f) => {
    const d = new Float32Array(Math.floor(uz * SR));
    for (let i = 0; i < d.length; i++) d[i] = f(i / SR, i / d.length) * Math.min(1, (d.length - i) / (SR * 0.02));
    return d;
  };
  // akustik tel (Karplus-Strong)
  const tel = (t, m, vol, uz = 1.1, pan = 0, yanki = 0.18) => {
    const N = Math.round(SR / hz(m));
    const h = new Float32Array(N);
    let y = 0;
    for (let i = 0; i < N; i++) { y += 0.55 * (rast() - y); h[i] = y; }
    let k = 0;
    yaz(t, uret(uz, (s, p) => { const a = h[k], b = h[(k + 1) % N]; h[k] = (a + b) * 0.4975; k = (k + 1) % N; return a * vol * 1.8 * Math.min(1, s / 0.002) * Math.exp(-p * 2.2); }), pan, yanki);
  };
  // elektrikli piyano (yumuşak FM)
  const epiyano = (t, m, vol, uz = 0.9, pan = 0) => {
    const f = hz(m);
    yaz(t, uret(uz, (s, p) => Math.sin(TAU * f * s + 1.4 * Math.exp(-s * 6) * Math.sin(TAU * f * s)) * vol * Math.min(1, s / 0.004) * Math.exp(-p * 3.2) * (1 + 0.12 * Math.sin(TAU * 4.5 * s))), pan, 0.25);
  };
  const akor = (t, notalar, vol, uz, calan = epiyano) => notalar.forEach((m, i) => calan(t + i * 0.008, m, vol, uz, (i / Math.max(1, notalar.length - 1) - 0.5) * 0.7));
  const marimba = (t, m, vol, pan = 0) => {
    const f = hz(m);
    yaz(t, uret(0.55, (s) => (Math.sin(TAU * f * s) * Math.exp(-s * 9) + 0.35 * Math.sin(TAU * f * 3.9 * s) * Math.exp(-s * 32)) * vol * Math.min(1, s / 0.002)), pan, 0.22);
  };
  const bas = (t, m, vol, uz = 0.26) => {
    const f = hz(m);
    yaz(t, uret(uz, (s, p) => Math.tanh(1.8 * (Math.sin(TAU * f * s) + 0.35 * Math.sin(TAU * 2 * f * s) * Math.exp(-s * 12))) * vol * Math.min(1, s / 0.006) * Math.exp(-p * 1.6)), 0, 0);
  };
  const kick = (t, vol) => { let faz = 0; yaz(t, uret(0.3, (s) => { faz += (50 + 105 * Math.exp(-s * 32)) / SR; return Math.sin(TAU * faz) * vol * Math.min(1, s / 0.002) * Math.exp(-s * 11); }), 0, 0); };
  // sıcak el çırpma: kısa, boğuk, arka arkaya üç vuruş
  const alkis = (t, vol, pan = 0.1) => {
    let a = 0, b = 0;
    yaz(t, uret(0.16, (s) => { const x = rast(); a += 0.28 * (x - a); b += 0.1 * (a - b); const zarf = s < 0.03 ? Math.exp(-((s % 0.01) * 330)) : Math.exp(-(s - 0.03) * 34); return (a - b) * 2.2 * vol * zarf; }), pan, 0.3);
  };
  const tahta = (t, vol, m = 79, pan = -0.35) => { const f = hz(m); yaz(t, uret(0.07, (s) => (Math.sin(TAU * f * s) + 0.5 * Math.sin(TAU * f * 1.51 * s)) * vol * Math.min(1, s / 0.001) * Math.exp(-s * 70)), pan, 0.15); };
  const tom = (t, m, vol) => { const f = hz(m); yaz(t, uret(0.3, (s) => Math.sin(TAU * f * s * (1 + 0.4 * Math.exp(-s * 25))) * vol * Math.min(1, s / 0.002) * Math.exp(-s * 12)), 0.2, 0.2); };
  const ped = (t, uz, notalar, vol) => notalar.forEach((m, i) => [-0.06, 0.06].forEach((d, j) => { const f = hz(m + d); yaz(t, uret(uz, (s, p) => (Math.sin(TAU * f * s) + 0.25 * Math.sin(TAU * 2 * f * s)) * vol * Math.min(1, p / 0.25, (1 - p) / 0.3)), j ? 0.5 : -0.5, 0.3); }));
  // ekran olayları
  const tik = (t) => { marimba(t, 84, 0.14); marimba(t + 0.05, 91, 0.08); };
  const olumsuz = (t) => { epiyano(t, 58, 0.2, 0.35); epiyano(t + 0.17, 53, 0.22, 0.6); tom(t, 38, 0.2); };
  const basari = (t, kok = 72) => { [0, 4, 7, 12, 16].forEach((a, i) => { marimba(t + i * 0.07, kok + a, 0.2, (i - 2) * 0.2); epiyano(t + i * 0.07, kok + a - 12, 0.07, 1.4); }); kick(t, 0.35); };
  // güvenlik anı: dolgun kilit vuruşu + sıcak iki çan
  const kilit = (t) => { kick(t + 0.45, 0.55); tahta(t + 0.45, 0.2, 67, 0); [[0.55, 74], [0.85, 81]].forEach(([g, m]) => { epiyano(t + g, m, 0.17, 2.2); marimba(t + g, m + 12, 0.08); }); };
  // bölümden önce kısa davul geçişi
  const gecis = (t) => [0, 0.14, 0.28, 0.38, 0.45].forEach((g, i) => tom(t - 0.55 + g, 50 - i * 2, 0.16 + i * 0.03));

  const bitir = () => {
    for (const [kanal, gecikmeler] of [[L, [0.067, 0.103, 0.149]], [R, [0.079, 0.121, 0.167]]]) {
      for (const g of gecikmeler) {
        const d = Math.floor(g * SR), h = new Float32Array(n);
        let y = 0;
        for (let i = d; i < n; i++) { y += 0.45 * (G[i - d] + h[i - d] * 0.4 - y); h[i] = y; kanal[i] += y * 0.28; }
      }
    }
    const son = Math.floor(SR * 0.9);
    for (let i = 0; i < son; i++) { L[n - 1 - i] *= i / son; R[n - 1 - i] *= i / son; }
    return [L, R];
  };
  return { tel, epiyano, akor, marimba, bas, kick, alkis, tahta, tom, ped, tik, olumsuz, basari, kilit, gecis, bitir };
}

// vuruş ızgarası: f(zaman, on altılık sıra, ölçü sırası, bir on altılığın süresi)
function izgara(bpm, bas, son, f) {
  const a = 60 / bpm / 4;
  for (let i = 0; bas + i * a < son; i++) f(bas + i * a + (i % 2 ? a * 0.12 : 0), i % 16, Math.floor(i / 16), a);
}

function hazirla(ad, sure) {
  const s = stüdyo(sure);
  const [a, b, x] = AGIR[ad];
  const z = (t) => (t < a ? t : t < b ? a + ((t - a) * (b - a + x)) / (b - a) : t + x); // sahne zamanı -> video zamanı
  // gizlilik cümlesi belirirken yumuşak, iki notalık sıcak bir işaret (müziği kesmez)
  [[0.15, 79], [0.35, 86]].forEach(([g, n]) => s.marimba(z(a) + g, n, 0.13));
  const V = {"udf-to-pdf":37,"gorsel-sikistir":34.2,"aranabilir-pdf":35,"pdf-to-excel":36.8}[ad];
  s.basari(V + 0.1, 72);
  for (let i = 0; i < 8; i++) s.marimba(V + 0.65 + i * 0.16, [72, 76, 79, 84][i % 4], 0.09, i % 2 ? 0.4 : -0.4);
  s.basari(V + 2.65, 77);
  s.tik(V + 4.3);
  return { s, z };
}

export const SESLER = {
  // UDF: funk-pop; sorunda hafif ve meraklı, çözümde tam ritim.
  "udf-to-pdf"(sure) {
    const { s, z } = hazirla("udf-to-pdf", sure);
    const kokler = [45, 41, 48, 43];
    const akorlar = [[57, 60, 64, 67], [57, 60, 65, 69], [55, 60, 64, 71], [55, 59, 62, 69]];
    izgara(108, 0.1, sure - 1.6, (t, i, o) => {
      const k = o % 4, dolu = t >= z(18.9);
      if (i === 0 || i === 8 || (dolu && (i === 4 || i === 12))) s.kick(t, dolu ? 0.5 : 0.32);
      if (i === 4 || i === 12) s.alkis(t, dolu ? 0.3 : 0.16);
      if (i % 2 === 0 && t > 4) s.tahta(t, i % 4 === 2 ? 0.07 : 0.035, 91);
      if ([0, 3, 6, 10, 11, 14].includes(i)) s.bas(t, kokler[k] - 12 + ([6, 14].includes(i) ? 12 : 0), 0.26, 0.2);
      if ([2, 7, 10].includes(i)) s.akor(t, akorlar[k], dolu ? 0.085 : 0.06, i === 10 ? 0.7 : 0.3);
      if (dolu && [0, 3, 6, 8, 11, 14].includes(i)) s.tel(t, akorlar[k][[0, 2, 1, 3, 2, 3][[0, 3, 6, 8, 11, 14].indexOf(i)]] + 12, 0.11, 0.6, 0.45);
    });
    [2.0, 6.3, 19.9, 29.6].forEach((t) => s.tik(z(t)));
    s.olumsuz(z(8.2));
    [14.2, 15.7, 17.2].forEach((t) => s.olumsuz(z(t)));
    s.basari(z(23.6), 72);
    s.basari(z(31.7), 72);
    return s.bitir();
  },

  // Fotoğraf: neşeli ukulele tadında tel, marimba ezgisi, el çırpma.
  "gorsel-sikistir"(sure) {
    const { s, z } = hazirla("gorsel-sikistir", sure);
    const akorlar = [[60, 64, 67, 72], [57, 60, 64, 69], [57, 60, 65, 69], [59, 62, 67, 71]];
    const kokler = [48, 45, 41, 43];
    const ezgi = [76, 0, 79, 0, 0, 81, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0];
    izgara(116, 0.1, sure - 1.6, (t, i, o) => {
      const k = o % 4, dolu = t >= z(17.9);
      if ([0, 4, 6, 10, 12, 14].includes(i)) akorlar[k].forEach((m, j) => s.tel(t + j * 0.014, m, [6, 14].includes(i) ? 0.055 : 0.085, 0.45, -0.3 + j * 0.15));
      if (i === 0 || i === 8) { s.kick(t, 0.42); s.bas(t, kokler[k] - 12, 0.24, 0.34); }
      if (i === 6 || i === 14) s.bas(t, kokler[k] - 5, 0.18, 0.16);
      if (i === 4 || i === 12) s.alkis(t, dolu ? 0.3 : 0.2);
      if (ezgi[i] && (dolu || o % 2 === 0)) s.marimba(t, ezgi[i] + [0, -3, -2, -1][k], dolu ? 0.15 : 0.1, 0.35);
      if (dolu && i % 4 === 2) s.tahta(t, 0.09, 84);
    });
    [3.4, 17.6, 19.0, 20.0, 25.7].forEach((t) => s.tik(z(t)));
    [5.9, 10.7, 14.5].forEach((t) => s.olumsuz(z(t)));
    s.basari(z(23.4), 72);
    s.basari(z(26.6), 76);
    s.basari(z(29.0), 72);
    return s.bitir();
  },

  // Aranabilir PDF: sıcak akustik gitar arpeji; adım adım davul katılıp yükselir.
  "aranabilir-pdf"(sure) {
    const { s, z } = hazirla("aranabilir-pdf", sure);
    const akorlar = [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [53, 57, 60, 65, 69], [48, 55, 60, 64, 67]];
    const sira = [0, 1, 2, 3, 4, 3, 2, 3];
    izgara(100, 0.1, sure - 1.6, (t, i, o) => {
      const k = o % 4, a = akorlar[k], dolu = t >= z(17.4);
      if (i % 2 === 0) s.tel(t, a[sira[i / 2]] + 12, i % 8 === 0 ? 0.17 : 0.12, 1.2, (sira[i / 2] - 2) * 0.22);
      if (i === 0) { s.bas(t, a[0] - 12, 0.24, 0.7); s.akor(t, a.slice(1, 4).map((m) => m + 12), 0.045, 1.6); }
      if (t > 4 && (i === 0 || i === 10 || (dolu && i === 8))) s.kick(t, dolu ? 0.46 : 0.28);
      if (t > z(9.2) && (i === 4 || i === 12)) s.alkis(t, dolu ? 0.24 : 0.12);
      if (dolu && i % 2 === 0) s.tahta(t, i % 4 === 2 ? 0.065 : 0.03, 88);
      if (dolu && i === 8) s.bas(t, a[0] - 5, 0.18, 0.3);
      if (t >= z(24.6) && [0, 6, 12].includes(i)) s.marimba(t, a[[2, 3, 4][i / 6]] + 24, 0.1, -0.25);
    });
    s.olumsuz(z(7.4));
    s.olumsuz(z(15.9));
    s.tik(z(25.3));
    s.basari(z(26.7), 74);
    s.tik(z(28.1));
    s.basari(z(30.4), 77);
    return s.bitir();
  },

  // Excel: hareketli dans ritmi; sorunda sade, çözümde dörtlük vuruş ve parlak ezgi.
  "pdf-to-excel"(sure) {
    const { s, z } = hazirla("pdf-to-excel", sure);
    const kokler = [45, 41, 48, 43];
    const akorlar = [[57, 60, 64, 69], [57, 60, 65, 69], [55, 60, 64, 67], [55, 59, 62, 67]];
    izgara(120, 0.1, sure - 1.6, (t, i, o) => {
      const k = o % 4, dolu = t >= z(20.4), durgun = t > z(11.8) && t < z(13.2);
      if (durgun) return;
      if (i % 4 === 0 && (dolu || i % 8 === 0)) s.kick(t, dolu ? 0.55 : 0.34);
      if (i % 4 === 2) { s.bas(t, kokler[k] - 12, 0.26, 0.2); s.tahta(t, dolu ? 0.1 : 0.055, 93); }
      if (i === 4 || i === 12) s.alkis(t, dolu ? 0.32 : 0.14);
      if ([3, 6, 11, 14].includes(i)) s.akor(t, akorlar[k], dolu ? 0.08 : 0.05, 0.28);
      if (dolu && i % 2 === 0) s.marimba(t, akorlar[k][[0, 2, 3, 1, 2, 3, 1, 2][i / 2]] + 12, 0.1, i % 4 ? 0.4 : -0.4);
    });
    for (let t = 4.6; t < 10.8; t += 0.5) s.marimba(z(t), 81, 0.05, 0.2);
    s.olumsuz(z(12.0));
    s.olumsuz(z(18.3));
    s.tik(z(21.2));
    s.basari(z(26.4), 72);
    s.basari(z(31.4), 76);
    return s.bitir();
  },
};

export function wav([L, R]) {
  const out = Buffer.alloc(44 + L.length * 4);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + L.length * 4, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(L.length * 4, 40);
  let tepe = 0;
  for (const b of [L, R]) for (const v of b) tepe = Math.max(tepe, Math.abs(v));
  const k = tepe ? 0.85 / tepe : 1;
  for (let i = 0; i < L.length; i++) {
    out.writeInt16LE(Math.round(L[i] * k * 32767), 44 + i * 4);
    out.writeInt16LE(Math.round(R[i] * k * 32767), 46 + i * 4);
  }
  return out;
}
