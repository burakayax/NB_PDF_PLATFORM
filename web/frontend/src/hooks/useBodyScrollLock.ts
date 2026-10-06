import { useEffect } from "react";

let lockCount = 0;
let restore: (() => void) | null = null;

function lock() {
  if (lockCount++ > 0) return;
  const scrollY = window.scrollY;
  const html = document.documentElement;
  const body = document.body;
  const prev = {
    htmlOverflow: html.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };
  // iOS Safari `overflow:hidden`'ı yok sayar → body `position:fixed` ile sabitlenir,
  // konum `top` ile korunur ve kilit kalkınca geri yüklenir.
  html.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  restore = () => {
    html.style.overflow = prev.htmlOverflow;
    body.style.position = prev.position;
    body.style.top = prev.top;
    body.style.left = prev.left;
    body.style.right = prev.right;
    body.style.width = prev.width;
    body.style.overflow = prev.overflow;
    window.scrollTo(0, scrollY);
  };
}

function unlock() {
  if (--lockCount > 0) return;
  lockCount = 0;
  restore?.();
  restore = null;
}

/** Tam ekran pencere (görsel seçici vb.) açıkken arka plandaki sayfanın kaymasını engeller. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
