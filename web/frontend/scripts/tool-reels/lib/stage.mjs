/**
 * Araç tanıtım videosu çekim sahnesi: tarayıcı, sahte imleç/vurgu, yazı olayları, yakınlaşma kayıtları.
 *
 * Kayıtta fare görünmez: imleç ve vurgu çerçevesi sayfaya çizilir. İmleç hedefe YÜRÜMEZ,
 * oraya ışınlanır (video kısa kalsın). Videodaki yazılar ve yakınlaşmalar burada kaydedilen
 * zaman çizelgesinden kurgu aşamasında (compose.mjs) üretilir.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

export async function createStage({ baseUrl, workDir, viewport = { width: 860, height: 1700 } }) {
  const VW = viewport.width;
  const VH = viewport.height;
  mkdirSync(`${workDir}/rec`, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport,
    // Site dilini tarayıcı dilinden seçer; CI makinesi İngilizce olduğundan Türkçe sabitlenir.
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    deviceScaleFactor: 1,
    recordVideo: { dir: `${workDir}/rec`, size: viewport },
  });
  const pg = await ctx.newPage();
  const t0 = Date.now();
  const now = () => +((Date.now() - t0) / 1000).toFixed(2);
  const events = [];
  let startT = 0;
  // Ekrandaki anlatım: üstte adım başlığı, altta 0-2 satır açıklama (ilk satır vurgulu).
  const say = (label, title, l1 = "", l2 = "", accent = "") => {
    events.push({ t: +(now() - startT).toFixed(2), label, title, l1, l2, accent });
    console.log("SAY", events.at(-1).t, label, "|", title, "|", l1, "|", l2);
  };
  pg.on("download", (d) => d.cancel().catch(() => {}));
  pg.on("pageerror", (e) => console.log("PAGEERR", e.message));
  // Tanı: başarısız/hatalı istekler ve tarayıcı hataları kayda geçer (CI'da takılmaların nedeni buradan okunur).
  pg.on("requestfailed", (r) => console.log("REQFAIL", r.method(), r.url().slice(0, 140), r.failure()?.errorText ?? ""));
  pg.on("response", (r) => {
    if (r.status() >= 400) console.log("HTTP", r.status(), r.request().method(), r.url().slice(0, 140));
  });
  pg.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200));
  });

  // Paylaş düğmesi telefon/Chrome'da görünür; headless tarayıcıda yoktur, canlıdaki gibi
  // görünsün diye Web Share tanımlanır.
  await pg.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: async () => {}, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    const add = () => {
      if (document.getElementById("fake-cursor")) return;
      const st = document.createElement("style");
      st.textContent =
        "@keyframes fhl{0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,.55),0 0 18px 2px rgba(56,189,248,.45)}50%{box-shadow:0 0 0 7px rgba(56,189,248,.0),0 0 26px 6px rgba(56,189,248,.65)}}";
      document.head.append(st);
      const c = document.createElement("div");
      c.id = "fake-cursor";
      c.style.cssText =
        "position:fixed;left:0;top:0;width:34px;height:34px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 3px 5px rgba(0,0,0,.55))";
      c.innerHTML =
        '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.6L21 10.8z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
      const ring = document.createElement("div");
      ring.style.cssText =
        "position:fixed;left:0;top:0;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;border:4px solid rgba(56,189,248,.95);z-index:2147483646;pointer-events:none;opacity:0";
      document.documentElement.append(ring, c);
      let mx = -100, my = -100;
      addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; c.style.transform = `translate(${mx}px,${my}px)`; }, true);
      addEventListener("mousedown", () => {
        ring.style.transition = "none";
        ring.style.opacity = "1";
        ring.style.transform = `translate(${mx}px,${my}px) scale(.3)`;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          ring.style.transition = "transform .45s ease-out, opacity .45s ease-out";
          ring.style.opacity = "0";
          ring.style.transform = `translate(${mx}px,${my}px) scale(1.15)`;
        }));
      }, true);
      window.__hl = (x, y, w, h) => {
        let r = document.getElementById("fake-hl");
        if (!r) {
          r = document.createElement("div");
          r.id = "fake-hl";
          r.style.cssText =
            "position:fixed;z-index:2147483645;pointer-events:none;border:4px solid #38bdf8;border-radius:16px;animation:fhl 1.2s ease-in-out infinite;transition:left .35s ease,top .35s ease,width .35s ease,height .35s ease";
          document.documentElement.append(r);
        }
        Object.assign(r.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px", display: "block" });
      };
      const mst = document.createElement("style");
      mst.textContent = "#fake-menu div.fm-item:hover{background:rgba(56,189,248,.20)!important}";
      document.head.append(mst);
      window.__menu = (x, y, w, items, sel) => {
        let m = document.getElementById("fake-menu");
        if (m) m.remove();
        m = document.createElement("div");
        m.id = "fake-menu";
        m.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${w}px;z-index:2147483644;background:#0b1326;border:1.5px solid rgba(56,189,248,.55);border-radius:16px;padding:6px;box-shadow:0 18px 40px rgba(0,0,0,.55),0 0 0 4px rgba(56,189,248,.10);font:500 16px/1.2 Inter,system-ui,sans-serif;color:#e2e8f0`;
        items.forEach((t, i) => {
          const d = document.createElement("div");
          d.className = "fm-item";
          d.style.cssText = `height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-radius:10px;${i === sel ? "background:rgba(56,189,248,.16);box-shadow:inset 3px 0 0 #38bdf8;color:#fff;font-weight:700" : ""}`;
          d.innerHTML = `<span>${t}</span>${i === sel ? '<span style="color:#38bdf8">✓</span>' : ""}`;
          m.append(d);
        });
        document.documentElement.append(m);
      };
      window.__menuOff = () => { const m = document.getElementById("fake-menu"); if (m) m.remove(); };
      window.__hlOff = () => { const r = document.getElementById("fake-hl"); if (r) r.style.display = "none"; };
    };
    if (document.documentElement) add(); else addEventListener("DOMContentLoaded", add);
  });
  const wait = (ms) => pg.waitForTimeout(ms);
  const box = async (loc) => loc.boundingBox();
  const center = async (loc) => {
    const bb = await box(loc);
    return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  };
  const zooms = [];
  let zoomOpen = null;
  const zoomOff = () => {
    if (zoomOpen) {
      zoomOpen.b = +(now() - startT).toFixed(2);
      zoomOpen = null;
    }
  };
  const zoomOn = (bb) => {
    if (!startT) return;
    zoomOff();
    zoomOpen = { a: +(now() - startT).toFixed(2), b: null, box: { x: bb.x, y: bb.y, w: bb.w ?? bb.width, h: bb.h ?? bb.height } };
    zooms.push(zoomOpen);
  };
  const hl = async (loc, pad = 8) => {
    const bb = await box(loc);
    zoomOn(bb);
    await pg.evaluate(([x, y, w, h]) => window.__hl(x, y, w, h), [bb.x - pad, bb.y - pad, bb.width + pad * 2, bb.height + pad * 2]);
  };
  const hlText = async (loc, pad = 8) => {
    const r = await loc.evaluate((el) => {
      const rg = document.createRange();
      rg.selectNodeContents(el);
      const b = rg.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    });
    zoomOn(r);
    await pg.evaluate(([x, y, w, h]) => window.__hl(x, y, w, h), [r.x - pad - 4, r.y - pad + 2, r.w + (pad + 4) * 2, r.h + (pad - 2) * 2]);
  };
  const hlOff = () => {
    zoomOff();
    return pg.evaluate(() => window.__hlOff());
  };
  // İmleç yürümez, ışınlanır.
  const moveTo = (x, y) => pg.mouse.move(x, y);

  const openMenu = async (selLoc, holdRows) => {
    const opts = await selLoc.evaluate((el) => [...el.options].map((o) => o.textContent.trim()));
    const selIdx = await selLoc.evaluate((el) => el.selectedIndex);
    const sb = await box(selLoc);
    const top = sb.y + sb.height + 6;
    const rowC = (i) => top + 6 + 44 * i + 22;
    const menuH = opts.length * 44 + 12;
    // imleç seçime gelir, tıklanır, menü açılır
    const sp = { x: sb.x + sb.width * 0.35, y: sb.y + sb.height / 2 };
    await moveTo(sp.x, sp.y, 30);
    await pg.mouse.click(sp.x, sp.y);
    await pg.evaluate(([x, y, w, items, sel]) => window.__menu(x, y, w, items, sel), [sb.x, top, sb.width, opts, selIdx]);
    await pg.evaluate(([x, y, w, h]) => window.__hl(x, y, w, h), [sb.x - 6, sb.y - 6, sb.width + 12, sb.height + 12]);
    zoomOn({ x: sb.x, y: sb.y, w: sb.width, h: sb.height + 6 + menuH });
    return { opts, selIdx, rowC, sp, sb };
  };
  const closeMenu = async () => { await pg.evaluate(() => window.__menuOff()); await hlOff(); };
  /** Giriş (videoya GİRMEZ) ve aracın sayfasına geçiş. */
  async function loginAndOpenTool({ email, password, toolPath }) {
    await pg.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await wait(2500);
    await pg.getByRole("button", { name: "Yalnızca Zorunlu" }).click().catch(() => {});
    await pg.locator("input[type=email]").first().fill(email);
    await pg.locator("input[type=password]").first().fill(password);
    await pg.getByRole("button", { name: /^Giriş Yap$/ }).last().click();
    await pg.waitForURL(/\/tools\//, { timeout: 60000 });
    await wait(2500);
    for (let i = 0; i < 6; i++) {
      await pg.evaluate((p) => {
        history.pushState({}, "", p);
        dispatchEvent(new PopStateEvent("popstate"));
      }, toolPath);
      try {
        await pg.locator("form.tool-form").waitFor({ timeout: 12000 });
        break;
      } catch {
        /* yeniden dene */
      }
    }
    await wait(1500);
    await pg.getByRole("button", { name: "Turu atla" }).click().catch(() => {});
    await wait(1300);
    await pg.mouse.move(VW - 200, VH - 150);
    await wait(300);
  }

  /** Sonuç ekranı: İndir · Paylaş · Aç TEK adımda, üçü birden vurgulanır. */
  async function showResultButtons() {
    const locs = ["İndir", "Paylaş", "Aç"].map((n) => pg.locator("button", { hasText: new RegExp(`^\\s*${n}\\s*$`) }).first());
    const bbs = [];
    for (const l of locs) if (await l.count()) bbs.push(await box(l));
    const ux = Math.min(...bbs.map((q) => q.x));
    const uy = Math.min(...bbs.map((q) => q.y));
    const ux2 = Math.max(...bbs.map((q) => q.x + q.width));
    const uy2 = Math.max(...bbs.map((q) => q.y + q.height));
    const ub = { x: ux, y: uy, width: ux2 - ux, height: uy2 - uy };
    zoomOn(ub);
    await pg.evaluate(([x, y, w, h]) => window.__hl(x, y, w, h), [ub.x - 10, ub.y - 10, ub.width + 20, ub.height + 20]);
    await moveTo(ub.x + ub.width / 2, ub.y + ub.height / 2);
    say("SONUÇ", "Sonucu al", "İndir · Paylaş · Aç", "cihazına indir, uygulamayla paylaş ya da yeni sekmede aç", "");
    await wait(2340);
    await hlOff();
    await wait(214);
  }

  /** Sonuç ekranının üst konumu (kurgu, geçişte bu noktadan keser). */
  async function resultTop() {
    const rb = await pg.getByText(/^PDF hazır/).first().boundingBox();
    return { x: rb.x, y: rb.y };
  }

  /** Videoya girecek kısmın başlangıcı. */
  const begin = () => {
    startT = now();
    return startT;
  };

  /** Zaman çizelgesini yazar, tarayıcıyı kapatır. */
  async function finish(extra) {
    zoomOff();
    const end = +(now() - startT).toFixed(2);
    writeFileSync(`${workDir}/timeline.json`, JSON.stringify({ events, end, start: startT, zooms, VW, VH, ...extra }));
    await ctx.close();
    await browser.close();
    return end;
  }

  return {
    pg, VW, VH, wait, box, center, say, hl, hlText, hlOff, moveTo, zoomOn, zoomOff, openMenu, closeMenu,
    showResultButtons, resultTop, loginAndOpenTool, begin, finish, now, startAt: () => startT, events,
  };
}
