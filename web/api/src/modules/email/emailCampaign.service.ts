import type { EmailCampaign } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { escapeHtml } from "../../lib/email-html.js";
import { renderCorporateEmail, ctaButton } from "../../lib/email-layout.js";
import { sendMail } from "../../lib/mailer.js";
import { emailT, type Locale } from "../../lib/email-i18n.js";
import { unsubscribeUrlFor } from "./email-unsubscribe.service.js";

/** Admin gövdesini güvenli HTML'e çevirir: escape + **kalın** + çift satır = paragraf. */
function bodyToHtml(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const safe = escapeHtml(block)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
      return `<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#334155;">${safe}</p>`;
    })
    .join("");
}

function couponBlock(code: string, label: string): string {
  return `<div style="margin:18px 0 4px;padding:16px 18px;border:1px solid rgba(16,185,129,0.35);border-radius:14px;background:rgba(16,185,129,0.08);">
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.04em;color:#047857;text-transform:uppercase;">${escapeHtml(label)}</p>
    <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:0.12em;color:#065f46;">${escapeHtml(code)}</p>
  </div>`;
}

/** Kampanyayı bir kullanıcı için HTML'e dönüştürür (dile göre). */
export function renderCampaign(
  c: EmailCampaign,
  locale: Locale,
  vars: { name: string; unsubscribeUrl: string },
): { subject: string; html: string } {
  const t = emailT[locale];
  const tr = locale === "tr";
  const subject = tr ? c.subjectTr : c.subjectEn;
  const eyebrow = (tr ? c.eyebrowTr : c.eyebrowEn) || (tr ? "Bülten" : "Newsletter");
  const title = tr ? c.titleTr : c.titleEn;
  const intro = tr ? c.introTr : c.introEn;
  const body = tr ? c.bodyTr : c.bodyEn;
  const ctaLabel = tr ? c.ctaLabelTr : c.ctaLabelEn;
  const origin = env.FRONTEND_ORIGIN.replace(/\/$/, "");
  const ctaUrl = c.ctaUrl || `${origin}/workspace`;

  const coupon = c.couponCode ? couponBlock(c.couponCode, tr ? "İndirim kodunuz" : "Your discount code") : "";
  const cta = ctaLabel ? ctaButton(ctaUrl, ctaLabel) : "";
  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.75;color:#0f172a;">${t.greeting(escapeHtml(vars.name))}</p>
    ${bodyToHtml(body)}
    ${coupon}
    ${cta}
  `;
  const html = renderCorporateEmail({
    eyebrow,
    title,
    intro,
    bodyHtml,
    footerText: t.newsletter_footer,
    productName: env.SMTP_FROM_NAME,
    unsubscribeUrl: vars.unsubscribeUrl,
  });
  return { subject, html };
}

/** Tek kullanıcıya kampanya gönderir (pazarlama → tek-tık unsubscribe başlıklı). */
export async function sendCampaignToUser(
  c: EmailCampaign,
  user: { id: string; email: string; name: string | null; firstName: string | null; preferredLanguage: string },
): Promise<void> {
  const locale: Locale = user.preferredLanguage === "tr" ? "tr" : "en";
  const name = (user.firstName || user.name || (locale === "tr" ? "Merhaba" : "there")).trim();
  const unsubscribeUrl = unsubscribeUrlFor(user.id);
  const { subject, html } = renderCampaign(c, locale, { name, unsubscribeUrl });
  await sendMail({ to: user.email, subject, html, text: subject, listUnsubscribeUrl: unsubscribeUrl });
}

/** Admin'e test önizlemesi gönderir. */
export async function sendCampaignTest(c: EmailCampaign, toEmail: string, locale: Locale): Promise<void> {
  const unsubscribeUrl = unsubscribeUrlFor("test");
  const { subject, html } = renderCampaign(c, locale, { name: "Burak", unsubscribeUrl });
  await sendMail({ to: toEmail, subject: `[TEST] ${subject}`, html, text: subject, listUnsubscribeUrl: unsubscribeUrl });
}

/** Tablo boşsa varsayılan 3 lifecycle kampanyasını (tips/value/winback) oluşturur. */
export async function seedDefaultCampaigns(): Promise<void> {
  const count = await prisma.emailCampaign.count();
  if (count > 0) return;
  await prisma.emailCampaign.createMany({
    data: [
      {
        name: "İpuçları (2. gün)",
        triggerDays: 2,
        subjectTr: "PDF Platform ile 3 hızlı kazanım",
        subjectEn: "3 quick wins with PDF Platform",
        eyebrowTr: "İpuçları", eyebrowEn: "Tips",
        titleTr: "PDF işlerinizi hızlandırın", titleEn: "Speed up your PDF work",
        introTr: "Hesabınızdan en iyi şekilde yararlanmanız için birkaç ipucu.",
        introEn: "A few tips to get the most out of your account.",
        bodyTr: "Çoğu kullanıcı ilk haftada şu araçlarla zaman kazanıyor:\n\n**Birleştir & Böl** — sayfaları saniyeler içinde düzenleyin.\n**Sıkıştır** — e-postaya sığması için dosya boyutunu küçültün.\n**PDF → Word / Görsel** — düzenlenebilir formata dönüştürün.\n\nBirleştirme gibi araçlar tamamen tarayıcınızda çalışır; dosyanız yüklenmez.",
        bodyEn: "Most users save time in their first week with these tools:\n\n**Merge & Split** — reorganize pages in seconds.\n**Compress** — shrink files to fit email limits.\n**PDF → Word / Image** — convert to editable formats.\n\nTools like merge run entirely in your browser; nothing is uploaded.",
        ctaLabelTr: "Bir aracı dene", ctaLabelEn: "Try a tool",
        ctaUrl: "",
      },
      {
        name: "Yükseltme / AI (6. gün)",
        triggerDays: 6,
        subjectTr: "PDF Platform ile belgelerde yapay zekânın gücü",
        subjectEn: "The power of AI on your documents with PDF Platform",
        eyebrowTr: "Yükseltme", eyebrowEn: "Upgrade",
        titleTr: "Belgelerinizi yapay zekâyla konuşturun", titleEn: "Put AI to work on your documents",
        introTr: "Temel PDF araçları ücretsiz ve sınırsız — asıl zaman kazancı yapay zekâda.",
        introEn: "The core PDF tools are free and unlimited — the real time-saver is AI.",
        bodyTr: "Pro'ya geçen kullanıcılar şu yapay zekâ araçlarını açıyor:\n\n**PDF Özetle** — uzun sözleşme ve raporları saniyeler içinde özetleyin.\n**Veri Çıkar** — fatura ve tablolardan Excel'e hazır veri.\n**Çeviri & Karşılaştırma** — belgeleri çevirin, iki sürümün farkını bulun.\n**Toplu işlem, daha büyük dosyalar ve API erişimi.**",
        bodyEn: "Users who upgrade to Pro unlock these AI tools:\n\n**Summarize PDF** — long contracts and reports in seconds.\n**Extract Data** — invoices and tables straight into Excel.\n**Translate & Compare** — translate docs, diff two versions.\n**Batch processing, larger files and API access.**",
        ctaLabelTr: "Planları gör", ctaLabelEn: "View plans",
        ctaUrl: "",
      },
      {
        name: "Geri kazanım + indirim (13. gün)",
        triggerDays: 13,
        subjectTr: "PDF Platform — size özel indirim hazır",
        subjectEn: "PDF Platform — your personal discount is ready",
        eyebrowTr: "Size özel", eyebrowEn: "Just for you",
        titleTr: "Geri dönmeniz için küçük bir teşvik", titleEn: "A little nudge to come back",
        introTr: "Hâlâ ücretsiz plandasınız — belki doğru an şimdidir.",
        introEn: "You're still on the free plan — maybe now is the right time.",
        bodyTr: "Yükseltmeyi düşünüyorsanız, bu size özel indirim tam zamanı. PDF özetleme, faturadan veri çıkarma, çeviri ve toplu işlem — yapay zekâ araçlarının tamamı sizi bekliyor.",
        bodyEn: "If you've been thinking about upgrading, this discount is perfect timing. PDF summarization, data extraction, translation and batch processing — the full AI toolkit is waiting.",
        ctaLabelTr: "İndirimi kullan", ctaLabelEn: "Use the discount",
        ctaUrl: "",
        couponCode: null,
      },
    ],
  });
}
