import ExcelJS from "exceljs";

const COLORS = {
  primary: "FF0E7490",
  primaryLight: "FF0891B2",
  dark: "FF0F172A",
  darkMid: "FF1E293B",
  white: "FFFFFFFF",
  muted: "FF94A3B8",
  success: "FF22C55E",
  warning: "FFF59E0B",
  danger: "FFEF4444",
} as const;

type Row = ExcelJS.Row;

function applyHeaderStyle(row: Row) {
  row.height = 36;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.white }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.primary } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: COLORS.primaryLight } },
    };
  });
}

function applyDataRowStyle(row: Row, isEven: boolean) {
  row.height = 28;
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isEven ? COLORS.dark : COLORS.darkMid },
    };
    cell.font = { color: { argb: COLORS.muted }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
}

type TeamData = Awaited<ReturnType<typeof import("./team.service.js").getTeamDashboard>>;

export function generateCSVReport(
  team: TeamData,
  _startDate?: Date,
  _endDate?: Date,
): string {
  const headers = [
    "Üye Adı",
    "Email",
    "Rol",
    "Durum",
    "Toplam İşlem",
    "Bu Ay İşlem",
    "Toplam Sayfa",
    "En Çok Kullanılan Araç",
    "Son Giriş",
    "Son İşlem",
  ];

  const statusLabels: Record<string, string> = {
    ACCEPTED: "Aktif",
    PENDING: "Davet Gönderildi",
    REVOKED: "İptal",
  };
  const roleLabels: Record<string, string> = {
    MEMBER: "Üye",
    MANAGER: "Yönetici",
  };

  const rows = team.members.map((m) => {
    const name = m.user
      ? [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || m.user.email
      : m.inviteEmail;
    const email = m.user?.email ?? m.inviteEmail;
    const lastLogin = m.user?.updatedAt ? m.user.updatedAt.toLocaleDateString("tr-TR") : "";
    const lastOp = m.stats.lastActivity
      ? new Date(m.stats.lastActivity).toLocaleDateString("tr-TR")
      : "";

    return [
      `"${name}"`,
      `"${email}"`,
      `"${roleLabels[m.role] ?? m.role}"`,
      `"${statusLabels[m.inviteStatus] ?? m.inviteStatus}"`,
      m.stats.totalOps,
      m.stats.thisMonthOps,
      m.stats.totalPagesProcessed,
      `"${m.stats.mostUsedTool ?? ""}"`,
      `"${lastLogin}"`,
      `"${lastOp}"`,
    ].join(",");
  });

  return [headers.map((h) => `"${h}"`).join(","), ...rows].join("\n");
}

export async function generateExcelReport(
  team: TeamData,
  _startDate?: Date,
  _endDate?: Date,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NB PDF Platform";
  (wb as unknown as { company: string }).company = "NB Global Studio";

  const statusLabels: Record<string, string> = {
    ACCEPTED: "Aktif",
    PENDING: "Davet Gönderildi",
    REVOKED: "İptal",
  };
  const roleLabels: Record<string, string> = {
    MEMBER: "Üye",
    MANAGER: "Yönetici",
  };

  // ── Sheet 1: Yönetici Özeti ──────────────────────────────────────────────
  const sheet1 = wb.addWorksheet("Yönetici Özeti");
  sheet1.columns = [
    { key: "label", width: 35 },
    { key: "value", width: 25 },
  ];

  const titleRow = sheet1.addRow(["NB PDF PLATFORM — EKİP RAPORU", ""]);
  titleRow.height = 48;
  sheet1.mergeCells("A1:B1");
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: COLORS.white } };
  titleRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.primary },
  };
  titleRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };

  sheet1
    .addRow(["Rapor Tarihi", new Date().toLocaleDateString("tr-TR")])
    .getCell(1).font = { bold: true, color: { argb: COLORS.muted } };
  sheet1
    .addRow(["Ekip Adı", team.name])
    .getCell(1).font = { bold: true, color: { argb: COLORS.muted } };
  sheet1.addRow([]);

  const summaryHeaderRow = sheet1.addRow(["Özet Metrikleri", ""]);
  applyHeaderStyle(summaryHeaderRow);

  const summaryData = [
    ["Toplam Aktif Üye", team.summary.activeMembers],
    ["Toplam Koltuk", team.summary.totalSeats],
    ["Bu Ay Toplam İşlem", team.summary.totalOpsThisMonth],
    ["Tüm Zamanlar Toplam Sayfa", team.summary.totalPagesAllTime],
    [`Toplam İşlenen Dosya (GB)`, team.summary.totalFileSizeGB],
  ];

  summaryData.forEach(([label, value], i) => {
    const row = sheet1.addRow([label, value]);
    applyDataRowStyle(row, i % 2 === 0);
    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
  });

  // ── Sheet 2: Üye Özeti ──────────────────────────────────────────────────
  const sheet2 = wb.addWorksheet("Üye Özeti");
  sheet2.columns = [
    { header: "Üye Adı", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Rol", key: "role", width: 12 },
    { header: "Durum", key: "status", width: 18 },
    { header: "Toplam İşlem", key: "totalOps", width: 16 },
    { header: "Bu Ay İşlem", key: "thisMonthOps", width: 16 },
    { header: "Toplam Sayfa", key: "totalPages", width: 16 },
    { header: "En Çok Kullanılan", key: "topTool", width: 22 },
    { header: "Son Giriş", key: "lastLogin", width: 20 },
    { header: "Son İşlem", key: "lastOp", width: 20 },
  ];

  applyHeaderStyle(sheet2.getRow(1));

  team.members.forEach((m, i) => {
    const name = m.user
      ? [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || m.user.email
      : m.inviteEmail;
    const row = sheet2.addRow({
      name,
      email: m.user?.email ?? m.inviteEmail,
      role: roleLabels[m.role] ?? m.role,
      status: statusLabels[m.inviteStatus] ?? m.inviteStatus,
      totalOps: m.stats.totalOps,
      thisMonthOps: m.stats.thisMonthOps,
      totalPages: m.stats.totalPagesProcessed,
      topTool: m.stats.mostUsedTool ?? "",
      lastLogin: m.user?.updatedAt ? m.user.updatedAt.toLocaleDateString("tr-TR") : "",
      lastOp: m.stats.lastActivity
        ? new Date(m.stats.lastActivity).toLocaleDateString("tr-TR")
        : "",
    });
    applyDataRowStyle(row, i % 2 === 0);

    const statusCell = row.getCell(4);
    if (m.inviteStatus === "ACCEPTED") {
      statusCell.font = { color: { argb: COLORS.success }, size: 10 };
    } else if (m.inviteStatus === "PENDING") {
      statusCell.font = { color: { argb: COLORS.warning }, size: 10 };
    } else {
      statusCell.font = { color: { argb: COLORS.danger }, size: 10 };
    }
  });

  // ── Sheet 3: İşlem Geçmişi ──────────────────────────────────────────────
  const sheet3 = wb.addWorksheet("İşlem Geçmişi");
  sheet3.columns = [
    { header: "Üye", key: "member", width: 25 },
    { header: "Araç", key: "tool", width: 22 },
    { header: "Sayfa", key: "pages", width: 10 },
    { header: "Dosya MB", key: "fileMB", width: 14 },
    { header: "Orijinal MB", key: "originalMB", width: 14 },
    { header: "Sıkıştırıldı MB", key: "compressedMB", width: 16 },
    { header: "Tasarruf %", key: "savings", width: 12 },
    { header: "Süre sn", key: "durSec", width: 12 },
    { header: "Durum", key: "status", width: 14 },
    { header: "Tarih", key: "date", width: 22 },
  ];

  applyHeaderStyle(sheet3.getRow(1));

  let rowIdx = 0;
  for (const m of team.members) {
    const memberName = m.user
      ? [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || m.user.email
      : m.inviteEmail;

    const activities = await import("../../lib/prisma.js").then(({ prisma }) =>
      prisma.teamMemberActivity.findMany({
        where: { memberId: m.id },
        orderBy: { createdAt: "desc" },
      }),
    );

    for (const a of activities) {
      const savings =
        a.compressionRatio !== null && a.compressionRatio !== undefined
          ? Math.round(a.compressionRatio * 100)
          : null;
      const row = sheet3.addRow({
        member: memberName,
        tool: a.toolName,
        pages: a.pageCount ?? "",
        fileMB: a.fileSizeMB ?? "",
        originalMB: a.originalSizeMB ?? "",
        compressedMB: a.compressedSizeMB ?? "",
        savings: savings !== null ? `${savings}%` : "",
        durSec: a.durationMs !== null ? (a.durationMs / 1000).toFixed(2) : "",
        status: a.status === "SUCCESS" ? "✓ Başarılı" : "✗ Başarısız",
        date: a.createdAt.toLocaleString("tr-TR"),
      });

      applyDataRowStyle(row, rowIdx % 2 === 0);
      const statusCell = row.getCell(9);
      if (a.status === "SUCCESS") {
        statusCell.font = { color: { argb: COLORS.success }, size: 10 };
      } else {
        statusCell.font = { color: { argb: COLORS.danger }, size: 10 };
      }
      rowIdx++;
    }
  }

  return (await wb.xlsx.writeBuffer()) as Buffer;
}
