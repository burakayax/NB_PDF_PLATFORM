import { Fragment, type ReactNode } from "react";
import { splitMath, type MNode } from "../../lib/mathText";
import { cleanGraphSpec, plotData, tickLabel, type GraphSpec } from "../../lib/graphPlot";

function renderNodes(nodes: MNode[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.k) {
      case "t":
        return <Fragment key={i}>{n.s}</Fragment>;
      case "sup":
        return <sup key={i} className="text-[0.7em] leading-none">{renderNodes(n.c)}</sup>;
      case "sub":
        return <sub key={i} className="text-[0.7em] leading-none">{renderNodes(n.c)}</sub>;
      case "frac":
        return (
          <span key={i} className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.88em] leading-tight">
            <span className="border-b border-current px-0.5">{renderNodes(n.n)}</span>
            <span className="px-0.5">{renderNodes(n.d)}</span>
          </span>
        );
      case "sqrt":
        return (
          <span key={i} className="whitespace-nowrap">
            √<span className="border-t border-current">{renderNodes(n.c)}</span>
          </span>
        );
    }
  });
}

/** `$...$` içindeki formülleri (üs, kesir, kök, semboller) düzgün gösterir; düz metin olduğu gibi kalır. */
export function MathText({ text }: { text: string }) {
  return (
    <>
      {splitMath(text).map((sg, i) => (sg.math ? <span key={i} className="whitespace-nowrap">{renderNodes(sg.nodes)}</span> : <Fragment key={i}>{sg.s}</Fragment>))}
    </>
  );
}

/** Fonksiyon grafiği (SVG): eksenler, ızgara, eğriler ve gösterim. */
export function QuizGraphView({ spec, tr }: { spec: unknown; tr: boolean }) {
  const s: GraphSpec | null = cleanGraphSpec(spec);
  if (!s) return null;
  const data = plotData(s);
  if (!data.curves.length) return null;
  const W = 320;
  const H = 200;
  const P = 6;
  const sx = (v: number) => P + ((v - s.xmin) / (s.xmax - s.xmin)) * (W - P * 2);
  const sy = (v: number) => H - P - ((v - s.ymin) / (s.ymax - s.ymin)) * (H - P * 2);
  const ax = s.xmin <= 0 && s.xmax >= 0 ? sx(0) : P;
  const ay = s.ymin <= 0 && s.ymax >= 0 ? sy(0) : H - P;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tr ? "Fonksiyon grafiği" : "Function graph"} className="mt-3 w-full max-w-[360px] rounded-xl border border-white/10 bg-white">
      {data.xTicks.map((t) => <line key={`gx${t}`} x1={sx(t)} x2={sx(t)} y1={P} y2={H - P} stroke="#e5e7eb" strokeWidth={0.6} />)}
      {data.yTicks.map((t) => <line key={`gy${t}`} y1={sy(t)} y2={sy(t)} x1={P} x2={W - P} stroke="#e5e7eb" strokeWidth={0.6} />)}
      <line x1={P} x2={W - P} y1={ay} y2={ay} stroke="#374151" strokeWidth={1.1} />
      <line y1={P} y2={H - P} x1={ax} x2={ax} stroke="#374151" strokeWidth={1.1} />
      {data.xTicks.filter((t) => Math.abs(t) > 1e-9).map((t) => <text key={`tx${t}`} x={sx(t)} y={Math.min(H - 1, ay + 10)} fontSize={8} textAnchor="middle" fill="#4b5563">{tickLabel(t)}</text>)}
      {data.yTicks.filter((t) => Math.abs(t) > 1e-9).map((t) => <text key={`ty${t}`} x={ax - 3} y={sy(t) + 3} fontSize={8} textAnchor="end" fill="#4b5563">{tickLabel(t)}</text>)}
      <text x={W - P - 2} y={ay - 4} fontSize={10} textAnchor="end" fill="#374151">x</text>
      <text x={ax + 4} y={P + 9} fontSize={10} fill="#374151">y</text>
      {data.curves.map((c, ci) => (
        <path key={ci} d={c.segs.map(([x0, y0, x1, y1]) => `M${sx(x0).toFixed(1)} ${sy(y0).toFixed(1)}L${sx(x1).toFixed(1)} ${sy(y1).toFixed(1)}`).join("")} stroke={c.color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      ))}
      {data.curves.map((c, ci) => (
        <g key={`l${ci}`}>
          <line x1={P + 4} x2={P + 18} y1={P + 8 + ci * 11} y2={P + 8 + ci * 11} stroke={c.color} strokeWidth={2} />
          <text x={P + 22} y={P + 11 + ci * 11} fontSize={8.5} fill="#111827">y = {c.expr}</text>
        </g>
      ))}
    </svg>
  );
}
