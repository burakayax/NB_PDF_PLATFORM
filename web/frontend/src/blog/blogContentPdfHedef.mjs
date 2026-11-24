// ─────────────────────────────────────────────────────────────────────────────
// PDF HEDEF BOYUT REHBERİ — «PDF Sıkıştır» aracının hedef boyut modunu anlatır.
// Yalnızca aracın ekranında yazan gerçek davranışa dayanır: hazır hedefler (100/200/500 KB,
// 1/2/5/10 MB), sınırın altına inen en yüksek kaliteyi arama, inemezse açıkça söyleme,
// isteğe bağlı «sayfaları görüntüye çevir» seçeneği, sunucuda işleme ve işlem sonrası silme.
// Süre, oran, kurum kabul koşulu iddiası YOK. TR ve EN metinler ayrı yazılmıştır.
// ─────────────────────────────────────────────────────────────────────────────

const post = (meta, tr, en) => ({ ...meta, tr, en });

import { PDF_HEDEF_EN_SLUGS } from "./blogSlugTables.mjs";
export { PDF_HEDEF_EN_SLUGS };

export const PDF_HEDEF_POSTS = [
  post(
    {
      slug: "pdf-1-mb-alti-kucultme-hedef-boyut",
      date: "2026-11-23",
      updated: "2026-11-23",
      readMinutes: 5,
      tags: { tr: ["PDF Sıkıştır", "Hedef Boyut", "Başvuru"], en: ["Compress PDF", "Target Size", "Applications"] },
      accent: "amber",
      tool: "/tools/compress",
    },
    {
      title: "PDF'i 1 MB'ın Altına Düşürme: Hedef Boyut Yöntemi",
      description:
        "Başvuru ya da e-posta «en fazla 1 MB» diyor ve PDF'iniz büyük mü? Hedef boyutu seçip sınırın altına inmenin yolu, inilemezse ne yapılacağı ve sık hatalar.",
      excerpt:
        "Kalite ayarını tahminle denemek yerine hedef boyutu seçin: araç sınırın altına inen en yüksek kaliteyi kendisi arar. İnemezse de bunu açıkça söyler.",
      blocks: [
        { t: "lead", x: "Bir başvuru ekranı ya da e-posta «dosya en fazla 1 MB olabilir» diyor, sizin PDF'iniz ise bunun birkaç katı. Kaliteyi tahminle düşürüp dosyayı indirmek, boyutuna bakmak ve tutmadıysa baştan denemek hem yorucu hem de çoğu zaman gereğinden fazla kalite kaybettirir. Hedef boyut yöntemi bu döngüyü ortadan kaldırır." },

        { t: "h2", x: "Kaliteye göre mi, hedef boyuta göre mi?" },
        { t: "p", x: "PDF Sıkıştır aracında iki yol vardır. «Kaliteye göre» seçeneğinde kaliteyi siz seçersiniz ve boyut ona göre çıkar: Otomatik (önerilen), Dengeli ya da Agresif. «Hedef boyuta göre» seçeneğinde ise bir üst sınır belirlersiniz; araç o sınırın altına inen en yüksek kaliteyi arar. İkisi birlikte seçilemez: hedef seçiliyken kaliteyi araç belirler." },
        { t: "p", x: "Bir sınırınız varsa hedef boyut doğru seçimdir. Sınırınız yoksa, yalnızca dosyanın küçülmesini istiyorsanız kaliteye göre sıkıştırmak yeterlidir." },

        { t: "h2", x: "Adım adım: PDF'i hedef boyuta indirin" },
        { t: "steps", items: [
          { title: "PDF'i ekleyin", x: "Dosyayı araca sürükleyin. Dosya şifreli aktarılır, sunucuda işlenir ve işlem sonrası silinir." },
          { title: "«Hedef boyuta göre» seçeneğini seçin", x: "Hazır hedefler 100 KB, 200 KB, 500 KB, 1 MB, 2 MB, 5 MB ve 10 MB'tır. Formunuz «en fazla 1 MB» diyorsa 1 MB'ı seçin." },
          { title: "PDF'i sıkıştırın", x: "Araç sınırın altına inen en yüksek kaliteyi arar. Bittiğinde eski ve yeni boyutu ile yüzde kaç küçüldüğünü yazar." },
          { title: "Sonucu indirin", x: "Dosya hedefin altındaysa doğrudan yükleyebilirsiniz. İsterseniz sonucu indirmek yerine paylaşabilirsiniz." },
        ] },

        { t: "cta", title: "PDF Sıkıştır", x: "Hedef boyutu seçin, kaliteyi araç ayarlasın.", btn: "Aracı aç", tool: "/tools/compress" },

        { t: "h2", x: "Hedefe inilemezse ne olur?" },
        { t: "p", x: "Bazı PDF'ler, özellikle çok sayıda yüksek çözünürlüklü fotoğraf ya da tarama içerenler, kaliteyi düşürmekle istenen sınıra inmeyebilir. Bu durumda araç boyutu tutturmak için dosyayı sessizce bozmaz; hedefin altına inilemediğini ve ulaşabildiği en küçük sonucu açıkça yazar. Sonra şunları deneyebilirsiniz:" },
        { t: "ul", items: [
          "«Agresif» kaliteyi seçip görselleri daha çok küçültmek.",
          "Hedefi bir kademe yükseltmek (örneğin 1 MB yerine 2 MB), form izin veriyorsa.",
          "«Hedefe inemezse sayfaları görüntüye çevir» seçeneğini işaretlemek. Dikkat: bu seçenekte sayfalar görüntüye dönüşür ve dosyadaki yazı artık seçilemez ve aranamaz olur. Metnin seçilebilir kalması gerekiyorsa bunu kullanmayın.",
        ] },

        { t: "h2", x: "Zaten sıkıştırılmış dosyalar" },
        { t: "p", x: "Daha önce iyi sıkıştırılmış bir PDF'i tekrar sıkıştırınca boyut anlamlı biçimde küçülmeyebilir. Bu durumda araç dosyanın zaten çok iyi sıkıştırıldığını söyler ve orijinali kullanabileceğinizi belirtir. Büyük bir dosyayı sıkıştırmadan önce, içindeki gereksiz sayfaları silmek ya da birkaç dosyaya bölmek de boyutu doğrudan azaltır." },

        { t: "h2", x: "Sık yapılan hatalar" },
        { t: "ul", items: [
          "Sınır yokken de «Agresif» seçmek. Sınır yoksa Otomatik çoğu belge için yeterlidir ve görselleri gereksiz bozmaz.",
          "Sıkıştırılmış dosyayı tekrar tekrar sıkıştırmak. Her turda kazanç azalır; asıl dosyadan başlayın.",
          "Taranmış bir belgeyi görüntüye çevirmeden önce arama yapılabilir olması gerekip gerekmediğini düşünmemek. Görüntüye çevirmek metni seçilemez yapar.",
          "Kurumun hangi boyutu ve biçimi istediğini kontrol etmemek. Ekrandaki açıklama her zaman esastır.",
        ] },
        { t: "tip", x: "Hedefin tam sınırda olması yerine bir kademe altını seçmek güvenlidir: sistemler bazen megabaytı 1.000.000 bayt, bazen 1.048.576 bayt sayar. Bunu aracın göstereceği boyuttan sonra kendiniz kontrol edin." },
      ],
      faq: [
        { q: "PDF'i 1 MB'ın altına nasıl düşürürüm?", a: "PDF Sıkıştır aracına dosyayı ekleyin, «Hedef boyuta göre» seçeneğini seçin ve 1 MB'ı işaretleyin. Araç sınırın altına inen en yüksek kaliteyi arar; sonuç ekranında eski ve yeni boyutu görürsünüz." },
        { q: "Hangi hedef boyutlar hazır geliyor?", a: "100 KB, 200 KB, 500 KB, 1 MB, 2 MB, 5 MB ve 10 MB için hazır seçenekler vardır." },
        { q: "Kaliteyi ben de seçebilir miyim?", a: "Evet, «Kaliteye göre» seçeneğinde Otomatik, Dengeli ya da Agresif seçersiniz. Ancak hedef boyut seçiliyken kaliteyi araç kendisi belirler; ikisi birlikte seçilemez." },
        { q: "Hedefe inilemezse ne yapmalıyım?", a: "Araç bunu açıkça söyler ve ulaşabildiği en küçük sonucu gösterir. Agresif kaliteyi denemek, hedefi bir kademe yükseltmek ya da sayfaları görüntüye çevirme seçeneğini kullanmak mümkündür; sonuncusunda yazı seçilemez ve aranamaz olur." },
        { q: "Dosyam sunucuya yüklenir mi?", a: "Evet. PDF sıkıştırma sunucuda yapılır: dosya şifreli aktarılır ve işlem sonrası silinir." },
        { q: "Üye olmam gerekir mi?", a: "Üyeliksiz günlük sınırlı ücretsiz hak vardır; ücretsiz üyelikle günlük hak artar. Güncel sınırlar aracın ekranında yazar." },
      ],
    },
    {
      title: "Compress a PDF Under 1 MB: The Target Size Method",
      description:
        "A form or email says «1 MB maximum» and your PDF is bigger? Pick a target size and get under the limit, what to do if it cannot, and the common mistakes.",
      excerpt:
        "Instead of guessing at quality settings, choose a target size: the tool searches for the highest quality that fits under the limit, and tells you plainly if it cannot.",
      blocks: [
        { t: "lead", x: "An application screen or an email says the file can be at most 1 MB, and your PDF is several times that. Lowering quality by guesswork, downloading the file, checking its size and starting over when it misses is tiring and usually costs more quality than needed. A target size removes that loop." },

        { t: "h2", x: "By quality, or to a target size?" },
        { t: "p", x: "The Compress PDF tool offers two routes. With «By quality» you pick the quality and the size follows: Automatic (recommended), Balanced or Aggressive. With «To a target size» you set a ceiling and the tool looks for the highest quality that fits under it. The two cannot be combined: while a target is set, the tool chooses the quality." },
        { t: "p", x: "If you have a limit, a target size is the right choice. If you simply want a smaller file with no limit in mind, compressing by quality is enough." },

        { t: "h2", x: "Step by step: bring a PDF down to a target" },
        { t: "steps", items: [
          { title: "Add the PDF", x: "Drag the file onto the tool. It is sent over an encrypted connection, processed on a server and deleted afterwards." },
          { title: "Choose «To a target size»", x: "The ready-made targets are 100 KB, 200 KB, 500 KB, 1 MB, 2 MB, 5 MB and 10 MB. If your form says «1 MB maximum», pick 1 MB." },
          { title: "Compress the PDF", x: "The tool looks for the highest quality that fits under the limit. When it finishes it shows the old and new size and the percentage saved." },
          { title: "Download the result", x: "If the file is under the target, you can upload it straight away. You can also share the result instead of downloading it." },
        ] },

        { t: "cta", title: "Compress PDF", x: "Pick a target size and let the tool set the quality.", btn: "Open the tool", tool: "/tools/compress" },

        { t: "h2", x: "What if it cannot reach the target?" },
        { t: "p", x: "Some PDFs, especially those with many high-resolution photos or scans, do not reach the limit by lowering quality alone. The tool does not quietly damage the file to hit the number; it tells you plainly that it could not get under the target and shows the smallest result it reached. After that you can try:" },
        { t: "ul", items: [
          "Choosing «Aggressive» quality to shrink images further.",
          "Raising the target one step (for example 2 MB instead of 1 MB), if the form allows it.",
          "Ticking «If it cannot reach the target, turn pages into images». Note: with this option the pages become images and the text in the file can no longer be selected or searched. Do not use it if the text must stay selectable.",
        ] },

        { t: "h2", x: "Files that are already compressed" },
        { t: "p", x: "Compressing a PDF that was already compressed well may not make it meaningfully smaller. In that case the tool tells you the file is already well compressed and that you can use the original. Before compressing a large file, deleting pages you do not need or splitting it into several files also reduces the size directly." },

        { t: "h2", x: "Common mistakes" },
        { t: "ul", items: [
          "Choosing «Aggressive» when there is no limit. Without a limit, Automatic is enough for most documents and does not degrade images needlessly.",
          "Compressing an already compressed file again and again. The gain shrinks each round; start from the original.",
          "Turning a scanned document into images without thinking about whether it needs to stay searchable. Turning pages into images makes the text unselectable.",
          "Not checking what size and format the institution asks for. The description on the screen always wins.",
        ] },
        { t: "tip", x: "Choose one step below the limit instead of landing exactly on it: systems sometimes count a megabyte as 1,000,000 bytes and sometimes as 1,048,576. Check the size the tool reports against the form yourself." },
      ],
      faq: [
        { q: "How do I get a PDF under 1 MB?", a: "Add the file to the Compress PDF tool, choose «To a target size» and tick 1 MB. The tool looks for the highest quality that fits under the limit, and the result screen shows the old and new size." },
        { q: "Which target sizes come ready-made?", a: "There are ready options for 100 KB, 200 KB, 500 KB, 1 MB, 2 MB, 5 MB and 10 MB." },
        { q: "Can I choose the quality myself?", a: "Yes. With «By quality» you choose Automatic, Balanced or Aggressive. While a target size is set, though, the tool chooses the quality itself; the two cannot be combined." },
        { q: "What if it cannot reach the target?", a: "The tool says so plainly and shows the smallest result it reached. You can try Aggressive quality, raise the target one step, or use the option that turns pages into images; with the last one, text can no longer be selected or searched." },
        { q: "Is my file uploaded to a server?", a: "Yes. PDF compression runs on a server: the file is sent over an encrypted connection and deleted after processing." },
        { q: "Do I need an account?", a: "Without an account there is a limited free daily allowance; a free account raises the daily allowance. The current limits are shown on the tool's screen." },
      ],
    },
  ),
];

export const PDF_HEDEF_CAROUSELS = {
  "pdf-1-mb-alti-kucultme-hedef-boyut": {
    hook: "PDF 1 MB sınırını aşıyor, ne yapmalı?",
    slides: [
      ["Tahmin etmeyin", "Kaliteyi deneme yanılmayla düşürmek yorucu ve gereğinden fazla kalite kaybettirir. Sınır varsa hedef boyutu seçin."],
      ["Hazır hedefler", "100 KB, 200 KB, 500 KB, 1 MB, 2 MB, 5 MB ve 10 MB tek tıkla seçilir. Formunuz hangi sınırı söylüyorsa onu işaretleyin."],
      ["Araç kaliteyi arar", "Sınırın altına inen en yüksek kaliteyi araç kendisi bulur. Sonuçta eski ve yeni boyutu görürsünüz."],
      ["İnemezse söyler", "Boyutu tutturmak için dosyayı sessizce bozmaz. Ulaşabildiği en küçük sonucu yazar; Agresif ya da bir üst hedefi deneyin."],
      ["Görüntüye çevirmeden önce", "Bu seçenekte yazı seçilemez ve aranamaz olur. Metin gerekiyorsa işaretlemeyin."],
    ],
  },
};
