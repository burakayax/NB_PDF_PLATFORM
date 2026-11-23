/** PDF Sıkıştır: dosya seç → beklenen küçülme → kalite → sıkıştır → sonuç. */

export default {
  id: "compress",
  toolPath: "/tools/compress",
  intro: { title: "PDF Sıkıştırma", sub: "Büyük PDF dosyalarını küçült" },
  /** Gösterilen belge (~100 MB tarama arşivi: etkileyici bir küçülme); make-fixtures.py "big" ile üretir. */
  files: ["Arsiv-Taramasi-2025.pdf"],

  async run(st, { fixtures, processing }) {
    const { pg, wait, box, center, say, hl, hlText, hlOff, moveTo, openMenu, closeMenu } = st;
    const bbf = await pg.locator("form.tool-form").boundingBox();
    const formBox = { x: bbf.x, y: bbf.y, w: bbf.width, h: bbf.height };
    st.begin();
    const N = 4;

    say(`ADIM 1 / ${N}`, "Dosyanı seç ya da alana sürükle", "Saniyeler içinde", "şifreli aktarım", "");
    await wait(450);
    const dp = await center(pg.getByText("Dosyaları buraya sürükle").first());
    await moveTo(dp.x, dp.y + 20);
    await hl(pg.locator("form.tool-form [class*=cursor-pointer]").first(), 6).catch(() => {});
    await wait(400);
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
    await wait(200);
    await chooser.setFiles(fixtures("Arsiv-Taramasi-2025.pdf"));
    await pg.getByText("Arsiv-Taramasi-2025.pdf").first().waitFor({ timeout: 30000 });
    await wait(250);
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
      await wait(1000);
    }

    // Kalite
    const ksel = pg.getByText("Kalite", { exact: true }).locator("xpath=ancestor::label[1]").locator("select");
    const km = await openMenu(ksel);
    say(`ADIM 3 / ${N}`, "Kaliteyi seç", "Agresif, Dengeli ya da Kaliteli", "Önerimiz: Otomatik", "");
    await wait(450);
    await moveTo(km.sp.x, km.rowC(km.selIdx));
    await wait(650);
    await pg.mouse.click(km.sp.x, km.rowC(km.selIdx));
    await closeMenu();
    await wait(200);

    // Sıkıştır
    const btn = pg.getByRole("button", { name: /PDF.i Sıkıştır/ });
    await hlOff();
    const btnBoxFinal = await box(btn);
    const bp = await center(btn);
    await moveTo(bp.x, bp.y);
    await hl(btn, 8);
    say(`ADIM 4 / ${N}`, "Sıkıştır'a bas", "", "", "");
    await wait(900);
    await hlOff();
    await pg.mouse.click(bp.x, bp.y);
    say(`ADIM 4 / ${N}`, "Birkaç saniye sürer…", processing[0], processing[1], "");
    // Sunucunun gerçek işleme süresi videoya girmez: ilk 1,6 sn gösterilir, kalanı kesilir.
    st.cutOpen(1.6);
    await pg.getByText(/Yeniden yükleme yapmadan/i).first().waitFor({ timeout: 90000 });
    st.cutClose();
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
    await wait(700);

    await st.showResultButtons();
    const stat = { big: m[5], small: `${num(m[1])} ${m[2]} → ${num(m[3])} ${m[4]}` };
    return { formBox, loadedBox, resultBox, swapAt, btnBoxFinal, estText, stat };
  },
};
