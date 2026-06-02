import { useState } from "react";
import { getSaasApiBase } from "../../api/saasBase";

type Props = {
  open: boolean;
  onClose: () => void;
  accessToken: string;
  onSuccess: () => void;
};

export function InviteMemberModal({ open, onClose, accessToken, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getSaasApiBase()}/api/team/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        if (res.status === 402) throw new Error("Tüm koltuklar doldu. Yeni koltuk ekleyerek devam edebilirsiniz.");
        throw new Error(data.message ?? "Davet gönderilemedi.");
      }
      setEmail("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0f172a] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Ekip Üyesi Davet Et</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="mb-5 text-sm text-slate-400">
          Davet bağlantısı girilen e-posta adresine gönderilecektir.
        </p>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <label className="mb-1 block text-sm font-medium text-slate-300">E-posta adresi</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="ornek@sirket.com"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
          />
          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.04]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 py-2.5 text-sm font-bold text-white disabled:opacity-60 hover:from-cyan-500 hover:to-sky-500"
            >
              {loading ? "Gönderiliyor..." : "Daveti Gönder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
