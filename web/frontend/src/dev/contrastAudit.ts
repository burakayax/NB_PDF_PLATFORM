/**
 * GELİŞTİRME ARACI — sayfadaki her yazının rengini gerçek zemin rengine karşı ölçer (WCAG).
 * Hiçbir yerden import edilmez, üretim paketine girmez. Dev sunucuda tarayıcı konsolunda:
 *   const { auditContrast } = await import("/src/dev/contrastAudit.ts"); auditContrast()
 * Gradyan zeminlerde durakların EN KÖTÜSÜ ölçülür. Dönen liste yalnız başarısızları içerir.
 */
type Rgba = { r: number; g: number; b: number; a: number };

// Tarayıcı oklab/oklch/color-mix gibi biçimleri de verebilir (Tailwind 4): 1x1 tuval her biçimi sRGB'ye çevirir.
const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
ctx.canvas.width = ctx.canvas.height = 1;
const cache = new Map<string, Rgba | null>();
const parse = (c: string): Rgba | null => {
  if (cache.has(c)) return cache.get(c)!;
  let out: Rgba | null = null;
  const m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    out = { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  } else if (c && c !== "none") {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    out = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  }
  cache.set(c, out);
  return out;
};
const COLOR_FN = /(?:rgba?|oklab|oklch|lab|lch|hsla?|color)\([^)]*\)/g;
const over = (t: Rgba, b: Rgba): Rgba => ({
  r: t.r * t.a + b.r * (1 - t.a),
  g: t.g * t.a + b.g * (1 - t.a),
  b: t.b * t.a + b.b * (1 - t.a),
  a: 1,
});
const lin = (v: number) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const lum = (c: Rgba) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const ratio = (a: Rgba, b: Rgba) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

export function auditContrast(minArea = 1) {
  const root = document.documentElement;
  const base = parse(getComputedStyle(root).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  const fails: Record<string, unknown>[] = [];

  document.querySelectorAll<HTMLElement>("#root *").forEach((el) => {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
    if (!hasText) return;
    const rect = el.getBoundingClientRect();
    if (rect.width * rect.height < minArea || rect.bottom < 0) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    if (cs.webkitTextFillColor === "rgba(0, 0, 0, 0)" || cs.backgroundClip === "text") return; // degrade yazı
    const fg0 = parse(cs.color);
    if (!fg0) return;

    // Zemin katmanları: öğeden yukarı doğru ilk opak renge kadar
    const layers: Rgba[] = [];
    let gradientStops: Rgba[] | null = null;
    for (let n: HTMLElement | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      const bg = parse(s.backgroundColor);
      if (!gradientStops && s.backgroundImage !== "none" && s.backgroundImage.includes("gradient")) {
        const stops = [...s.backgroundImage.matchAll(COLOR_FN)].map((m) => parse(m[0])!).filter(Boolean);
        const visible = stops.filter((c) => c.a >= 0.35);
        if (visible.length) gradientStops = visible;
      }
      if (bg && bg.a > 0) layers.push(bg);
      if (bg && bg.a >= 1) break;
      if (gradientStops && gradientStops.some((c) => c.a >= 0.99)) break;
    }
    let bg = layers.length && layers[layers.length - 1].a >= 1 ? layers[layers.length - 1] : base;
    for (let i = layers.length - (layers.length && layers[layers.length - 1].a >= 1 ? 2 : 1); i >= 0; i--) bg = over(layers[i], bg);

    const fg = over({ ...fg0, a: fg0.a * (parseFloat(cs.opacity) || 1) }, bg);
    const backgrounds = gradientStops ? gradientStops.map((c) => over(c, bg)) : [bg];
    const worst = Math.min(...backgrounds.map((b) => ratio(fg, b)));
    const fs = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight) >= 700;
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5;
    if (worst < need) {
      fails.push({
        text: (el.textContent ?? "").trim().slice(0, 30),
        ratio: +worst.toFixed(2),
        need,
        size: Math.round(fs),
        color: cs.color,
        bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})${gradientStops ? " +gradyan" : ""}`,
        cls: (el.className?.toString() ?? "").slice(0, 70),
      });
    }
  });
  return fails;
}
