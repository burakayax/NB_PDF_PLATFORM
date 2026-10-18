import { env } from "../config/env.js";
import { escapeHtml } from "./email-html.js";
import { renderCorporateEmail, ctaButton, commercialSubject, calloutBox, checkList, sectionTitle, para } from "./email-layout.js";
import { planDefinitions } from "../modules/subscription/subscription.config.js";
import { assertCommercialConsent } from "./commercial-email-gate.js";
import { sendMail } from "./mailer.js";
import { logAutomationEmailAudit } from "../modules/admin/admin-audit.service.js";
import { emailT, type Locale } from "./email-i18n.js";
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

  const eyebrow = tr ? "Yükseltmen bekliyor" : "Your upgrade is waiting";
  const title = tr ? "Bir adım kalmıştı" : "You were one step away";
  const intro = tr
    ? `${plan} planına geçişini tamamlamadın — kaldığın yerden devam edebilirsin.`
    : `You didn't finish upgrading to ${plan} — you can pick up right where you left off.`;
  const p1 = tr
    ? `${plan} planına geçişin neredeyse tamamdı; ödeme adımında yarıda kaldı. Hiçbir şey kaybolmadı — planını seçip birkaç saniyede tamamlayabilirsin.`
    : `Your switch to ${plan} was almost done; it stopped at the payment step. Nothing is lost — pick your plan and finish in a few seconds.`;
  const p2 = tr
    ? "Yükselttiğinde daha büyük dosyalar, daha fazla işlem ve yapay zekâ araçları anında açılır."
    : "Once you upgrade, larger files, more operations and AI tools unlock instantly.";
  const cta = tr ? "Yükseltmeyi tamamla" : "Complete your upgrade";

  const unsubscribeUrl = unsubscribeUrlFor(vars.userId);
  const bodyHtml = `
    ${para(t.greeting(name))}
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
    tr ? `${vars.planLabel} yükseltmen yarım kaldı` : `Your ${vars.planLabel} upgrade is unfinished`,
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

  const eyebrow = tr ? "Limitine ulaştın" : "You hit your limit";
  const title = tr ? "Bu ay için hakkın doldu 🚀" : "You're out for this month 🚀";
  const intro = tr
    ? "Ücretsiz aylık işlem hakkını kullandın — belli ki işine yarıyor."
    : "You've used your free monthly operations — clearly it's working for you.";
  const p1 = tr
    ? "Beklemek zorunda değilsin: yükselttiğinde günlük/aylık limit kalkar, daha büyük dosyalar ve yapay zekâ araçları da anında açılır."
    : "No need to wait: upgrading removes the daily/monthly cap and instantly unlocks larger files and AI tools.";
  const cta = tr ? "Limitsize geç" : "Go unlimited";

  const unsubscribeUrl = unsubscribeUrlFor(vars.userId);
  const bodyHtml = `
    ${para(t.greeting(name))}
    ${para(p1)}
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
    tr ? "Aylık ücretsiz hakkın doldu — limitsize geç" : "Your free monthly quota is used up — go unlimited",
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
