/**
 * CV Oluştur: meslek seç → hazır örnek CV'yi aç → kendi bilgisini yaz → şablonu seç → PDF'i indir.
 * (Cihazda işlenir; yapay zekâ kullanılmaz.)
 *
 * Bu araç diğerleri gibi tek bir "form" değildir: adım adım bir sihirbazdır. Kurgu iki sabit pencere gösterir:
 *   1. pencere (WIZ_*): sihirbaz adımları (sayfanın alt yarısı),
 *   2. pencere (TOP_*): üstteki şablon seçici, sekmeler, CV önizlemesi ve "PDF olarak indir" düğmesi.
 * Sayfa kaydırması yalnızca "örnek CV" düğmesini ve yazılacak kutuyu görünür yapmak için kullanılır.
 */

const WIZ_Y = 640;
const WIZ_H = 760;
const TOP_Y = 190; // 2. pencerenin üstü (kurgu bundan 135 pay çıkarır: resultBox.y = TOP_Y + 135)
const PROFESSION = "Hemşire / Sağlık";
// Örnek CV'deki tek köşeli [X] satırı: gösterimde kendi rakamımızı yazarız.
const OWN_FIRST_BULLET = "Günde ortalama 14 hastanın bakımını ve takibini üstlendim";

export default {
  id: "cv-olustur",
  toolPath: "/tools/cv-olustur",
  readySelector: "text=/Adım \\d+ \\/ 11/i",
  intro: { title: "CV Oluştur", sub: "Hazır şablonla dakikalar içinde CV'ni hazırla" },
  files: [],

  async run(st) {
    const { pg, wait, box, center, say, hl, hlOff, moveTo } = st;
    const N = 5;

    const scroller = () => pg.evaluate(() => document.querySelector(".app-shell__scroll").scrollTop);
    const scrollTo = async (v) => {
      await pg.evaluate((s) => {
        const sc = document.querySelector(".app-shell__scroll");
        sc.style.scrollBehavior = "auto";
        sc.scrollTop = s;
      }, v);
      await wait(350);
    };
    /** Öğeyi (sayfa elverdiğince) y konumuna getirecek kadar kaydırır. */
    const reveal = async (loc, y) => {
      const bb = await box(loc);
      await scrollTo((await scroller()) + bb.y - y);
    };
    const seg = (name) => pg.locator(`button[aria-label="${name}"]`).first();
    const clickAt = async (loc) => {
      const c = await center(loc);
      await moveTo(c.x, c.y);
      await wait(450);
      await pg.mouse.click(c.x, c.y);
    };

    const formBox = { x: 32, y: WIZ_Y, w: 796, h: WIZ_H };
    st.begin();

    // ── 1. Meslek ──
    say(`ADIM 1 / ${N}`, "Mesleğini seç", "Sana uygun hazır cümleler", "ve beceri önerileri hazırlanır", "");
    const prof = pg.getByRole("button", { name: PROFESSION });
    const pc = await center(prof);
    await moveTo(pc.x, pc.y);
    await hl(prof, 6);
    await wait(1700);
    await pg.mouse.click(pc.x, pc.y);
    await wait(900);
    await hlOff();

    // ── 2. Hazır örnek CV ──
    const sample = pg.getByRole("button", { name: /Bu mesleğin örnek CV/ });
    await reveal(sample, 1180);
    say(`ADIM 2 / ${N}`, "Hazır örnek CV'yi aç", "Boş sayfayla uğraşma", "üzerine kendi bilgilerini yazarsın", "");
    const sc = await center(sample);
    await moveTo(sc.x, sc.y);
    await hl(sample, 8);
    await wait(1900);
    await hlOff();
    await pg.mouse.click(sc.x, sc.y);
    await wait(700);
    await scrollTo(0);
    await wait(1500);

    // ── 3. Kendi bilgin ──
    await clickAt(seg("Deneyim"));
    await wait(700);
    const ta = pg.locator("fieldset textarea").first();
    await ta.waitFor({ timeout: 15000 });
    {
      const bb = await box(ta);
      if (bb.y + bb.height > WIZ_Y + WIZ_H - 60) await reveal(ta, 1050);
    }
    say(`ADIM 3 / ${N}`, "Kendi bilgilerini yaz", "Her satır CV'de bir madde olur", "köşeli [X] yerine rakamını yaz", "");
    await hl(ta, 8);
    await wait(1300);
    const tc = await center(ta);
    await moveTo(tc.x, tc.y - 30);
    await pg.mouse.click(tc.x, tc.y - 30);
    await ta.evaluate((el) => {
      el.focus();
      const i = el.value.indexOf("\n");
      el.setSelectionRange(0, i < 0 ? el.value.length : i);
    });
    await pg.keyboard.type(OWN_FIRST_BULLET, { delay: 38 });
    await wait(1500);
    await hlOff();

    // ── 4. Önizleme + şablon (2. pencere) ──
    await scrollTo(0);
    say(`ADIM 4 / ${N}`, "CV'n anında oluşur", "30 şablon arasından seç", "sonucu hemen önizlemede gör", "");
    const swapAt = +(st.now() - st.startAt()).toFixed(2);
    await wait(300);
    await clickAt(pg.getByRole("tab", { name: "Önizleme", exact: true }));
    await wait(900);
    await clickAt(pg.getByRole("tab", { name: /PDF görünümü/ }));
    await wait(1700);
    await clickAt(pg.getByRole("button", { name: /Şablonu değiştir/ }));
    await wait(1100);
    const tpl = pg.getByRole("radio", { name: /Modern Mavi/ });
    await hl(tpl, 6);
    await wait(1200);
    await hlOff();
    await clickAt(tpl);
    await scrollTo(0);
    await wait(2200);

    // ── 5. PDF ──
    await clickAt(pg.getByRole("tab", { name: "Bilgilerim", exact: true }).first());
    await wait(900);
    const dl = pg.getByRole("button", { name: /CV'yi PDF olarak indir/ });
    say(`ADIM 5 / ${N}`, "PDF olarak indir", "Tek tıkla hazır", "", "");
    const dc = await center(dl);
    await moveTo(dc.x, dc.y);
    await hl(dl, 8);
    await wait(1700);
    await hlOff();
    await pg.mouse.click(dc.x, dc.y);
    await wait(1200);

    // CV gücü puanı sayfadan okunur (uydurulmaz).
    const body = await pg.locator("body").innerText();
    const m = body.match(/(\d{1,3})\s*\n\s*CV gücü\s*\n?\s*([^\n]+)/i);
    const score = m ? `%${m[1]} · ${m[2].trim()}` : "";
    say(
      "SONUÇ",
      "CV'in hazır",
      score ? `CV gücü ${score}` : "PDF olarak indirildi",
      "Bilgilerin yalnızca tarayıcında kalır · sunucuya gönderilmez",
      "green",
    );
    await moveTo(700, TOP_Y + 560);
    await wait(2600);
    await hl(dl, 10).catch(() => {});
    await wait(2000);

    return {
      formBox,
      loadedBox: formBox,
      resultBox: { x: 32, y: TOP_Y + 135 },
      swapAt,
      btnBoxFinal: { x: 32, y: WIZ_Y + WIZ_H - 14, width: 796, height: 0 },
      estText: "",
    };
  },
};
