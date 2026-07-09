import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminBlockedEmails,
  fetchAdminUserDetail,
  fetchAdminUsers,
  patchAdminUser,
  grantAdminTempPlan,
  postAdminBlockedEmail,
  deleteAdminBlockedEmail,
  adminResetUserRateLimit,
  postAdminGrantBonusOpsToday,
  postAdminSetCustomDailyLimit,
  type AdminUserDetail,
  type AdminUserRow,
  type BlockedEmailRow,
} from "../../api/admin";
import type { AdminUiMode } from "../adminTypes";
import { AdminField, adminInputClass, AdminSection, AdminToggle, AdminImpactCard, AdminMutedBox, ConfirmModal } from "../mosaic/adminPrimitives";
import { AdminToolbar } from "../mosaic/AdminToolbar";
import { EmptyState } from "../mosaic/EmptyState";
import { MotionSlideOver } from "../mosaic/MotionSlideOver";

type Props = { accessToken: string; uiMode: AdminUiMode };

function userInitials(u: AdminUserRow): string {
  const n = (u.name ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()) || u.email;
  const p = n.split(/[\s@._-]+/).filter(Boolean);
  if (p.length >= 2) {
    return (p[0]![0]! + p[1]![0]!).toUpperCase();
  }
  return n.slice(0, 2).toUpperCase();
}

function userStatus(
  u: AdminUserRow,
  blockedSet: Set<string>,
): { label: string; className: string } {
  if (u.role === "ADMIN") {
    return { label: "Yönetici", className: "bg-violet-500/20 text-violet-200 ring-violet-500/35" };
  }
  if (blockedSet.has(u.email.toLowerCase())) {
    return { label: "Kara liste", className: "bg-rose-500/20 text-rose-200 ring-rose-500/35" };
  }
  if (!u.isVerified) {
    return { label: "Onaysız", className: "bg-amber-500/20 text-amber-100 ring-amber-500/35" };
  }
  if (u.plan === "FREE") {
    return { label: "Ücretsiz", className: "bg-slate-500/20 text-slate-200 ring-slate-500/35" };
  }
  // Ücretli abone — planı göster (Pro / Business).
  return { label: u.plan === "BUSINESS" ? "Business" : "Pro", className: "bg-emerald-500/20 text-emerald-200 ring-emerald-500/30" };
}

const PAGE_SIZE = 20;

export function AdminUserManagement({ accessToken, uiMode }: Props) {
  const advanced = uiMode === "advanced";
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [plan, setPlan] = useState<"all" | "FREE" | "PRO" | "BUSINESS">("all");
  const [verified, setVerified] = useState<"all" | "yes" | "no">("all");
  // Sıralama — backend createdAt/email/plan (asc/desc) destekler.
  const [sortKey, setSortKey] = useState<"createdAt-desc" | "createdAt-asc" | "plan-desc" | "email-asc">("createdAt-desc");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<BlockedEmailRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [selectOpen, setSelectOpen] = useState<AdminUserRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDlg, setConfirmDlg] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
    confirmLabel?: string;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [blockEmailInput, setBlockEmailInput] = useState("");
  const [blockReasonInput, setBlockReasonInput] = useState("");
  const [detailUser, setDetailUser] = useState<AdminUserRow | null>(null);
  const [detailData, setDetailData] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"payments" | "tools">("payments");

  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      setQDebounced(q);
      setPage(1);
    }, 380);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [q]);

  const blockedSet = useMemo(
    () => new Set(blocked.map((b) => b.email.toLowerCase())),
    [blocked],
  );

  const loadBlocked = useCallback(async () => {
    try {
      setBlocked(await fetchAdminBlockedEmails(accessToken));
    } catch {
      /* ignore */
    }
  }, [accessToken]);

  const openDetail = useCallback(async (u: AdminUserRow) => {
    setDetailUser(u);
    setDetailData(null);
    setDetailLoading(true);
    setDetailTab("payments");
    try {
      const data = await fetchAdminUserDetail(accessToken, u.id);
      setDetailData(data);
    } catch {
      /* ignore */
    } finally {
      setDetailLoading(false);
    }
  }, [accessToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [sort, dir] = sortKey.split("-") as ["createdAt" | "email" | "plan", "asc" | "desc"];
      const res = await fetchAdminUsers(accessToken, {
        q: qDebounced.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
        sort,
        dir,
        plan: plan === "all" ? "all" : plan,
        verified,
      });
      setRows(res.items);
      setTotal(res.total);
      setSelected(new Set());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İstek başarısız");
    } finally {
      setLoading(false);
    }
  }, [accessToken, qDebounced, page, plan, verified, sortKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadBlocked();
  }, [loadBlocked]);

  const requestDanger = useCallback(
    (opts: { title: string; message: string; confirmLabel?: string; action: () => Promise<void> }) => {
      setConfirmDlg(opts);
    },
    [],
  );

  const pageIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAllPage = () => {
    if (allOnPage) {
      setSelected((s) => {
        const n = new Set(s);
        for (const id of pageIds) n.delete(id);
        return n;
      });
    } else {
      setSelected((s) => {
        const n = new Set(s);
        for (const id of pageIds) n.add(id);
        return n;
      });
    }
  };

  const copySelectedEmails = useCallback(() => {
    const emails = rows.filter((r) => selected.has(r.id)).map((r) => r.email);
    if (emails.length === 0) return;
    void navigator.clipboard.writeText(emails.join(", "));
  }, [rows, selected]);

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={!!confirmDlg}
        title={confirmDlg?.title ?? ""}
        message={confirmDlg?.message ?? ""}
        confirmLabel={confirmDlg?.confirmLabel ?? "Onayla"}
        cancelLabel="Vazgeç"
        variant="danger"
        busy={confirmBusy}
        onClose={() => {
          if (!confirmBusy) setConfirmDlg(null);
        }}
        onConfirm={async () => {
          if (!confirmDlg) return;
          setConfirmBusy(true);
          try {
            await confirmDlg.action();
            setConfirmDlg(null);
          } finally {
            setConfirmBusy(false);
          }
        }}
      />

      {advanced ? (
        <AdminImpactCard title="Dikkat">
          <p>
            Bir kullanıcının planını, rolünü veya e-posta doğrulamasını değiştirdiğinde
            <strong className="text-slate-100"> hemen aktif olur</strong> (beklemeye gerek yok).
            Verdiğin/aldığın krediler kayda geçer. <strong className="text-slate-100">Hesap silme ve engelleme geri alınamaz</strong> — dikkatli ol.
          </p>
        </AdminImpactCard>
      ) : (
        <AdminMutedBox>Kullanıcı satırında <strong className="text-slate-200">Yönet</strong> ile sağ paneli açın; toplu işlem için satırları işaretleyin.</AdminMutedBox>
      )}

      <AdminToolbar
        searchPlaceholder="E-posta, ad ara…"
        searchValue={q}
        onSearchChange={setQ}
        isSearching={q !== qDebounced}
        filters={
          <>
            <select
              className="rounded-lg border border-slate-600/50 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-200"
              value={plan}
              onChange={(e) => {
                setPage(1);
                setPlan(e.target.value as typeof plan);
              }}
            >
              <option value="all">Tüm planlar</option>
              <option value="FREE">FREE</option>
              <option value="PRO">PRO</option>
              <option value="BUSINESS">BUSINESS</option>
            </select>
            <select
              className="rounded-lg border border-slate-600/50 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-200"
              value={verified}
              onChange={(e) => {
                setPage(1);
                setVerified(e.target.value as typeof verified);
              }}
            >
              <option value="all">E-posta: tümü</option>
              <option value="yes">Doğrulanmış</option>
              <option value="no">Doğrulanmamış</option>
            </select>
            <select
              className="rounded-lg border border-slate-600/50 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-200"
              value={sortKey}
              onChange={(e) => {
                setPage(1);
                setSortKey(e.target.value as typeof sortKey);
              }}
              title="Sıralama"
            >
              <option value="createdAt-desc">Kayıt: yeni → eski</option>
              <option value="createdAt-asc">Kayıt: eski → yeni</option>
              <option value="plan-desc">Plana göre (abone önce)</option>
              <option value="email-asc">E-postaya göre (A→Z)</option>
            </select>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/35 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/20"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {createOpen ? "Formu gizle" : "Kullanıcı ekle"}
          </button>
        }
      />

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3">
          <p className="text-sm text-cyan-100">
            <span className="font-bold">{selected.size}</span> kullanıcı seçildi
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copySelectedEmails()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-cyan-100"
            >
              <Mail className="h-3.5 w-3.5" />
              E-postaları kopyala
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-slate-500 underline">
              Seçimi temizle
            </button>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <AdminSection title="Yeni kullanıcı" description="E-posta bu panelde doğrulanmış kabul edilir.">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await createAdminUser(accessToken, {
                  email: newEmail,
                  password: newPassword,
                  firstName: newFirst,
                  lastName: newLast,
                  plan: "FREE",
                  skipEmailVerification: true,
                });
                setNewEmail("");
                setNewPassword("");
                setCreateOpen(false);
                void load();
              } catch (er) {
                setErr(er instanceof Error ? er.message : "Oluşturma başarısız");
              }
            }}
          >
            <AdminField label="E-posta">
              <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={adminInputClass} />
            </AdminField>
            <AdminField label="Şifre">
              <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={adminInputClass} />
            </AdminField>
            <AdminField label="Ad">
              <input value={newFirst} onChange={(e) => setNewFirst(e.target.value)} className={adminInputClass} />
            </AdminField>
            <AdminField label="Soyad">
              <input value={newLast} onChange={(e) => setNewLast(e.target.value)} className={adminInputClass} />
            </AdminField>
            <button type="submit" className="sm:col-span-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white">
              Oluştur
            </button>
          </form>
        </AdminSection>
      ) : null}

      {err ? <p className="text-sm text-rose-300">{err}</p> : null}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : !loading && total === 0 ? (
        <EmptyState
          title="Kullanıcı bulunamadı"
          description="Arama veya filtreleri gevşetin; yeni hesap da oluşturabilirsiniz."
          ctaLabel="Filtreleri sıfırla"
          onCta={() => {
            setQ("");
            setQDebounced("");
            setPlan("all");
            setVerified("all");
            setPage(1);
            void load();
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/20">
          <div className="hidden border-b border-slate-800/50 bg-slate-800/30 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:flex sm:items-center sm:gap-3">
            <div className="w-6 shrink-0">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-600"
                checked={allOnPage}
                onChange={toggleAllPage}
                aria-label="Sayfadakileri seç"
              />
            </div>
            <div className="min-w-0 flex-1">Kullanıcı</div>
            <div className="w-24 shrink-0 hidden lg:block">Konum</div>
            <div className="w-28 shrink-0 hidden xl:block">Kayıt tarihi</div>
            <div className="w-24 shrink-0">Durum</div>
            <div className="w-20 shrink-0">Plan</div>
            <div className="w-[132px] shrink-0 text-right">İşlem</div>
          </div>
          <ul>
            {rows.map((u) => {
              const st = userStatus(u, blockedSet);
              const ownerRow = u.isTeamMember && u.teamOwnerId
                ? rows.find((r) => r.id === u.teamOwnerId)
                : null;
              return (
                <li
                  key={u.id}
                  className={`flex flex-wrap items-center gap-2 border-b border-slate-800/40 px-3 py-3 last:border-0 sm:flex-nowrap sm:gap-3 sm:px-4 ${u.isTeamMember ? "bg-cyan-950/20" : ""}`}
                >
                  <div className="flex w-full shrink-0 items-center gap-2 sm:w-6 sm:flex-col sm:justify-center">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-600"
                      checked={selected.has(u.id)}
                      onChange={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          if (n.has(u.id)) n.delete(u.id);
                          else n.add(u.id);
                          return n;
                        })
                      }
                    />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/25 to-slate-800 text-sm font-bold text-cyan-100 ring-1 ring-white/[0.08] sm:hidden">
                      {userInitials(u)}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/25 to-slate-800 text-sm font-bold text-cyan-100 ring-1 ring-white/[0.08] sm:flex">
                      {userInitials(u)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-slate-100">{u.name || u.firstName || "—"}</p>
                        {u.isTeamMember && (
                          <span className="shrink-0 rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-300 ring-1 ring-cyan-500/25">
                            Ekip Üyesi
                          </span>
                        )}
                      </div>
                      <p className="truncate font-mono text-[11px] text-slate-500">{u.email}</p>
                      {ownerRow && (
                        <p className="truncate text-[10px] text-cyan-600">
                          ↳ {ownerRow.name || ownerRow.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="hidden w-24 shrink-0 flex-col gap-0.5 lg:flex">
                    <span className="truncate text-xs text-slate-300">{u.country ?? "—"}</span>
                    <span className="truncate text-[11px] text-slate-500">{u.city ?? ""}</span>
                  </div>
                  <div className="hidden w-28 shrink-0 xl:block">
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </span>
                  </div>
                  {/* Masaüstü (sm+): header ile birebir hizalı sabit sütunlar */}
                  <div className="hidden w-24 shrink-0 sm:block">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${st.className}`}>{st.label}</span>
                  </div>
                  <div className="hidden w-20 shrink-0 font-mono text-xs text-slate-400 sm:block">{u.plan}</div>
                  <div className="hidden w-[132px] shrink-0 items-center justify-end gap-2 sm:flex">
                    <button type="button" onClick={() => void openDetail(u)} title="Detaylar ve geçmiş"
                      className="shrink-0 rounded-lg bg-violet-500/15 px-2.5 py-1.5 text-xs font-semibold text-violet-200 ring-1 ring-violet-500/30 transition hover:bg-violet-500/25">Detay</button>
                    <button type="button" onClick={() => setSelectOpen(u)}
                      className="shrink-0 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/30 transition hover:bg-cyan-500/25">Yönet</button>
                  </div>
                  {/* Mobil (< sm): hepsi tek satırda */}
                  <div className="flex w-full items-center justify-between gap-2 sm:hidden">
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${st.className}`}>{st.label}</span>
                      <span className="shrink-0 font-mono text-xs text-slate-400">{u.plan}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" onClick={() => void openDetail(u)}
                        className="rounded-lg bg-violet-500/15 px-2.5 py-1.5 text-xs font-semibold text-violet-200 ring-1 ring-violet-500/30">Detay</button>
                      <button type="button" onClick={() => setSelectOpen(u)}
                        className="rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/30">Yönet</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {total} kullanıcı — sayfa {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-700 px-2 py-1 text-xs font-medium disabled:opacity-30"
          >
            ← Önceki
          </button>
          <button
            type="button"
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-700 px-2 py-1 text-xs font-medium disabled:opacity-30"
          >
            Sonraki →
          </button>
        </div>
      </div>

      {advanced ? (
        <AdminSection title="Kara liste" description="Bu adreslerle yeni hesap açılamaz" variant="amber">
          <form
            className="mt-1 flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!blockEmailInput.trim()) return;
              setErr(null);
              try {
                await postAdminBlockedEmail(accessToken, { email: blockEmailInput.trim(), reason: blockReasonInput.trim() || undefined });
                setBlockEmailInput("");
                setBlockReasonInput("");
                await loadBlocked();
              } catch (er) {
                setErr(er instanceof Error ? er.message : "Engel eklenemedi");
              }
            }}
          >
            <AdminField label="E-posta" htmlFor="blk-em">
              <input id="blk-em" type="email" required className={adminInputClass} value={blockEmailInput} onChange={(e) => setBlockEmailInput(e.target.value)} />
            </AdminField>
            <AdminField label="Not" htmlFor="blk-reason">
              <input id="blk-reason" className={adminInputClass} value={blockReasonInput} onChange={(e) => setBlockReasonInput(e.target.value)} />
            </AdminField>
            <button type="submit" className="rounded-xl bg-amber-600/30 px-4 py-2 text-sm font-semibold text-amber-50">
              Ekle
            </button>
          </form>
          <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs">
            {blocked.map((b) => (
              <li key={b.email} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/50 px-2 py-1.5">
                <span className="font-mono text-slate-200">{b.email}</span>
                <button
                  type="button"
                  className="text-rose-300/90"
                  onClick={() => {
                    requestDanger({
                      title: "Kaldır",
                      message: `${b.email} engeli kaldırılacak`,
                      action: async () => {
                        await deleteAdminBlockedEmail(accessToken, b.email);
                        await loadBlocked();
                      },
                    });
                  }}
                >
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
        </AdminSection>
      ) : null}

      <UserManagePanel
        user={selectOpen}
        accessToken={accessToken}
        onClose={() => setSelectOpen(null)}
        onRefresh={() => void load()}
        blockedSet={blockedSet}
        onBlockedChange={() => void loadBlocked()}
        requestDanger={requestDanger}
      />

      <UserDetailPanel
        user={detailUser}
        detail={detailData}
        loading={detailLoading}
        tab={detailTab}
        accessToken={accessToken}
        onTabChange={setDetailTab}
        onClose={() => { setDetailUser(null); setDetailData(null); }}
      />
    </div>
  );
}

type UsageInfo = NonNullable<AdminUserDetail["usage"]>;

function UsageGrantSection({
  accessToken,
  userId,
  usage,
}: {
  accessToken: string;
  userId: string;
  usage: UsageInfo | null;
}) {
  const [bonus, setBonus] = useState(5);
  const [customLimit, setCustomLimit] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<null | "bonus" | "limit" | "clear">(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cur, setCur] = useState<UsageInfo | null>(usage);

  // Detay yüklenince/değişince mevcut durumu eşitle.
  useEffect(() => setCur(usage), [usage]);

  async function run(kind: "bonus" | "limit" | "clear", fn: () => Promise<string>) {
    setBusy(kind);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  const fmtLimit = (n: number | null | undefined) =>
    n === null || n === undefined ? "∞" : String(n);

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/15 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-300/90">
        Günlük kullanım hakkı
      </p>

      {cur ? (
        <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-900/40 px-3 py-2 text-[11px] sm:grid-cols-3">
          <span className="text-slate-500">Plan limiti: <span className="font-semibold text-slate-200">{fmtLimit(cur.planDailyLimit)}</span></span>
          <span className="text-slate-500">Özel limit: <span className={`font-semibold ${cur.customDailyLimit != null ? "text-cyan-200" : "text-slate-400"}`}>{cur.customDailyLimit != null ? cur.customDailyLimit : "—"}</span></span>
          <span className="text-slate-500">Bugünkü bonus: <span className={`font-semibold ${cur.bonusDailyOperations > 0 ? "text-emerald-300" : "text-slate-400"}`}>{cur.bonusDailyOperations > 0 ? `+${cur.bonusDailyOperations}` : "—"}</span></span>
          <span className="text-slate-500">Efektif limit: <span className="font-semibold text-amber-200">{fmtLimit(cur.effectiveDailyLimit)}</span></span>
          <span className="text-slate-500">Bugün kullanılan: <span className="font-semibold text-slate-200">{cur.currentDayOperations}</span></span>
        </div>
      ) : null}

      <AdminField label="İşlem nedeni (opsiyonel, audit log'a yazılır)" htmlFor="usg-reason">
        <input
          id="usg-reason"
          className={adminInputClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="örn. destek talebi / jest"
        />
      </AdminField>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* Bugünlük +N işlem */}
        <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-2.5">
          <p className="mb-1.5 text-[11px] font-medium text-slate-300">Bugün için ekstra işlem</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={10000}
              className={`${adminInputClass} w-20`}
              value={bonus}
              onChange={(e) => setBonus(Math.max(1, Number(e.target.value) || 1))}
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void run("bonus", async () => {
                  const r = await postAdminGrantBonusOpsToday(accessToken, userId, bonus, reason);
                  setCur((p) =>
                    p
                      ? { ...p, bonusDailyOperations: r.bonusAfter, currentDayOperations: r.usedToday, effectiveDailyLimit: r.effectiveDailyLimit }
                      : p,
                  );
                  return `Bugün +${bonus} işlem eklendi. Bugünkü limit: ${r.effectiveDailyLimit ?? "∞"} (kullanılan: ${r.usedToday}).`;
                })
              }
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {busy === "bonus" ? "…" : "Ekle"}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500">Sadece bugün geçerli; gece sıfırlanır.</p>
        </div>

        {/* Kalıcı özel günlük limit */}
        <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-2.5">
          <p className="mb-1.5 text-[11px] font-medium text-slate-300">Kalıcı özel günlük limit</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100000}
              className={`${adminInputClass} w-20`}
              value={customLimit}
              onChange={(e) => setCustomLimit(e.target.value)}
              placeholder="örn. 10"
            />
            <button
              type="button"
              disabled={busy !== null || customLimit.trim() === ""}
              onClick={() =>
                void run("limit", async () => {
                  const lim = Math.max(0, Number(customLimit) || 0);
                  const r = await postAdminSetCustomDailyLimit(accessToken, userId, lim, reason);
                  setCur((p) => ({
                    planDailyLimit: r.planDailyLimit,
                    customDailyLimit: r.customDailyLimit,
                    bonusDailyOperations: p?.bonusDailyOperations ?? 0,
                    currentDayOperations: r.usedToday,
                    effectiveDailyLimit: r.effectiveDailyLimit,
                  }));
                  return `Özel günlük limit ${lim} olarak ayarlandı (efektif: ${r.effectiveDailyLimit ?? "∞"}).`;
                })
              }
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50"
            >
              {busy === "limit" ? "…" : "Kaydet"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void run("clear", async () => {
                  const r = await postAdminSetCustomDailyLimit(accessToken, userId, null, reason);
                  setCustomLimit("");
                  setCur((p) => ({
                    planDailyLimit: r.planDailyLimit,
                    customDailyLimit: r.customDailyLimit,
                    bonusDailyOperations: p?.bonusDailyOperations ?? 0,
                    currentDayOperations: r.usedToday,
                    effectiveDailyLimit: r.effectiveDailyLimit,
                  }));
                  return "Özel limit kaldırıldı; kullanıcı plan limitine döndü.";
                })
              }
              className="rounded-lg border border-slate-600/50 bg-slate-800/60 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700/60 disabled:opacity-50"
            >
              {busy === "clear" ? "…" : "Kaldır"}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500">Plan limitini ezer; her gün geçerli.</p>
        </div>
      </div>

      {msg ? (
        <p className={`mt-2.5 text-xs ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>{msg.text}</p>
      ) : null}
    </div>
  );
}

function UserDetailPanel({
  user,
  detail,
  loading,
  tab,
  accessToken,
  onTabChange,
  onClose,
}: {
  user: AdminUserRow | null;
  detail: AdminUserDetail | null;
  loading: boolean;
  tab: "payments" | "tools";
  accessToken: string;
  onTabChange: (t: "payments" | "tools") => void;
  onClose: () => void;
}) {
  const fmtDate = (s: string) =>
    new Date(s).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });

  return (
    <MotionSlideOver
      open={user !== null}
      onClose={onClose}
      title={user ? user.email : ""}
      description={user ? `${user.plan} · ${user.email}` : undefined}
      widthClassName="max-w-lg"
    >
      {user ? (
        <div className="flex flex-col gap-4">
          {/* Günlük kota sistemi kaldırıldı (araçlar sınırsız) — eski UsageGrantSection çıkarıldı. */}

          <div className="flex gap-1 rounded-xl bg-slate-900/60 p-1">
            {(["payments", "tools"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTabChange(t)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                  tab === t
                    ? "bg-slate-700 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t === "payments" ? "Ödemeler" : "Araç Kullanımı"}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Yükleniyor…</p>
          ) : !detail ? (
            <p className="py-8 text-center text-sm text-slate-500">Veri yüklenemedi.</p>
          ) : tab === "payments" ? (
            <div className="space-y-3">
              {detail.paymentCheckouts.length === 0 && detail.creditPackCheckouts.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Ödeme kaydı yok.</p>
              ) : (
                <>
                  {detail.paymentCheckouts.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Abonelik Ödemeleri</p>
                      <div className="overflow-x-auto rounded-xl border border-slate-800/60">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-left text-slate-500">
                              <th className="px-3 py-2">Tarih</th>
                              <th className="px-3 py-2">Plan</th>
                              <th className="px-3 py-2 text-right">Tutar</th>
                              <th className="px-3 py-2">Durum</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.paymentCheckouts.map((p) => (
                              <tr key={p.id} className="border-b border-slate-800/40 last:border-0">
                                <td className="px-3 py-2 font-mono text-slate-400">{fmtDate(p.createdAt)}</td>
                                <td className="px-3 py-2 font-medium text-cyan-200">{p.plan}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-200">{p.priceTry} {p.paymentCurrency}</td>
                                <td className={`px-3 py-2 font-semibold ${p.status === "completed" ? "text-emerald-300" : p.status === "pending" ? "text-amber-300" : "text-rose-300"}`}>
                                  {p.status}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {detail.creditPackCheckouts.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Kredi Paketi Ödemeleri</p>
                      <div className="overflow-x-auto rounded-xl border border-slate-800/60">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-left text-slate-500">
                              <th className="px-3 py-2">Tarih</th>
                              <th className="px-3 py-2">Paket</th>
                              <th className="px-3 py-2">Kredi</th>
                              <th className="px-3 py-2 text-right">Tutar</th>
                              <th className="px-3 py-2">Durum</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.creditPackCheckouts.map((c) => (
                              <tr key={c.id} className="border-b border-slate-800/40 last:border-0">
                                <td className="px-3 py-2 font-mono text-slate-400">{fmtDate(c.createdAt)}</td>
                                <td className="px-3 py-2 text-slate-200">{c.product}</td>
                                <td className="px-3 py-2 font-bold tabular-nums text-amber-200">{c.credits}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-200">{c.finalPriceTry} {c.paymentCurrency}</td>
                                <td className={`px-3 py-2 font-semibold ${c.status === "completed" ? "text-emerald-300" : c.status === "pending" ? "text-amber-300" : "text-rose-300"}`}>
                                  {c.status}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {Object.keys(detail.toolUsageCounts).length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Araç kullanım kaydı yok.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800/60">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-left text-slate-500">
                        <th className="px-3 py-2">Araç</th>
                        <th className="px-3 py-2 text-right">Kullanım</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(detail.toolUsageCounts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([toolId, count]) => (
                          <tr key={toolId} className="border-b border-slate-800/40 last:border-0">
                            <td className="px-3 py-2 font-mono text-slate-300">{toolId}</td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums text-cyan-200">{count}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </MotionSlideOver>
  );
}

function UserManagePanel({
  user,
  accessToken,
  onClose,
  onRefresh,
  blockedSet,
  onBlockedChange,
  requestDanger,
}: {
  user: AdminUserRow | null;
  accessToken: string;
  onClose: () => void;
  onRefresh: () => void;
  blockedSet: Set<string>;
  onBlockedChange: () => void;
  requestDanger: (o: { title: string; message: string; confirmLabel?: string; action: () => Promise<void> }) => void;
}) {
  const [plan, setPlan] = useState(user?.plan ?? "FREE");
  const [saving, setSaving] = useState(false);
  const [vOk, setVok] = useState(user?.isVerified ?? true);
  const [tempPlan, setTempPlan] = useState<"PRO" | "BUSINESS">("PRO");
  const [tempDays, setTempDays] = useState(3);
  const [tempBusy, setTempBusy] = useState(false);
  const [tempMsg, setTempMsg] = useState<string | null>(null);
  const [resetRateLimitBusy, setResetRateLimitBusy] = useState(false);
  const [resetRateLimitMsg, setResetRateLimitMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setPlan(user.plan);
      setVok(user.isVerified);
      setTempMsg(null);
    }
  }, [user]);

  const st = user ? userStatus(user, blockedSet) : { label: "", className: "" };

  return (
    <MotionSlideOver
      open={user !== null}
      onClose={onClose}
      title={user ? user.email : ""}
      description={user ? `${st.label} · ${user.plan}` : undefined}
      widthClassName="max-w-md"
    >
      {user ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-slate-800 text-lg font-bold text-cyan-50 ring-1 ring-white/[0.08]">
              {userInitials(user)}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{user.name || "İsimsiz"}</p>
              <p className="text-xs text-slate-500">{user.authProvider} · {user.preferredLanguage}</p>
            </div>
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${st.className}`}>
              {st.label}
            </span>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800/50 bg-slate-800/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Erişim</p>
            <AdminField label="Plan">
              <select
                className={adminInputClass}
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
              >
                <option value="FREE">FREE</option>
                <option value="PRO">PRO</option>
                <option value="BUSINESS">BUSINESS</option>
              </select>
            </AdminField>
            <AdminToggle
              id="uv"
              label="E-posta doğrulandı"
              checked={vOk}
              onChange={setVok}
            />
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await patchAdminUser(accessToken, user.id, {
                    plan: plan as "FREE" | "PRO" | "BUSINESS",
                    isVerified: vOk,
                  });
                  onRefresh();
                } catch (e) {
                  window.alert(e instanceof Error ? e.message : "Kayıt hatası");
                } finally {
                  setSaving(false);
                }
              }}
              className="w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white"
            >
              {saving ? "…" : "Değişiklikleri kaydet"}
            </button>
          </div>

          {/* Süreli (geçici) plan — N gün sonra mevcut plana döner */}
          <div className="space-y-3 rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.05] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300/80">Süreli (geçici) plan</p>
            {user.overrideExpiresAt && new Date(user.overrideExpiresAt).getTime() > Date.now() ? (
              <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-[12px] text-fuchsia-100">
                <span className="font-bold">Aktif:</span> {user.plan} planı{" "}
                <span className="font-semibold">{new Date(user.overrideExpiresAt).toLocaleString("tr-TR")}</span>{" "}
                tarihinde bitiyor → sonra <span className="font-semibold">{user.basePlan ?? "FREE"}</span> planına döner.
              </div>
            ) : null}
            <p className="text-[11px] leading-snug text-slate-400">
              N günlük plan tanımla; süre bitince kullanıcı önceki planına döner. Mevcut aboneliğinin süresi bu süreçte <span className="text-slate-300">durmaz</span>.
            </p>
            <div className="flex gap-2">
              <AdminField label="Plan">
                <select
                  className={adminInputClass}
                  value={tempPlan}
                  onChange={(e) => setTempPlan(e.target.value as "PRO" | "BUSINESS")}
                >
                  <option value="PRO">PRO</option>
                  <option value="BUSINESS">BUSINESS</option>
                </select>
              </AdminField>
              <AdminField label="Gün">
                <input
                  type="number"
                  min={1}
                  max={365}
                  className={adminInputClass}
                  value={tempDays}
                  onChange={(e) => setTempDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                />
              </AdminField>
            </div>
            <button
              type="button"
              disabled={tempBusy}
              onClick={async () => {
                setTempBusy(true);
                setTempMsg(null);
                try {
                  const res = await grantAdminTempPlan(accessToken, user.id, tempPlan, tempDays);
                  const until = new Date(res.overrideExpiresAt).toLocaleString();
                  setTempMsg(`${tempPlan} · ${tempDays} gün tanımlandı — ${until} tarihine kadar; sonra ${res.basePlan} planına döner.`);
                  onRefresh();
                } catch (e) {
                  setTempMsg(e instanceof Error ? e.message : "Hata");
                } finally {
                  setTempBusy(false);
                }
              }}
              className="w-full rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/15 py-2.5 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25 disabled:opacity-50"
            >
              {tempBusy ? "…" : `${tempDays} günlük ${tempPlan} tanımla`}
            </button>
            {tempMsg ? <p className="text-[11px] leading-snug text-fuchsia-200/90">{tempMsg}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="rounded-xl border border-slate-800/50 bg-slate-800/20 p-3">
              <p className="text-slate-500">Bugünkü işlem</p>
              <p className="mt-1 font-semibold text-slate-200">{user.usageToday ? `${user.usageToday.operationsCount} işlem` : "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-800/50 bg-slate-800/20 p-3">
              <p className="text-slate-500">Konum</p>
              <p className="mt-1 font-semibold text-slate-200">{[user.city, user.country].filter(Boolean).join(", ") || "—"}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-800 pt-4">
            {/* Rate Limit Reset */}
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                disabled={resetRateLimitBusy}
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                onClick={async () => {
                  setResetRateLimitBusy(true);
                  setResetRateLimitMsg(null);
                  try {
                    const result = await adminResetUserRateLimit(accessToken, user.id);
                    setResetRateLimitMsg(result.note || result.message);
                  } catch (e) {
                    setResetRateLimitMsg(e instanceof Error ? e.message : "Hata oluştu");
                  } finally {
                    setResetRateLimitBusy(false);
                  }
                }}
              >
                {resetRateLimitBusy ? "…" : "🚫 Rate Limit Sıfırla"}
              </button>
              {resetRateLimitMsg && (
                <p className="text-[11px] text-amber-200/80">{resetRateLimitMsg}</p>
              )}
            </div>

            <button
              type="button"
              className="rounded-lg border border-slate-600 py-2 text-sm text-slate-300"
              onClick={() =>
                requestDanger({
                  title: "Kullanıcıyı sil",
                  message: `${user.email} silinecek`,
                  confirmLabel: "Sil",
                  action: async () => {
                    await deleteAdminUser(accessToken, user.id, false);
                    onClose();
                    onRefresh();
                  },
                })
              }
            >
              Hesabı sil
            </button>
            <button
              type="button"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 py-2 text-sm font-medium text-rose-200"
              onClick={() =>
                requestDanger({
                  title: "Sil + engelle",
                  message: "Hesap silinir, e-posta kara listeye alınır",
                  confirmLabel: "Sil ve engelle",
                  action: async () => {
                    await deleteAdminUser(accessToken, user.id, true);
                    onBlockedChange();
                    onClose();
                    onRefresh();
                  },
                })
              }
            >
              Sil ve engelle
            </button>
          </div>
        </div>
      ) : null}
    </MotionSlideOver>
  );
}
