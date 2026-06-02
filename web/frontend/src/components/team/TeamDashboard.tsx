import { useEffect, useState, useCallback } from "react";
import type { Language } from "../../i18n/landing";
import { getSaasApiBase } from "../../api/saasBase";
import { TeamMemberCard } from "./TeamMemberCard";
import { InviteMemberModal } from "./InviteMemberModal";
import { TeamReportButton } from "./TeamReportButton";
import { GrowTeamModal } from "./GrowTeamModal";
import { ShrinkTeamModal } from "./ShrinkTeamModal";
import { PaymentSummaryModal } from "../dashboard/PaymentSummaryModal";

type ToolBreakdownItem = {
  toolId: string;
  toolName: string;
  count: number;
};

type TeamMemberStats = {
  totalOps: number;
  thisMonthOps: number;
  mostUsedTool: string | null;
  totalPagesProcessed: number;
  totalFileSizeGB: number;
  lastActivity: string | null;
  toolBreakdown?: ToolBreakdownItem[];
};

type TeamMemberItem = {
  id: string;
  inviteEmail: string;
  inviteStatus: "PENDING" | "ACCEPTED" | "REVOKED";
  role: "MEMBER" | "MANAGER";
  joinedAt: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    updatedAt: string;
    lastLoginAt?: string | null;
  } | null;
  stats: TeamMemberStats;
  activities: unknown[];
};

type TeamSummary = {
  activeMembers: number;
  totalSeats: number;
  totalOpsThisMonth: number;
  totalPagesAllTime: number;
  totalFileSizeGB: number;
};

type TeamData = {
  id: string;
  name: string;
  maxSeats: number;
  extraSeats: number;
  subscriptionStatus: string;
  members: TeamMemberItem[];
  summary: TeamSummary;
};

type Props = {
  language: Language;
  accessToken: string;
  isOwner?: boolean;
  currentUserId?: string;
};

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-[14px] border border-white/[0.06] bg-[#0f172a] p-5">
      <div className="mb-3 h-4 w-24 rounded bg-white/10" />
      <div className="h-8 w-16 rounded bg-white/10" />
    </div>
  );
}

export function TeamDashboard({ language: _language, accessToken, isOwner = true, currentUserId }: Props) {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokeInfoMsg, setRevokeInfoMsg] = useState<string | null>(null);
  const [growOpen, setGrowOpen] = useState(false);
  const [shrinkOpen, setShrinkOpen] = useState(false);
  const [seatPayment, setSeatPayment] = useState<{ billingCycle: "MONTHLY" | "YEARLY"; extraSeats: number } | null>(null);

  const handleRoleChange = useCallback(
    (memberId: string, newRole: "MEMBER" | "MANAGER") => {
      setTeam((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === memberId ? { ...m, role: newRole } : m,
          ),
        };
      });
    },
    [],
  );

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getSaasApiBase()}/api/team/dashboard`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Ekip verisi alınamadı.");
      const data: TeamData = await res.json();
      setTeam(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const handleRevoke = useCallback(
    async (memberId: string) => {
      await fetch(`${getSaasApiBase()}/api/team/members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });
      await fetchDashboard();
      setRevokeInfoMsg(
        "Çıkardığınız üyenin erişimi bu fatura döneminin sonuna kadar devam edecektir. Gelecek ay faturanız güncel kişi sayısına göre güncellenecektir.",
      );
    },
    [accessToken, fetchDashboard],
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6 h-10 w-48 animate-pulse rounded-xl bg-white/10" />
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[14px] bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="p-6">
        <p className="text-red-400">{error ?? "Ekip bilgisi bulunamadı."}</p>
      </div>
    );
  }

  const { summary } = team;
  const seatsUsed = summary.activeMembers;
  const seatsTotal = summary.totalSeats;
  const seatsAvailable = seatsTotal - seatsUsed;
  const seatUsagePercent = Math.round((seatsUsed / seatsTotal) * 100);

  const summaryCards = [
    {
      icon: "👥",
      value: `${seatsUsed}/${seatsTotal}`,
      label: "Aktif Üye",
    },
    {
      icon: "⚡",
      value: summary.totalOpsThisMonth.toLocaleString("tr-TR"),
      label: "Bu Ay İşlem",
    },
    {
      icon: "📄",
      value: summary.totalPagesAllTime.toLocaleString("tr-TR"),
      label: "İşlenen Sayfa",
    },
    {
      icon: "💾",
      value: `${summary.totalFileSizeGB} GB`,
      label: "İşlenen Veri",
    },
  ];

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{team.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {seatsUsed} / {seatsTotal} koltuk kullanımda
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TeamReportButton accessToken={accessToken} teamName={team.name} />
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => setShrinkOpen(true)}
                className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition-all hover:bg-amber-500/18 active:scale-[0.97]"
              >
                ➖ Ekibi Küçült
              </button>
              <button
                type="button"
                onClick={() => setGrowOpen(true)}
                className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition-all hover:bg-emerald-500/18 active:scale-[0.97]"
              >
                🏢 Ekibi Büyüt
              </button>
            </>
          )}
          {seatsAvailable > 0 ? (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(14,116,144,0.35)] transition-all hover:from-cyan-500 hover:to-sky-500 active:scale-[0.97]"
            >
              + Üye Davet Et
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-xl border border-slate-600/50 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-slate-400 transition-all cursor-not-allowed"
              disabled
              title="Tüm koltuklar dolu. Ekibi büyütmek için 'Ekibi Büyüt' butonunu kullanın."
            >
              + Üye Davet Et
            </button>
          )}
        </div>
      </div>

      {/* Seat reduction info message */}
      {revokeInfoMsg && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 p-4">
          <span className="shrink-0 text-amber-400">ℹ️</span>
          <p className="text-sm text-amber-300">{revokeInfoMsg}</p>
          <button
            type="button"
            onClick={() => setRevokeInfoMsg(null)}
            className="ml-auto shrink-0 text-amber-500/60 hover:text-amber-400"
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="group rounded-[14px] border border-white/[0.06] bg-[#0f172a] p-5 transition-all hover:border-cyan-500/25 hover:shadow-[0_0_30px_-8px_rgba(103,232,249,0.2)]"
          >
            <div className="mb-2 text-2xl">{card.icon}</div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
            <div className="mt-1 text-xs text-slate-400 uppercase tracking-wider">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Seat Usage Progress */}
      <div className="mb-6 rounded-[14px] border border-white/[0.06] bg-[#0f172a] p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">Koltuk Kullanımı</span>
          <span className="text-sm font-bold text-cyan-400">%{seatUsagePercent}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-sky-500 transition-all"
            style={{ width: `${seatUsagePercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {seatsUsed} koltuk kullanımda, {seatsAvailable} boş
        </p>
      </div>

      {/* Member List */}
      <div className="space-y-3">
        {team.members
          .filter((m) => m.inviteStatus !== "REVOKED")
          .filter((m) => !currentUserId || !m.user || m.user.id !== currentUserId)
          .map((m) => (
            <TeamMemberCard
              key={m.id}
              member={m}
              language="tr"
              accessToken={accessToken}
              onRevoke={handleRevoke}
              isOwner={isOwner}
              onRoleChange={handleRoleChange}
            />
          ))}
      </div>

      {/* Invite Modal */}
      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        accessToken={accessToken}
        onSuccess={() => {
          setInviteOpen(false);
          void fetchDashboard();
        }}
      />

      {/* Grow Team Modal — sadece patron */}
      <GrowTeamModal
        open={isOwner && growOpen}
        onClose={() => setGrowOpen(false)}
        currentExtraSeats={team.extraSeats}
        onPurchaseIntent={(billingCycle, extraSeats) => {
          setGrowOpen(false);
          setSeatPayment({ billingCycle, extraSeats });
        }}
      />

      {/* Shrink Team Modal — sadece patron */}
      <ShrinkTeamModal
        open={isOwner && shrinkOpen}
        onClose={() => setShrinkOpen(false)}
        currentExtraSeats={team.extraSeats}
        activeMembers={summary.activeMembers}
        accessToken={accessToken}
        onSuccess={() => {
          setShrinkOpen(false);
          void fetchDashboard();
        }}
      />

      {/* Seat Payment Modal */}
      {seatPayment && (
        <PaymentSummaryModal
          open={true}
          planId="BUSINESS"
          billingCycle={seatPayment.billingCycle}
          extraSeats={seatPayment.extraSeats}
          seatsOnly={true}
          accessToken={accessToken}
          language={_language}
          onClose={() => setSeatPayment(null)}
          onPurchaseSuccess={() => {
            setSeatPayment(null);
            void fetchDashboard();
          }}
        />
      )}
    </div>
  );
}
