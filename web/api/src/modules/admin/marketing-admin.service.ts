import { prisma } from "../../lib/prisma.js";
import { sendMassCampaignEmail } from "../../lib/email-service.js";
import {
  CommercialConsentError,
  commercialRecipientWhere,
} from "../../lib/commercial-email-gate.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";
import { displayNameForEmail, readEmailAutomationConfig, type EmailAutomationConfig } from "../marketing/email-automation.js";
import { auditedPatchSetting, logAdminAudit, type AdminActor } from "./admin-audit.service.js";

export async function getMarketingAdminPayload(): Promise<{ automation: EmailAutomationConfig }> {
  return { automation: await readEmailAutomationConfig() };
}

export async function putMarketingAutomation(cfg: EmailAutomationConfig, actor: AdminActor) {
  await auditedPatchSetting(
    SITE_SETTING_KEYS.EMAIL_AUTOMATION,
    cfg,
    actor,
    "email.automation.update",
    "Email automation config updated",
    { welcomeEnabled: cfg.welcomeEnabled, lifecycleEnabled: cfg.lifecycleEnabled },
  );
}

/**
 * Yönetim panelinden elle toplu duyuru.
 *
 * DÜZELTİLEN AÇIK: Bu işlev daha önce "ADMIN olmayan HERKES" diye sorgu
 * yapıyordu — pazarlama izni vermemiş ve hatta listeden ÇIKMIŞ kullanıcılara
 * ticari e-posta gidiyordu. Diğer dört otomatik e-posta izni doğru kontrol
 * ediyordu; kural beş ayrı yerde elle yazıldığı için burada unutulmuştu.
 * Artık kural tek yerde (commercialRecipientWhere) ve gönderim anında kapı
 * ikinci kez doğruluyor.
 *
 * "Herkese duyuru" ihtiyacı için not: hizmet kesintisi, fiyat değişikliği gibi
 * BİLGİLENDİRME duyuruları ticari ileti değildir ve izinsiz gönderilebilir —
 * ama içlerinde hiçbir tanıtım/özendirme bulunamaz. Bu işlev tanıtım
 * varsayımıyla çalışır; saf bilgilendirme duyurusu için ayrı bir yol gerekir.
 */
export async function broadcastCampaignToAllUsers(
  subject: string,
  htmlBody: string,
  batchSize: number,
  actor: AdminActor,
) {
  const batch = Math.min(80, Math.max(5, Math.floor(batchSize) || 40));
  let offset = 0;
  let sent = 0;
  const failed: string[] = [];
  const sampleEmails: string[] = [];
  /** İzni olmadığı için atlananlar — yöneticiye "kaç kişiye gitmedi" denebilsin. */
  let skippedNoConsent = 0;

  while (true) {
    const rows = await prisma.user.findMany({
      where: {
        role: { not: "ADMIN" },
        // HUKUKİ: ticari ileti yalnız önceden onay veren ve çıkmayan alıcıya.
        ...commercialRecipientWhere(),
      },
      select: { id: true, email: true, firstName: true, lastName: true, name: true, preferredLanguage: true },
      take: batch,
      skip: offset,
      orderBy: { createdAt: "asc" },
    });
    if (rows.length === 0) {
      break;
    }
    for (const u of rows) {
      try {
        const name = displayNameForEmail(u);
        await sendMassCampaignEmail(
          u.id,
          u.email,
          subject,
          htmlBody,
          { name, credits: 0, email: u.email },
          u.preferredLanguage === "tr" ? "tr" : "en",
        );
        sent++;
        if (sampleEmails.length < 20) {
          sampleEmails.push(u.email);
        }
      } catch (err) {
        // Kapı reddettiyse bu bir hata değil, doğru davranış: liste
        // çekildikten sonra çıkmış olabilir. Başarısız sayılmaz.
        if (err instanceof CommercialConsentError) {
          skippedNoConsent++;
        } else {
          failed.push(u.email);
        }
      }
    }
    offset += batch;
    await new Promise((r) => setTimeout(r, 1200));
  }

  await logAdminAudit(actor, "email.broadcast", "all_users", `Manual campaign: ${subject.slice(0, 160)} — sent ${sent}`, {
    sent,
    failedCount: failed.length,
    skippedNoConsent,
    sampleEmails,
  });

  return { sent, failedCount: failed.length, skippedNoConsent, failedSample: failed.slice(0, 40) };
}
