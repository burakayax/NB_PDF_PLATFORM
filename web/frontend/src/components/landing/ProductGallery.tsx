import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CircleCheck,
  ClipboardPenLine,
  Combine,
  Crop,
  FileUser,
  Highlighter,
  Lock,
  Maximize2,
  MoveHorizontal,
  PenLine,
  SquareSplitHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Language } from "../../i18n/landing";

/**
 * ÜRÜN GALERİSİ — "sekmeli ürün turu".
 *
 * Solda ne göreceğini söyleyen sekmeler, sağda tek bir büyük çerçeve: ziyaretçi sırayla
 * gezerken hep aynı yere bakar, çerçeve zıplamaz.
 *
 * Görseller uygulamanın kendisinden alınmış gerçek ekran görüntüleridir (örnek belge ve örnek
 * CV bilgileriyle). Dile göre ayrı görsel tutulur; bir ekranın İngilizce arayüzü eksikse o ekran
 * İngilizce turda hiç gösterilmez (Türkçe arayüzlü görseli İngilizce ziyaretçiye göstermeyiz).
 *
 * Erişilebilirlik: gerçek `tablist/tab/tabpanel` rolleri, ok tuşlarıyla gezinme. Otomatik geçiş;
 * fareyle üstüne gelince, odaklanınca ve "hareketi azalt" ayarında durur.
 */

type Copy = {
  label: string;
  desc: string;
  badge: string;
  path: string;
  alt: string;
  points: string[];
};
/** Görselin kendi piksel koordinatında numaralı işaret noktası */
type Pin = { x: number; y: number };
type Shot = {
  id: string;
  Icon: LucideIcon;
  /** Renk (r,g,b) — sekme vurgusu ve çerçeve ışıması */
  accent: string;
  /** Dil → masaüstü görsel yolu; yoksa o dilde gösterilmez */
  img: Partial<Record<Language, string>>;
  /** Masaüstü görselin piksel boyutu (işaretlerin yüzdeye çevrilmesi ve çerçeve oranı için) */
  w: number;
  h: number;
  /** Numaralı işaretler; `points` açıklamalarıyla aynı sırada */
  pins: Pin[];
  /** İngilizce arayüzde düğme genişlikleri farklıysa kullanılacak noktalar (yoksa `pins`) */
  pinsEn?: Pin[];
  /** Dil → telefon görseli (dar ekranda telefon çerçevesinde gösterilir) */
  mimg: Record<Language, string>;
  tr: Copy;
  en: Copy;
};

const SHOTS: Shot[] = [
  {
    id: "cv",
    Icon: FileUser,
    accent: "99,102,241",
    img: {
      tr: "/screenshots/tour-cv-c.webp",
      en: "/screenshots/tour-cv-en-c.webp",
    },
    w: 1535,
    h: 1200,
    pins: [
      { x: 1200, y: 388 },
      { x: 62, y: 580 },
      { x: 1255, y: 700 },
      { x: 1458, y: 531 },
    ],
    mimg: {
      tr: "/screenshots/tour-m-cv.webp",
      en: "/screenshots/tour-m-cv-en.webp",
    },
    tr: {
      label: "CV'nizi canlı oluşturun",
      desc: "30 şablondan birini seçin, bilgilerinizi yazın; CV'niz yanda anında şekillensin. Hazır olunca tek tıkla PDF.",
      badge: "Bilgileriniz cihazınızda kalır",
      path: "pdfplatform.app/tools/cv-olustur",
      alt: "CV Oluştur: şablon seçimi, canlı PDF önizlemesi, CV gücü puanı ve tasarım ayarları",
      points: [
        "30 şablondan birini seçin; değiştirdiğinizde CV anında yenilenir.",
        'Bilgilerinizi yazdıkça CV yanda canlı şekillenir. "PDF görünümü" indireceğiniz sayfayı gösterir.',
        "CV gücü puanı eksik ve zayıf yerleri size söyler.",
        "Tek tıkla PDF; Word ve diğer seçenekler hemen altındaki menüde.",
      ],
    },
    en: {
      label: "Build your CV live",
      desc: "Pick one of 30 templates and type your details; your CV takes shape beside you as you write. One click to PDF.",
      badge: "Your details stay on your device",
      path: "pdfplatform.app/en/tools/cv-maker",
      alt: "CV Maker: template picker, live PDF preview, CV strength score and design settings",
      points: [
        "Pick one of 30 templates; the CV refreshes the moment you switch.",
        "As you type, the CV takes shape beside the form. PDF view shows the page you will download.",
        "The CV strength score points out what is missing or weak.",
        "One click to PDF; Word and other options are in the menu right below.",
      ],
    },
  },
  {
    id: "sign",
    Icon: PenLine,
    accent: "244,114,182",
    img: {
      tr: "/screenshots/tour-sign.webp",
      en: "/screenshots/tour-sign-en.webp",
    },
    w: 1920,
    h: 1200,
    pins: [
      { x: 172, y: 36 },
      { x: 570, y: 612 },
      { x: 322, y: 40 },
      { x: 1622, y: 108 },
    ],
    pinsEn: [
      { x: 222, y: 36 },
      { x: 570, y: 612 },
      { x: 352, y: 40 },
      { x: 1592, y: 108 },
    ],
    mimg: {
      tr: "/screenshots/tour-m-sign.webp",
      en: "/screenshots/tour-m-sign-en.webp",
    },
    tr: {
      label: "PDF'e imza atın",
      desc: "İmzanızı çizin, yazın ya da yükleyin; belgede istediğiniz yere yerleştirin.",
      badge: "Cihazınızda · üyeliksiz",
      path: "pdfplatform.app/tools/pdf-imzala",
      alt: "PDF İmzala: sözleşmede müşteri satırına yerleştirilmiş el yazısı imza",
      points: [
        "«İmza Ekle» ile imzanızı fareyle çizin, adınızı yazın ya da imza görselinizi yükleyin.",
        "İmza belgeye gelir; sürükleyerek yerine koyun, köşesinden boyutlandırın.",
        "Metin ve Tarih ekleyerek belgeyi tamamlayın; renk ve saydamlığı üstten seçin.",
        "Hazır olunca «Uygula ve İndir» deyin; dosyanız cihazınızdan çıkmaz.",
      ],
    },
    en: {
      label: "Sign a PDF",
      desc: "Draw, type or upload your signature, then place it anywhere on the page.",
      badge: "On your device · no sign-up",
      path: "pdfplatform.app/en/tools/sign-pdf",
      alt: "Sign PDF: a handwritten signature placed on the client line of an agreement",
      points: [
        "With Add signature, draw your signature with the mouse, type your name or upload an image of it.",
        "The signature lands on the page; drag it into place and resize it from the corner.",
        "Add Text and Date to finish the document, and pick colour and opacity at the top.",
        "When you are ready, choose Apply & download; your file never leaves your device.",
      ],
    },
  },
  {
    id: "annot",
    Icon: Highlighter,
    accent: "250,204,21",
    img: {
      tr: "/screenshots/tour-annot.webp",
      en: "/screenshots/tour-annot-en.webp",
    },
    w: 1920,
    h: 1200,
    pins: [
      { x: 1560, y: 650 },
      { x: 1090, y: 798 },
      { x: 1392, y: 922 },
      { x: 1612, y: 40 },
    ],
    pinsEn: [
      { x: 1560, y: 657 },
      { x: 1278, y: 796 },
      { x: 1500, y: 928 },
      { x: 1592, y: 40 },
    ],
    mimg: {
      tr: "/screenshots/tour-m-annot.webp",
      en: "/screenshots/tour-m-annot-en.webp",
    },
    tr: {
      label: "Belgeyi işaretleyin",
      desc: "Önemli yerleri vurgulayın, çerçeveleyin, okla gösterin.",
      badge: "Cihazınızda · üyeliksiz",
      path: "pdfplatform.app/tools/pdf-yorumla",
      alt: "PDF İşaretle: sözleşmede sarı vurgu, kırmızı kutu ve ok",
      points: [
        "Vurgu ile önemli cümleyi sarıyla işaretleyin; Fosforlu ve Kalem serbest çizim içindir.",
        "Kutu ile bir rakamı ya da ifadeyi çerçeveleyin.",
        "Ok ile dikkat çekin; Metin aracıyla not da yazabilirsiniz.",
        "Bitince «Uygula ve İndir» deyin; işlem cihazınızda yapılır.",
      ],
    },
    en: {
      label: "Mark up a document",
      desc: "Highlight what matters, box it and point an arrow at it.",
      badge: "On your device · no sign-up",
      path: "pdfplatform.app/en/tools/annotate-pdf",
      alt: "Annotate PDF: yellow highlight, red box and arrow on an agreement",
      points: [
        "Highlight marks a key sentence in yellow; Marker and Pen are for freehand drawing.",
        "Box frames a figure or a phrase.",
        "Arrow draws attention to it; the Text tool lets you add a note.",
        "When you are done, choose Apply & download; it all happens on your device.",
      ],
    },
  },
  {
    id: "form",
    Icon: ClipboardPenLine,
    accent: "52,211,153",
    img: {
      tr: "/screenshots/tour-form.webp",
      en: "/screenshots/tour-form-en.webp",
    },
    w: 1920,
    h: 1200,
    pins: [
      { x: 872, y: 106 },
      { x: 505, y: 528 },
      { x: 790, y: 961 },
      { x: 545, y: 1059 },
    ],
    mimg: {
      tr: "/screenshots/tour-m-form.webp",
      en: "/screenshots/tour-m-form-en.webp",
    },
    tr: {
      label: "Formları bilgisayarda doldurun",
      desc: "Formdaki alanlar otomatik bulunur; yazın, isterseniz kilitleyin.",
      badge: "Dosyanız cihazınızdan çıkmaz",
      path: "pdfplatform.app/tools/form-doldur",
      alt: "PDF Form Doldurma: başvuru formunun alanları doldurulmuş",
      points: [
        "Dosyayı seçtiğiniz anda formdaki doldurulabilir alanlar otomatik bulunur.",
        "Alanları doğrudan yazarak doldurun; Türkçe karakterler bozulmadan yazılır.",
        "«Doldurduktan sonra kilitle» ile alanlar kalıcı içeriğe dönüşür; karşı taraf değiştiremez.",
        "Hazır olunca «Formu doldur» deyin; araç ücretsiz, ücretsiz üye girişi yeterli.",
      ],
    },
    en: {
      label: "Fill forms on screen",
      desc: "Form fields are found automatically; type in them and lock if you like.",
      badge: "Your file never leaves your device",
      path: "pdfplatform.app/en/tools/fill-pdf-form",
      alt: "Fill PDF Form: an application form with its fields filled in",
      points: [
        "The moment you pick the file, its fillable fields are found automatically.",
        "Type straight into the fields; special characters are written without being lost.",
        "Lock after filling turns the fields into permanent content that the recipient cannot change.",
        "When you are ready, choose Fill form; the tool is free and a free sign-in is enough.",
      ],
    },
  },
  {
    id: "crop",
    Icon: Crop,
    accent: "56,189,248",
    img: {
      tr: "/screenshots/tour-crop.webp",
      en: "/screenshots/tour-crop-en.webp",
    },
    w: 1920,
    h: 1200,
    pins: [
      { x: 440, y: 498 },
      { x: 1465, y: 420 },
      { x: 1462, y: 562 },
      { x: 1462, y: 816 },
    ],
    mimg: {
      tr: "/screenshots/tour-m-crop.webp",
      en: "/screenshots/tour-m-crop-en.webp",
    },
    tr: {
      label: "Belgeden kesit alın",
      desc: "Tabloyu ya da grafiği seçin; PDF, PNG veya JPEG olarak kaydedin.",
      badge: "Cihazınızda · üyeliksiz",
      path: "pdfplatform.app/tools/pdf-kesit-al",
      alt: "Kesit Al: faturadan seçilen tablo ve kesit listesi",
      points: [
        "Sayfada sürükleyerek alan seçin; kutuyu taşıyın, köşelerden boyutlandırın.",
        "«Kesiti Ekle» ile alan listeye girer; aynı belgeden istediğiniz kadar kesit ekleyin.",
        "Kesitler listelenir; sıralarını değiştirin, tek tek indirin ya da silin.",
        "PDF, PNG veya JPEG olarak kaydedin; çözünürlüğü baskı için seçebilirsiniz.",
      ],
    },
    en: {
      label: "Snip part of a page",
      desc: "Select a table or a chart and save it as PDF, PNG or JPEG.",
      badge: "On your device · no sign-up",
      path: "pdfplatform.app/en/tools/crop-pdf-to-image",
      alt: "Snip: a table selected from an invoice and the list of snips",
      points: [
        "Drag on the page to select an area; move the box and resize it from the corners.",
        "Add snip puts the area in a list; add as many snips from the same document as you need.",
        "Snips are listed; reorder them, download them one by one or delete them.",
        "Save as PDF, PNG or JPEG; you can choose a print resolution.",
      ],
    },
  },
  {
    id: "merge",
    Icon: Combine,
    accent: "129,140,248",
    img: {
      tr: "/screenshots/tour-merge.webp",
      en: "/screenshots/tour-merge-en.webp",
    },
    w: 1920,
    h: 1200,
    pins: [
      { x: 1230, y: 200 },
      { x: 840, y: 308 },
      { x: 1300, y: 436 },
      { x: 560, y: 716 },
    ],
    mimg: {
      tr: "/screenshots/tour-m-merge.webp",
      en: "/screenshots/tour-m-merge-en.webp",
    },
    tr: {
      label: "PDF'leri birleştirin",
      desc: "Birkaç PDF'i sıraya dizin, tek belgede toplayın.",
      badge: "Ücretsiz · üyeliksiz",
      path: "pdfplatform.app/tools/merge-pdf",
      alt: "PDF Birleştirme: sıralanmış üç dosya ve Birleştir düğmesi",
      points: [
        "PDF'leri sürükleyip bırakın ya da «Dosya ekle» ile seçin; birkaçını birden ekleyebilirsiniz.",
        "Üstte kaç dosya, kaç sayfa ve toplam boyutu görürsünüz; hepsi cihazınızda işlenir.",
        "Sıralamak için satırı sürükleyin ya da ok düğmelerini kullanın.",
        "«Birleştir» deyin; sonuç saniyeler içinde hazır olur. Üyelik gerekmez.",
      ],
    },
    en: {
      label: "Merge PDFs",
      desc: "Put several PDFs in order and combine them into one file.",
      badge: "Free · no sign-up",
      path: "pdfplatform.app/en/tools/merge-pdf",
      alt: "Merge PDF: three files in order and the Merge button",
      points: [
        "Drag and drop PDFs or choose them with Add file; you can add several at once.",
        "At the top you see how many files, pages and the total size; it is all processed on your device.",
        "To reorder, drag a row or use the arrow buttons.",
        "Choose Merge; the result is ready in seconds. No account needed.",
      ],
    },
  },
  {
    id: "pages",
    Icon: SquareSplitHorizontal,
    accent: "59,130,246",
    img: {
      tr: "/screenshots/tour-pages.webp",
      en: "/screenshots/tour-pages-en.webp",
    },
    w: 1920,
    h: 1200,
    pins: [
      { x: 960, y: 330 },
      { x: 1050, y: 75 },
      { x: 46, y: 141 },
      { x: 1868, y: 122 },
    ],
    mimg: {
      tr: "/screenshots/tour-m-pages.webp",
      en: "/screenshots/tour-m-pages-en.webp",
    },
    tr: {
      label: "Sayfaları görerek seçin",
      desc: "Sayfa numarası tahmin etmek yok. Küçük görsellere tıklayın, hangi sayfaları aldığınızı gözünüzle görün.",
      badge: "Ücretsiz · üyeliksiz",
      path: "pdfplatform.app/tools/split-pdf",
      alt: "PDF Ayır: sayfa küçük görselleri, seçili sayfalar işaretli",
      points: [
        "Seçtiğiniz sayfalar parlak çerçeveyle işaretlenir; tıklayın ya da boş alanda sürükleyin.",
        "Kaç sayfa seçtiğinizi üstte canlı görürsünüz.",
        "Kısa kullanım notu hep ekranın üstünde: Ctrl+A tümünü seçer, Ctrl+D temizler.",
        "Vazgeçerseniz seçimi tek tıkla temizleyin.",
      ],
    },
    en: {
      label: "Pick pages by eye",
      desc: "No guessing page numbers. Click the thumbnails and see exactly which pages you are taking.",
      badge: "Free · no sign-up",
      path: "pdfplatform.app/en/tools/split-pdf",
      alt: "Split PDF: page thumbnails with the chosen pages highlighted",
      points: [
        "Pages you pick get a bright outline; click them or drag across empty space.",
        "A live counter at the top shows how many pages are selected.",
        "A short how-to stays at the top: Ctrl+A selects all, Ctrl+D clears.",
        "Changed your mind? Clear the selection in one click.",
      ],
    },
  },
  {
    id: "order",
    Icon: MoveHorizontal,
    accent: "16,185,129",
    img: {
      tr: "/screenshots/tour-order.webp",
      en: "/screenshots/tour-order-en.webp",
    },
    w: 1920,
    h: 1180,
    pins: [
      { x: 779, y: 215 },
      { x: 1042, y: 615 },
      { x: 46, y: 141 },
      { x: 620, y: 73 },
    ],
    mimg: {
      tr: "/screenshots/tour-m-order.webp",
      en: "/screenshots/tour-m-order-en.webp",
    },
    tr: {
      label: "Sırayı değiştirin",
      desc: "Sayfaları ok düğmeleriyle ya da hedef numarayı yazarak taşıyın; sonucu indirmeden önce görün.",
      badge: "Ücretsiz · üyeliksiz",
      path: "pdfplatform.app/tools/organize-pdf",
      alt: "PDF Sayfa Düzenleme: sayfa kartları ve sıra değiştirme düğmeleri",
      points: [
        "Her kartın üstündeki ok düğmeleri sayfayı bir adım sola ya da sağa taşır.",
        "Alttaki numara kutusuna hedef sırayı yazarak sayfayı doğrudan o yere gönderin.",
        "Nasıl kullanılacağı ekranın üstünde kısaca yazar.",
        "Yakınlaştırma düğmeleriyle kartları %25 ile %100 arasında küçültüp büyütün.",
      ],
    },
    en: {
      label: "Reorder with a click",
      desc: "Move pages with the arrow buttons or by typing a target number, and check the result before you download.",
      badge: "Free · no sign-up",
      path: "pdfplatform.app/en/tools/organize-pdf",
      alt: "Organize PDF: page cards with reorder buttons",
      points: [
        "The arrow buttons on each card move that page one step left or right.",
        "Type a target number in the box at the bottom to send a page straight to that position.",
        "A short how-to sits at the top of the screen.",
        "Zoom buttons shrink or enlarge the cards from 25% to 100%.",
      ],
    },
  },
];

const AUTO_MS = 7000;

/** Dar ekran (telefon) mı? Yalnızca bir görsel yüklensin diye CSS yerine durum olarak izlenir. */
function usePhone(): boolean {
  const q = "(max-width: 639px)";
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(q).matches,
  );
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setPhone(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}

export function ProductGallery({
  language,
  onUseWebApp,
}: {
  language: Language;
  onUseWebApp: () => void;
}) {
  const tr = language === "tr";
  const shots = SHOTS.filter((s) => s.img[language]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hoverPin, setHoverPin] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const phone = usePhone();

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Büyütülmüş görünümde Esc ile kapat; açıkken sayfa kaymasın.
  useEffect(() => {
    if (!zoomed) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setZoomed(false);
    window.addEventListener("keydown", onEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [zoomed]);

  // Otomatik ilerleme — durdurulabilir, hareketi azalt ayarına saygılı.
  useEffect(() => {
    if (paused || reduceMotion || zoomed) return;
    const t = window.setTimeout(
      () => setActive((i) => (i + 1) % shots.length),
      AUTO_MS,
    );
    return () => window.clearTimeout(t);
  }, [active, paused, reduceMotion, zoomed, shots.length]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      setActive((i) =>
        e.key === "ArrowRight"
          ? (i + 1) % shots.length
          : (i - 1 + shots.length) % shots.length,
      );
      const next =
        tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
      next?.forEach(
        (b) => b.getAttribute("aria-selected") === "true" && b.focus(),
      );
    },
    [shots.length],
  );

  const shot = shots[Math.min(active, shots.length - 1)];
  const copy = shot[language];
  const src = shot.img[language] as string;

  return (
    <section
      id="showcase"
      className="relative overflow-hidden px-5 py-12 sm:px-8 sm:py-20"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.09)_0%,transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Başlık */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            {tr ? "Ürün Turu" : "Product Tour"}
          </span>
          <h2
            className="mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-[2.75rem]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {tr ? "Ürünü yakından görün" : "See the product up close"}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            {tr
              ? "Gerçek uygulamadan alınmış ekranlar; numaralı noktalar her alanın ne işe yaradığını gösterir. Yalnızca örnek belge ve örnek CV bilgileri kullanıldı."
              : "Screens taken from the real app. The numbered dots show what each area does. Only a sample document and a sample CV are used."}
          </p>
        </motion.div>

        {/* Sekmeler + çerçeve */}
        <div
          className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,290px)_minmax(0,1fr)] lg:items-start lg:gap-10"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          {/* Sekme listesi */}
          <div
            ref={tabsRef}
            role="tablist"
            aria-label={tr ? "Ürün ekranları" : "Product screens"}
            onKeyDown={onKeyDown}
            className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-3 lg:overflow-visible lg:pb-0"
          >
            {shots.map((s, i) => {
              const on = i === active;
              const c = s[language];
              const TabIcon = s.Icon;
              return (
                <button
                  key={s.id}
                  role="tab"
                  id={`tab-${s.id}`}
                  aria-selected={on}
                  aria-controls={`shot-${s.id}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={`group relative flex-shrink-0 overflow-hidden rounded-2xl border px-4 py-4 text-left transition duration-200 lg:flex-shrink ${
                    on
                      ? "border-white/20 bg-white/[0.07]"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.045]"
                  }`}
                  style={
                    on
                      ? { boxShadow: `0 18px 40px -24px rgba(${s.accent},0.8)` }
                      : undefined
                  }
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10"
                      style={{
                        background: `linear-gradient(140deg, rgba(${s.accent},0.34), rgba(${s.accent},0.08))`,
                        color: `rgb(${s.accent})`,
                      }}
                    >
                      <TabIcon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    <span
                      className={`whitespace-nowrap text-[14px] font-bold lg:whitespace-normal ${on ? "text-white" : "text-slate-300"}`}
                    >
                      {c.label}
                    </span>
                  </span>

                  {/* Açıklama + güven etiketi yalnız geniş ekranda; dar ekranda sekme çip gibi durur */}
                  <span
                    className={`mt-2.5 text-[13px] leading-relaxed text-slate-400 ${on ? "hidden lg:block" : "hidden"}`}
                  >
                    {c.desc}
                  </span>
                  <span
                    className={`mt-3 items-center gap-1.5 text-[11.5px] font-semibold text-slate-300 ${on ? "hidden lg:inline-flex" : "hidden"}`}
                  >
                    <CircleCheck
                      className="h-3.5 w-3.5"
                      style={{ color: `rgb(${s.accent})` }}
                      aria-hidden="true"
                    />
                    {c.badge}
                  </span>

                  {/* Otomatik geçiş göstergesi */}
                  {on && !reduceMotion && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
                      <motion.span
                        key={`${s.id}-${paused ? "p" : "r"}`}
                        className="block h-full"
                        style={{ background: `rgb(${s.accent})` }}
                        initial={{ width: "0%" }}
                        animate={{ width: paused ? "0%" : "100%" }}
                        transition={{
                          duration: paused ? 0 : AUTO_MS / 1000,
                          ease: "linear",
                        }}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Çerçeve: telefonda telefon, diğerlerinde tarayıcı */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-8 -bottom-10 top-8 -z-10 blur-[80px] transition-colors duration-500"
              style={{ background: `rgba(${shot.accent},0.22)` }}
            />
            {phone ? (
              <div className="mx-auto w-[min(100%,270px)] rounded-[2.4rem] border border-white/[0.14] bg-[#05080f] p-2 shadow-[0_40px_90px_-35px_rgba(0,0,0,0.95)] ring-1 ring-black/40">
                <div className="relative aspect-[390/844] overflow-hidden rounded-[1.9rem] bg-[#070d19]">
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-2 z-10 h-[18px] w-[72px] -translate-x-1/2 rounded-full bg-black/80"
                  />
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={`${shot.id}-${language}-m`}
                      id={`shot-${shot.id}`}
                      role="tabpanel"
                      aria-labelledby={`tab-${shot.id}`}
                      src={shot.mimg[language]}
                      alt={copy.alt}
                      width={780}
                      height={1688}
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover object-top"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0b1220] shadow-[0_50px_110px_-40px_rgba(0,0,0,0.95)] ring-1 ring-black/40">
                {/* Üst çubuk */}
                <div className="flex items-center gap-3 border-b border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.02] px-4 py-2.5">
                  <span className="flex gap-1.5" aria-hidden="true">
                    {[0, 1, 2].map((n) => (
                      <span
                        key={n}
                        className="h-2.5 w-2.5 rounded-full bg-white/15"
                      />
                    ))}
                  </span>
                  <span className="mx-auto flex max-w-[340px] flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.07] bg-black/30 px-3 py-1 text-[11px] text-slate-400">
                    <Lock
                      className="h-3 w-3 text-emerald-400/80"
                      aria-hidden="true"
                    />
                    <span className="truncate">{copy.path}</span>
                  </span>
                  <span className="w-[42px]" aria-hidden="true" />
                </div>

                {/* Görsel + numaralı işaretler */}
                <div
                  className="relative bg-[#070d19]"
                  style={{ aspectRatio: `${shot.w} / ${shot.h}` }}
                >
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={`${shot.id}-${language}`}
                      id={`shot-${shot.id}`}
                      role="tabpanel"
                      aria-labelledby={`tab-${shot.id}`}
                      src={src}
                      alt={copy.alt}
                      width={shot.w}
                      height={shot.h}
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover object-top"
                      initial={{ opacity: 0, scale: 1.012 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </AnimatePresence>

                  {(language === "en" && shot.pinsEn
                    ? shot.pinsEn
                    : shot.pins
                  ).map((pin, i) => {
                    const hot = hoverPin === i;
                    return (
                      <span
                        key={`${shot.id}-pin-${i}`}
                        aria-hidden="true"
                        className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${(pin.x / shot.w) * 100}%`,
                          top: `${(pin.y / shot.h) * 100}%`,
                        }}
                      >
                        {!reduceMotion && (
                          <span
                            className={`absolute inset-0 rounded-full ${hot ? "animate-ping" : ""}`}
                            style={{ background: `rgba(${shot.accent},0.55)` }}
                          />
                        )}
                        <span
                          className={`relative flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-extrabold text-white ring-2 transition-transform duration-200 ${
                            hot ? "scale-125 ring-white" : "ring-white/80"
                          }`}
                          style={{
                            background: `linear-gradient(140deg, rgb(${shot.accent}), rgba(${shot.accent},0.72))`,
                            boxShadow: `0 6px 18px -4px rgba(${shot.accent},0.9), 0 0 0 4px rgba(${shot.accent},0.22)`,
                          }}
                        >
                          {i + 1}
                        </span>
                      </span>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setZoomed(true)}
                    className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-[11.5px] font-semibold text-white opacity-90 backdrop-blur transition hover:bg-black/80 hover:opacity-100"
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {tr ? "Büyüt" : "Enlarge"}
                  </button>
                </div>
              </div>
            )}

            {/* Dar ekranda kısa açıklama */}
            <div className="mt-4 text-center lg:hidden">
              <p className="text-[13px] leading-relaxed text-slate-400">
                {copy.desc}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-300">
                <CircleCheck
                  className="h-3.5 w-3.5 text-slate-400"
                  aria-hidden="true"
                />
                {copy.badge}
              </p>
            </div>

            {/* Ekranda neler var: numaralı açıklamalar (noktalarla eşleşir) */}
            {!phone && (
              <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  {tr ? "Bu ekranda neler var" : "What you are looking at"}
                </p>
                <ol className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {copy.points.map((text, i) => (
                    <li
                      key={`${shot.id}-pt-${i}`}
                      onMouseEnter={() => setHoverPin(i)}
                      onMouseLeave={() => setHoverPin(null)}
                      className="flex items-start gap-3"
                    >
                      <span
                        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
                        style={{
                          background: `linear-gradient(140deg, rgb(${shot.accent}), rgba(${shot.accent},0.72))`,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-[13.5px] leading-relaxed text-slate-300">
                        {text}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={onUseWebApp}
            className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 font-semibold text-white shadow-[0_0_50px_-8px_rgba(99,102,241,0.7)] transition hover:from-blue-500 hover:to-indigo-500"
          >
            {tr ? "Kendin dene — ücretsiz" : "Try it yourself — free"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {zoomed && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={copy.alt}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setZoomed(false)}
          >
            <button
              type="button"
              onClick={() => setZoomed(false)}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition hover:bg-black/80"
              aria-label={tr ? "Kapat" : "Close"}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <img
              src={phone ? shot.mimg[language] : src}
              alt={copy.alt}
              draggable={false}
              className="max-h-full max-w-full rounded-xl border border-white/15 object-contain shadow-[0_40px_120px_-30px_rgba(0,0,0,1)]"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
