/**
 * Ortak çekim iskeleti: "dosyayı seç → (isteğe bağlı ayarlar) → büyük düğmeye bas → sonuç" akışındaki araçlar.
 *
 * Her araç kendi senaryo dosyasında yalnızca KENDİNE ÖZGÜ olanı verir: örnek belge, ekranda görünecek
 * yazılar, ayar adımları, basılacak düğme. Çekimin kendisi (imleç, vurgu, bekleme, sonuç ekranı) burada.
 *
 * Yazılar aracın gerçek ekranına/davranışına dayanmalıdır; uydurma iddia yazma.
 */

/** Dosya seçme penceresini açıp dosyaları verir (yavaş makinede sayfa yüklenirken tıklama boşa gidebilir: yeniden dener). */
export async function chooseFiles(st, dropzone, paths) {
  const { pg, center, moveTo, wait } = st;
  const dp = await center(dropzone);
  await moveTo(dp.x, dp.y);
  let chooser = null;
  for (let i = 0; i < 6 && !chooser; i++) {
    [chooser] = await Promise.all([
      pg.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null),
      pg.mouse.click(dp.x, dp.y),
    ]);
  }
  if (!chooser) throw new Error("Dosya seçme penceresi açılmadı");
  await wait(300);
  await chooser.setFiles(paths);
}

/** Açılır listede bir seçeneği göstererek seçer (menü kayıtta çizilir; seçim gerçekten yapılır). */
export async function pickOption(st, selectLoc, optionLabel, { hold = 900 } = {}) {
  const { pg, wait, moveTo, openMenu, closeMenu } = st;
  const m = await openMenu(selectLoc);
  const idx = m.opts.findIndex((o) => (optionLabel instanceof RegExp ? optionLabel.test(o) : o.includes(optionLabel)));
  if (idx < 0) throw new Error(`Seçenek bulunamadı: ${optionLabel} (${m.opts.join(" / ")})`);
  await wait(900);
  await moveTo(m.sp.x, m.rowC(idx));
  await wait(hold);
  await pg.mouse.click(m.sp.x, m.rowC(idx));
  await closeMenu();
  await selectLoc.selectOption({ index: idx });
  await wait(350);
}

/** Bir kutuya imleçle tıklayıp harf harf yazar. */
export async function typeInto(st, loc, text, { delay = 60 } = {}) {
  const { pg, center, moveTo, wait } = st;
  const c = await center(loc);
  await moveTo(c.x, c.y);
  await wait(400);
  await pg.mouse.click(c.x, c.y);
  await loc.fill("");
  await pg.keyboard.type(text, { delay });
  await wait(500);
}

/** Öğenin yeri/boyu en az `ms` boyunca değişmeyene kadar bekler (önizleme küçük resimleri yüklenirken sayfa kayar). */
export async function settle(st, loc, { ms = 1200, max = 25000 } = {}) {
  const t0 = Date.now();
  let last = null;
  let since = Date.now();
  while (Date.now() - t0 < max) {
    const b = await loc.boundingBox().catch(() => null);
    const key = b ? `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}` : null;
    if (key && key === last) {
      if (Date.now() - since >= ms) return;
    } else {
      last = key;
      since = Date.now();
    }
    await st.wait(250);
  }
}

/** İmleci düğmeye götürüp vurgular ve basar. */
export async function pressButton(st, loc, { pad = 8, before = 1400 } = {}) {
  const { pg, center, moveTo, hl, hlOff, wait } = st;
  await settle(st, loc);
  const c = await center(loc);
  await moveTo(c.x, c.y);
  await hl(loc, pad);
  await wait(before);
  await hlOff();
  await pg.mouse.click(c.x, c.y);
}

/** İmleci öğeye götürüp tıklar (onay kutusu, sekme, küçük düğme). */
export async function clickAt(st, loc, { hl = true, hold = 1100 } = {}) {
  const { pg, center, moveTo, wait, hlOff } = st;
  const c = await center(loc);
  await moveTo(c.x, c.y);
  if (hl) await st.hl(loc, 6).catch(() => {});
  await wait(hold);
  await pg.mouse.click(c.x, c.y);
  await wait(450);
  if (hl) await hlOff();
}

/** Kaydırma çubuğunu (range) adım adım yeni değere çeker; sayfa her adımda güncellenir. */
export async function dragRange(st, loc, to, { steps = 10 } = {}) {
  const { pg, center, moveTo, wait } = st;
  const c = await center(loc);
  await moveTo(c.x, c.y);
  await wait(500);
  const from = Number(await loc.inputValue());
  for (let i = 1; i <= steps; i++) {
    const v = Math.round(from + ((to - from) * i) / steps);
    await loc.evaluate((el, val) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      set.call(el, String(val));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, v);
    await wait(110);
  }
  await wait(500);
}

/** Düğme basılabilir olana kadar bekler (önkontrol bitmeden pasif kalan düğmeler için). */
export async function waitEnabled(loc, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if ((await loc.count()) && (await loc.first().isEnabled().catch(() => false))) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("Düğme etkinleşmedi");
}

/**
 * @param {object} cfg
 * @param {string} cfg.id
 * @param {string} cfg.toolPath
 * @param {{title:string, sub:string}} cfg.intro
 * @param {string[]} cfg.files                      örnek belgeler (make-fixtures.py üretir)
 * @param {string} [cfg.readySelector]              sayfanın hazır olduğunu gösteren öğe (varsayılan form.tool-form)
 * @param {string} [cfg.container]                  kurgunun gösterdiği kapsayıcı (varsayılan form.tool-form)
 * @param {(pg)=>any} [cfg.dropzone]                dosya bırakma alanı
 * @param {(pg)=>any} [cfg.loaded]                  dosya yüklendi göstergesi
 * @param {{l1?:string,l2?:string}} [cfg.pick]      1. adım yazıları
 * @param {Array<{title:string,l1?:string,l2?:string,run:(st,ctx)=>Promise<void>}>} [cfg.options]  ayar adımları
 * @param {(pg)=>any} cfg.button                    basılacak ana düğme
 * @param {{title:string,l1?:string,l2?:string}} cfg.press   düğme adımının yazısı
 * @param {RegExp} [cfg.resultText]                 sonuç başlığı (varsayılan PDF hazır / Dosyan hazır)
 * @param {(st,ctx)=>Promise<[string,string,string]>} [cfg.result]  sonuç satırları
 * @param {number} [cfg.timeout]                    işlem en çok kaç ms sürebilir
 */
export function simpleTool(cfg) {
  const resultRe = cfg.resultText ?? /^(PDF hazır|Dosyan hazır)/;
  return {
    id: cfg.id,
    toolPath: cfg.toolPath,
    intro: cfg.intro,
    files: cfg.files,
    readySelector: cfg.readySelector,

    async run(st, { fixtures, processing }) {
      const { pg, wait, box, center, say, hl, hlOff, moveTo } = st;
      const hasForm = (await pg.locator("form.tool-form").count()) > 0;
      const container = pg.locator(cfg.container ?? "form.tool-form").first();
      const dropzoneOf = () =>
        cfg.dropzone
          ? cfg.dropzone(pg)
          : hasForm
            ? pg.locator("form.tool-form [class*=cursor-pointer]").first()
            : pg.getByText(/buraya sürükle|^\+? ?Dosya ekle$/i).first();
      // Üstteki "Nasıl çalışır?" kutusu açıksa kapatılır: araç alanı yukarı çıkar, kesit kısalır.
      if (!hasForm || cfg.collapseHelp) {
        const help = pg.getByText("«Dosya Seç» düğmesine bas").first();
        if (await help.isVisible().catch(() => false)) {
          await pg.getByRole("button", { name: "Nasıl çalışır?" }).first().click().catch(() => {});
          await wait(500);
        }
      }
      let formBox;
      if (hasForm || cfg.container) {
        const bbf = await container.boundingBox();
        formBox = { x: bbf.x, y: bbf.y, w: bbf.width, h: bbf.height };
      } else {
        const d = cfg.files.length ? await box(dropzoneOf()) : await box(pg.locator("input,select,textarea").first());
        formBox = { x: 32, y: Math.max(70, d.y - 110), w: 796, h: 0 };
      }
      const upload = cfg.files.length > 0;
      const N = (upload ? 2 : 1) + (cfg.options?.length ?? 0);
      let n = 0;
      const lab = () => `ADIM ${++n} / ${N}`;
      st.begin();

      // 1) Dosya
      if (upload) {
        say(lab(), "Dosyanı seç ya da alana sürükle", cfg.pick?.l1 ?? "Saniyeler içinde", cfg.pick?.l2 ?? "", "");
        await wait(700);
        const dz = dropzoneOf();
        await hl(dz, 6).catch(() => {});
        await wait(900);
        await hlOff();
        await chooseFiles(st, dz, cfg.files.map((f) => fixtures(f)));
        await (cfg.loaded ? cfg.loaded(pg) : pg.getByText(cfg.files[0]).first()).waitFor({ timeout: 60000 });
        await wait(900);
        if (cfg.afterLoad) await cfg.afterLoad(st);
      }

      // 2) Ayarlar
      for (const o of cfg.options ?? []) {
        say(lab(), o.title, o.l1 ?? "", o.l2 ?? "", "");
        await wait(500);
        await o.run(st, { fixtures });
        await wait(500);
      }

      // 3) Ana düğme
      const btn = cfg.button(pg);
      await btn.first().waitFor({ state: "visible", timeout: 60000 });
      await waitEnabled(btn);
      await settle(st, btn.first());
      const btnBoxFinal = await box(btn.first());
      say(lab(), cfg.press.title, cfg.press.l1 ?? "", cfg.press.l2 ?? "", "");
      await pressButton(st, btn.first());
      say(`ADIM ${n} / ${N}`, "Birkaç saniye sürer…", processing[0], processing[1], "");
      // Bazı araçlar işlemden önce onay penceresi açar ("Tablo yapısı uyarısı → Evet, devam"): açılırsa imleçle
      // onaylanır. Pencere ne zaman açılacağı belli olmadığından sonuçla birlikte aynı döngüde beklenir.
      const resultLoc = pg.getByText(resultRe).first();
      const confirmBtn = pg.getByRole("button", { name: /^(Evet, devam|Evet|Devam et)$/ }).first();
      const deadline = Date.now() + (cfg.timeout ?? 120000);
      let confirmed = false;
      for (;;) {
        if (await resultLoc.isVisible().catch(() => false)) break;
        if (!confirmed && (await confirmBtn.isVisible().catch(() => false))) {
          confirmed = true;
          await wait(1200);
          await clickAt(st, confirmBtn, { hl: false, hold: 900 });
        }
        if (Date.now() > deadline) throw new Error("Sonuç ekranı gelmedi (zaman aşımı)");
        await wait(400);
      }
      const swapAt = +(st.now() - st.startAt()).toFixed(2);
      await wait(250);
      const resultBox = await st.resultTop(resultRe);

      const [t1, l1, l2] = cfg.result
        ? await cfg.result(st, { processing })
        : ["İşlem tamam", cfg.resultLine ?? "", `${processing[0]} · ${processing[1]}`];
      say("SONUÇ", t1, l1, l2, "green");
      await moveTo(700, 330);
      await wait(2300);
      await st.showResultButtons();
      return { formBox, loadedBox: formBox, resultBox, swapAt, btnBoxFinal, estText: "" };
    },
  };
}
