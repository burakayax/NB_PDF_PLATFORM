/**
 * KARŞILAMA EKRANI ARKA PLANI — katmanlı, hareketli "aurora" kurgusu.
 *
 * Katmanlar (arkadan öne):
 *   1. Derin zemin + ufuk parıltısı  — sayfanın rengi ve derinliği
 *   2. İnce ızgara (maskeli)          — teknik/kurumsal doku, kenarlarda erir
 *   3. Aurora lekeleri (3 adet)       — yavaşça sürüklenen renk bulutları
 *   4. Işık huzmesi                   — tepeden süzülen sabit koni
 *   5. Parçacıklar                    — yukarı süzülen minik ışık noktaları
 *   6. Grain                          — bant oluşumunu kıran film dokusu
 *
 * PERFORMANS KURALLARI (bozulursa açılış takılır):
 *   • Yalnızca `transform` ve `opacity` animasyonlanır. `filter`/`background`
 *     animasyonu her karede yeniden boyama demektir — kullanılmaz.
 *   • CSS `blur()` KULLANILMAZ. Bulanık leke görüntüsü, kenarı zaten yumuşak
 *     radial-gradient ile üretilir; böylece leke hareket ederken yeniden
 *     bulanıklık hesabı yapılmaz. (Eskiden blur(120px) + scale animasyonu
 *     vardı; açılışta ve kaydırmada donmanın asıl sebebi buydu.)
 *   • `mix-blend-mode` tam ekran katmanda kullanılmaz — altındaki her şeyi
 *     yeniden karıştırmaya zorlar.
 *   • Huzme (conic-gradient) sabittir; dönmesi ekran boyutunda sürekli
 *     yeniden boyama üretiyordu.
 *   • Katman `contain` ile yalıtılır, boyama sayfanın geri kalanına yayılmaz.
 *   • Kullanıcı "hareketi azalt" dediyse (işletim sistemi ayarı) tüm animasyonlar
 *     durur; kompozisyon sabit görüntü olarak kalır.
 */

/** Parçacıklar — sabit liste (rastgele üretim her render'da yer değiştirirdi). */
const PARTICLES = [
  { left: "12%", delay: 0, dur: 26, size: 2 },
  { left: "29%", delay: 9, dur: 32, size: 1.5 },
  { left: "46%", delay: 18, dur: 24, size: 2 },
  { left: "63%", delay: 5, dur: 30, size: 1.5 },
  { left: "81%", delay: 14, dur: 28, size: 2 },
  { left: "93%", delay: 22, dur: 34, size: 1.5 },
];

/**
 * NOT — yerleşim: Katman sayfa boyunca sabit durur (`fixed`), böylece aşağı
 * inildikçe kompozisyon yavaşça kayar. Kökteki `isolate` sayesinde `-z-10`
 * içeriğin altında kalır; gövdenin arka plan rengiyle oynamaya gerek yoktur.
 */
export function HeroBackground({
  /** Katmanın kapladığı alan. Gerekirse tek ekranlık sayfalarda değiştirilir. */
  className = "fixed inset-0",
}: {
  className?: string;
}) {
  return (
    <>
      <style>{`
        @keyframes hb-drift-a {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50%      { transform: translate3d(4%, 5%, 0); }
        }
        @keyframes hb-drift-b {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50%      { transform: translate3d(-5%, -4%, 0); }
        }
        @keyframes hb-drift-c {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50%      { transform: translate3d(3%, -5%, 0); }
        }
        @keyframes hb-rise {
          0%   { transform: translate3d(0, 0, 0); opacity: 0; }
          10%  { opacity: 0.7; }
          85%  { opacity: 0.5; }
          100% { transform: translate3d(0, -70vh, 0); opacity: 0; }
        }
        @keyframes hb-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 0.85; }
        }

        /* Mobil: parçacıklar ve huzme kapalı — ısınma ve takılma olmasın. */
        @media (max-width: 767px) {
          .hb-particle, .hb-beam { display: none !important; }
        }

        /* Kullanıcı hareketi azaltmak istiyorsa her şey durur. */
        @media (prefers-reduced-motion: reduce) {
          .hb-anim { animation: none !important; }
          .hb-particle { display: none !important; }
        }
      `}</style>

      <div
        aria-hidden="true"
        className={`pointer-events-none -z-10 overflow-hidden ${className}`}
        style={{ background: "#070a12", contain: "layout paint" }}
      >
        {/* 1 — Ufuk parıltısı: sayfanın tepesinden inen ışık */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 120% 70% at 50% -20%, rgba(99,102,241,0.38) 0%, rgba(79,70,229,0.13) 38%, transparent 72%)",
          }}
        />

        {/* 2 — İnce ızgara; kenarlara doğru eriyip kaybolur */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.075) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.075) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse 90% 60% at 50% 0%, #000 35%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 60% at 50% 0%, #000 35%, transparent 78%)",
          }}
        />

        {/* 3 — Aurora lekeleri. Yumuşaklık gradient'in kendisinden gelir:
            renk merkezde başlar, %70'te tamamen erir. Blur filtresi YOK. */}
        <div
          className="hb-anim absolute"
          style={{
            top: "-32%",
            left: "-18%",
            width: "78vw",
            height: "78vw",
            background:
              "radial-gradient(circle at 50% 50%, rgba(37,99,235,0.40) 0%, rgba(37,99,235,0.18) 34%, rgba(37,99,235,0.05) 55%, transparent 70%)",
            animation: "hb-drift-a 28s ease-in-out infinite",
            willChange: "transform",
          }}
        />
        <div
          className="hb-anim absolute"
          style={{
            top: "-14%",
            right: "-22%",
            width: "66vw",
            height: "66vw",
            background:
              "radial-gradient(circle at 50% 50%, rgba(139,92,246,0.34) 0%, rgba(139,92,246,0.15) 34%, rgba(139,92,246,0.04) 55%, transparent 70%)",
            animation: "hb-drift-b 36s ease-in-out infinite",
            willChange: "transform",
          }}
        />
        <div
          className="hb-anim absolute"
          style={{
            top: "34%",
            left: "22%",
            width: "52vw",
            height: "52vw",
            background:
              "radial-gradient(circle at 50% 50%, rgba(6,182,212,0.24) 0%, rgba(6,182,212,0.10) 34%, rgba(6,182,212,0.03) 55%, transparent 70%)",
            animation: "hb-drift-c 24s ease-in-out infinite",
            willChange: "transform",
          }}
        />

        {/* 4 — Işık huzmesi: tepeden süzülen sabit koni (dönmüyor) */}
        <div
          className="hb-beam absolute"
          style={{
            top: "-60vh",
            left: "50%",
            width: "150vw",
            height: "150vh",
            transform: "translate(-50%, 0)",
            background:
              "conic-gradient(from 180deg at 50% 50%, transparent 0deg, rgba(129,140,248,0.13) 12deg, transparent 32deg, transparent 180deg, rgba(34,211,238,0.09) 200deg, transparent 220deg)",
          }}
        />

        {/* 5 — Süzülen parçacıklar */}
        {PARTICLES.map((p) => (
          <span
            key={p.left}
            className="hb-particle hb-anim absolute rounded-full"
            style={{
              left: p.left,
              bottom: "-6px",
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: "rgba(191,219,254,0.85)",
              boxShadow: "0 0 6px rgba(147,197,253,0.65)",
              animation: `hb-rise ${p.dur}s linear ${p.delay}s infinite`,
              willChange: "transform, opacity",
            }}
          />
        ))}

        {/* Üst kenardaki ince ışık çizgisi */}
        <div
          className="hb-anim absolute left-[12%] top-0 h-px w-[76%]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(129,140,248,0.45), transparent)",
            animation: "hb-pulse 7s ease-in-out infinite",
          }}
        />

        {/* 6 — Grain: renk bantlarını kırar. Karışım kipi YOK; düz düşük
            opaklık, tam ekran blend'in maliyeti olmadan aynı işi görür. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: "200px 200px",
            opacity: 0.05,
          }}
        />

        {/* Alt karartma: sayfanın gövdesine yumuşak geçiş */}
        <div
          className="absolute inset-x-0 bottom-0 h-[42vh]"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(7,10,18,0.72) 70%, #070a12)",
          }}
        />
      </div>
    </>
  );
}
