import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Bağlandığı alanın altında açılan, ekran dışına taşmayan açılır pencere.
 * Formdaki kartlar taşmayı kestiği için gövdeye (portal) çizilir; dar ekranda alttan açılan sayfa olur.
 * Dışarı tıklama ve Esc ile kapanır.
 */
export function CvPopover({ anchor, open, onClose, width = 300, label, children }: { anchor: RefObject<HTMLElement | null>; open: boolean; onClose: () => void; width?: number; label: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; w: number; sheet: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      if (vw < 560) {
        setPos({ left: 0, top: 0, w: vw, sheet: true });
        return;
      }
      const w = Math.min(width, vw - 16);
      const left = Math.min(Math.max(8, a.left), vw - w - 8);
      const h = box.current?.offsetHeight ?? 360;
      const below = a.bottom + 6;
      const top = below + h > vh - 8 ? Math.max(8, a.top - h - 6) : below;
      setPos({ left, top, w, sheet: false });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, width]);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchor.current?.focus();
      }
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [open, onClose, anchor]);

  if (!open || !pos) return null;
  return createPortal(
    <div className={pos.sheet ? "fixed inset-0 z-[90] flex items-end bg-black/60" : "fixed z-[90]"} style={pos.sheet ? undefined : { left: pos.left, top: pos.top, width: pos.w }}>
      <div
        ref={box}
        role="dialog"
        aria-label={label}
        className={pos.sheet ? "max-h-[80vh] w-full overflow-y-auto rounded-t-3xl border-t border-white/10 bg-slate-900 p-4 pb-6 shadow-2xl" : "overflow-hidden rounded-2xl border border-white/12 bg-slate-900 p-3 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] ring-1 ring-black/40"}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
