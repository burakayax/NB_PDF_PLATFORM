/**
 * Çöküş bekçisi (watchdog) — Cloudflare Worker, ÜCRETSİZ plan.
 *
 * Her 5 dakikada siteyi kontrol eder ve YALNIZ "ne yapardım" kaydı tutar.
 *
 * GÖLGE MODU (bu dosyada GERÇEK GERİ ALMA KODU HİÇ YOKTUR):
 *   - Render'a ya da GitHub'a YAZMAZ; Render anahtarı kullanmaz. Yalnız GET isteği atar.
 *   - Tek yazdığı yer kendi R2 klasörü (bekci/). E-posta atmaz; anlık haber UptimeRobot'tan gelir,
 *     bu kayıt ertesi sabahki özete girer.
 *   - Yapay zekâ YOK. Karar yalnız aşağıdaki 4 kuralla verilir.
 *
 * KARAR KURALLARI (hepsi doğruysa kayıt "GERİ ALIRDIM" olur; yoksa "GERİ ALMAZDIM"):
 *   1. Art arda en az 3 kontrol başarısız.
 *   2. Kesinti, main'e son birleştirmeden en çok ~60 dakika sonra başlamış.
 *   3. Site, kesintiden önceki 24 saatte sağlıklıymış (en az 12 saatlik kayıt, başarısızlık <= %1).
 *   4. O birleştirmede veritabanı değişikliği yok (web/api/prisma/ altında dosya yok).
 *
 * Kurulum (kopyala-yapıştır): docs/rehber/19-CLOUDFLARE-BEKCI.md. Ortam: R2 bağlantısı adı BUCKET.
 */

export const MOD = "golge";
export const ESIKLER = {
  ardArdaBasarisiz: 3,
  pencereDk: 60,
  saglikliSaat: 24,
  minGecmisSaat: 12,
  azamiBasarisizOran: 0.01,
  kayitTutSaat: 26,
  azamiOlay: 20,
};
const REPO = "burakayax/NB_PDF_PLATFORM";
const DB_YOLU = "web/api/prisma/";
const DK = 60000;

export function kurallariDegerlendir({ basladi, history, merge, mergeDosyalar, esik = ESIKLER }) {
  const kurallar = [];
  const gecmis = history.filter((h) => h.t < basladi && h.t >= basladi - esik.saglikliSaat * 3600000);
  const ilk = gecmis.length ? Math.min(...gecmis.map((h) => h.t)) : basladi;
  const kayitSaat = (basladi - ilk) / 3600000;
  const basarisiz = gecmis.filter((h) => !h.ok).length;
  const oran = gecmis.length ? basarisiz / gecmis.length : 1;

  // 1. art arda başarısızlık (çağıran zaten >= eşik iken değerlendirir; yine de kayda geçer)
  kurallar.push({ ad: "art-arda-hata", tamam: true, aciklama: `Art arda en az ${esik.ardArdaBasarisiz} kontrol başarısız.` });

  // 2. son birleştirmeden sonra başlama
  if (!merge) {
    kurallar.push({ ad: "son-birlestirme-yakin", tamam: false, aciklama: "Son birleştirme bilgisi alınamadı." });
  } else {
    const fark = (basladi - merge.t) / DK;
    const tamam = fark >= 0 && fark <= esik.pencereDk;
    kurallar.push({ ad: "son-birlestirme-yakin", tamam, aciklama: tamam ? `Kesinti son birleştirmeden ${Math.round(fark)} dk sonra başladı.` : `Kesinti son birleştirmeden ${Math.round(fark)} dk sonra başladı (sınır ${esik.pencereDk} dk).` });
  }

  // 3. kesintiden önce sağlıklıymış
  const saglikli = kayitSaat >= esik.minGecmisSaat && oran <= esik.azamiBasarisizOran;
  kurallar.push({
    ad: "once-saglikliydi",
    tamam: saglikli,
    aciklama: kayitSaat < esik.minGecmisSaat ? `Öncesine ait kayıt yetersiz (${kayitSaat.toFixed(1)} saat).` : `Önceki ${esik.saglikliSaat} saatte başarısızlık oranı %${(oran * 100).toFixed(1)}.`,
  });

  // 4. veritabanı değişikliği yok
  if (!mergeDosyalar) {
    kurallar.push({ ad: "veritabani-degisikligi-yok", tamam: false, aciklama: "Birleştirmenin değişen dosyaları alınamadı; güvenli tarafta kalınır." });
  } else {
    const db = mergeDosyalar.some((f) => String(f).startsWith(DB_YOLU));
    kurallar.push({ ad: "veritabani-degisikligi-yok", tamam: !db, aciklama: db ? "O birleştirmede veritabanı (prisma) dosyası değişmiş." : "O birleştirmede veritabanı dosyası değişmemiş." });
  }

  const karar = kurallar.every((k) => k.tamam) ? "GERI_ALIRDIM" : "GERI_ALMAZDIM";
  return { karar, kurallar };
}

async function kontrolleriYap(env, fetchFn) {
  const api = env.API_BASE || "https://api.pdfplatform.app";
  const site = env.SITE_URL || "https://pdfplatform.app";
  const bir = async (url) => {
    try {
      const r = await fetchFn(url, { signal: AbortSignal.timeout(10000), headers: { "user-agent": "pdfplatform-bekci" }, redirect: "follow" });
      return r.status === 200;
    } catch {
      return false;
    }
  };
  const [apiOk, dbOk, siteOk] = await Promise.all([bir(`${api}/api/health`), bir(`${api}/api/health/db`), bir(`${site}/`)]);
  return { ok: apiOk && dbOk && siteOk, detay: { api: apiOk, db: dbOk, site: siteOk } };
}

async function githubSonBirlestirme(basladi, fetchFn) {
  const h = { accept: "application/vnd.github+json", "user-agent": "pdfplatform-bekci" };
  const get = async (u) => {
    const r = await fetchFn(`https://api.github.com/repos/${REPO}${u}`, { headers: h, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    return r.json();
  };
  try {
    const list = await get("/commits?sha=main&per_page=20");
    const m = list.find((c) => /^Merge pull request/.test(c.commit?.message || "") && Date.parse(c.commit?.committer?.date) <= basladi);
    if (!m) return { merge: null, dosyalar: null };
    const satirlar = String(m.commit.message).split("\n").filter(Boolean);
    const merge = { sha: m.sha.slice(0, 7), baslik: (satirlar[1] || satirlar[0] || "").slice(0, 100), t: Date.parse(m.commit.committer.date) };
    let dosyalar = null;
    try {
      const d = await get(`/commits/${m.sha}`);
      // GitHub çok dosyada listeyi keser; eksik liste "bilinmiyor" sayılır (güvenli taraf).
      dosyalar = Array.isArray(d.files) && d.files.length < 300 ? d.files.map((f) => f.filename) : null;
    } catch {
      dosyalar = null;
    }
    return { merge, dosyalar };
  } catch {
    return { merge: null, dosyalar: null };
  }
}

async function oku(bucket, key, bos) {
  try {
    const o = await bucket.get(key);
    if (!o) return bos;
    return JSON.parse(await o.text());
  } catch {
    return bos;
  }
}

/** Tek bir kontrol turu. Test edilebilsin diye env ve fetch dışarıdan verilir. */
export async function kontrolEt(env, fetchFn = fetch, now = Date.now()) {
  const bucket = env.BUCKET;
  if (!bucket) throw new Error("R2 bağlantısı (BUCKET) tanımlı değil");
  const esik = ESIKLER;
  const durum = await oku(bucket, "bekci/durum.json", { history: [], streak: 0, basladi: null, olayBasladi: null });
  const kayit = await oku(bucket, "bekci/kayit.json", { golge: true, olaylar: [] });

  const { ok, detay } = await kontrolleriYap(env, fetchFn);
  durum.history = [...(durum.history || []), { t: now, ok }].filter((h) => h.t >= now - esik.kayitTutSaat * 3600000);

  if (ok) {
    if (durum.olayBasladi) {
      const o = kayit.olaylar.find((x) => x.basladi === durum.olayBasladi);
      if (o && !o.bitti) { o.bitti = now; o.sureDk = Math.round((now - o.basladi) / DK); }
    }
    durum.streak = 0; durum.basladi = null; durum.olayBasladi = null;
  } else {
    durum.streak = (durum.streak || 0) + 1;
    if (durum.streak === 1) durum.basladi = now;
    if (durum.streak >= esik.ardArdaBasarisiz && !durum.olayBasladi) {
      const { merge, dosyalar } = await githubSonBirlestirme(durum.basladi, fetchFn);
      const sonuc = kurallariDegerlendir({ basladi: durum.basladi, history: durum.history, merge, mergeDosyalar: dosyalar });
      durum.olayBasladi = durum.basladi;
      kayit.olaylar.push({ basladi: durum.basladi, bitti: null, sureDk: null, karar: sonuc.karar, kurallar: sonuc.kurallar, sonBirlestirme: merge ? { sha: merge.sha, baslik: merge.baslik } : null, detay });
      kayit.olaylar = kayit.olaylar.slice(-esik.azamiOlay);
    }
  }

  const son24 = durum.history.filter((h) => h.t >= now - 24 * 3600000);
  kayit.golge = true;
  kayit.mod = MOD;
  kayit.guncelleme = now;
  kayit.son24 = { kontrol: son24.length, basarisiz: son24.filter((h) => !h.ok).length };
  kayit.sonDetay = detay;
  await bucket.put("bekci/durum.json", JSON.stringify(durum), { httpMetadata: { contentType: "application/json" } });
  await bucket.put("bekci/kayit.json", JSON.stringify(kayit), { httpMetadata: { contentType: "application/json" } });
  return { ok, streak: durum.streak };
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(kontrolEt(env).catch(() => {}));
  },
  // Dışarıya hiçbir şey göstermez.
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};
