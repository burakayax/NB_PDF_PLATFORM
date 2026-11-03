/**
 * Soru metinlerindeki matematik gösterimi: `$...$` içindeki küçük bir LaTeX benzeri dil.
 *
 *   üs: x^2  x^{n+1}   alt indis: a_1   kesir: frac{a}{b}   kök: sqrt{x}
 *   semboller: pi le ge neq cap cup in R (mathbb{R}) times div pm infty ...
 *   (başına "\" konabilir ama gerekmez — model JSON'da ters bölüyle sorun yaşamasın diye)
 *
 * Saf fonksiyonlar: hem PDF çizimi (mathPdf.ts) hem ekran (MathText.tsx) hem düz metin (kopyala) kullanır.
 */

export type MNode =
  | { k: "t"; s: string }
  | { k: "sup" | "sub"; c: MNode[] }
  | { k: "frac"; n: MNode[]; d: MNode[] }
  | { k: "sqrt"; c: MNode[] };

export type Seg = { math: false; s: string } | { math: true; nodes: MNode[]; src: string };

const SYMBOLS: Record<string, string> = {
  pi: "π", infty: "∞", inf: "∞", le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", ne: "≠", approx: "≈",
  times: "×", div: "÷", pm: "±", mp: "∓", cdot: "·", cap: "∩", cup: "∪", in: "∈", notin: "∉",
  subset: "⊂", supset: "⊃", subseteq: "⊆", emptyset: "∅", setminus: "∖", to: "→", rightarrow: "→",
  leftarrow: "←", Rightarrow: "⇒", Leftrightarrow: "⇔", forall: "∀", exists: "∃", angle: "∠", perp: "⊥",
  parallel: "∥", degree: "°", equiv: "≡", land: "∧", lor: "∨", neg: "¬", sum: "∑", prod: "∏",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", theta: "θ", lambda: "λ", mu: "μ", sigma: "σ", omega: "ω",
  Delta: "Δ", Omega: "Ω", Sigma: "Σ", cbrt: "∛",
};
const BB: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ" };
const WORD_COMMANDS = new Set(["frac", "sqrt", "mathbb", "mathrm", "text", ...Object.keys(SYMBOLS)]);

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ";
const SUP_SRC = "0123456789+-n";
const SUB = "₀₁₂₃₄₅₆₇₈₉";

/** Metni `$...$` parçalarına ayırır. Eşi olmayan `$` düz metin sayılır. */
export function splitMath(text: string): Seg[] {
  const out: Seg[] = [];
  const re = /\$([^$\n]{1,300}?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ math: false, s: text.slice(last, m.index) });
    out.push({ math: true, nodes: parseMath(m[1]), src: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ math: false, s: text.slice(last) });
  return out;
}

export const hasMath = (text: string): boolean => /\$[^$\n]{1,300}?\$/.test(text);

function pushText(out: MNode[], s: string) {
  if (!s) return;
  const prev = out[out.length - 1];
  if (prev && prev.k === "t") prev.s += s;
  else out.push({ k: "t", s });
}

/** `$` içindeki ifadeyi düğüm ağacına çevirir; bozuk girdide bile çökmez. */
export function parseMath(src: string): MNode[] {
  let i = 0;

  const group = (): MNode[] => {
    while (src[i] === " ") i++;
    if (src[i] === "{") {
      i++;
      const inner = seq(true);
      if (src[i] === "}") i++;
      return inner;
    }
    // Tek karakter (ya da işaretli tek karakter / tek sözcük sembolü) bağımsız değişken olur.
    const out: MNode[] = [];
    if ((src[i] === "-" || src[i] === "+") && i + 1 < src.length) {
      pushText(out, src[i] === "-" ? "−" : "+");
      i++;
    }
    if (i < src.length) {
      if (src[i] === "\\") {
        const w = word();
        pushText(out, SYMBOLS[w.name] ?? w.name);
      } else {
        // Üs/indiste süslüsüz bağımsız değişken tek karakterdir (LaTeX gibi): x^2, a_n; çok basamak için {10}.
        pushText(out, src[i++]);
      }
    }
    return out;
  };

  const word = (): { name: string; cmd: boolean } => {
    let cmd = false;
    if (src[i] === "\\") {
      cmd = true;
      i++;
    }
    const m = /^[A-Za-z]+/.exec(src.slice(i));
    if (!m) {
      const ch = src[i] ?? "";
      i += ch ? 1 : 0;
      return { name: ch, cmd: true };
    }
    i += m[0].length;
    return { name: m[0], cmd };
  };

  const seq = (inGroup: boolean): MNode[] => {
    const out: MNode[] = [];
    let guard = 0;
    while (i < src.length && guard++ < 2000) {
      const ch = src[i];
      if (ch === "}") {
        if (inGroup) return out;
        i++;
        continue;
      }
      if (ch === "{") {
        out.push(...group());
        continue;
      }
      if (ch === "^" || ch === "_") {
        i++;
        const c = group();
        out.push({ k: ch === "^" ? "sup" : "sub", c });
        continue;
      }
      if (/[A-Za-z\\]/.test(ch)) {
        const w = word();
        const name = w.name;
        if ((w.cmd || WORD_COMMANDS.has(name)) && (name === "frac" || name === "sqrt" || name === "mathbb" || name === "mathrm" || name === "text")) {
          if (name === "frac") {
            const n = group();
            const d = group();
            out.push({ k: "frac", n, d });
          } else if (name === "sqrt") {
            if (src[i] === "[") {
              const end = src.indexOf("]", i);
              i = end < 0 ? src.length : end + 1;
            }
            out.push({ k: "sqrt", c: group() });
          } else if (name === "mathbb") {
            const g = group();
            const txt = g.map((n) => (n.k === "t" ? n.s : "")).join("");
            pushText(out, BB[txt] ?? txt);
          } else {
            const g = group();
            for (const n of g) out.push(n);
          }
        } else if ((w.cmd || WORD_COMMANDS.has(name)) && SYMBOLS[name]) {
          pushText(out, SYMBOLS[name]);
        } else {
          pushText(out, name);
        }
        continue;
      }
      // Operatör kısaltmaları
      if (src.startsWith("<=", i)) { pushText(out, "≤"); i += 2; continue; }
      if (src.startsWith(">=", i)) { pushText(out, "≥"); i += 2; continue; }
      if (src.startsWith("!=", i)) { pushText(out, "≠"); i += 2; continue; }
      if (src.startsWith("->", i)) { pushText(out, "→"); i += 2; continue; }
      if (ch === "*") { pushText(out, "·"); i++; continue; }
      if (ch === "-") { pushText(out, "−"); i++; continue; }
      pushText(out, ch);
      i++;
    }
    return out;
  };

  return seq(false);
}

const nodesText = (nodes: MNode[]): string => nodes.map(nodeText).join("");

function nodeText(n: MNode): string {
  switch (n.k) {
    case "t":
      return n.s;
    case "sup": {
      const s = nodesText(n.c);
      return [...s].every((ch) => ch === "−" || SUP_SRC.includes(ch)) && s
        ? [...s].map((ch) => (ch === "−" ? "⁻" : SUP[SUP_SRC.indexOf(ch)])).join("")
        : `^(${s})`;
    }
    case "sub": {
      const s = nodesText(n.c);
      return [...s].every((ch) => /\d/.test(ch)) && s ? [...s].map((ch) => SUB[Number(ch)]).join("") : `_(${s})`;
    }
    case "frac": {
      const a = nodesText(n.n);
      const b = nodesText(n.d);
      const wrap = (s: string) => (/^[\w.−-]+$/u.test(s) ? s : `(${s})`);
      return `${wrap(a)}/${wrap(b)}`;
    }
    case "sqrt": {
      const s = nodesText(n.c);
      return /^[\w.]+$/.test(s) ? `√${s}` : `√(${s})`;
    }
  }
}

/** Düğümleri okunur düz metne (Unicode) çevirir: kopyalama / kısa etiketler için. */
export const mathToPlain = (nodes: MNode[]): string => nodesText(nodes);

/** Metindeki `$...$` işaretlerini kaldırıp formülleri düz Unicode'a çevirir. */
export function plainText(text: string): string {
  return splitMath(text)
    .map((sg) => (sg.math ? mathToPlain(sg.nodes) : sg.s))
    .join("");
}

/** Düğüm ağacındaki tüm düz karakterler (hangi yazı tipi glifleri gerekir diye taramak için). */
export function collectChars(nodes: MNode[], into: Set<string>): void {
  for (const n of nodes) {
    if (n.k === "t") for (const ch of n.s) into.add(ch);
    else if (n.k === "frac") {
      collectChars(n.n, into);
      collectChars(n.d, into);
    } else collectChars(n.c, into);
  }
}

/** Bir metindeki (formüller dahil) tüm karakterler. */
export function allChars(text: string): Set<string> {
  const set = new Set<string>();
  for (const sg of splitMath(text)) {
    if (sg.math) collectChars(sg.nodes, set);
    else for (const ch of sg.s) set.add(ch);
  }
  return set;
}
