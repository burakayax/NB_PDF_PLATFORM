import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { LABELS, resolveOrder, type CvData, type SectionKey } from "./cvModel";

type Props = { data: CvData; onChange: (d: CvData) => void; tr: boolean; graduateOrder: SectionKey[] };

/** Aç/kapa anahtarı (role="switch"): açık = bölüm CV'de görünür. */
function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} onClick={onToggle} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-gradient-to-r from-sky-500 to-emerald-400" : "bg-white/15"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/**
 * Bölüm yöneticisi: her satırda tutamaç (sürükle-bırak ya da ↑/↓ tuşları) + aç/kapa anahtarı.
 * Sürükleme işaretçi olaylarıyla yapılır; fare, dokunmatik ve kalem aynı şekilde çalışır.
 */
export function CvSectionManager({ data, onChange, tr, graduateOrder }: Props) {
  const order = resolveOrder(data);
  const L = LABELS[data.settings.lang];
  const [drag, setDrag] = useState<{ key: SectionKey; order: SectionKey[] } | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const shown = drag?.order ?? order;

  const nameOf = (k: SectionKey): string => {
    if (k.startsWith("custom:")) return data.customSections.find((c) => `custom:${c.id}` === k)?.title.trim() || (tr ? "Özel bölüm" : "Custom section");
    return ({ summary: L.profile, experience: L.experience, education: L.education, skills: L.skills, languages: L.languages, certs: L.certs, projects: L.projects, interests: L.interests, references: L.references } as Record<string, string>)[k] ?? k;
  };
  const commit = (next: SectionKey[] | null) => onChange({ ...data, settings: { ...data.settings, order: next } });
  const toggle = (k: SectionKey) => onChange({ ...data, settings: { ...data.settings, hidden: data.settings.hidden.includes(k) ? data.settings.hidden.filter((x) => x !== k) : [...data.settings.hidden, k] } });

  const place = (key: SectionKey, y: number, base: SectionKey[]): SectionKey[] => {
    const others = base.filter((k) => k !== key);
    let idx = 0;
    for (const k of others) {
      const r = rows.current.get(k)?.getBoundingClientRect();
      if (r && r.top + r.height / 2 < y) idx++;
    }
    return [...others.slice(0, idx), key, ...others.slice(idx)];
  };

  const visibleCount = order.filter((k) => !data.settings.hidden.includes(k)).length;

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-slate-400">
        {tr ? "Tutamaçtan tutup sürükleyerek sırayı değiştirin; anahtarla bölümü CV'den gizleyin ya da gösterin. Klavyede tutamaça odaklanıp ↑ ↓ tuşlarını kullanabilirsiniz." : "Drag a handle to reorder; use the switch to hide or show a section. With a keyboard, focus a handle and press ↑ ↓."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => commit(null)} className="rounded-xl bg-white/[0.06] px-3 py-2 text-[12.5px] font-semibold text-slate-100 hover:bg-white/10">{tr ? "Deneyimli düzeni" : "Experienced layout"}</button>
        <button type="button" onClick={() => commit(graduateOrder)} className="rounded-xl bg-sky-500/15 px-3 py-2 text-[12.5px] font-semibold text-sky-100 ring-1 ring-sky-400/30 hover:bg-sky-500/25">{tr ? "Yeni mezun düzeni" : "Graduate layout"}</button>
        <span className="ml-auto text-[12px] text-slate-500">{tr ? `${visibleCount}/${order.length} bölüm görünür` : `${visibleCount}/${order.length} sections shown`}</span>
      </div>
      <ul className="select-none space-y-1.5" aria-label={tr ? "Bölümler" : "Sections"}>
        {shown.map((k, i) => {
          const hidden = data.settings.hidden.includes(k);
          const dragging = drag?.key === k;
          return (
            <li
              key={k}
              ref={(el) => { if (el) rows.current.set(k, el); else rows.current.delete(k); }}
              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition ${dragging ? "border-sky-400/70 bg-sky-500/15 shadow-[0_12px_30px_-12px_rgba(56,189,248,0.7)]" : hidden ? "border-white/5 bg-white/[0.015]" : "border-white/10 bg-white/[0.04]"}`}
            >
              <button
                type="button"
                aria-label={tr ? `${nameOf(k)} sırasını değiştir (sürükleyin ya da ↑ ↓ tuşları)` : `Reorder ${nameOf(k)} (drag or ↑ ↓ keys)`}
                className="touch-none cursor-grab rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag({ key: k, order: shown });
                }}
                onPointerMove={(e) => {
                  if (!drag || drag.key !== k) return;
                  const next = place(k, e.clientY, drag.order);
                  if (next.join() !== drag.order.join()) setDrag({ key: k, order: next });
                }}
                onPointerUp={() => { if (drag && drag.key === k) { if (drag.order.join() !== order.join()) commit(drag.order); setDrag(null); } }}
                onPointerCancel={() => setDrag(null)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  const j = i + (e.key === "ArrowUp" ? -1 : 1);
                  if (j < 0 || j >= order.length) return;
                  const next = order.slice();
                  [next[i], next[j]] = [next[j], next[i]];
                  commit(next);
                }}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <span className={`min-w-0 flex-1 truncate text-[13.5px] font-semibold ${hidden ? "text-slate-500 line-through decoration-slate-600" : "text-slate-100"}`}>{nameOf(k)}</span>
              <span className={`hidden text-[12px] font-semibold sm:inline ${hidden ? "text-slate-500" : "text-emerald-300/80"}`}>{hidden ? (tr ? "Gizli" : "Hidden") : (tr ? "Görünür" : "Shown")}</span>
              <Switch on={!hidden} onToggle={() => toggle(k)} label={hidden ? (tr ? `${nameOf(k)}: göster` : `Show ${nameOf(k)}`) : (tr ? `${nameOf(k)}: gizle` : `Hide ${nameOf(k)}`)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
