import type { EmailCampaign } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { escapeHtml } from "../../lib/email-html.js";
import { renderCorporateEmail, ctaButton, commercialSubject, featureRows } from "../../lib/email-layout.js";
import { assertCommercialConsent } from "../../lib/commercial-email-gate.js";
import { sendMail } from "../../lib/mailer.js";
import { emailT, type Locale } from "../../lib/email-i18n.js";
import { unsubscribeUrlFor } from "./email-unsubscribe.service.js";
import { emailUtm, withUtm } from "../../lib/utm.js";
import { AI_MONTHLY_CREDITS, PLAN_LIMITS } from "../../lib/plan-catalogue.js";
import { greetingHtml } from "../../lib/email-i18n.js";

/** Admin gövdesini güvenli HTML'e çevirir: escape + **kalın** + çift satır = paragraf. */
function bodyToHtml(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      // "**Başlık** — açıklama" satırlarından oluşan blok → numaralı özellik satırları.
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const parsed = lines.map((l) => /^\*\*(.+?)\*\*\s*[—-]\s*(.+)$/.exec(l));
      if (lines.length >= 2 && parsed.every(Boolean)) {
        return featureRows(
          parsed.map((m) => ({
            title: escapeHtml(m![1]),
            text: escapeHtml(m![2]).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
          })),
        );
      }
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
  // CTA hedefi: boşsa /workspace; göreli yol (/ ile başlar) siteye eklenir; tam URL
  // (http…) aynen kullanılır. Böylece kampanyada env-bağımsız göreli yol saklanabilir
  // (ör. "/workspace?upgrade=1" → yükseltme paneli).
  const rawCta = (c.ctaUrl || "").trim() || "/workspace";
  let ctaUrl = /^https?:\/\//i.test(rawCta)
    ? rawCta
    : `${origin}${rawCta.startsWith("/") ? "" : "/"}${rawCta}`;
  // Kupon varsa butonun linkine taşı → ödeme özetinde OTOMATİK uygulanır (elle yazma yok).
  // Görünen kupon bloğu manuel yedek olarak kalır.
  if (c.couponCode) {
    ctaUrl += `${ctaUrl.includes("?") ? "&" : "?"}coupon=${encodeURIComponent(c.couponCode)}`;
  }

  ctaUrl = withUtm(ctaUrl, emailUtm("kampanya"));

  const coupon = c.couponCode ? couponBlock(c.couponCode, tr ? "İndirim kodunuz" : "Your discount code") : "";
  const cta = ctaLabel ? ctaButton(ctaUrl, ctaLabel) : "";
  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.75;color:#0f172a;">${greetingHtml(locale, vars.name)}</p>
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

/**
 * Tek kullanıcıya kampanya gönderir (pazarlama → tek-tık unsubscribe başlıklı).
 *
 * İzin, çağıran işin liste sorgusunda filtrelenmiş olsa bile burada yeniden
 * doğrulanır: liste ile gönderim arasında dakikalar geçer ve kullanıcı o
 * aralıkta listeden çıkmış olabilir.
 */
export async function sendCampaignToUser(
  c: EmailCampaign,
  user: { id: string; email: string; name: string | null; firstName: string | null; preferredLanguage: string },
): Promise<void> {
  await assertCommercialConsent(user.id);

  const locale: Locale = user.preferredLanguage === "tr" ? "tr" : "en";
  const name = (user.firstName || user.name || "").trim();
  const unsubscribeUrl = unsubscribeUrlFor(user.id);
  const { subject, html } = renderCampaign(c, locale, { name, unsubscribeUrl });
  await sendMail({
    to: user.email,
    subject: commercialSubject(subject, locale),
    html,
    text: subject,
    listUnsubscribeUrl: unsubscribeUrl,
  });
}

/** Admin'e test önizlemesi gönderir. */
export async function sendCampaignTest(c: EmailCampaign, toEmail: string, locale: Locale): Promise<void> {
  const unsubscribeUrl = unsubscribeUrlFor("test");
  const { subject, html } = renderCampaign(c, locale, { name: "Burak", unsubscribeUrl });
  await sendMail({ to: toEmail, subject: `[TEST] ${subject}`, html, text: subject, listUnsubscribeUrl: unsubscribeUrl });
}

type CampaignSeed = Parameters<typeof prisma.emailCampaign.create>[0]["data"];

const nTr = (n: number) => n.toLocaleString("tr-TR");
const nEn = (n: number) => n.toLocaleString("en-US");
const F = PLAN_LIMITS.FREE;
const S = PLAN_LIMITS.STARTER;
const P = PLAN_LIMITS.PLUS;
const R = PLAN_LIMITS.PRO;

/**
 * Varsayılan e-posta kampanyaları.
 *
 * İLKE: Her cümle koddaki gerçek kuralı söyler (plan-catalogue.ts, subscription.config.ts,
 * toolProcessing.mjs, toolAccess.ts). Sayılar sabitlerden üretilir — limit değişirse metin de
 * değişir. Kullanıcıyı çekmek için abartı, eksik koşul ya da olmayan indirim vaadi YOKTUR.
 * Hangi aracın nerede işlendiği (cihaz/sunucu) ve neyin ücretli olduğu açıkça yazılır.
 */
export function buildDefaultCampaigns(): CampaignSeed[] {
  const serverTr = `Ücretsiz hesapta sunucu işlemleri günde ${F.dailyOperationLimit}, ayda ${F.monthlyOperationLimit} ile sınırlıdır`;
  const serverEn = `On a free account, server operations are limited to ${F.dailyOperationLimit} a day and ${F.monthlyOperationLimit} a month`;
  const plansTr =
    `**Başlangıç** — günde ${S.dailyOperationLimit}, ayda ${nTr(S.monthlyOperationLimit)} sunucu işlemi; ayda ${AI_MONTHLY_CREDITS.STARTER} yapay zekâ işlemi.\n` +
    `**Plus** — günlük sınır yok, ayda ${nTr(P.monthlyOperationLimit)} sunucu işlemi; ayda ${AI_MONTHLY_CREDITS.PLUS} yapay zekâ işlemi.\n` +
    `**Pro** — günlük sınır yok, ayda ${nTr(R.monthlyOperationLimit)} sunucu işlemi; ayda ${AI_MONTHLY_CREDITS.PRO} yapay zekâ işlemi, toplu işlem (en çok ${R.batchLimit} dosya) ve API erişimi.`;
  const plansEn =
    `**Starter** — ${S.dailyOperationLimit} a day, ${nEn(S.monthlyOperationLimit)} a month server operations; ${AI_MONTHLY_CREDITS.STARTER} AI operations a month.\n` +
    `**Plus** — no daily limit, ${nEn(P.monthlyOperationLimit)} a month server operations; ${AI_MONTHLY_CREDITS.PLUS} AI operations a month.\n` +
    `**Pro** — no daily limit, ${nEn(R.monthlyOperationLimit)} a month server operations; ${AI_MONTHLY_CREDITS.PRO} AI operations a month, batch processing (up to ${R.batchLimit} files) and API access.`;
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

  return [
    {
      name: "Hoş geldin — ilk adımlar (1. gün)",
      triggerDays: 1,
      subjectTr: "PDF Platform'da ilk adımlar",
      subjectEn: "First steps on PDF Platform",
      eyebrowTr: "Başlangıç", eyebrowEn: "Getting started",
      titleTr: "İlk işini yapalım", titleEn: "Let's do your first task",
      introTr: "En çok kullanılan üç araç ve her birinin gerçek koşulları.",
      introEn: "The three most-used tools and the real conditions of each.",
      bodyTr:
        "**PDF Birleştir** — Cihazında çalışır, dosyan yüklenmez, günlük hakkından düşmez. (80 MB üstü ya da parolalı dosyada sunucu kullanılır.)\n" +
        "**PDF Sıkıştır** — Sunucuda işlenir; günlük işlem hakkından düşer.\n" +
        "**PDF → Word** — Sunucuda işlenir; ücretsiz hesapla açıktır, günlük işlem hakkından düşer.\n\n" +
        `${serverTr}. Cihazında çalışan araçlarda bu sınır yoktur. Sunucuya yüklenen dosya işlem biter bitmez silinir; sonuç dosyası indirebilmen için en fazla 24 saat saklanır.`,
      bodyEn:
        "**Merge PDF** — Runs on your device, your file is not uploaded, uses none of your daily allowance. (Files over 80 MB or password-protected use the server.)\n" +
        "**Compress PDF** — Processed on our server; uses your daily allowance.\n" +
        "**PDF → Word** — Processed on our server; available with a free account and uses your daily allowance.\n\n" +
        `${serverEn}. Tools that run on your device have no such limit. A file uploaded to the server is deleted as soon as processing ends; the result is kept for at most 24 hours so you can download it.`,
      ctaLabelTr: "Çalışma alanını aç", ctaLabelEn: "Open workspace",
      ctaUrl: "",
    },
    {
      name: "İpuçları (2. gün)",
      triggerDays: 2,
      subjectTr: "PDF Platform'da hak tüketmeyen araçlar",
      subjectEn: "PDF Platform tools that don't use your allowance",
      eyebrowTr: "İpuçları", eyebrowEn: "Tips",
      titleTr: "Hangi araç ne kadar hak harcar?", titleEn: "Which tool uses how much allowance?",
      introTr: "Cihazında çalışanlar ile sunucuda çalışanlar arasındaki fark.",
      introEn: "The difference between tools that run on your device and on our server.",
      bodyTr:
        "**Birleştir & Böl** — Cihazında çalışır; sayfaları düzenlersin, hak tüketmez.\n" +
        "**Sayfa Sil & Sırala** — Cihazında çalışır; hak tüketmez.\n" +
        "**Görselden PDF** — Cihazında çalışır; hak tüketmez.\n\n" +
        `**Sıkıştır, Word ↔ PDF ve PDF → JPG** sunucuda işlenir ve işlem hakkından düşer. ${serverTr}.\n\n` +
        "İhtiyacın olan aracı çalışma alanındaki arama kutusundan bulabilirsin.",
      bodyEn:
        "**Merge & Split** — Runs on your device; reorganize pages, uses no allowance.\n" +
        "**Delete & Reorder pages** — Runs on your device; uses no allowance.\n" +
        "**Image to PDF** — Runs on your device; uses no allowance.\n\n" +
        `**Compress, Word ↔ PDF and PDF → JPG** are processed on our server and use your allowance. ${serverEn}.\n\n` +
        "You can find any tool with the search box in your workspace.",
      ctaLabelTr: "Bir aracı dene", ctaLabelEn: "Try a tool",
      ctaUrl: "",
    },
    {
      name: "Özellik keşfi — bilmediklerin (4. gün)",
      triggerDays: 4,
      subjectTr: "Çalışma alanında belki görmediğin 3 araç",
      subjectEn: "3 tools in your workspace you may have missed",
      eyebrowTr: "İpucu", eyebrowEn: "Tip",
      titleTr: "Muhtemelen kaçırdığın 3 araç", titleEn: "3 tools you may have missed",
      introTr: "Her birinin kimlere açık olduğunu da yazdık.",
      introEn: "We also wrote who each one is open to.",
      bodyTr:
        "**Taranmış PDF → Metin (OCR)** — Fotoğraf ya da taramadaki yazıyı metne çevirir. Cihazında çalışır; ücretsiz hesapla kullanılır.\n" +
        "**Sayfa Sil / Sırala** — İstemediğin sayfaları at, sırayı düzelt. Cihazında çalışır; üyeliksiz de kullanılır.\n" +
        "**PDF Düzenle** — Metin, imza ve damga ekleyip çıkarırsın. Sunucuda işlenir; kaydetme ve indirme günlük sınırlıdır: ücretsiz hesapta günde 2, Başlangıç'ta 10, Plus ve üzerinde sınırsız.",
      bodyEn:
        "**Scanned PDF → Text (OCR)** — Turns the text in a photo or scan into real text. Runs on your device; works with a free account.\n" +
        "**Delete / Reorder pages** — Drop unwanted pages, fix the order. Runs on your device; works without an account too.\n" +
        "**Edit PDF** — Add or remove text, signatures and stamps. Processed on our server; saving and downloading is limited per day: 2 on a free account, 10 on Starter, unlimited on Plus and above.",
      ctaLabelTr: "Araçları keşfet", ctaLabelEn: "Explore tools",
      ctaUrl: "",
    },
    {
      name: "Yükseltme / AI (6. gün)",
      triggerDays: 6,
      subjectTr: "Yapay zekâ araçları: neyin ücretli olduğu",
      subjectEn: "AI tools: what is paid and what is not",
      eyebrowTr: "Plan bilgisi", eyebrowEn: "Plan info",
      titleTr: "Yapay zekâ araçları hakkında", titleEn: "About the AI tools",
      introTr: "Neyin ücretli olduğunu baştan açık yazalım.",
      introEn: "Let's be upfront about what is paid.",
      bodyTr:
        "PDF Özetle, PDF ile Sohbet, Çeviri, Karşılaştırma ve Veri Çıkar yapay zekâ araçlarıdır ve **ücretlidir**: Başlangıç ya da üzeri bir plan veya satın alınmış işlem kredisi gerekir. Ücretsiz hesaba kayıtta bir kez 3 hediye işlem tanımlanır; bittiğinde devam etmek için plan ya da kredi şarttır.\n\n" +
        `${plansTr}\n\n` +
        `Dosya boyutu sınırı ücretsiz hesapta ${F.fileSizeLimitMB} MB, Başlangıç'ta ${S.fileSizeLimitMB}, Plus'ta ${P.fileSizeLimitMB}, Pro'da ${R.fileSizeLimitMB} MB. Cihazında çalışan araçlar plan gerektirmeden kullanılmaya devam eder. Abonelik kendiliğinden yenilenmez; fiyatlar planlar sayfasındadır.`,
      bodyEn:
        "Summarize PDF, Chat with PDF, Translate, Compare and Extract Data are AI tools and they are **paid**: they need a Starter-or-higher plan or purchased credits. A free account gets 3 free operations once, at sign-up; after that you need a plan or credits.\n\n" +
        `${plansEn}\n\n` +
        `The file size limit is ${F.fileSizeLimitMB} MB on a free account, ${S.fileSizeLimitMB} on Starter, ${P.fileSizeLimitMB} on Plus, ${R.fileSizeLimitMB} MB on Pro. Tools that run on your device stay available without a plan. Subscriptions never renew automatically; prices are on the plans page.`,
      ctaLabelTr: "Planları gör", ctaLabelEn: "View plans",
      ctaUrl: "/workspace?upgrade=1",
    },
    {
      name: "Geri kazanım + indirim (13. gün)",
      triggerDays: 13,
      subjectTr: "PDF Platform: ücretsiz hesap ve plan seçenekleri",
      subjectEn: "PDF Platform: your free account and plan options",
      eyebrowTr: "Hesap", eyebrowEn: "Account",
      titleTr: "Ücretsiz hesabın böyle kalabilir", titleEn: "Your free account can stay as it is",
      introTr: "İhtiyacın artarsa seçenekler aşağıda.",
      introEn: "If your needs grow, the options are below.",
      bodyTr:
        `Ücretsiz hesapta cihazında çalışan araçlar sınırsızdır; ${lower(serverTr)}. Bu sana yetiyorsa bir şey yapman gerekmiyor.\n\n` +
        `İhtiyacın bunu aşıyorsa:\n\n${plansTr}\n\nAbonelik kendiliğinden yenilenmez; fiyatlar planlar sayfasındadır.`,
      bodyEn:
        `On a free account the tools that run on your device are unlimited; ${lower(serverEn)}. If that is enough for you, there is nothing to do.\n\n` +
        `If you need more:\n\n${plansEn}\n\nSubscriptions never renew automatically; prices are on the plans page.`,
      ctaLabelTr: "Planları gör", ctaLabelEn: "View plans",
      ctaUrl: "/workspace?upgrade=1",
      couponCode: null,
    },
    {
      name: "Kilometre taşı — 1 ay (30. gün)",
      triggerDays: 30,
      subjectTr: "Hesabın bir aylık oldu",
      subjectEn: "Your account is one month old",
      eyebrowTr: "Hesap", eyebrowEn: "Account",
      titleTr: "Bir ay geride kaldı", titleEn: "One month in",
      introTr: "Hesabını bir ay önce açtın.",
      introEn: "You opened your account a month ago.",
      bodyTr:
        "Cihazında çalışan araçlar plan gerektirmeden kullanılmaya devam ediyor. Yapay zekâ araçları (özetleme, veri çıkarma, çeviri) ücretlidir: Başlangıç ya da üzeri bir plan veya satın alınmış kredi gerekir.\n\n" +
        "Bir sorun yaşarsan bu e-postanın altındaki iletişim adresine yazabilirsin.",
      bodyEn:
        "The tools that run on your device remain available without a plan. AI tools (summarize, extract data, translate) are paid: they need a Starter-or-higher plan or purchased credits.\n\n" +
        "If you run into a problem, write to the contact address at the bottom of this email.",
      ctaLabelTr: "Planları gör", ctaLabelEn: "View plans",
      ctaUrl: "/workspace?upgrade=1",
    },
  ];
}

/**
 * Eski varsayılan metinler. Veritabanındaki satır HÂLÂ bunlardan birine eşitse (yönetici
 * elle değiştirmemişse) yeni, doğrulanmış metinle değiştirilir; elle yazılmış metne dokunulmaz.
 */
const LEGACY_BODY_TR: Record<string, string[]> = {
  "İpuçları (2. gün)": [
    "Çoğu kullanıcı ilk haftada şu araçlarla zaman kazanıyor:\n\n**Birleştir & Böl** — sayfaları saniyeler içinde düzenleyin.\n**Sıkıştır** — e-postaya sığması için dosya boyutunu küçültün.\n**PDF → Word / Görsel** — düzenlenebilir formata dönüştürün.\n\nBirleştirme gibi araçlar tamamen tarayıcınızda çalışır; dosyanız yüklenmez.",
  ],
  "Yükseltme / AI (6. gün)": [
    "Pro'ya geçen kullanıcılar şu yapay zekâ araçlarını açıyor:\n\n**PDF Özetle** — uzun sözleşme ve raporları saniyeler içinde özetleyin.\n**Veri Çıkar** — fatura ve tablolardan Excel'e hazır veri.\n**Çeviri & Karşılaştırma** — belgeleri çevirin, iki sürümün farkını bulun.\n**Toplu işlem, daha büyük dosyalar ve API erişimi.**",
  ],
  "Geri kazanım + indirim (13. gün)": [
    "Yükseltmeyi düşünüyorsanız, bu size özel indirim tam zamanı. PDF özetleme, faturadan veri çıkarma, çeviri ve toplu işlem — yapay zekâ araçlarının tamamı sizi bekliyor.",
  ],
  "Hoş geldin — ilk adımlar (1. gün)": [
    "En popüler 3 araçla saniyeler içinde sonuç al:\n\n**PDF Birleştir** — birden çok dosyayı tek PDF yap.\n**PDF Sıkıştır** — e-postaya sığması için küçült.\n**PDF → Word** — düzenlenebilir belgeye çevir.\n\nBirleştirme gibi araçlar tamamen tarayıcında çalışır; dosyan yüklenmez.",
  ],
  "Özellik keşfi — bilmediklerin (4. gün)": [
    "**PDF Düzenle** — metni, imzayı, damgayı doğrudan tarayıcıda ekle/çıkar.\n**Taranmış PDF → Metin (OCR)** — fotoğraf/taranmış belgedeki yazıyı gerçek metne çevir.\n**Sayfa Sil / Sırala** — istemediğin sayfaları at, sırayı düzelt.\n\nHepsi ücretsiz ve çoğu cihazında çalışır.",
  ],
  "Kilometre taşı — 1 ay (30. gün)": [
    "Daha da ileri gitmek istersen: yapay zekâ araçlarımız uzun belgeleri özetliyor, faturalardan Excel'e veri çıkarıyor ve belgeleri çeviriyor. Bir dahaki büyük işinde denemeye değer.\n\nBir sorunun mu var? Bu e-postayı yanıtla, yardımcı olalım.",
  ],
};

/** Varsayılan lifecycle kampanyalarını ekler — İSME GÖRE idempotent. Elle düzenlenmiş satıra DOKUNMAZ. */
export async function seedDefaultCampaigns(): Promise<void> {
  for (const data of buildDefaultCampaigns()) {
    const exists = await prisma.emailCampaign.findFirst({
      where: { name: data.name },
      select: { id: true, ctaUrl: true, bodyTr: true },
    });
    if (!exists) {
      await prisma.emailCampaign.create({ data });
      continue;
    }
    // Yönetici elle düzenlemediyse (gövde eski varsayılanla birebir aynı) metni doğrulanmış yenisiyle değiştir.
    if ((LEGACY_BODY_TR[data.name] ?? []).includes(exists.bodyTr)) {
      const { name: _n, triggerDays: _t, ...text } = data as Record<string, unknown>;
      await prisma.emailCampaign.update({ where: { id: exists.id }, data: text as never });
      continue;
    }
    // Buton boşsa ve varsayılan hedef tanımlıysa yalnız onu doldur (admin'in girdiği CTA'yı ASLA ezme).
    const defCta = (typeof data.ctaUrl === "string" ? data.ctaUrl : "").trim();
    if (defCta && !(exists.ctaUrl ?? "").trim()) {
      await prisma.emailCampaign.update({ where: { id: exists.id }, data: { ctaUrl: defCta } });
    }
  }
}
