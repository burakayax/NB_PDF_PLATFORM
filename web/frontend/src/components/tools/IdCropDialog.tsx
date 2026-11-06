import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCw } from "lucide-react";

type Rect = { x: number; y: number; w: number; h: number };
type Handle = "move" | "tl" | "tr" | "bl" | "br";
type Rot = 0 | 90 | 180 | 270;

const MIN_W = 60; // doğal piksel

/**
 * Küçük kırpma penceresi: kullanıcı kimliğin sınırlarını elle çizer, «Tamam» deyince
 * kırptığı hali döner. Kırpma kutusu belge oranına (en/boy) kilitlidir → görüntü bozulmaz.
 * Her şey cihazda olur; fotoğraf sunucuya gitmez.
 */
export function IdCropDialog({
  file,
  aspect,
  tr,
  onCancel,
  onDone,
}: {
  file: File;
  /** Genişlik / yükseklik (ör. 85,6 / 54). */
  aspect: number;
  tr: boolean;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [rot, setRot] = useState<Rot>(0);
  const [src, setSrc] = useState<{ url: string; w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [scale, setScale] = useState(1); // ekran px / doğal px
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ h: Handle; px: number; py: number; start: Rect } | null>(null);

  useEffect(() => {
    let dead = false;
    void createImageBitmap(file).then((b) => !dead && setBmp(b));
    return () => {
      dead = true;
    };
  }, [file]);

  // Döndürülmüş kaynak (kırpma, döndürülmüş görüntü üzerinde yapılır).
  useEffect(() => {
    if (!bmp) return;
    const q = rot === 90 || rot === 270;
    const w = q ? bmp.height : bmp.width;
    const h = q ? bmp.width : bmp.height;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    g.translate(w / 2, h / 2);
    g.rotate((rot * Math.PI) / 180);
    g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
    let url = "";
    let dead = false;
    c.toBlob((b) => {
      if (!b || dead) return;
      url = URL.createObjectURL(b);
      setSrc({ url, w, h });
      // Başlangıç kutusu: görüntüye sığan en büyük oranlı kutunun %90'ı, ortada.
      let rw = Math.min(w, h * aspect) * 0.9;
      let rh = rw / aspect;
      if (rh > h) {
        rh = h * 0.9;
        rw = rh * aspect;
      }
      setRect({ x: (w - rw) / 2, y: (h - rh) / 2, w: rw, h: rh });
    }, "image/jpeg", 0.95);
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [bmp, rot, aspect]);

  const measure = useCallback(() => {
    const el = imgRef.current;
    if (el && src) setScale(el.clientWidth / src.w);
  }, [src]);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCancel]);

  const begin = (h: Handle) => (e: React.PointerEvent) => {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { h, px: e.clientX, py: e.clientY, start: rect };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !src) return;
    const dx = (e.clientX - d.px) / scale;
    const dy = (e.clientY - d.py) / scale;
    const s = d.start;
    if (d.h === "move") {
      setRect({
        ...s,
        x: Math.min(Math.max(0, s.x + dx), src.w - s.w),
        y: Math.min(Math.max(0, s.y + dy), src.h - s.h),
      });
      return;
    }
    // Karşı köşe sabit; kutu oran kilitli büyür/küçülür.
    const left = d.h === "tl" || d.h === "bl";
    const top = d.h === "tl" || d.h === "tr";
    const ox = left ? s.x + s.w : s.x;
    const oy = top ? s.y + s.h : s.y;
    const maxW = Math.min(left ? ox : src.w - ox, (top ? oy : src.h - oy) * aspect);
    const rawW = left ? s.w - dx : s.w + dx;
    const w = Math.min(Math.max(rawW, MIN_W), Math.max(maxW, MIN_W));
    const h = w / aspect;
    setRect({ x: left ? ox - w : ox, y: top ? oy - h : oy, w, h });
  };
  const end = () => {
    drag.current = null;
  };

  const confirm = async () => {
    if (!bmp || !src || !rect) return;
    setBusy(true);
    try {
      const q = rot === 90 || rot === 270;
      const w = q ? bmp.height : bmp.width;
      const h = q ? bmp.width : bmp.height;
      const full = document.createElement("canvas");
      full.width = w;
      full.height = h;
      const g = full.getContext("2d")!;
      g.translate(w / 2, h / 2);
      g.rotate((rot * Math.PI) / 180);
      g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
      const outW = Math.round(Math.min(rect.w, 2400));
      const outH = Math.round(outW / aspect);
      const out = document.createElement("canvas");
      out.width = outW;
      out.height = outH;
      out.getContext("2d")!.drawImage(full, rect.x, rect.y, rect.w, rect.h, 0, 0, outW, outH);
      const blob: Blob = await new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("crop"))), "image/jpeg", 0.95));
      onDone(blob);
    } finally {
      setBusy(false);
    }
  };

  const corner = (h: Handle, cls: string) => (
    <span
      onPointerDown={begin(h)}
      className={`absolute h-7 w-7 touch-none rounded-full border-2 border-white bg-cyan-500 shadow ${cls}`}
      style={{ cursor: h === "tl" || h === "br" ? "nwse-resize" : "nesw-resize" }}
    />
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3" role="dialog" aria-modal="true" aria-label={tr ? "Kimliği kırp" : "Crop the ID"}>
      <div className="flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
        <div>
          <p className="text-[15px] font-bold text-white">{tr ? "Kimliği kırpın" : "Crop the ID"}</p>
          <p className="text-[12px] text-slate-400">
            {tr
              ? "Kutuyu sürükleyip köşelerinden büyütün; sadece kimlik kartı kutunun içinde kalsın. Fotoğraf yan duruyorsa döndürün."
              : "Drag the box and resize it from the corners so only the card stays inside. Rotate if the photo is sideways."}
          </p>
        </div>

        <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-xl bg-black/40 p-6">
          {src && rect ? (
            <div className="relative inline-block select-none" style={{ touchAction: "none" }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
              <img ref={imgRef} src={src.url} alt="" draggable={false} onLoad={measure} className="block max-h-[55vh] max-w-full" />
              {/* Kutunun dışını karart */}
              <div
                onPointerDown={begin("move")}
                className="absolute cursor-move touch-none border-2 border-cyan-400"
                style={{
                  left: rect.x * scale,
                  top: rect.y * scale,
                  width: rect.w * scale,
                  height: rect.h * scale,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                }}
              >
                {corner("tl", "-left-3.5 -top-3.5")}
                {corner("tr", "-right-3.5 -top-3.5")}
                {corner("bl", "-bottom-3.5 -left-3.5")}
                {corner("br", "-bottom-3.5 -right-3.5")}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-slate-400">{tr ? "Fotoğraf hazırlanıyor…" : "Preparing the photo…"}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRot((r) => (((r + 90) % 360) as Rot))}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[13px] font-semibold text-slate-200 hover:border-white/25"
          >
            <RotateCw className="h-4 w-4" />
            {tr ? "Döndür" : "Rotate"}
          </button>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onCancel} className="min-h-[44px] rounded-xl border border-white/10 px-4 text-[13px] font-semibold text-slate-300 hover:bg-white/5">
              {tr ? "Vazgeç" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy || !rect}
              className="min-h-[44px] rounded-xl bg-cyan-500 px-6 text-[13px] font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {tr ? "Tamam" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
