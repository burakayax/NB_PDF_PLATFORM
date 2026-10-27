/**
 * GELİŞTİRME ARACI — uygulama tarafından içe aktarılmaz.
 * Birden çok adresi gizli bir çerçevede açıp kontrast taramasından geçirir (açık tema denetimi).
 * Üçüncü parametre çerçeve genişliği (mobil için 390); yatay taşma "TASMA" olarak raporlanır.
 *   const { sweep } = await import('/src/dev/sweep.ts'); await sweep(['/pricing', '/tools/compress'], 3000)
 * Önce localStorage 'nb-theme' = 'light' olmalı; böylece tema uygulamanın kendi yoluyla uygulanır.
 */
export async function sweep(paths: string[], wait = 3000, width = 1280): Promise<string> {
  const out: string[] = [];
  for (const p of paths) {
    const f = document.createElement("iframe");
    f.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:900px;opacity:0;pointer-events:none`;
    f.src = p;
    document.body.appendChild(f);
    await new Promise((r) => (f.onload = r));
    await new Promise((r) => setTimeout(r, wait));
    try {
      const win = f.contentWindow as Window & { eval: (s: string) => Promise<unknown> };
      const theme = f.contentDocument?.documentElement.dataset.theme;
      const de = f.contentDocument?.documentElement;
      const overflow = de ? de.scrollWidth - de.clientWidth : 0;
      const res = (await win.eval(
        "import('/src/dev/contrastAudit.ts?v=sweep').then(m=>m.auditContrast().filter(x=>!/^\\d$/.test(x.text)).map(x=>[x.text.slice(0,22),x.ratio,x.cls.slice(0,70)]))",
      )) as unknown[][];
      out.push(`${p} [${theme}] ${win.location.pathname}  :${res.length}${overflow > 1 ? ` TASMA+${overflow}px` : ""}${res.length ? JSON.stringify(res.slice(0, 3)) : ""}`);
    } catch (e) {
      out.push(`${p} ERR ${(e as Error).message}`);
    }
    f.remove();
  }
  return out.join("\n");
}
