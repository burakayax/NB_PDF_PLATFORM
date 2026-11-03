/**
 * Fonksiyon grafiği: yapay zekâdan gelen "şu fonksiyonları çiz" tarifini güvenle hesaplar.
 * `eval`/`Function` KULLANILMAZ — kendi küçük ifade çözümleyicimiz var (yalnızca sayı, x, + - * / ^, parantez ve
 * sin cos tan sqrt abs ln log exp gibi izinli fonksiyonlar). Hem PDF hem ekran aynı veriyi çizer.
 */

export type GraphSpec = { fns: string[]; xmin: number; xmax: number; ymin: number; ymax: number };

type Fn = (x: number) => number;

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
    if (num) { out.push({ t: "num", v: parseFloat(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z]+/.exec(src.slice(i));
    if (id) { out.push({ t: "id", v: id[0].toLowerCase() }); i += id[0].length; continue; }
    if (src.startsWith("**", i)) { out.push({ t: "op", v: "^" }); i += 2; continue; }
    if ("+-*/^(),".includes(ch)) { out.push({ t: "op", v: ch }); i++; continue; }
    throw new Error("bad char");
  }
  return out;
}

/** İfadeyi f(x)'e çevirir; geçersizse null. */
export function compileExpr(src: string): Fn | null {
  if (!src || src.length > 120) return null;
  let toks: Tok[];
  try {
    toks = lex(src.replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=/i, ""));
  } catch {
    return null;
  }
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === "op" && (peek() as { v: string }).v === v;
  type Node = (x: number) => number;

  const expr = (): Node => {
    let l = term();
    while (isOp("+") || isOp("-")) {
      const op = (toks[p++] as { v: string }).v;
      const a = l;
      const r = term();
      l = op === "+" ? (x) => a(x) + r(x) : (x) => a(x) - r(x);
    }
    return l;
  };
  const startsFactor = () => {
    const t = peek();
    return !!t && (t.t === "num" || t.t === "id" || (t.t === "op" && t.v === "("));
  };
  const term = (): Node => {
    let l = unary();
    // Açık * / yanında örtük çarpma da desteklenir: 2x, 3(x+1), x(x-1)
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = (toks[p++] as { v: string }).v;
        const a = l;
        const r = unary();
        l = op === "*" ? (x) => a(x) * r(x) : (x) => a(x) / r(x);
      } else if (startsFactor()) {
        const a = l;
        const r = unary();
        l = (x) => a(x) * r(x);
      } else break;
    }
    return l;
  };
  const unary = (): Node => {
    if (isOp("-")) { p++; const a = unary(); return (x) => -a(x); }
    if (isOp("+")) { p++; return unary(); }
    return power();
  };
  const power = (): Node => {
    const base = atom();
    if (isOp("^")) {
      p++;
      const e = unary(); // sağdan birleşir: 2^-x ve 2^3^2
      return (x) => Math.pow(base(x), e(x));
    }
    return base;
  };
  const atom = (): Node => {
    const t = toks[p++];
    if (!t) throw new Error("eof");
    if (t.t === "num") { const v = t.v; return () => v; }
    if (t.t === "id") {
      if (t.v === "x") return (x) => x;
      if (isOp("(") && FUNCS[t.v]) {
        p++;
        const a = expr();
        if (!isOp(")")) throw new Error("paren");
        p++;
        const f = FUNCS[t.v];
        return (x) => f(a(x));
      }
      if (t.v in CONSTS) { const v = CONSTS[t.v]; return () => v; }
      throw new Error("unknown id");
    }
    if (t.v === "(") {
      const a = expr();
      if (!isOp(")")) throw new Error("paren");
      p++;
      return a;
    }
    throw new Error("unexpected");
  };

  try {
    const f = expr();
    if (p !== toks.length) return null;
    // Deneme: en az bir noktada sayı üretmeli (tamamen tanımsız ifadeyi eler).
    let ok = false;
    for (const x of [-2, -1, -0.5, 0.5, 1, 2, 3]) if (Number.isFinite(f(x))) { ok = true; break; }
    return ok ? f : null;
  } catch {
    return null;
  }
}

/** Sunucudan/dış kaynaktan gelen tarifi doğrular; geçersizse null. */
export function cleanGraphSpec(v: unknown): GraphSpec | null {
  const g = (v ?? {}) as Record<string, unknown>;
  const fns = Array.isArray(g.fns) ? g.fns.filter((s): s is string => typeof s === "string").slice(0, 3) : [];
  const nums = [g.xmin, g.xmax, g.ymin, g.ymax].map(Number);
  if (!fns.length || nums.some((n) => !Number.isFinite(n) || Math.abs(n) > 1000)) return null;
  const [xmin, xmax, ymin, ymax] = nums;
  if (xmin >= xmax || ymin >= ymax) return null;
  return { fns, xmin, xmax, ymin, ymax };
}

export const CURVE_COLORS = ["#6d28d9", "#059669", "#ea580c"] as const;

export type PlotData = {
  spec: GraphSpec;
  /** Çizim kutusuna kırpılmış doğru parçaları (veri koordinatında). */
  curves: { expr: string; color: string; segs: [number, number, number, number][] }[];
  xTicks: number[];
  yTicks: number[];
};

/** Liang–Barsky: parçayı dikdörtgene kırpar; tamamen dışarıdaysa null. */
function clip(x0: number, y0: number, x1: number, y1: number, b: GraphSpec): [number, number, number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const checks: [number, number][] = [[-dx, x0 - b.xmin], [dx, b.xmax - x0], [-dy, y0 - b.ymin], [dy, b.ymax - y0]];
  for (const [pp, q] of checks) {
    if (pp === 0) { if (q < 0) return null; continue; }
    const r = q / pp;
    if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

function niceStep(range: number): number {
  const raw = range / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag;
}
function ticks(min: number, max: number): number[] {
  const step = niceStep(max - min);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

export function plotData(spec: GraphSpec): PlotData {
  const N = 320;
  const curves: PlotData["curves"] = [];
  spec.fns.forEach((src, idx) => {
    const f = compileExpr(src);
    if (!f) return;
    const segs: [number, number, number, number][] = [];
    const yr = spec.ymax - spec.ymin;
    let prev: [number, number] | null = null;
    for (let k = 0; k <= N; k++) {
      const x = spec.xmin + ((spec.xmax - spec.xmin) * k) / N;
      const y = f(x);
      if (!Number.isFinite(y)) { prev = null; continue; }
      // Dikey asimptot (tan gibi): çok büyük sıçramada çizgiyi kes.
      if (prev && Math.abs(y - prev[1]) > yr * 4) prev = null;
      if (prev) {
        const c = clip(prev[0], prev[1], x, y, spec);
        if (c) segs.push(c);
      }
      prev = [x, y];
    }
    curves.push({ expr: src.replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=\s*/i, ""), color: CURVE_COLORS[idx % CURVE_COLORS.length], segs });
  });
  return { spec, curves, xTicks: ticks(spec.xmin, spec.xmax), yTicks: ticks(spec.ymin, spec.ymax) };
}

/** Eksen sayısı etiketi (gereksiz ondalık yok). */
export const tickLabel = (v: number): string => String(Math.round(v * 1000) / 1000).replace("-", "−");
