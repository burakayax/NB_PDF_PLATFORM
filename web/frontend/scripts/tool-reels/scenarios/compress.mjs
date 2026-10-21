/** PDF Sıkıştır: dosya seç → beklenen küçülme → hedef boyut → kalite → sıkıştır → sonuç. */

export default {
  id: "compress",
  toolPath: "/tools/compress",
  intro: { title: "PDF Sıkıştırma", sub: "Büyük PDF dosyalarını küçült" },
  /** Gösterilen belge; make-fixtures.py üretir. */
  files: ["Faaliyet-Raporu-2025.pdf"],

  async run(st, { fixtures, processing }) {
    const { pg, wait, box, center, say, hl, hlText, hlOff, moveTo, openMenu, closeMenu } = st;
    const bbf = await pg.locator("form.tool-form").boundingBox();
    const formBox = { x: bbf.x, y: bbf.y, w: bbf.width, h: bbf.height };
    st.begin();
    const N = 5;

    say(`ADIM 1 / ${N}`, "Dosyanı seç ya da alana sürükle", "Saniyeler içinde", "şifreli aktarım", "");
    await wait(786);
    const dp = await center(pg.getByText("Dosyaları buraya sürükle").first());
    await moveTo(dp.x, dp.y + 20);
    await hl(pg.locator("form.tool-form [class*=cursor-pointer]").first(), 6).catch(() => {});
    await wait(644);
    await hlOff();
    // Yavaş CI makinesinde sayfa hâlâ yükleniyor olabilir: tıklama boşa giderse yeniden denenir.
    let chooser = null;
    for (let i = 0; i < 5 && !chooser; i++) {
      [chooser] = await Promise.all([
        pg.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null),
        pg.mouse.click(dp.x, dp.y + 20),
      ]);
    }
    if (!chooser) throw new Error("Dosya seçme penceresi açılmadı");
    await wait(322);
    await chooser.setFiles(fixtures("Faaliyet-Raporu-2025.pdf"));
    await pg.getByText("Faaliyet-Raporu-2025.pdf").first().waitFor({ timeout: 30000 });
    await wait(429);
    const bbl = await pg.locator("form.tool-form").boundingBox();
    const loadedBox = { x: bbl.x, y: bbl.y, w: bbl.width, h: bbl.height };

    // Beklenen küçülme (dosya kartında); çıkmadıysa bu adım atlanır.
    const est = pg.locator(".selected-file-card__compress").first();
    let hasEst = false;
    try {
      await est.waitFor({ timeout: 15000 });
      hasEst = true;
    } catch {
      /* tahmin çıkmadı */
    }
    const estText = hasEst ? (await est.innerText()).trim() : "";
    if (hasEst) {
      await hlText(est, 8);
      const ep = await center(est);
      await moveTo(ep.x + 40, ep.y + 30);
      say(`ADIM 2 / ${N}`, "Beklenen küçülmeyi gör", estText, "dosyanın içeriğine göre hesaplanır", "");
      await wait(1859);
    }

    // Hedef boyut: açık menü tek adımda gösterilir, seçenekler sayfadan okunur.
    const hsel = pg.getByText("Hedef boyut", { exact: true }).locator("xpath=ancestor::label[1]").locator("select");
    const hm = await openMenu(hsel);
    say(`ADIM ${hasEst ? 3 : 2} / ${N}`, "İstersen hedef boyut belirle", "100 KB'den 10 MB'a kadar", "bir sınır seçebilirsin", "");
    await wait(1100);
    await moveTo(hm.sp.x, hm.rowC(hm.selIdx));
    await wait(900);
    await pg.mouse.click(hm.sp.x, hm.rowC(hm.selIdx));
    await closeMenu();
    await wait(322);

    // Kalite
    const ksel = pg.getByText("Kalite", { exact: true }).locator("xpath=ancestor::label[1]").locator("select");
    const km = await openMenu(ksel);
    say(`ADIM 4 / ${N}`, "Kaliteyi seç", "Agresif, Dengeli ya da Kaliteli", "Önerimiz: Otomatik", "");
    await wait(1100);
    await moveTo(km.sp.x, km.rowC(km.selIdx));
    await wait(900);
    await pg.mouse.click(km.sp.x, km.rowC(km.selIdx));
    await closeMenu();
    await wait(322);

    // Sıkıştır
    const btn = pg.getByRole("button", { name: /PDF.i Sıkıştır/ });
    await hlOff();
    const btnBoxFinal = await box(btn);
    const bp = await center(btn);
    await moveTo(bp.x, bp.y);
    await hl(btn, 8);
    say(`ADIM 5 / ${N}`, "Sıkıştır'a bas", "", "", "");
    await wait(1500);
    await hlOff();
    await pg.mouse.click(bp.x, bp.y);
    say(`ADIM 5 / ${N}`, "Birkaç saniye sürer…", processing[0], processing[1], "");
    await pg.getByText(/Yeniden yükleme yapmadan/i).first().waitFor({ timeout: 90000 });
    const swapAt = +(st.now() - st.startAt()).toFixed(2);
    await wait(200);
    const resultBox = await st.resultTop();

    // Sonuç sayıları sayfadan okunur (uydurulmaz).
    const resultText = (await pg.getByText(/küçüldü/).first().innerText()).trim();
    const m = resultText.match(/([\d.,]+)\s*(MB|KB|GB)\s*→\s*([\d.,]+)\s*(MB|KB|GB)\s*·\s*(%\d+)/);
    if (!m) throw new Error(`Sonuç metni okunamadı: ${resultText}`);
    const num = (x) => x.replace(".", ",");
    await hlText(pg.getByText(/küçüldü/).first(), 8);
    say("SONUÇ", "İşlem tamam", `${num(m[1])} ${m[2]}’den ${num(m[3])} ${m[4]}’ye`, `${m[5]} küçüldü`, "green");
    await moveTo(700, 330);
    await wait(1716);

    await st.showResultButtons();
    return { formBox, loadedBox, resultBox, swapAt, btnBoxFinal, estText };
  },
};
