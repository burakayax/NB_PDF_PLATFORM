import {
  LayoutDashboard, Users, Wrench, Search, Megaphone, Ticket, Mail,
  Package, PenSquare, Image as ImageIcon, Settings, BarChart3, ScrollText,
  type LucideIcon,
} from "lucide-react";

/** Her admin bölümünün ne olduğu + ne işe yaradığı — "hiçbir şey belli değil" sorununu çözer. */
const INTRO: Record<string, { icon: LucideIcon; title: string; what: string; how?: string }> = {
  dashboard: {
    icon: LayoutDashboard,
    title: "Genel Bakış",
    what: "Sitenin canlı sağlık panosu: kullanıcı, günlük işlem, canlı oturum ve ödemeler.",
    how: "\"Bugün işlem\" = kullanıcıların SUNUCUDA yaptığı PDF işlemi (indirme). Tarayıcıda çalışan araçlar (birleştir/böl) burada sayılmaz. Sayfayı yenileyince güncellenir.",
  },
  users: {
    icon: Users,
    title: "Kullanıcılar",
    what: "Tüm hesapları ara ve yönet: plan/rol değiştir, kredi ver, günlük limit ayarla, hesabı sil.",
    how: "Bir kullanıcıya tıkla → detay paneli açılır (ödemeleri ve araç kullanımı).",
  },
  "cmd-tools": {
    icon: Wrench,
    title: "Araç kataloğu",
    what: "Hangi PDF araçlarının açık/kapalı olduğunu, hangi planda kullanılabildiğini ve kredi maliyetini belirler.",
    how: "Bir aracı kapatırsan kullanıcılar onu göremez/kullanamaz.",
  },
  "cmd-site": {
    icon: Search,
    title: "Uygulama & SEO",
    what: "Sitenin arama motoru bilgilerini düzenler: sayfa başlıkları, açıklamalar, sosyal paylaşım görseli.",
    how: "Buradaki metinler Google sonuçlarında ve WhatsApp/Twitter önizlemelerinde görünür.",
  },
  "cmd-mkt": {
    icon: Megaphone,
    title: "Pazarlama",
    what: "Otomatik e-posta serisinin ve indirim otomasyonunun ayarları (açık/kapalı, kupon kodu).",
    how: "E-postaların İÇERİĞİNİ \"E-postalar\" sekmesinden düzenlersin; burası genel ayarlardır.",
  },
  "cmd-coupons": {
    icon: Ticket,
    title: "Kuponlar",
    what: "İndirim kodu oluştur ve yönet: yüzde, kişi başına kullanım, son-kullanma tarihi.",
    how: "Kod ödeme ekranında uygulanır. Süresi geçen kupon otomatik geçersiz olur.",
  },
  "cmd-emails": {
    icon: Mail,
    title: "Pazarlama e-postaları",
    what: "Kullanıcılara otomatik giden e-postaları yönet: gör, düzenle, sil, KENDİ e-postanı ekle.",
    how: "\"Test\" ile kendine örnek gönder. Kayıttan N gün sonra, izin veren kullanıcılara gider.",
  },
  packages: {
    icon: Package,
    title: "Paket & fiyat",
    what: "Plan fiyatlarını (Pro / Business), para birimlerini ve her planın özelliklerini düzenler.",
    how: "Fiyat değişiklikleri fiyatlandırma sayfasına yansır.",
  },
  TOOLS: {
    icon: Wrench,
    title: "Araçlar (teknik kayıt)",
    what: "Her aracın teknik kaydı: kredi maliyeti ve etkin olup olmadığı.",
    how: "Araç kataloğu görünürlüğü, burası ise maliyet/kayıt tarafıdır.",
  },
  content: {
    icon: PenSquare,
    title: "İçerik (CMS)",
    what: "Ana (landing) sayfadaki metinleri düzenler: başlıklar, açıklamalar, buton yazıları.",
    how: "Değişiklikler yayınlanınca ana sayfada görünür.",
  },
  media: {
    icon: ImageIcon,
    title: "Medya",
    what: "Sitede kullanılan görselleri (logo, blog görselleri, ekran görüntüleri) yükler ve yönetir.",
    how: "Yüklediğin görselin bağlantısını içerik/blog alanlarında kullanabilirsin.",
  },
  settings: {
    icon: Settings,
    title: "Ayarlar",
    what: "Sistem ayarları: bakım modu, ödeme aç/kapa, özellik bayrakları.",
    how: "Ödemeyi buradan açtığında tüm satış/AI özellikleri aktifleşir.",
  },
  analytics: {
    icon: BarChart3,
    title: "Analitik",
    what: "Trafik ve kullanım istatistikleri — dönem seçerek incele.",
  },
  audit: {
    icon: ScrollText,
    title: "İşlem günlüğü",
    what: "Yapılan admin eylemlerinin kaydı: kime kredi/plan verildi, kim silindi/engellendi.",
    how: "İlk admin eylemini yapınca (ör. kredi ver) dolmaya başlar. Boşsa henüz eylem yok demektir.",
  },
};

export function SectionIntro({ tab }: { tab: string }) {
  const info = INTRO[tab];
  if (!info) return null;
  const Icon = info.icon;
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{info.title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{info.what}</p>
        {info.how ? (
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-400">Nasıl kullanılır: </span>{info.how}
          </p>
        ) : null}
      </div>
    </div>
  );
}
