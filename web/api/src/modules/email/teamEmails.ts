import { sendMail } from "../../lib/mailer.js";

// ─── Layout Helpers ───────────────────────────────────────────────────────────

function emailWrapper(headerTitle: string, headerSubtitle: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${headerTitle}</title></head>
<body style="margin:0;padding:0;background:#05080f;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#05080f;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#0f172a;border-radius:20px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">
      <!-- HEADER -->
      <tr><td style="background:linear-gradient(135deg,#0c4a6e 0%,#0e7490 50%,#0891b2 100%);padding:40px 48px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(224,242,254,0.7);">NB PDF PLATFORM</p>
        <h1 style="margin:0 0 10px;font-size:28px;font-weight:700;color:#ffffff;line-height:1.25;">${headerTitle}</h1>
        <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.6;">${headerSubtitle}</p>
      </td></tr>
      <!-- BODY -->
      <tr><td style="padding:40px 48px;">
        ${bodyHtml}
      </td></tr>
      <!-- FOOTER -->
      <tr><td style="padding:24px 48px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:12px;color:#64748b;line-height:1.7;"><strong style="color:#475569;">NB PDF PLATFORM</strong> by NB Global Studio</p>
        <p style="margin:6px 0 0;font-size:11px;color:#475569;">&copy; ${new Date().getFullYear()} NB Global Studio. Tüm hakları saklıdır.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

type StatItem = { label: string; value: string; icon: string };

function statBlock(stats: StatItem[]): string {
  const cols = stats
    .map(
      (s) => `
    <td style="padding:0 8px;" align="center">
      <div style="background:rgba(14,116,144,0.12);border:1px solid rgba(103,232,249,0.25);border-radius:12px;padding:16px 20px;min-width:120px;">
        <div style="font-size:24px;margin-bottom:6px;">${s.icon}</div>
        <div style="font-size:20px;font-weight:700;color:#67e8f9;">${s.value}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;text-transform:uppercase;letter-spacing:0.06em;">${s.label}</div>
      </div>
    </td>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;"><tr>${cols}</tr></table>`;
}

function ctaButton(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto;">
  <tr><td align="center">
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#0e7490,#0891b2);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:16px 52px;border-radius:12px;box-shadow:0 4px 24px rgba(14,116,144,0.45);">${text}</a>
  </td></tr>
</table>`;
}

function alertBox(type: "warning" | "danger" | "info", message: string): string {
  const colors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    warning: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.35)", text: "#fbbf24", icon: "⚠️" },
    danger: { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.35)", text: "#f87171", icon: "🔴" },
    info: { bg: "rgba(103,232,249,0.08)", border: "rgba(103,232,249,0.30)", text: "#67e8f9", icon: "ℹ️" },
  };
  const c = colors[type];
  return `<div style="background:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;color:${c.text};font-weight:500;">${c.icon} ${message}</p>
</div>`;
}

function divider(): string {
  return `<div style="height:1px;background:linear-gradient(90deg,transparent,rgba(103,232,249,0.2),transparent);margin:28px 0;"></div>`;
}

// ─── Email Senders ────────────────────────────────────────────────────────────

export async function sendTeamInviteEmail(params: {
  patronName: string;
  teamName: string;
  inviteUrl: string;
  recipientEmail: string;
}) {
  const { patronName, teamName, inviteUrl, recipientEmail } = params;

  const features = [
    "Tüm PDF araçlarına tam erişim",
    "Filigransız çıktı",
    "Öncelikli işlem kuyruğu",
    "Büyük dosya desteği",
    "Toplu işlem (batch) desteği",
    "Kurumsal güvenlik standartları",
  ];

  const featureGrid = features
    .map(
      (f) =>
        `<tr><td style="padding:8px 0;"><span style="color:#67e8f9;margin-right:8px;">✓</span><span style="color:#e2e8f0;font-size:14px;">${f}</span></td></tr>`,
    )
    .join("");

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;line-height:1.7;">Merhaba,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#e2e8f0;line-height:1.7;"><strong style="color:#67e8f9;">${patronName}</strong>, sizi <strong style="color:#f1f5f9;">${teamName}</strong> ekibine NB PDF Platform üzerinden davet etti.</p>
    <div style="background:rgba(14,116,144,0.08);border:1px solid rgba(103,232,249,0.18);border-radius:14px;padding:24px;margin:24px 0;">
      <p style="margin:0 0 16px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Ekip üyesi olarak şunlara erişeceksiniz:</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">${featureGrid}</table>
    </div>
    ${ctaButton("Daveti Kabul Et →", inviteUrl)}
    ${alertBox("info", "Bu davet bağlantısı 48 saat geçerlidir.")}
    ${divider()}
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Butona tıklayamıyorsanız aşağıdaki bağlantıyı kopyalayın:</p>
    <p style="margin:0;font-size:12px;color:#475569;word-break:break-all;">${inviteUrl}</p>
    <p style="margin:20px 0 0;font-size:12px;color:#64748b;">Bu daveti siz istemediyseniz bu e-postayı görmezden gelebilirsiniz.</p>
  `;

  await sendMail({
    to: recipientEmail,
    subject: `${patronName} sizi ${teamName} ekibine davet etti — NB PDF Platform`,
    html: emailWrapper(
      `${teamName} Ekip Daveti`,
      `${patronName} sizi NB PDF Platform'da ekibine katılmaya davet ediyor.`,
      body,
    ),
    text: `${patronName} sizi ${teamName} ekibine davet etti. Kabul etmek için: ${inviteUrl}`,
  });
}

export async function sendInviteReminderEmail(params: {
  recipientEmail: string;
  patronName: string;
  teamName: string;
  inviteUrl: string;
}) {
  const { recipientEmail, patronName, teamName, inviteUrl } = params;

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;line-height:1.7;">Merhaba,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#e2e8f0;line-height:1.7;"><strong style="color:#67e8f9;">${patronName}</strong>'in <strong style="color:#f1f5f9;">${teamName}</strong> ekibine katılım davetiniz henüz kabul edilmedi.</p>
    ${alertBox("warning", "Bu davet bağlantısının süresi yakında dolacaktır. Kaçırmadan katılın!")}
    ${ctaButton("Daveti Kabul Et →", inviteUrl)}
    ${divider()}
    <p style="margin:0;font-size:13px;color:#64748b;">Bu daveti kabul etmek istemiyorsanız bu e-postayı görmezden gelebilirsiniz.</p>
  `;

  await sendMail({
    to: recipientEmail,
    subject: `Hatırlatma: ${teamName} ekip davetiniz sona eriyor`,
    html: emailWrapper(
      "Ekip Daveti Hatırlatması",
      `${teamName} ekibine katılmak için son şansınız.`,
      body,
    ),
    text: `${patronName}'in ${teamName} davetini kabul etmediniz. Katılmak için: ${inviteUrl}`,
  });
}

export async function sendUsageLimitWarningEmail(params: {
  patronEmail: string;
  patronName: string;
  teamName: string;
  usedOps: number;
  totalOps: number;
  usagePercent: number;
}) {
  const { patronEmail, patronName, teamName, usedOps, totalOps, usagePercent } = params;
  const isHigh = usagePercent >= 90;
  const barColor = isHigh ? "#ef4444" : "#f59e0b";
  const badgeBg = isHigh ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)";
  const badgeText = isHigh ? "#f87171" : "#fbbf24";
  const remaining = totalOps - usedOps;

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;line-height:1.7;">Merhaba <strong style="color:#f1f5f9;">${patronName}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#e2e8f0;line-height:1.7;"><strong style="color:#f1f5f9;">${teamName}</strong> ekibinizin aylık işlem limitine yaklaşılmaktadır.</p>
    <div style="background:rgba(14,116,144,0.08);border:1px solid rgba(103,232,249,0.18);border-radius:14px;padding:24px;margin:0 0 24px;text-align:center;">
      <p style="margin:0 0 8px;font-size:36px;font-weight:700;color:#f1f5f9;">${usedOps} <span style="font-size:18px;color:#94a3b8;">/ ${totalOps}</span></p>
      <span style="display:inline-block;background:${badgeBg};border-radius:20px;padding:4px 14px;font-size:13px;font-weight:700;color:${badgeText};">%${usagePercent} kullanıldı</span>
      <div style="background:rgba(255,255,255,0.08);border-radius:100px;height:10px;margin:16px 0 8px;overflow:hidden;">
        <div style="background:${barColor};height:100%;width:${usagePercent}%;border-radius:100px;"></div>
      </div>
      <p style="margin:0;font-size:13px;color:#94a3b8;">${remaining} işlem kaldı</p>
    </div>
    ${alertBox(isHigh ? "danger" : "warning", isHigh ? "Aylık limitinizin %90'ına ulaştınız! İşlemler yakında duracak." : "Aylık limitinizin %80'ine ulaştınız. Planınızı kontrol etmeyi düşünün.")}
    ${ctaButton("Planı Yönet →", `${process.env["FRONTEND_ORIGIN"] ?? "https://nbpdf.com"}/dashboard/billing`)}
    <p style="margin:16px 0 0;font-size:12px;color:#64748b;text-align:center;">Sorularınız için destek ekibimizle iletişime geçebilirsiniz.</p>
  `;

  await sendMail({
    to: patronEmail,
    subject: `⚠️ Ekibiniz aylık limitin %${usagePercent}'ine ulaştı — ${teamName}`,
    html: emailWrapper(
      "Kullanım Limiti Uyarısı",
      `${teamName} ekibi aylık işlem kapasitesinin %${usagePercent}'ini kullandı.`,
      body,
    ),
    text: `${teamName} ekibiniz ${usedOps}/${totalOps} işlem kullandı (%${usagePercent}).`,
  });
}

export async function sendSubscriptionExpiryWarningEmail(params: {
  patronEmail: string;
  patronName: string;
  teamName: string;
  expiresAt: Date;
  daysRemaining: number;
  activeMemberCount: number;
}) {
  const { patronEmail, patronName, teamName, expiresAt, daysRemaining, activeMemberCount } = params;
  const isUrgent = daysRemaining === 1;
  const expiresFormatted = expiresAt.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const highlightColor = isUrgent ? "#f87171" : "#fbbf24";
  const subject = isUrgent
    ? `🔴 Paketiniz YARIN sona eriyor — ${teamName}`
    : `⏳ Paketiniz ${daysRemaining} gün içinde sona eriyor — ${teamName}`;

  const consequences = [
    "Tüm ekip üyeleri premium erişimini kaybeder",
    "Büyük dosya ve toplu işlem desteği devre dışı kalır",
    "Ücretsiz plan limitleri ve filigran uygulanmaya başlar",
  ];

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;line-height:1.7;">Merhaba <strong style="color:#f1f5f9;">${patronName}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#e2e8f0;line-height:1.7;"><strong style="color:#f1f5f9;">${teamName}</strong> ekibinizin Business paketi <strong style="color:${highlightColor};">${isUrgent ? "YARIN" : `${daysRemaining} gün içinde`}</strong> sona eriyor.</p>
    ${statBlock([
      { label: "Kalan Gün", value: String(daysRemaining), icon: "⏳" },
      { label: "Aktif Üye", value: String(activeMemberCount), icon: "👥" },
      { label: "Sona Eriyor", value: expiresFormatted, icon: "📅" },
    ])}
    ${alertBox(isUrgent ? "danger" : "warning", isUrgent ? "Paketiniz yarın sona eriyor! Ekibinizin erişimini korumak için hemen yenileyin." : `Paketiniz ${daysRemaining} gün sonra sona eriyor. Süre dolmadan yenilemenizi öneririz.`)}
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:20px 24px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#f87171;">Paket yenilenmezse ne olur?</p>
      ${consequences
        .map(
          (c) =>
            `<p style="margin:0 0 8px;font-size:14px;color:#fca5a5;"><span style="margin-right:8px;">✗</span>${c}</p>`,
        )
        .join("")}
    </div>
    ${ctaButton("Paketi Hemen Yenile →", `${process.env["FRONTEND_ORIGIN"] ?? "https://nbpdf.com"}/dashboard/billing`)}
    <p style="margin:16px 0 0;font-size:12px;color:#64748b;text-align:center;">Yenilemek istemiyorsanız bu e-postayı görmezden gelebilirsiniz.</p>
  `;

  await sendMail({
    to: patronEmail,
    subject,
    html: emailWrapper(
      isUrgent ? "Paketiniz Yarın Sona Eriyor!" : `Paketiniz ${daysRemaining} Gün İçinde Sona Eriyor`,
      `${teamName} ekibinizin Business paketini yenileme zamanı.`,
      body,
    ),
    text: `${teamName} Business paketi ${expiresFormatted} tarihinde sona eriyor. Yenilemek için giriş yapın.`,
  });
}

export async function sendWeeklyTeamSummaryEmail(params: {
  patronEmail: string;
  patronName: string;
  teamName: string;
  weekStart: Date;
  weekEnd: Date;
  totalOps: number;
  totalPages: number;
  mostUsedTool: string | null;
  mostActiveMember?: { name: string; operationCount: number };
  memberBreakdown: { name: string; operationCount: number; pageCount: number }[];
}) {
  const {
    patronEmail,
    patronName,
    teamName,
    weekStart,
    weekEnd,
    totalOps,
    totalPages,
    mostUsedTool,
    mostActiveMember,
    memberBreakdown,
  } = params;

  const weekRange = `${weekStart.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} – ${weekEnd.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`;

  const sorted = [...memberBreakdown].sort((a, b) => b.operationCount - a.operationCount);
  const topMember = sorted[0];

  const memberRows = sorted
    .map((m, i) => {
      const isTop = i === 0 && m.operationCount > 0;
      return `<tr style="background:${i % 2 === 0 ? "rgba(15,23,42,0.8)" : "rgba(30,41,59,0.6)"};">
      <td style="padding:10px 14px;font-size:13px;color:${isTop ? "#67e8f9" : "#e2e8f0"};">${isTop ? "🏆 " : ""}${m.name}</td>
      <td style="padding:10px 14px;font-size:13px;color:#f1f5f9;text-align:center;font-weight:600;">${m.operationCount}</td>
      <td style="padding:10px 14px;font-size:13px;color:#94a3b8;text-align:center;">${m.pageCount}</td>
    </tr>`;
    })
    .join("");

  const body = `
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;">${weekRange}</p>
    <p style="margin:0 0 20px;font-size:15px;color:#e2e8f0;line-height:1.7;">Merhaba <strong style="color:#f1f5f9;">${patronName}</strong>,<br><strong style="color:#f1f5f9;">${teamName}</strong> ekibinin haftalık performans özeti hazır.</p>
    ${statBlock([
      { label: "Toplam İşlem", value: String(totalOps), icon: "⚡" },
      { label: "İşlenen Sayfa", value: String(totalPages), icon: "📄" },
      { label: "En Çok Kullanılan", value: mostUsedTool ?? "—", icon: "🔧" },
    ])}
    ${
      mostActiveMember
        ? `<div style="background:rgba(103,232,249,0.06);border-left:3px solid #67e8f9;border-radius:0 10px 10px 0;padding:14px 20px;margin:20px 0;">
      <p style="margin:0;font-size:14px;color:#e2e8f0;">🏆 Bu hafta en aktif üye: <strong style="color:#67e8f9;">${mostActiveMember.name}</strong> — <strong style="color:#f1f5f9;">${mostActiveMember.operationCount}</strong> işlem</p>
    </div>`
        : ""
    }
    ${divider()}
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
      <tr style="background:linear-gradient(135deg,#0e7490,#0891b2);">
        <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.08em;">Üye</th>
        <th style="padding:12px 14px;text-align:center;font-size:12px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.08em;">İşlem</th>
        <th style="padding:12px 14px;text-align:center;font-size:12px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.08em;">Sayfa</th>
      </tr>
      ${memberRows}
    </table>
    ${divider()}
    ${ctaButton("Detaylı Raporu Görüntüle →", `${process.env["FRONTEND_ORIGIN"] ?? "https://nbpdf.com"}/dashboard/team`)}
    <p style="margin:16px 0 0;font-size:12px;color:#64748b;text-align:center;">Bu rapor her Pazartesi otomatik olarak gönderilir.</p>
  `;

  await sendMail({
    to: patronEmail,
    subject: `📊 ${teamName} Haftalık Ekip Özeti — ${weekRange}`,
    html: emailWrapper(
      "Haftalık Ekip Performans Özeti",
      `${teamName} · ${weekRange}`,
      body,
    ),
    text: `${teamName} haftalık özet: ${totalOps} işlem, ${totalPages} sayfa. En aktif: ${mostActiveMember?.name ?? "—"}`,
  });
}
