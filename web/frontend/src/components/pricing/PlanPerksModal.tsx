import { useEffect } from "react";
import type { Language } from "../../i18n/landing";
import { PLANS, type PlanId } from "../../lib/planConfig";
import { langAsset } from "../../lib/langAsset";

type Perk = { label: string; detail: string };
type PerkCategory = { icon: string; title: string; perks: Perk[] };

/**
 * Plan ayrıcalıklarının kategorize, açıklamalı dökümü. Sayılar planConfig'ten
 * (tek gerçek kaynak) türetilir → asla uydurma/tutarsız olmaz. Yalnızca ücretli
 * üst planlar (PLUS/PRO/BUSINESS) için çağrılır.
 */
function getPerks(planId: PlanId, language: Language): PerkCategory[] {
  const tr = language === "tr";
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return [];

  const monthly =
    plan.monthlyOpsLimit == null
      ? tr
        ? "Sınırsız işlem"
        : "Unlimited operations"
      : tr
        ? `Ayda ${plan.monthlyOpsLimit.toLocaleString("tr-TR")} işlem`
        : `${plan.monthlyOpsLimit.toLocaleString("en-US")} operations / month`;
  const fileSize =
    plan.fileSizeMB == null
      ? tr
        ? "Sınırsız dosya boyutu"
        : "Unlimited file size"
      : tr
        ? `${plan.fileSizeMB} MB'a kadar dosya`
        : `Files up to ${plan.fileSizeMB} MB`;
  const batch =
    plan.batchLimit >= 999
      ? tr
        ? "Sınırsız toplu işlem"
        : "Unlimited batch processing"
      : tr
        ? `Aynı anda ${plan.batchLimit} dosya (toplu işlem)`
        : `${plan.batchLimit} files at once (batch)`;

  const categories: PerkCategory[] = [
    {
      icon: "📊",
      title: tr ? "Kapasite & Limitler" : "Capacity & Limits",
      perks: [
        {
          label: monthly,
          detail: tr
            ? "Her PDF dönüştürme, birleştirme veya sıkıştırma 1 işlem sayılır."
            : "Each PDF convert, merge or compress counts as 1 operation.",
        },
        {
          label: tr ? "Sınırsız günlük kullanım" : "Unlimited daily usage",
          detail:
            plan.monthlyOpsLimit == null
              ? tr
                ? "Ne günlük ne aylık işlem limiti yok — dilediğin kadar kullan."
                : "No daily or monthly cap — use it as much as you want."
              : tr
                ? "Gün içinde işlem sayısı kısıtı yok; yalnızca aylık kotan geçerli."
                : "No daily cap; only your monthly quota applies.",
        },
        {
          label: fileSize,
          detail: tr
            ? "Büyük taranmış belgeler ve yüksek çözünürlüklü PDF'ler sorunsuz."
            : "Large scanned documents and high-resolution PDFs handled smoothly.",
        },
        {
          label: batch,
          detail: tr
            ? "Birden fazla dosyayı tek seferde yükleyip topluca işle."
            : "Upload and process multiple files in a single run.",
        },
      ],
    },
    {
      icon: "🛠️",
      title: tr ? "Araçlar & Çıktı" : "Tools & Output",
      perks: [
        {
          label:
            planId === "BUSINESS"
              ? tr
                ? "Tüm araçlar + kurumsal özel araçlar"
                : "All tools + enterprise-only tools"
              : tr
                ? "20+ PDF aracının tamamı"
                : "All 20+ PDF tools",
          detail: tr
            ? "Birleştir, böl, dönüştür, sıkıştır, şifrele, filigran ve daha fazlası."
            : "Merge, split, convert, compress, encrypt, watermark and more.",
        },
        {
          label: tr ? "Filigran yok" : "No watermark",
          detail: tr
            ? "Çıktı dosyalarında PDF Platform filigranı bulunmaz — temiz, profesyonel."
            : "No PDF Platform watermark on your output — clean and professional.",
        },
      ],
    },
    {
      icon: "⚡",
      title: tr ? "Hız & Öncelik" : "Speed & Priority",
      perks: [
        {
          label:
            planId === "PLUS"
              ? tr
                ? "Öncelikli işlem sırası"
                : "Priority processing queue"
              : tr
                ? "Maksimum öncelikli işlem"
                : "Maximum priority processing",
          detail: tr
            ? "İşlemlerin yoğun saatlerde bile hızlı, ayrı bir öncelikli hatta çalışır."
            : "Your jobs run on a faster priority lane, even at peak hours.",
        },
      ],
    },
  ];

  // Pro & Business: analitik
  if (planId === "PRO" || planId === "BUSINESS") {
    categories.push({
      icon: "📈",
      title: tr ? "Analitik & Raporlama" : "Analytics & Reporting",
      perks: [
        {
          label: tr ? "Kullanım analitiği" : "Usage analytics",
          detail: tr
            ? "Hangi araçları ne sıklıkta kullandığını gösteren raporlar."
            : "Reports showing which tools you use and how often.",
        },
      ],
    });
  }

  // Business: ekip & yönetim
  if (planId === "BUSINESS") {
    categories.push({
      icon: "👥",
      title: tr ? "Ekip & Yönetim Paneli" : "Team & Admin Panel",
      perks: [
        {
          label: tr ? "5+ kullanıcı, koltuk yönetimi" : "5+ users, seat management",
          detail: tr
            ? "Ekip üyelerini davet et, koltuk ekle/çıkar, tek faturada yönet."
            : "Invite team members, add/remove seats, manage under one invoice.",
        },
        {
          label: tr ? "Yönetim paneli (Admin dashboard)" : "Admin dashboard",
          detail: tr
            ? "Organizasyon genelinde kullanım, kullanıcı ve fatura yönetimi tek ekranda."
            : "Org-wide usage, user and billing management in one place.",
        },
        {
          label: tr ? "Özel entegrasyon" : "Custom integration",
          detail: tr
            ? "İş akışına özel entegrasyon ve kurumsal onay süreçleri."
            : "Workflow-specific integrations and enterprise approval flows.",
        },
        {
          label: tr ? "Ticari kullanım hakkı" : "Commercial usage rights",
          detail: tr
            ? "Çıktıları ticari işlerinde sınırsızca kullanma hakkı."
            : "Right to use outputs in your commercial work without limits.",
        },
      ],
    });
  }

  // Destek (her plan)
  categories.push({
    icon: "🎧",
    title: tr ? "Destek" : "Support",
    perks: [
      {
        label:
          planId === "PLUS"
            ? tr
              ? "E-posta desteği"
              : "Email support"
            : planId === "PRO"
              ? tr
                ? "Öncelikli e-posta desteği"
                : "Priority email support"
              : tr
                ? "Öncelikli destek"
                : "Priority support",
        detail:
          planId === "PLUS"
            ? tr
              ? "Sorularına e-posta ile gerçek bir insandan yanıt."
              : "Real-human answers to your questions by email."
            : planId === "PRO"
              ? tr
                ? "E-postaların öncelikli sırada, daha hızlı yanıtlanır."
                : "Your emails are prioritized for faster replies."
              : tr
                ? "Talepleriniz en üst öncelikte ele alınır."
                : "Your requests are handled at the highest priority.",
      },
    ],
  });

  return categories;
}

export interface PlanPerksModalProps {
  open: boolean;
  planId: PlanId | null;
  language: Language;
  onClose: () => void;
}

export function PlanPerksModal({
  open,
  planId,
  language,
  onClose,
}: PlanPerksModalProps) {
  const tr = language === "tr";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !planId) return null;
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return null;
  const planName = tr ? plan.nameTr : plan.nameEn;
  const categories = getPerks(planId, language);

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0d1120] to-[#060910] shadow-[0_48px_120px_-40px_rgba(0,0,0,0.85)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-white/[0.07] px-6 py-5">
          <button
            type="button"
            aria-label={tr ? "Kapat" : "Close"}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-lg text-slate-400 transition hover:bg-white/[0.1] hover:text-slate-200"
            onClick={onClose}
          >
            ×
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300/80">
            {tr ? "Paket ayrıcalıkları" : "Plan perks"}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
            {planName} {tr ? "ile neler alıyorsun?" : "— what you get"}
          </h2>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Business: yönetim paneli görseli */}
          {planId === "BUSINESS" && (
            <div className="overflow-hidden rounded-2xl border border-violet-500/25 bg-violet-500/[0.05]">
              <img
                src={langAsset("/admin-preview.png", language)}
                alt={tr ? "Yönetim paneli önizleme" : "Admin panel preview"}
                className="w-full object-cover"
                onError={(e) => {
                  const img = e.currentTarget;
                  // 1) EN görsel yoksa Türkçesine düş.
                  if (img.dataset.langFallback !== "1") {
                    img.dataset.langFallback = "1";
                    img.src = "/admin-preview.png";
                    return;
                  }
                  // 2) Türkçe de yoksa kapsayıcıyı gizle.
                  const box = (img.parentElement as HTMLElement) ?? null;
                  if (box) box.style.display = "none";
                }}
              />
              <p className="px-4 py-2 text-center text-[11px] text-violet-200/70">
                {tr
                  ? "Kurumsal müşterilere özel yönetim paneli"
                  : "Admin panel exclusive to enterprise customers"}
              </p>
            </div>
          )}

          {categories.map((cat) => (
            <section key={cat.title}>
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-white">
                <span aria-hidden>{cat.icon}</span>
                {cat.title}
              </h3>
              <ul className="space-y-2.5">
                {cat.perks.map((perk) => (
                  <li key={perk.label} className="flex gap-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-400"
                      aria-hidden
                    >
                      ✓
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {perk.label}
                      </p>
                      <p className="text-[12px] leading-relaxed text-slate-400">
                        {perk.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/[0.07] bg-gradient-to-t from-[#060910]/95 to-[#0d1120]/90 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
          >
            {tr ? "Kapat" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
