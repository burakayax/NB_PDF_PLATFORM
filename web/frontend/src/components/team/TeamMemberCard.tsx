import { useState } from "react";
import { getSaasApiBase } from "../../api/saasBase";

type Language = "tr" | "en";

type ToolBreakdownItem = {
  toolId: string;
  toolName: string;
  count: number;
};

type MemberStats = {
  totalOps: number;
  thisMonthOps: number;
  mostUsedTool: string | null;
  totalPagesProcessed: number;
  totalFileSizeGB: number;
  lastActivity: string | null;
  toolBreakdown?: ToolBreakdownItem[];
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
    lastLoginAt?: string | null;
  } | null;
  stats: MemberStats;
};

type Props = {
  member: Member;
  language: Language;
  accessToken: string;
  onRevoke: (memberId: string) => void;
  isOwner?: boolean;
  onRoleChange?: (memberId: string, newRole: "MEMBER" | "MANAGER") => void;
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

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 dakika

function isOnline(lastActivity: string | null): boolean {
  if (!lastActivity) return false;
  return Date.now() - new Date(lastActivity).getTime() < ONLINE_THRESHOLD_MS;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  ACCEPTED: { label: "Aktif", bg: "bg-emerald-500/12", text: "text-emerald-400" },
  PENDING: { label: "Davet Gönderildi", bg: "bg-amber-500/12", text: "text-amber-400" },
  REVOKED: { label: "İptal", bg: "bg-red-500/12", text: "text-red-400" },
};

export function TeamMemberCard({ member, accessToken, onRevoke, isOwner, onRoleChange }: Props) {
  const [showTools, setShowTools] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  const displayName = member.user
    ? [member.user.firstName, member.user.lastName].filter(Boolean).join(" ") || member.user.email
    : member.inviteEmail;

  const email = member.user?.email ?? member.inviteEmail;
  const status = STATUS_CONFIG[member.inviteStatus] ?? STATUS_CONFIG["PENDING"]!;
  const online = isOnline(member.stats.lastActivity);

  const lastLoginDate = member.user?.lastLoginAt
    ? new Date(member.user.lastLoginAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
    : null;

  const lastActivityDate = member.stats.lastActivity
    ? new Date(member.stats.lastActivity).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
    : null;

  const toolBreakdown = member.stats.toolBreakdown ?? [];

  async function handleRoleToggle() {
    if (!isOwner || roleLoading) return;
    const newRole = member.role === "MANAGER" ? "MEMBER" : "MANAGER";
    setRoleLoading(true);
    try {
      await fetch(`${getSaasApiBase()}/api/team/members/${member.id}/role`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      });
      onRoleChange?.(member.id, newRole);
    } finally {
      setRoleLoading(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-[#0f172a] p-5 transition-all hover:border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <Avatar name={displayName} />
            {member.inviteStatus === "ACCEPTED" && (
              <span
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0f172a] ${online ? "bg-emerald-400" : "bg-slate-600"}`}
                title={online ? "Çevrimiçi" : "Çevrimdışı"}
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              {member.role === "MANAGER" && (
                <span className="shrink-0 rounded-full bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                  Yönetici
                </span>
              )}
            </div>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 flex-wrap justify-end">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.bg} ${status.text}`}>
            {status.label}
          </span>
          {isOwner && member.inviteStatus === "ACCEPTED" && (
            <button
              type="button"
              disabled={roleLoading}
              onClick={() => void handleRoleToggle()}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-50 ${
                member.role === "MANAGER"
                  ? "border-violet-500/25 bg-violet-500/8 text-violet-400 hover:bg-violet-500/16"
                  : "border-slate-600/40 bg-slate-800/50 text-slate-400 hover:bg-slate-700/60"
              }`}
            >
              {roleLoading ? "..." : member.role === "MANAGER" ? "Üye Yap" : "Yönetici Yap"}
            </button>
          )}
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

      {member.inviteStatus === "ACCEPTED" && (
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
          {lastLoginDate && (
            <span>🔑 Son giriş: <span className="text-slate-400">{lastLoginDate}</span></span>
          )}
          {lastActivityDate && (
            <span>🕐 Son işlem: <span className="text-slate-400">{lastActivityDate}</span></span>
          )}
          {online && (
            <span className="text-emerald-400 font-semibold">● Şu an çevrimiçi</span>
          )}
        </div>
      )}

      {member.inviteStatus === "ACCEPTED" && toolBreakdown.length > 0 && (
        <div className="mt-3 border-t border-white/[0.04] pt-3">
          <button
            type="button"
            onClick={() => setShowTools((v) => !v)}
            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            🔧 Araç kullanımı ({toolBreakdown.length} araç) {showTools ? "▲" : "▼"}
          </button>
          {showTools && (
            <div className="mt-2 space-y-1">
              {toolBreakdown.slice(0, 8).map((t) => (
                <div key={t.toolId} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 truncate max-w-[70%]">{t.toolName}</span>
                  <span className="text-cyan-400 font-semibold">{t.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
