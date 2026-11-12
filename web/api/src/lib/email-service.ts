import { env } from "../config/env.js";
import { escapeHtml } from "./email-html.js";
import { renderCorporateEmail, ctaButton, commercialSubject, calloutBox, checkList, sectionTitle, para } from "./email-layout.js";
import { planDefinitions } from "../modules/subscription/subscription.config.js";
import { assertCommercialConsent } from "./commercial-email-gate.js";
import { sendMail } from "./mailer.js";
import { logAutomationEmailAudit } from "../modules/admin/admin-audit.service.js";
import { emailT, greetingHtml, type Locale } from "./email-i18n.js";
import { PLAN_LIMITS } from "./plan-catalogue.js";
import { unsubscribeUrlFor } from "../modules/email/email-unsubscribe.service.js";
import { emailUtm, withUtm } from "./utm.js";

const product = () => env.SMTP_FROM_NAME;

export function applyTemplateVars(content: string, vars: Record<string, string | number>): string {
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

function stripForText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Hoş geldin e-postası içeriği (gönderimden ayrı → önizleme ve test edilebilir).
 *
 * HUKUK NOTU: Bu e-posta işlem/hizmet iletisidir (onay kapısı yok). Bu yüzden yalnızca hesabın GERÇEKTE
 * içerdiklerini (hediye AI işlemi, günlük hak, çalışma alanı) anlatır; ücretli plana çağrı (Pro/indirim)
 * içermez. Ücretli yönlendirme yalnız onaylı (marketingConsent) yaşam döngüsü e-postalarındadır.
 */
export function buildWelcomeEmail(vars: {
  name: string;
  locale?: Locale;
  giftCredits?: number;
  dailyLimit?: number;
}): { subject: string; html: string; text: string; ctaUrl: string } {
  const locale: Locale = vars.locale ?? "tr";
  const t = emailT[locale];
  const name = escapeHtml(vars.name);
  const gift = Math.max(0, vars.giftCredits ?? 0);
  const dailyLimit = vars.dailyLimit ?? (planDefinitions.FREE.dailyLimit ?? 3);
  const ctaUrl = withUtm(`${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/workspace`, emailUtm("hosgeldin"));

  const bodyHtml = `
    ${para(t.greeting(name))}
    ${gift > 0 ? calloutBox(t.welcome_gift_title(gift), t.welcome_gift_body) : ""}
    ${sectionTitle(t.welcome_section)}
    ${checkList(t.welcome_points(dailyLimit))}
    ${ctaButton(ctaUrl, t.welcome_cta)}
  `;

  const html = renderCorporateEmail({
    eyebrow: t.welcome_eyebrow,
    title: t.welcome_title,
    intro: t.welcome_intro,
    bodyHtml,
    footerText: t.welcome_footer,
    productName: product(),
    preheader: t.welcome_preheader(gift),
  });

  const text = [
    t.welcome_title,
    "",
    ...(gift > 0 ? [t.welcome_gift_title(gift), stripForText(t.welcome_gift_body), ""] : []),
    t.welcome_section,
    ...t.welcome_points(dailyLimit).map((p) => `- ${stripForText(p)}`),
    "",
    `${t.welcome_cta}: ${ctaUrl}`,
  ].join("\n");

  return { subject: t.welcome_subject(product(), gift), html, text, ctaUrl };
}

export async function sendWelcomeEmailToUser(
  toEmail: string,
  vars: { name: string; userId: string; locale?: Locale },
): Promise<void> {
  const locale: Locale = vars.locale ?? "tr";
  const mail = buildWelcomeEmail({ name: vars.name, locale, giftCredits: env.AI_TRIAL_CREDITS });
  await sendMail({ to: toEmail, subject: mail.subject, html: mail.html, text: mail.text });
  await logAutomationEmailAudit("email.welcome", vars.userId, `Welcome email → ${toEmail}`, { template: "welcome", to: toEmail, locale });
}

/** Lifecycle drip aşamaları — dönüşmeyen FREE kullanıcılara zamanlı gönderilir. */
export type LifecycleStage = "tips" | "value" | "winback";

export async function sendLifecycleEmail(
  toEmail: string,
  vars: {
    name: string;
    userId: string;
    stage: LifecycleStage;
    ctaUrl: string;
    couponCode?: string;
    locale?: Locale;
  },
): Promise<void> {
  // Ticari ileti → gönderim anında izin kapısı. Job katmanı da filtreliyor;
  // bu ikinci savunma, yeni bir çağıran filtreyi unutursa devreye girer.
  await assertCommercialConsent(vars.userId);

  const locale: Locale = vars.locale ?? "tr";
  const t = emailT[locale];
  const name = escapeHtml(vars.name);
  const ctaUrl = withUtm(
    vars.ctaUrl || `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/workspace`,
    emailUtm(`yasam-dongusu-${vars.stage}`),
  );
  const stage = vars.stage;
  const lc = t.lifecycle[stage] as {
    eyebrow: string;
    title: string;
    intro: string;
    body: string;
    bullets?: readonly string[];
    couponLabel?: string;
    cta: string;
    footer: string;
    subject: (product: string) => string;
  };

  // Win-back: kupon varsa indirim bloğu ekle, yoksa değer-odaklı kalır.
  const couponBlock =
    stage === "winback" && vars.couponCode
      ? calloutBox(lc.couponLabel ?? "", `<span style="font-size:22px;font-weight:700;letter-spacing:0.12em;color:#312e81;">${escapeHtml(vars.couponCode)}</span>`)
      : "";

  const bodyHtml = `
    ${para(t.greeting(name))}
    ${para(lc.body)}
    ${lc.bullets ? checkList(lc.bullets) : ""}
    ${couponBlock}
    ${ctaButton(ctaUrl, lc.cta)}
  `;
  // Pazarlama e-postası → hukuki olarak abonelikten çıkış yolu ZORUNLU
  // (GDPR/CASL/CAN-SPAM/6563). Token'lı gerçek https endpoint (tek-tık uyumlu).
  const unsubscribeUrl = unsubscribeUrlFor(vars.userId);
  const html = renderCorporateEmail({
    eyebrow: lc.eyebrow,
    title: lc.title,
    intro: lc.intro,
    bodyHtml,
    footerText: lc.footer,
    productName: product(),
    unsubscribeUrl,
  });

  const subject = commercialSubject(lc.subject(product()), locale);
  await sendMail({ to: toEmail, subject, html, text: stripForText(`${vars.name} — ${ctaUrl}`), listUnsubscribeUrl: unsubscribeUrl });
  await logAutomationEmailAudit(`email.lifecycle.${stage}`, vars.userId, `Lifecycle ${stage} → ${toEmail}`, {
    template: `lifecycle_${stage}`,
    ctaUrl,
    couponCode: vars.couponCode ?? null,
    locale,
  });
}

/**
 * Checkout recovery — ödeme adımında yarıda kalmış yükseltmeyi geri kazanma.
 *
 * TİCARİ İLETİDİR, işlem e-postası DEĞİLDİR. Kodda daha önce "transactional"
 * diye nitelenmişti; gerekçe kullanıcının satın almayı kendi başlatmış
 * olmasıydı. Ticari İletişim Yönetmeliği md.6 buna izin vermiyor: devam eden
 * üyelik/tahsilat bildirimleri onaysız gönderilebilir, ANCAK içlerinde mal
 * veya hizmet özendirilemez. Bu e-posta "yükselttiğinde yapay zekâ araçları
 * açılır" diyor ve yükseltmeye çağırıyor — tanım gereği özendirme.
 *
 * Dedup: audit action'ı checkoutId içerir → aynı terk için tekrar gönderilmez.
 */
export async function sendCheckoutRecoveryEmail(
  toEmail: string,
  vars: { name: string; userId: string; checkoutId: string; planLabel: string; ctaUrl: string; locale?: Locale },
): Promise<void> {
  await assertCommercialConsent(vars.userId);

  const locale: Locale = vars.locale ?? "tr";
  const t = emailT[locale];
  const tr = locale === "tr";
  const name = escapeHtml(vars.name);
  const plan = escapeHtml(vars.planLabel);

  const eyebrow = tr ? "Ödeme" : "Payment";
  const title = tr ? "Plan geçişin tamamlanmadı" : "Your plan change was not completed";
  const intro = tr
    ? `${plan} planına geçişini tamamlamadın.`
    : `You didn't finish switching to ${plan}.`;
  const p1 = tr
    ? `${plan} planına geçiş ödeme adımında yarıda kaldı; ödeme alınmadı. İstersen planlar sayfasından kaldığın yerden devam edebilirsin.`
    : `Your switch to ${plan} stopped at the payment step; no payment was taken. If you wish, you can continue from the plans page.`;
  const p2 = tr
    ? "Plan; dosya boyutu sınırını, aylık işlem hakkını ve yapay zekâ hakkını artırır. Ayrıntılar planlar sayfasındadır. Abonelik kendiliğinden yenilenmez."
    : "A plan raises your file size limit, monthly operations and AI allowance. Details are on the plans page. Subscriptions never renew automatically.";
  const cta = tr ? "Planlara dön" : "Back to plans";

  const unsubscribeUrl = unsubscribeUrlFor(vars.userId);
  const bodyHtml = `
    ${para(greetingHtml(locale, vars.name))}
    ${para(p1)}
    ${para(p2)}
    ${ctaButton(vars.ctaUrl, cta)}
  `;
  const html = renderCorporateEmail({
    eyebrow,
    title,
    intro,
    bodyHtml,
    footerText: t.newsletter_footer,
    productName: product(),
    unsubscribeUrl,
  });
  const subject = commercialSubject(
    tr ? `${vars.planLabel} plan geçişin tamamlanmadı` : `Your ${vars.planLabel} plan change was not completed`,
    locale,
  );
  await sendMail({ to: toEmail, subject, html, text: stripForText(`${vars.name} — ${vars.ctaUrl}`), listUnsubscribeUrl: unsubscribeUrl });
  await logAutomationEmailAudit(`email.checkout_recovery.${vars.checkoutId}`, vars.userId, `Checkout recovery → ${toEmail}`, {
    template: "checkout_recovery",
    checkoutId: vars.checkoutId,
    planLabel: vars.planLabel,
    locale,
  });
}

/**
 * "Aylık limitine ulaştın" — FREE kullanıcı aylık ücretsiz işlem hakkını bitirdiğinde
 * (güçlü satın-alma sinyali) gönderilen davranış-tetikli yükseltme e-postası. Uygulamada
 * değilken onu geri getirir. Sıkı opt-in (job katmanında marketingConsent) + unsubscribe.
 */
export async function sendLimitReachedEmail(
  toEmail: string,
  vars: { name: string; userId: string; periodKey: string; ctaUrl: string; locale?: Locale },
): Promise<void> {
  await assertCommercialConsent(vars.userId);

  const locale: Locale = vars.locale ?? "tr";
  const t = emailT[locale];
  const tr = locale === "tr";
  const name = escapeHtml(vars.name);

  const F = PLAN_LIMITS.FREE;
  const S = PLAN_LIMITS.STARTER;
  const P = PLAN_LIMITS.PLUS;
  const R = PLAN_LIMITS.PRO;
  const eyebrow = tr ? "Aylık hak" : "Monthly allowance";
  const title = tr ? "Bu ayki ücretsiz hakkın doldu" : "Your free allowance for this month is used";
  const intro = tr
    ? `Ücretsiz hesaptaki aylık ${F.monthlyOperationLimit} sunucu işlemini kullandın.`
    : `You've used the ${F.monthlyOperationLimit} monthly server operations of a free account.`;
  const p1 = tr
    ? "Hakkın yeni ayda yenilenir. Cihazında çalışan araçlar (birleştirme, bölme, döndürme, sayfa silme ve sıralama, görselden PDF) hak tüketmez; onları kullanmaya devam edebilirsin."
    : "Your allowance renews next month. Tools that run on your device (merge, split, rotate, delete and reorder pages, image to PDF) use no allowance, so you can keep using them.";
  const p2 = tr
    ? `Daha fazla sunucu işlemi gerekiyorsa: Başlangıç ayda ${S.monthlyOperationLimit.toLocaleString("tr-TR")}, Plus ayda ${P.monthlyOperationLimit.toLocaleString("tr-TR")}, Pro ayda ${R.monthlyOperationLimit.toLocaleString("tr-TR")} işlem verir; Plus ve üzerinde günlük sınır yoktur. Abonelik kendiliğinden yenilenmez.`
    : `If you need more server operations: Starter gives ${S.monthlyOperationLimit.toLocaleString("en-US")}, Plus ${P.monthlyOperationLimit.toLocaleString("en-US")}, Pro ${R.monthlyOperationLimit.toLocaleString("en-US")} a month; Plus and above have no daily limit. Subscriptions never renew automatically.`;
  const cta = tr ? "Planları gör" : "View plans";

  const unsubscribeUrl = unsubscribeUrlFor(vars.userId);
  const bodyHtml = `
    ${para(greetingHtml(locale, vars.name))}
    ${para(p1)}
    ${para(p2)}
    ${ctaButton(vars.ctaUrl, cta)}
  `;
  const html = renderCorporateEmail({
    eyebrow,
    title,
    intro,
    bodyHtml,
    footerText: t.newsletter_footer,
    productName: product(),
    unsubscribeUrl,
  });
  const subject = commercialSubject(
    tr ? "Aylık ücretsiz işlem hakkın doldu" : "Your free monthly allowance is used up",
    locale,
  );
  await sendMail({ to: toEmail, subject, html, text: stripForText(`${vars.name} — ${vars.ctaUrl}`), listUnsubscribeUrl: unsubscribeUrl });
  await logAutomationEmailAudit(`email.limit_reached.${vars.periodKey}`, vars.userId, `Limit reached → ${toEmail}`, {
    template: "limit_reached",
    periodKey: vars.periodKey,
    locale,
  });
}

/**
 * Yönetim panelinden elle gönderilen toplu duyuru.
 *
 * TİCARİ İLETİDİR: İçeriğini yönetici yazar ve içinde tanıtım/kampanya olduğu
 * varsayılmalıdır. Bu yüzden alıcının onayı çağıran tarafta (yalnız izinli
 * listeye sorgu) VE burada (gönderim anında kapı) iki kez doğrulanır.
 *
 * NEDEN userId ZORUNLU: Önceden çıkış yolu olarak "bize e-posta atın" bağlantısı
 * konuyordu; ret elle işlenmek zorundaydı ve tek-tık çıkış başlığı hiç yoktu.
 * Kişiye özel token'lı çıkış için kullanıcı kimliği şart.
 */
export async function sendMassCampaignEmail(
  userId: string,
  toEmail: string,
  subject: string,
  bodyHtml: string,
  sampleVars: { name: string; credits: number; email: string },
  locale: Locale = "tr",
): Promise<void> {
  // Gönderim anındaki son kontrol: liste çekildikten sonra çıkmış olabilir.
  await assertCommercialConsent(userId);

  const t = emailT[locale];
  const safe = {
    name: escapeHtml(sampleVars.name),
    email: escapeHtml(sampleVars.email),
    credits: String(sampleVars.credits),
  };
  const safeSubject = applyTemplateVars(subject, safe);
  const inner = applyTemplateVars(bodyHtml, safe);
  const unsubscribeUrl = unsubscribeUrlFor(userId);
  const wrapped = renderCorporateEmail({
    eyebrow: t.newsletter_eyebrow,
    title: t.newsletter_title,
    intro: " ",
    bodyHtml: `<div style="font-size:15px;line-height:1.75;color:#334155;">${inner}</div>`,
    footerText: t.newsletter_footer,
    productName: product(),
    unsubscribeUrl,
  });
  await sendMail({
    to: toEmail,
    subject: commercialSubject(safeSubject, locale),
    html: wrapped,
    text: stripForText(safeSubject + " " + inner),
    listUnsubscribeUrl: unsubscribeUrl,
  });
}
