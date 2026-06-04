import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminBlockedEmails,
  fetchAdminUserDetail,
  fetchAdminUsers,
  patchAdminUser,
  postAdminBlockedEmail,
  deleteAdminBlockedEmail,
  adminResetUserRateLimit,
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
    return { label: "Deneme", className: "bg-slate-500/20 text-slate-200 ring-slate-500/35" };
  }
  return { label: "Aktif", className: "bg-emerald-500/20 text-emerald-200 ring-emerald-500/30" };
}

const PAGE_SIZE = 20;

export function AdminUserManagement({ accessToken, uiMode }: Props) {
  const advanced = uiMode === "advanced";
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [plan, setPlan] = useState<"all" | "FREE" | "PRO" | "BUSINESS">("all");
  const [verified, setVerified] = useState<"all" | "yes" | "no">("all");
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
      const res = await fetchAdminUsers(accessToken, {
        q: qDebounced.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
        sort: "createdAt",
        dir: "desc",
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
  }, [accessToken, qDebounced, page, plan, verified]);

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
        <AdminImpactCard title="Yönetim notu">
          <p>
            Plan, rol ve e-posta doğrulama <strong className="text-slate-100">anında</strong> yürürlüğe girer. Kredi düzenlemesi
            muhasebe izi bırakır. Sil + engel kalıcıdır.
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
            <div className="w-20 shrink-0 text-right">İşlem</div>
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
                  <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:w-auto sm:justify-end">
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${st.className}`}>
                      {st.label}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-400 sm:w-20">{u.plan}</span>
                    <button
                      type="button"
                      onClick={() => void openDetail(u)}
                      className="shrink-0 rounded-lg bg-violet-500/15 px-2.5 py-1.5 text-xs font-semibold text-violet-200 ring-1 ring-violet-500/30 transition hover:bg-violet-500/25"
                      title="Detaylar ve geçmiş"
                    >
                      Detay
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectOpen(u)}
                      className="shrink-0 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/30 transition hover:bg-cyan-500/25"
                    >
                      Yönet
                    </button>
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
        onTabChange={setDetailTab}
        onClose={() => { setDetailUser(null); setDetailData(null); }}
      />
    </div>
  );
}

function UserDetailPanel({
  user,
  detail,
  loading,
  tab,
  onTabChange,
  onClose,
}: {
  user: AdminUserRow | null;
  detail: AdminUserDetail | null;
  loading: boolean;
  tab: "payments" | "tools";
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
  const [resetRateLimitBusy, setResetRateLimitBusy] = useState(false);
  const [resetRateLimitMsg, setResetRateLimitMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setPlan(user.plan);
      setVok(user.isVerified);
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
