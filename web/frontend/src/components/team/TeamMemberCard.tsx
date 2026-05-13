type Language = "tr" | "en";

type MemberStats = {
  totalOps: number;
  thisMonthOps: number;
  mostUsedTool: string | null;
  totalPagesProcessed: number;
  totalFileSizeGB: number;
  lastActivity: string | null;
};

type Member = {
  id: string;
  inviteEmail: string;
  inviteStatus: "PENDING" | "ACCEPTED" | "REVOKED";
  role: "MEMBER" | "MANAGER";
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    updatedAt: string;
  } | null;
  stats: MemberStats;
};

type Props = {
  member: Member;
  language: Language;
  accessToken: string;
  onRevoke: (memberId: string) => void;
};

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-700 to-sky-800 text-sm font-bold text-white">
      {initials || "?"}
    </div>
  );
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  ACCEPTED: { label: "Aktif", bg: "bg-emerald-500/12", text: "text-emerald-400" },
  PENDING: { label: "Davet Gönderildi", bg: "bg-amber-500/12", text: "text-amber-400" },
  REVOKED: { label: "İptal", bg: "bg-red-500/12", text: "text-red-400" },
};

export function TeamMemberCard({ member, onRevoke }: Props) {
  const displayName = member.user
    ? [member.user.firstName, member.user.lastName].filter(Boolean).join(" ") ||
      member.user.email
    : member.inviteEmail;

  const email = member.user?.email ?? member.inviteEmail;
  const status = STATUS_CONFIG[member.inviteStatus] ?? STATUS_CONFIG["PENDING"]!;

  const lastActivityDate = member.stats.lastActivity
    ? new Date(member.stats.lastActivity).toLocaleDateString("tr-TR")
    : null;

  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-[#0f172a] p-5 transition-all hover:border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={displayName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.bg} ${status.text}`}
          >
            {status.label}
          </span>
          {member.inviteStatus !== "REVOKED" && (
            <button
              type="button"
              onClick={() => onRevoke(member.id)}
              className="rounded-lg border border-red-500/20 bg-red-500/8 px-2.5 py-1 text-[11px] font-medium text-red-400 transition-all hover:bg-red-500/16 hover:text-red-300"
            >
              Üyeyi Kaldır
            </button>
          )}
        </div>
      </div>

      {member.inviteStatus === "ACCEPTED" && (
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.04] pt-4">
          <div className="text-center">
            <p className="text-lg font-bold text-cyan-400">{member.stats.totalOps}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Toplam İşlem</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-cyan-400">{member.stats.thisMonthOps}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Bu Ay</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-cyan-400">{member.stats.totalPagesProcessed}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Toplam Sayfa</p>
          </div>
        </div>
      )}

      {member.inviteStatus === "ACCEPTED" && (member.stats.mostUsedTool || lastActivityDate) && (
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
          {member.stats.mostUsedTool && (
            <span>
              🔧 En çok:{" "}
              <span className="text-slate-400">{member.stats.mostUsedTool}</span>
            </span>
          )}
          {lastActivityDate && (
            <span>
              🕐 Son işlem:{" "}
              <span className="text-slate-400">{lastActivityDate}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
