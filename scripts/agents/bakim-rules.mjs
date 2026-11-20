/**
 * Yazılım bakım ajanı: KURAL TABANLI sınıflandırma (saf fonksiyonlar; ağ/dosya yok, test edilebilir).
 * Karar kurallardadır; yapay zekâ yalnızca sonucu sade Türkçe anlatır.
 * GÖLGE MODU: bu dosya hiçbir şeyi değiştirmez, birleştirmez, yorum yazmaz. Yalnız sınıflar ve öneri metni üretir.
 * Girdi olarak PR gövdesi/sürüm notu OKUNMAZ (dışarıdan gelen metin = talimat enjeksiyonu riski); yalnız başlık,
 * dosya adları ve CI sonucu kullanılır.
 */

export const GRUPLAR = {
  guvenli: "Güvenli",
  dikkatli: "Dikkatli",
  riskli: "Riskli",
  kritik: "Kritik alan",
  ci: "CI dosyası",
  masaustu: "Yalnız masaüstü paketleme",
};

// Giriş, ödeme, veritabanı, şifre ve istek işleme gibi alanlara dokunan paketler.
const KRITIK = /^(prisma|@prisma\/client|express|bcrypt|bcryptjs|@types\/bcryptjs|jsonwebtoken|@types\/jsonwebtoken|iyzipay|passport(-.+)?|helmet|cors|cookie-parser|express-rate-limit)$/;
// PDF işleme/önizleme motorları.
const PDF_MOTOR = /^(pdfjs-dist|pymupdf|pypdf|pikepdf|pdf-lib|pdf2docx|reportlab|fitz)$/;
// Yalnız masaüstü uygulamasını paketleyen araçlar.
const MASAUSTU = /^(pyinstaller|pywin32|customtkinter)$/;
// Yalnız geliştirme/test sırasında kullanılan araçlar (canlı siteyi etkilemez).
const GELISTIRME = /^(concurrently|pytest|eslint|vitest|prettier|ruff|tsx)$/;
// Büyük sürümde ayrıca dikkat isteyen ama kritik olmayan paketler.
const DIKKAT_PAKET = /^(typescript|@types\/node|redis|sendgrid|@sendgrid\/mail)$/;

/** "deps(api): bump prisma from 6.19.3 to 7.8.0 in /web/api" gibi başlığı ayrıştırır. */
export function parseTitle(title) {
  const t = String(title || "");
  let m = /(?:bump|Bump)\s+(\S+)\s+from\s+([\w.\-+]+)\s+to\s+([\w.\-+]+)/.exec(t);
  if (m) return { tur: "tek", paket: m[1].toLowerCase(), from: m[2], to: m[3] };
  m = /Update\s+(\S+)\s+requirement\s+from\s+[><=~!^]*\s*([\w.\-+]+)\s+to\s+[><=~!^]*\s*([\w.\-+]+)/i.exec(t);
  if (m) return { tur: "tek", paket: m[1].toLowerCase(), from: m[2], to: m[3] };
  if (/the\s+\S+\s+group/i.test(t)) return { tur: "grup", paket: null, from: null, to: null };
  return { tur: "bilinmiyor", paket: null, from: null, to: null };
}

const majorOf = (v) => {
  const m = /^v?(\d+)/.exec(String(v || ""));
  return m ? Number(m[1]) : null;
};

export function isMajor(from, to) {
  const a = majorOf(from);
  const b = majorOf(to);
  return a !== null && b !== null && b > a;
}

/** CI özeti: "yesil" | "kirmizi" | "yok". Atlanan/nötr kontroller sorun sayılmaz. */
export function ciState(checks) {
  if (!Array.isArray(checks) || checks.length === 0) return "yok";
  const bad = checks.some((c) => ["failure", "cancelled", "timed_out", "action_required", "startup_failure"].includes(c.conclusion));
  if (bad) return "kirmizi";
  if (checks.some((c) => c.conclusion === null || c.conclusion === undefined)) return "bekliyor";
  return "yesil";
}

/** Tek bir Dependabot PR'ını gruplara ayırır. pr: {number,title,files:string[],ageDays,checks} */
export function classify(pr) {
  const info = parseTitle(pr.title);
  const files = Array.isArray(pr.files) ? pr.files : [];
  const major = info.tur === "tek" ? isMajor(info.from, info.to) : false;
  const ci = ciState(pr.checks);
  const age = Number.isFinite(pr.ageDays) ? pr.ageDays : 0;
  let grup;
  let neden;

  if (files.some((f) => f.startsWith(".github/"))) {
    grup = "ci";
    neden = "CI/iş akışı dosyasını değiştirir (kritik dosya); yalnız Burak onayıyla birleştirilir.";
  } else if (info.paket && MASAUSTU.test(info.paket)) {
    grup = "masaustu";
    neden = "Yalnız masaüstü paketleme aracı; web sitesini etkilemez (kapsam dışı).";
  } else if (info.paket && KRITIK.test(info.paket)) {
    grup = "kritik";
    neden = `${info.paket}: giriş, ödeme, veritabanı ya da şifre/istek işleme alanına dokunur${major ? "; büyük sürüm atlaması" : ""}.`;
  } else if (info.paket && PDF_MOTOR.test(info.paket)) {
    grup = major ? "riskli" : "dikkatli";
    neden = `${info.paket}: PDF motoru/önizlemesi${major ? "; büyük sürüm atlaması" : ""}.`;
  } else if (info.paket && GELISTIRME.test(info.paket)) {
    grup = "guvenli";
    neden = `${info.paket}: yalnız geliştirme/test aracı; canlı siteyi etkilemez.`;
  } else if (info.paket && DIKKAT_PAKET.test(info.paket)) {
    grup = "dikkatli";
    neden = `${info.paket}${major ? ": büyük sürüm atlaması" : ""}; derleme, önbellek ya da e-posta gönderimine dokunur.`;
  } else if (info.tur === "grup") {
    grup = "dikkatli";
    neden = "Birden çok pakette küçük/yama güncellemesi (grup); ortak PDF kütüphaneleri olabilir, tek tek bakmak gerekir.";
  } else if (major) {
    grup = "dikkatli";
    neden = `${info.paket || "paket"}: büyük sürüm atlaması.`;
  } else if (info.tur === "tek") {
    grup = "guvenli";
    neden = `${info.paket}: küçük/yama güncellemesi.`;
  } else {
    grup = "dikkatli";
    neden = "Başlık tanınamadı; elle bakılmalı.";
  }

  // CI kırmızıysa "güvenli" olamaz. Eski PR'larda sonuç da eski olabilir; bunu ayrıca belirtiriz.
  if (grup === "guvenli" && ci === "kirmizi") {
    grup = "dikkatli";
    neden += " CI kırmızı.";
  }
  return {
    n: pr.number,
    baslik: String(pr.title || "").slice(0, 100),
    paket: info.paket,
    from: info.from,
    to: info.to,
    major,
    grup,
    neden,
    ci,
    ciEski: age > 14,
    yasGun: age,
  };
}

const ONERI = {
  guvenli: "Önce 'Update branch' ile güncel main'e getir, CI yeşilse tek bir toplu PR önerisi olarak Burak'a sun.",
  dikkatli: "Tek tek ele al; CI yeşil olunca ne denenmeli notuyla Burak'a sun.",
  riskli: "Ayrı bir test planı olmadan açma; PDF önizleme/işleme testlerini elle çalıştırarak değerlendir.",
  kritik: "Ayrı plan ve açık onay ister; şimdilik hiçbir şey yapma.",
  ci: "Tüm CI güncellemelerini tek PR'da toplamayı Burak'a öner (kritik dosya, onaysız birleştirme yok).",
  masaustu: "Kapsam dışı: beklet.",
};

/** PR listesinden özet: grup sayıları, listeler ve 'ne yapardım' satırları (hepsi kural tabanlı). */
export function summarize(prs) {
  const items = prs.map(classify).sort((a, b) => a.n - b.n);
  const sayi = Object.fromEntries(Object.keys(GRUPLAR).map((k) => [k, 0]));
  for (const i of items) sayi[i.grup] += 1;
  const yapardim = Object.keys(GRUPLAR)
    .filter((k) => sayi[k] > 0)
    .map((k) => ({ grup: k, adet: sayi[k], oneri: ONERI[k] }));
  return { toplam: items.length, sayi, items, yapardim, golge: true };
}

/** Sabah e-postası için tek satır özet. */
export function mailLine(summary) {
  if (!summary || !Number.isFinite(summary.toplam)) return null;
  const parts = Object.keys(GRUPLAR).filter((k) => summary.sayi[k] > 0).map((k) => `${GRUPLAR[k]} ${summary.sayi[k]}`);
  return `Açık yazılım güncellemesi: ${summary.toplam} (${parts.join(", ") || "yok"}). Gölge modu: hiçbir şey yapılmadı, birleştirilmedi.`;
}

/** GitHub'dan (salt okuma) açık Dependabot PR'larını toplar. fetchFn test için dışarıdan verilir. */
export async function collect({ repo = "burakayax/NB_PDF_PLATFORM", token = "", fetchFn = fetch, now = Date.now() } = {}) {
  const headers = { accept: "application/vnd.github+json", "user-agent": "bakim-ajani" };
  if (token) headers.authorization = `Bearer ${token}`;
  const get = async (u) => {
    const r = await fetchFn(`https://api.github.com/repos/${repo}${u}`, { headers, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
    return r.json();
  };
  const list = await get("/pulls?state=open&per_page=100");
  const bots = list.filter((p) => p?.user?.login === "dependabot[bot]");
  const prs = [];
  for (const p of bots) {
    const files = (await get(`/pulls/${p.number}/files?per_page=100`)).map((f) => f.filename);
    const cr = await get(`/commits/${p.head.sha}/check-runs?per_page=100`);
    const ageDays = Math.floor((now - Date.parse(p.created_at)) / 86400000);
    prs.push({ number: p.number, title: p.title, files, ageDays, checks: (cr.check_runs || []).map((c) => ({ conclusion: c.conclusion })) });
  }
  return summarize(prs);
}
