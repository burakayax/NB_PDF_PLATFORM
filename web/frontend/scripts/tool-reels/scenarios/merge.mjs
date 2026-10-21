/** PDF Birleştir: üç dosya seç → sırayı ayarla → birleştir → sonuç (cihazda işlenir). */

const FILES = ["Sozlesme.pdf", "Fatura.pdf", "Ekler.pdf"];

export default {
  id: "merge",
  toolPath: "/tools/merge",
  intro: { title: "PDF Birleştirme", sub: "Birden çok PDF'i tek dosyada topla" },
  files: FILES,

  async run(st, { fixtures, processing }) {
    const { pg, wait, box, center, say, hl, hlText, hlOff, moveTo, zoomOn } = st;
    const bbf = await pg.locator("form.tool-form").boundingBox();
    const dz = pg.locator("form.tool-form [class*=cursor-pointer]").first();
    const dzTop = await dz.boundingBox();
    // Kurgu, sürükle-bırak alanının üstünden başlar (üstteki "nasıl çalışır" kutusu girmez).
    const formBox = { x: bbf.x, y: dzTop.y, w: bbf.width, h: bbf.height };
    st.begin();
    const N = 4;

    say(`ADIM 1 / ${N}`, "Dosyalarını seç", "Birden çok PDF'i bir arada", "seçebilir ya da sürükleyip bırakabilirsin", "");
    const dp = await center(dz);
    await moveTo(dp.x, dp.y);
    await hl(dz, 6);
    await wait(1500);
    await hlOff();
    // Yavaş CI makinesinde sayfa hâlâ yükleniyor olabilir: tıklama boşa giderse yeniden denenir.
    let chooser = null;
    for (let i = 0; i < 5 && !chooser; i++) {
      [chooser] = await Promise.all([
        pg.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null),
        pg.mouse.click(dp.x, dp.y),
      ]);
    }
    if (!chooser) throw new Error("Dosya seçme penceresi açılmadı");
    await chooser.setFiles(FILES.map((f) => fixtures(f)));
    await pg.getByText("Ekler.pdf").first().waitFor({ timeout: 30000 });
    // Önkontrol bitmeden birleştirme kapalı: tüm satırlar "Hazır" olsun.
    // Yavaş CI makinesinde önkontrol uzun sürebilir; takılırsa listenin ne dediği kayda geçsin.
    try {
      await pg.getByText("Hazır", { exact: true }).nth(2).waitFor({ timeout: 90000 });
    } catch (err) {
      console.log("ONKONTROL TAKILDI:", (await pg.locator("form.tool-form").innerText().catch(() => "?")).slice(0, 800));
      throw err;
    }
    await wait(300);

    // Sıra: üçüncü dosyayı bir yukarı al.
    const upE = pg.locator("form.tool-form button", { hasText: "↑" }).nth(2);
    const listBox = await pg.getByText("Seçilen dosyalar").first().boundingBox();
    const upBox0 = await box(upE);
    const listR = {
      x: formBox.x + 16,
      y: listBox.y - 14,
      w: formBox.w - 32,
      h: upBox0.y + upBox0.height + 18 - (listBox.y - 14),
    };
    say(`ADIM 2 / ${N}`, "Sırayı ayarla", "Okları kullan ya da sürükle", "birleştirme bu sıraya göre yapılır", "");
    zoomOn(listR);
    await pg.evaluate(([x, y, w, h]) => window.__hl(x, y, w, h), [listR.x, listR.y, listR.w, listR.h]);
    await wait(1000);
    const up = await center(upE);
    await moveTo(up.x, up.y);
    await pg.mouse.click(up.x, up.y);
    await wait(1500);
    await hlOff();

    // Birleştir
    const btn = pg.getByRole("button", { name: /PDF.leri Birleştir/ });
    const btnBoxFinal = await box(btn);
    const bp = await center(btn);
    await moveTo(bp.x, bp.y);
    await hl(btn, 8);
    say(`ADIM 3 / ${N}`, "Birleştir'e bas", `${FILES.length} dosya tek PDF olur`, "", "");
    await wait(1700);
    await hlOff();
    await pg.mouse.click(bp.x, bp.y);
    await pg.getByText(/^PDF hazır/).first().waitFor({ timeout: 60000 });
    const swapAt = +(st.now() - st.startAt()).toFixed(2);
    await wait(200);
    const resultBox = await st.resultTop();

    await hlText(pg.getByText(/sunucuya yüklenmedi/).first(), 8);
    say("SONUÇ", "İşlem tamam", `${FILES.length} dosya tek PDF oldu`, `${processing[0]} · ${processing[1]}`, "green");
    await moveTo(700, 330);
    await wait(2300);

    await st.showResultButtons();
    return { formBox, loadedBox: formBox, resultBox, swapAt, btnBoxFinal, estText: "" };
  },
};
